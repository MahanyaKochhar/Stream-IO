"""Referral intake graph construction with node-owned routing."""

from langgraph.graph import START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from referral_intake.nodes import (
    check_routing,
    extract_fields,
    missing_information,
    parse_pdf,
    reject_referral,
    validate_insurance,
    validate_patient,
)
from referral_intake.runtime import GraphContext
from referral_intake.state import ReferralState


def build_graph() -> CompiledStateGraph:
    """Build and compile the initial referral intake workflow."""

    builder = StateGraph(ReferralState, context_schema=GraphContext)

    builder.add_node("parse_pdf", parse_pdf)
    builder.add_node("extract_fields", extract_fields)
    builder.add_node("check_routing", check_routing)
    builder.add_node("reject_referral", reject_referral)
    builder.add_node("validate_patient", validate_patient)
    builder.add_node("validate_insurance", validate_insurance)
    builder.add_node("missing_information", missing_information)

    # Nodes own all subsequent routing through Command(goto=...).
    builder.add_edge(START, "parse_pdf")

    return builder.compile()
