"""
API endpoints for TableTell Floating AI Assistant (REST and SSE streaming).
Enriched with contextual awareness (active tab, selected dataset, health score, active columns).
"""

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from sse_starlette.sse import EventSourceResponse
from app.services.assistant_service import assistant_service

router = APIRouter(prefix="/assistant", tags=["AI Copilot & Assistant"])


class AssistantContext(BaseModel):
    current_tab: Optional[str] = Field(None, description="Active UI tab ('studio', 'datasets', 'audit', 'telemetry')")
    dataset_id: Optional[str] = Field(None, description="Selected dataset identifier")
    dataset_name: Optional[str] = Field(None, description="Display name of active dataset")
    health_score: Optional[float] = Field(None, description="Calculated 100-point health score")
    total_rows: Optional[int] = Field(None, description="Total rows in dataset")
    columns: Optional[List[str]] = Field(None, description="Active or available column names")
    audit_summary: Optional[Dict[str, Any]] = Field(None, description="Summary of quality audit if available")


class AssistantChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000, description="User question about TableTell or data concepts")
    conversation_id: Optional[str] = Field(None, description="Optional conversation thread ID")
    context: Optional[AssistantContext] = Field(None, description="Active user session and dataset context")


@router.post("/chat")
async def chat_with_assistant(req: AssistantChatRequest) -> Dict[str, Any]:
    """Returns a direct synchronous markdown response from the TableTell Copilot with contextual awareness."""
    try:
        context_dict = req.context.model_dump(exclude_none=True) if req.context else None
        res = assistant_service.ask_assistant(
            query=req.query,
            conversation_id=req.conversation_id,
            context=context_dict
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Assistant error: {str(e)}")


@router.post("/chat/stream")
async def stream_assistant_chat(req: AssistantChatRequest, request: Request):
    """Server-Sent Events (SSE) streaming endpoint for real-time word-by-word token delivery."""
    try:
        context_dict = req.context.model_dump(exclude_none=True) if req.context else None
        return EventSourceResponse(
            assistant_service.stream_assistant(
                query=req.query,
                conversation_id=req.conversation_id,
                context=context_dict
            )
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
