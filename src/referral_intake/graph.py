"""Referral intake graph construction with node-owned routing."""

from functools import partial

from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph import START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from referral_intake.clinical_requirements.graph import (
    build_clinical_requirements_graph,
)
from referral_intake.dependencies import GraphDependencies
from referral_intake.nodes import (
    check_routing,
    extract_fields,
    human_review,
    missing_information,
    parse_pdf,
    review_referral_packet,
    start_intake,
    validate_insurance,
    validate_patient,
)
from referral_intake.state import ReferralInput, ReferralState


def build_graph(
    dependencies: GraphDependencies,
    checkpointer: BaseCheckpointSaver | None = None,
) -> CompiledStateGraph:
    """Build and compile the initial referral intake workflow."""

    builder = StateGraph(
        state_schema=ReferralState,
        input_schema=ReferralInput,
        output_schema=ReferralState,
    )

    builder.add_node(
        "start_intake",
        start_intake,
        destinations=("parse_pdf",),
    )
    builder.add_node(
        "parse_pdf",
        partial(parse_pdf, dependencies=dependencies),
        destinations=("extract_fields",),
    )
    builder.add_node(
        "extract_fields",
        partial(extract_fields, dependencies=dependencies),
        destinations=("check_routing",),
    )
    builder.add_node(
        "check_routing",
        partial(check_routing, dependencies=dependencies),
        destinations=("validate_patient", "human_review"),
    )
    builder.add_node("human_review", human_review)
    builder.add_node("validate_patient", validate_patient)
    builder.add_node("validate_insurance", validate_insurance)
    builder.add_node(
        "clinical_requirements",
        build_clinical_requirements_graph(dependencies),
    )
    builder.add_node("review_referral_packet", review_referral_packet)
    builder.add_node("missing_information", missing_information)

    builder.add_edge(START, "start_intake")
    builder.add_edge("clinical_requirements", "review_referral_packet")
    return builder.compile(checkpointer=checkpointer)
