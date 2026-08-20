"""Nodes for the clinical-requirements subagent."""

from typing import Literal

from langgraph.graph import END
from langgraph.runtime import Runtime
from langgraph.types import Command

from referral_intake.clinical_requirements.catalog import (
    load_references as load_reference_content,
)
from referral_intake.clinical_requirements.catalog import (
    load_skill_instructions,
)
from referral_intake.clinical_requirements.catalog import (
    select_skill as select_skill_from_catalog,
)
from referral_intake.runtime import GraphContext
from referral_intake.state import ReferralState


def select_skill(
    state: ReferralState,
) -> Command[Literal["load_skill"]]:
    """Select a skill deterministically from specialty and subspecialty."""

    extracted = state["extracted"]
    skill_name = select_skill_from_catalog(
        extracted.specialty,
        extracted.subspecialty,
    )
    return Command(
        update={"selected_skill": skill_name},
        goto="load_skill",
    )


def load_skill(
    state: ReferralState,
) -> Command[Literal["select_references"]]:
    """Load the selected skill's complete SKILL.md instructions."""

    instructions = load_skill_instructions(state["selected_skill"])
    return Command(
        update={
            "skill_instructions": instructions,
            "outcome": "processing",
            "message": "Clinical requirements skill loaded.",
        },
        goto="select_references",
    )


def select_references(
    state: ReferralState, runtime: Runtime[GraphContext]
) -> Command[Literal["load_references"]]:
    """Select supported condition and service reference IDs."""

    extracted = state["extracted"]
    selection = runtime.context.reference_selector.select(
        skill_instructions=state["skill_instructions"],
        condition=extracted.condition,
        service=extracted.service,
        reason_for_referral=extracted.reason_for_referral,
    )
    return Command(
        update={"selected_references": selection},
        goto="load_references",
    )


def load_references(state: ReferralState) -> Command[Literal[END]]:
    """Load selected reference content under logical reference IDs."""

    contents = load_reference_content(
        state["selected_skill"], state["selected_references"]
    )
    return Command(
        update={
            "reference_contents": contents,
            "outcome": "ready_for_next_stage",
            "message": "Clinical requirements references loaded.",
        },
        goto=END,
    )
