"""Clinical-requirements subagent construction."""

from functools import partial

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from referral_intake.clinical_requirements.nodes import (
    compile_requirements,
    extract_requirement_values,
    load_references,
    load_skill,
    select_references,
    select_skill,
)
from referral_intake.clinical_requirements.state import ClinicalRequirementsState
from referral_intake.dependencies import GraphDependencies
from referral_intake.state import (
    ClinicalRequirementsInput,
    ClinicalRequirementsOutput,
)


def build_clinical_requirements_graph(
    dependencies: GraphDependencies,
) -> CompiledStateGraph:
    """Build the initial select-and-load clinical skill workflow."""

    builder = StateGraph(
        ClinicalRequirementsState,
        input_schema=ClinicalRequirementsInput,
        output_schema=ClinicalRequirementsOutput,
    )
    builder.add_node("select_skill", select_skill)
    builder.add_node("load_skill", load_skill)
    builder.add_node(
        "select_references",
        partial(select_references, dependencies=dependencies),
    )
    builder.add_node("load_references", load_references)
    builder.add_node("compile_requirements", compile_requirements)
    builder.add_node(
        "extract_requirement_values",
        partial(extract_requirement_values, dependencies=dependencies),
    )
    sequence = [
        START,
        "select_skill",
        "load_skill",
        "select_references",
        "load_references",
        "compile_requirements",
        "extract_requirement_values",
        END,
    ]
    for source, target in zip(sequence, sequence[1:], strict=False):
        builder.add_edge(source, target)
    return builder.compile()
