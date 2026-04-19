"""Pydantic models for the open-chat subsystem."""

from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Any, Optional


class ChatMessage(BaseModel):
    role: str = Field(..., description="One of: system, user, assistant, tool")
    content: Optional[str] = None
    name: Optional[str] = None
    tool_call_id: Optional[str] = None
    tool_calls: Optional[list[dict[str, Any]]] = None


class ChatRequest(BaseModel):
    session_id: str = Field(..., alias="sessionId")
    user_id: str = Field("anonymous", alias="userId")
    message: str
    conversation_history: list[ChatMessage] = Field(default_factory=list, alias="conversationHistory")

    model_config = {"populate_by_name": True}


class ChatResponse(BaseModel):
    session_id: str = Field(..., alias="sessionId")
    reply: str
    tokens_used: int = Field(0, alias="tokensUsed")
    tools_invoked: list[str] = Field(default_factory=list, alias="toolsInvoked")

    model_config = {"populate_by_name": True}
