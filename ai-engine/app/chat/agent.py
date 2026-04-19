"""Agentic chat loop with OpenAI-compatible streaming and tool calling.

Uses the OpenAI Python SDK pointed at Groq's API for free inference.
Implements a multi-step agent that:
1. Sends the conversation to the LLM with tool schemas
2. If the model calls tools → executes them, appends results, re-sends
3. Streams content tokens as SSE events
4. Injects long-term memory from FAISS before the first call
"""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncGenerator

import tiktoken
from openai import AsyncOpenAI, RateLimitError

from .config import chat_config
from .memory import get_user_memory
from .models import ChatMessage
from .tools import TOOL_SCHEMAS, execute_tool

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Token counting
# ---------------------------------------------------------------------------

_encoder: tiktoken.Encoding | None = None


def _get_encoder() -> tiktoken.Encoding:
    global _encoder
    if _encoder is None:
        try:
            _encoder = tiktoken.encoding_for_model("gpt-4o")
        except Exception:
            _encoder = tiktoken.get_encoding("cl100k_base")
    return _encoder


def _count_tokens(text: str) -> int:
    return len(_get_encoder().encode(text))


def _count_messages_tokens(messages: list[dict]) -> int:
    total = 0
    for msg in messages:
        total += 4  # message overhead
        for key, value in msg.items():
            if isinstance(value, str):
                total += _count_tokens(value)
            elif isinstance(value, list):
                total += _count_tokens(json.dumps(value))
    return total


def _trim_messages(
    messages: list[dict], max_tokens: int, system_msg: dict | None = None
) -> list[dict]:
    """Trim oldest messages (keeping system) to fit within token budget."""
    if system_msg:
        non_system = [m for m in messages if m["role"] != "system"]
    else:
        non_system = messages[:]

    while _count_messages_tokens(non_system) > max_tokens and len(non_system) > 2:
        non_system.pop(0)

    if system_msg:
        return [system_msg] + non_system
    return non_system


# ---------------------------------------------------------------------------
# Client factory
# ---------------------------------------------------------------------------

def _get_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=chat_config.GROQ_API_KEY,
        base_url=chat_config.GROQ_BASE_URL,
    )


# ---------------------------------------------------------------------------
# Build messages array
# ---------------------------------------------------------------------------

def _build_messages(
    system_prompt: str,
    conversation_history: list[ChatMessage],
    user_message: str,
) -> list[dict]:
    """Assemble the messages list for the OpenAI-compatible API."""
    messages: list[dict] = [{"role": "system", "content": system_prompt}]

    for msg in conversation_history[-chat_config.SHORT_TERM_TURNS:]:
        if msg.role in ("system",):
            continue
        if msg.role in ("user", "assistant", "tool") and msg.content:
            messages.append({"role": msg.role, "content": msg.content})

    messages.append({"role": "user", "content": user_message})
    return messages


def _build_system_prompt(memory_context: str | None = None) -> str:
    """Build full system prompt with optional memory injection."""
    full_system = chat_config.SYSTEM_PROMPT
    if memory_context:
        full_system += (
            "\n\n## Relevant Memories from Past Conversations\n" + memory_context
        )
    return full_system


# ---------------------------------------------------------------------------
# Streaming agent loop
# ---------------------------------------------------------------------------

async def stream_agent_response(
    user_id: str,
    session_id: str,
    message: str,
    conversation_history: list[ChatMessage],
) -> AsyncGenerator[dict[str, Any], None]:
    """Yield SSE event dicts: token, tool_start, tool_result, done, error."""

    client = _get_client()
    tools_invoked: list[str] = []
    total_tokens = 0

    # ---- Retrieve long-term memories ------------------------------------
    memory_context = None
    try:
        mem_store = get_user_memory(user_id)
        memories = mem_store.search(message)
        if memories:
            memory_context = "\n".join(f"- {m['text']}" for m in memories)
    except Exception:
        logger.warning("Memory retrieval failed for user %s", user_id, exc_info=True)

    # ---- Build messages --------------------------------------------------
    system_prompt = _build_system_prompt(memory_context)
    messages = _build_messages(system_prompt, conversation_history, message)

    # Trim to fit context window (leave room for response)
    max_input = chat_config.CONTEXT_WINDOW_TOKENS - chat_config.MAX_TOKENS
    system_msg = messages[0]
    messages = _trim_messages(messages, max_input, system_msg)

    # ---- Agent loop (tool calling may require multiple rounds) -----------
    max_iterations = 10
    full_response = ""
    current_model = chat_config.GROQ_MODEL

    for iteration in range(max_iterations):
        try:
            stream = await client.chat.completions.create(
                model=current_model,
                messages=messages,
                tools=TOOL_SCHEMAS,
                tool_choice="auto",
                max_tokens=chat_config.MAX_TOKENS,
                temperature=0.7,
                stream=True,
            )
        except RateLimitError as e:
            # Try fallback models on 429
            fallback_ok = False
            for fb_model in chat_config.FALLBACK_MODELS:
                if fb_model == current_model:
                    continue
                logger.warning("Rate limited on %s, falling back to %s", current_model, fb_model)
                try:
                    current_model = fb_model
                    stream = await client.chat.completions.create(
                        model=current_model,
                        messages=messages,
                        tools=TOOL_SCHEMAS,
                        tool_choice="auto",
                        max_tokens=chat_config.MAX_TOKENS,
                        temperature=0.7,
                        stream=True,
                    )
                    fallback_ok = True
                    break
                except RateLimitError:
                    continue
                except Exception:
                    continue
            if not fallback_ok:
                logger.error("All models rate limited: %s", e)
                yield {"event": "error", "data": {"message": "All models are currently rate limited. Please try again later."}}
                return
        except Exception as e:
            logger.error("LLM API error: %s", e, exc_info=True)
            yield {"event": "error", "data": {"message": f"LLM error: {e}"}}
            return

        # Collect streaming response
        collected_content = ""
        collected_tool_calls: dict[int, dict] = {}  # index → {id, name, arguments}

        try:
            async for chunk in stream:
                if not chunk.choices:
                    continue

                delta = chunk.choices[0].delta

                # Text tokens
                if delta.content:
                    collected_content += delta.content
                    yield {"event": "token", "data": {"content": delta.content}}

                # Tool calls (streamed incrementally)
                if delta.tool_calls:
                    for tc in delta.tool_calls:
                        idx = tc.index
                        if idx not in collected_tool_calls:
                            collected_tool_calls[idx] = {
                                "id": tc.id or "",
                                "name": "",
                                "arguments": "",
                            }
                        if tc.id:
                            collected_tool_calls[idx]["id"] = tc.id
                        if tc.function and tc.function.name:
                            collected_tool_calls[idx]["name"] += tc.function.name
                        if tc.function and tc.function.arguments:
                            collected_tool_calls[idx]["arguments"] += tc.function.arguments

                # Usage (typically on last chunk)
                if chunk.usage:
                    total_tokens = chunk.usage.total_tokens or 0
        except Exception as e:
            err_msg = str(e)
            # Groq raises APIError with "Failed to call a function" when the
            # model produces a malformed tool call. Retry without tools.
            if "failed_generation" in err_msg.lower() or "failed to call a function" in err_msg.lower():
                logger.warning("Groq function-call failure, retrying without tools: %s", err_msg)
                try:
                    retry_stream = await client.chat.completions.create(
                        model=current_model,
                        messages=messages,
                        max_tokens=chat_config.MAX_TOKENS,
                        temperature=0.7,
                        stream=True,
                    )
                    async for chunk in retry_stream:
                        if not chunk.choices:
                            continue
                        delta = chunk.choices[0].delta
                        if delta.content:
                            collected_content += delta.content
                            yield {"event": "token", "data": {"content": delta.content}}
                        if chunk.usage:
                            total_tokens = chunk.usage.total_tokens or 0
                    full_response += collected_content
                    break
                except Exception as retry_err:
                    logger.error("Retry also failed: %s", retry_err, exc_info=True)
                    yield {"event": "error", "data": {"message": f"LLM error: {retry_err}"}}
                    return
            elif "tool call validation" in err_msg.lower() and collected_tool_calls:
                # Groq validated tool-call args against our schema and found
                # type mismatches (e.g. string instead of integer).  The tool
                # call data was already collected during streaming — fall
                # through to the tool-execution section where coercion in
                # the executor will handle the type conversion.
                logger.warning("Tool call validation failed, will coerce args: %s", err_msg)
            else:
                logger.error("Streaming error: %s", e, exc_info=True)
                yield {"event": "error", "data": {"message": f"Streaming error: {e}"}}
                return

        # If we got content with no tool calls, we're done
        if collected_content and not collected_tool_calls:
            full_response += collected_content
            break

        # If no tool calls and no content, we're done
        if not collected_tool_calls:
            full_response += collected_content
            break

        # ---- Execute tool calls ------------------------------------------
        full_response += collected_content

        # Build assistant message with tool_calls
        tool_calls_list = []
        for idx in sorted(collected_tool_calls.keys()):
            tc = collected_tool_calls[idx]
            tool_calls_list.append({
                "id": tc["id"],
                "type": "function",
                "function": {
                    "name": tc["name"],
                    "arguments": tc["arguments"],
                },
            })

        assistant_msg: dict[str, Any] = {"role": "assistant", "content": collected_content or None}
        if tool_calls_list:
            assistant_msg["tool_calls"] = tool_calls_list
        messages.append(assistant_msg)

        # Execute each tool call
        for tc_entry in tool_calls_list:
            tool_name = tc_entry["function"]["name"]
            try:
                tool_args = json.loads(tc_entry["function"]["arguments"])
            except json.JSONDecodeError:
                tool_args = {}

            tools_invoked.append(tool_name)
            yield {
                "event": "tool_start",
                "data": {"tool": tool_name, "args": tool_args},
            }

            tool_result = await execute_tool(tool_name, tool_args)

            # Truncate very long tool results
            if len(tool_result) > 4000:
                tool_result = tool_result[:4000] + "\n… (truncated)"

            yield {
                "event": "tool_result",
                "data": {"tool": tool_name, "result": tool_result[:500]},
            }

            # Append tool response message
            messages.append({
                "role": "tool",
                "tool_call_id": tc_entry["id"],
                "content": tool_result,
            })

        # Continue loop — model will process tool results and respond

    # ---- Store memory (summarise conversation if enough turns) -----------
    try:
        if full_response and user_id != "anonymous":
            summary = f"User asked: {message[:200]}\nAssistant responded about: {full_response[:300]}"
            mem_store = get_user_memory(user_id)
            mem_store.store(summary, {"session_id": session_id})
    except Exception:
        logger.warning("Memory storage failed for user %s", user_id, exc_info=True)

    # ---- Done event ------------------------------------------------------
    yield {
        "event": "done",
        "data": {
            "fullResponse": full_response,
            "tokensUsed": total_tokens,
            "toolsInvoked": tools_invoked,
        },
    }


# ---------------------------------------------------------------------------
# Non-streaming convenience wrapper
# ---------------------------------------------------------------------------

async def get_agent_response(
    user_id: str,
    session_id: str,
    message: str,
    conversation_history: list[ChatMessage],
) -> dict[str, Any]:
    """Run the agent loop and collect the full response (non-streaming)."""
    full_response = ""
    tokens_used = 0
    tools_invoked: list[str] = []

    async for event in stream_agent_response(user_id, session_id, message, conversation_history):
        etype = event["event"]
        if etype == "token":
            full_response += event["data"]["content"]
        elif etype == "done":
            full_response = event["data"]["fullResponse"]
            tokens_used = event["data"]["tokensUsed"]
            tools_invoked = event["data"]["toolsInvoked"]
        elif etype == "error":
            raise RuntimeError(event["data"]["message"])

    return {
        "sessionId": session_id,
        "reply": full_response,
        "tokensUsed": tokens_used,
        "toolsInvoked": tools_invoked,
    }
