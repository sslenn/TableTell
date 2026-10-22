"""
API endpoints for LangGraph Agent Chat (Synchronous and SSE Streaming).
"""

import json
import asyncio
from fastapi import APIRouter, HTTPException, Request
from sse_starlette.sse import EventSourceResponse
from app.agent.graph import tabletell_agent
from app.services.quality_service import quality_service
from app.schemas.analytics import ChatRequest

router = APIRouter(prefix="/chat", tags=["Agent Chat & Analysis"])


@router.post("")
async def chat_endpoint(req: ChatRequest):
    """Standard synchronous chat endpoint returning complete analytical payload."""
    try:
        schema_digest = quality_service.get_schema_digest(req.dataset_id, version=req.version)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Dataset error: {str(e)}")

    initial_state = {
        "dataset_id": req.dataset_id,
        "version": req.version,
        "user_query": req.query,
        "schema_digest": schema_digest,
        "generated_sql": None,
        "execution_result": None,
        "retry_count": 0,
        "max_retries": req.max_retries,
        "self_healed": False,
        "plotly_spec": None,
        "summary_markdown": None,
        "error": None,
        "status": "planning",
        "history": [],
        "run_id": None
    }

    try:
        final_state = tabletell_agent.invoke(initial_state)
        exec_res = final_state.get("execution_result") or {}

        return {
            "status": "success",
            "summary": final_state.get("summary_markdown"),
            "sql": final_state.get("generated_sql"),
            "plotly_spec": final_state.get("plotly_spec"),
            "table": {
                "columns": exec_res.get("columns", []),
                "rows": exec_res.get("rows", []),
                "row_count": exec_res.get("row_count", 0),
                "duration_ms": exec_res.get("duration_ms", 0)
            },
            "self_healed": final_state.get("self_healed", False),
            "retries": final_state.get("retry_count", 0),
            "dataset_id": req.dataset_id,
            "version": req.version or 1,
            "run_id": final_state.get("run_id")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent workflow error: {str(e)}")


@router.post("/stream")
async def chat_stream_endpoint(req: ChatRequest, request: Request):
    """
    Server-Sent Events (SSE) streaming endpoint.
    Emits real-time progression events (planning -> executing -> self-healing -> complete).
    """
    try:
        schema_digest = quality_service.get_schema_digest(req.dataset_id, version=req.version)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Dataset error: {str(e)}")

    initial_state = {
        "dataset_id": req.dataset_id,
        "version": req.version,
        "user_query": req.query,
        "schema_digest": schema_digest,
        "generated_sql": None,
        "execution_result": None,
        "retry_count": 0,
        "max_retries": req.max_retries,
        "self_healed": False,
        "plotly_spec": None,
        "summary_markdown": None,
        "error": None,
        "status": "planning",
        "history": [],
        "run_id": None
    }

    async def event_generator():
        yield {
            "event": "status",
            "data": json.dumps({"step": "planning", "message": "Analyzing schema & generating DuckDB SQL..."})
        }
        await asyncio.sleep(0.05)

        try:
            final_state = initial_state
            for step_state in tabletell_agent.stream(initial_state):
                for node_name, node_output in step_state.items():
                    if node_name == "generate_sql":
                        yield {
                            "event": "sql",
                            "data": json.dumps({"sql": node_output.get("generated_sql")})
                        }
                    elif node_name == "self_heal":
                        yield {
                            "event": "self_heal",
                            "data": json.dumps({
                                "message": "Interpreting error traceback and auto-repairing SQL...",
                                "repaired_sql": node_output.get("generated_sql"),
                                "retry_count": node_output.get("retry_count")
                            })
                        }
                    elif node_name == "execute_sql":
                        yield {
                            "event": "status",
                            "data": json.dumps({"step": "executing", "message": "Running query on DuckDB engine..."})
                        }
                    final_state = {**final_state, **node_output}
                await asyncio.sleep(0.03)

            exec_res = final_state.get("execution_result") or {}
            payload = {
                "status": "success",
                "summary": final_state.get("summary_markdown"),
                "sql": final_state.get("generated_sql"),
                "plotly_spec": final_state.get("plotly_spec"),
                "table": {
                    "columns": exec_res.get("columns", []),
                    "rows": exec_res.get("rows", []),
                    "row_count": exec_res.get("row_count", 0),
                    "duration_ms": exec_res.get("duration_ms", 0)
                },
                "self_healed": final_state.get("self_healed", False),
                "retries": final_state.get("retry_count", 0),
                "dataset_id": req.dataset_id,
                "version": req.version or 1,
                "run_id": final_state.get("run_id")
            }

            yield {
                "event": "complete",
                "data": json.dumps(payload, default=str)
            }
        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)}, default=str)
            }

    return EventSourceResponse(event_generator())
