"""Quick test for the agent streaming pipeline."""
import asyncio
import json

async def test():
    from app.chat.agent import stream_agent_response
    events = []
    async for event in stream_agent_response("test-user", "test-session", "Hello, how are you?", []):
        etype = event["event"]
        data = json.dumps(event["data"], ensure_ascii=False)[:200]
        print(f"  {etype}: {data}")
        events.append(event)
    print(f"\nTotal events: {len(events)}")
    # Check the done event
    done_events = [e for e in events if e["event"] == "done"]
    if done_events:
        full = done_events[0]["data"].get("fullResponse", "")
        print(f"Full response length: {len(full)}")
        print(f"Full response preview: {full[:300]}")
    else:
        print("WARNING: No 'done' event received!")

asyncio.run(test())
