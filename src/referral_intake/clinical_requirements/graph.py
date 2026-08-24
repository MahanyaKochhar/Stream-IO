"""Clinical-requirements subagent construction."""

from langgraph.graph import START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from referral_intake.clinical_requirements.nodes import (
    compile_requirements,
    extract_requirement_values,
    load_references,
    load_skill,
    review_referral_packet,
    select_references,
    select_skill,
)
from referral_intake.clinical_requirements.state import ClinicalRequirementsState
from referral_intake.runtime import GraphContext


def build_clinical_requirements_graph() -> CompiledStateGraph:
    """Build the initial select-and-load clinical skill workflow."""

    builder = StateGraph(ClinicalRequirementsState, context_schema=GraphContext)
    builder.add_node("select_skill", select_skill)
    builder.add_node("load_skill", load_skill)
    builder.add_node("select_references", select_references)
    builder.add_node("load_references", load_references)
    builder.add_node("compile_requirements", compile_requirements)
    builder.add_node("extract_requirement_values", extract_requirement_values)
    builder.add_node("review_referral_packet", review_referral_packet)
    builder.add_edge(START, "select_skill")
    return builder.compile()
