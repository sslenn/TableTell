"""
API endpoints for TableTell Floating AI Assistant (REST and SSE streaming).
"""

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from sse_starlette.sse import EventSourceResponse
from app.services.assistant_service import assistant_service

router = APIRouter(prefix="/assistant", tags=["AI Copilot & Assistant"])


class AssistantChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000, description="User question about TableTell or data concepts")
    conversation_id: Optional[str] = Field(None, description="Optional conversation thread ID")


@router.post("/chat")
async def chat_with_assistant(req: AssistantChatRequest) -> Dict[str, Any]:
    """Returns a direct synchronous markdown response from the TableTell Copilot."""
    try:
        res = assistant_service.ask_assistant(query=req.query, conversation_id=req.conversation_id)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Assistant error: {str(e)}")


@router.post("/chat/stream")
async def stream_assistant_chat(req: AssistantChatRequest, request: Request):
    """Server-Sent Events (SSE) streaming endpoint for real-time word-by-word token delivery."""
    try:
        return EventSourceResponse(
            assistant_service.stream_assistant(query=req.query, conversation_id=req.conversation_id)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Streaming error: {str(e)}")


@router.get("/history")
async def get_assistant_history(conversation_id: Optional[str] = Query(None)) -> Dict[str, Any]:
    """Retrieves conversation message history for the active thread."""
    try:
        messages = assistant_service.get_history(conversation_id=conversation_id)
        return {"status": "success", "messages": messages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")


@router.delete("/history")
async def clear_assistant_history(conversation_id: Optional[str] = Query(None)) -> Dict[str, Any]:
    """Clears all conversation messages in the thread."""
    try:
        assistant_service.clear_history(conversation_id=conversation_id)
        return {"status": "success", "message": "Assistant history cleared."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear history: {str(e)}")
