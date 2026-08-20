"""Referral intake graph construction with node-owned routing."""

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from referral_intake.clinical_requirements.graph import (
    build_clinical_requirements_graph,
)
from referral_intake.nodes import (
    check_routing,
    extract_fields,
    human_review,
    missing_information,
    parse_pdf,
    validate_insurance,
    validate_patient,
)
from referral_intake.runtime import GraphContext
from referral_intake.state import ReferralState


def build_graph(
    *, checkpointer: BaseCheckpointSaver | None = None
) -> CompiledStateGraph:
    """Build and compile the initial referral intake workflow."""

    builder = StateGraph(ReferralState, context_schema=GraphContext)

    builder.add_node("parse_pdf", parse_pdf)
    builder.add_node("extract_fields", extract_fields)
    builder.add_node("check_routing", check_routing)
    builder.add_node("human_review", human_review)
    builder.add_node("validate_patient", validate_patient)
    builder.add_node("validate_insurance", validate_insurance)
    builder.add_node(
        "clinical_requirements", build_clinical_requirements_graph()
    )
    builder.add_node("missing_information", missing_information)

    builder.add_edge(START, "parse_pdf")
    return builder.compile(checkpointer=checkpointer)
