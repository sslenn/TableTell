from typing import TypedDict, Dict, Any, Optional, List


class AgentState(TypedDict):
    """
    Typed state dictionary passed between nodes in the TableTell LangGraph workflow.
    """
    dataset_id: str
    version: Optional[int]
    user_query: str
    schema_digest: str
    generated_sql: Optional[str]
    execution_result: Optional[Dict[str, Any]]
    retry_count: int
    max_retries: int
    self_healed: bool
    plotly_spec: Optional[Dict[str, Any]]
    summary_markdown: Optional[str]
    error: Optional[str]
    status: str
    history: List[Dict[str, Any]]
    run_id: Optional[str]
