"""
Compiled LangGraph State Graph for TableTell V2
Orchestrates:
generate_sql -> execute_sql -> (conditional routing) -> self_heal (loop) -> visualize -> END
"""

from langgraph.graph import StateGraph, END
from app.agent.state import AgentState
from app.agent.nodes import (
    generate_sql_node,
    execute_sql_node,
    self_heal_node,
    visualize_and_summarize_node,
)


def route_after_execution(state: AgentState) -> str:
    """
    Evaluates whether SQL execution succeeded or requires self-healing recovery.
    """
    exec_res = state.get("execution_result") or {}
    success = exec_res.get("success", False)
    retries = state.get("retry_count", 0)
    max_retries = state.get("max_retries", 2)

    if success:
        return "visualize"
    elif retries < max_retries:
        return "self_heal"
    else:
        # Reached retry limit; proceed to visualize node to output explanation
        return "visualize"


def build_tabletell_graph():
    """Constructs and compiles the TableTell LangGraph state machine."""
    workflow = StateGraph(AgentState)

    # Register Nodes
    workflow.add_node("generate_sql", generate_sql_node)
    workflow.add_node("execute_sql", execute_sql_node)
    workflow.add_node("self_heal", self_heal_node)
    workflow.add_node("visualize", visualize_and_summarize_node)

    # Define Graph Traversal & Edges
    workflow.set_entry_point("generate_sql")
    workflow.add_edge("generate_sql", "execute_sql")

    workflow.add_conditional_edges(
        "execute_sql",
        route_after_execution,
        {
            "visualize": "visualize",
            "self_heal": "self_heal"
        }
    )

    # Self-heal loops back to execute the newly repaired query
    workflow.add_edge("self_heal", "execute_sql")
    workflow.add_edge("visualize", END)

    return workflow.compile()


tabletell_agent = build_tabletell_graph()
