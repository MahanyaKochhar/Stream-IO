"""Clinical-requirements subagent construction."""

from langgraph.graph import START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from referral_intake.clinical_requirements.nodes import (
    load_references,
    load_skill,
    select_references,
    select_skill,
)
from referral_intake.runtime import GraphContext
from referral_intake.state import ReferralState


def build_clinical_requirements_graph() -> CompiledStateGraph:
    """Build the initial select-and-load clinical skill workflow."""

    builder = StateGraph(ReferralState, context_schema=GraphContext)
    builder.add_node("select_skill", select_skill)
    builder.add_node("load_skill", load_skill)
    builder.add_node("select_references", select_references)
    builder.add_node("load_references", load_references)
    builder.add_edge(START, "select_skill")
    return builder.compile()
