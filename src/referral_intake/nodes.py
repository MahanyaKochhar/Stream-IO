"""Node functions for the referral intake graph."""

from pathlib import Path
from typing import Literal

from langgraph.graph import END
from langgraph.runtime import Runtime
from langgraph.types import Command
from pydantic import ValidationError

from referral_intake.models import Insurance, Patient
from referral_intake.runtime import GraphContext
from referral_intake.state import ReferralState


def parse_pdf(
    state: ReferralState, runtime: Runtime[GraphContext]
) -> Command[Literal["extract_fields"]]:
    """Parse the referral PDF into Markdown using LlamaParse."""

    markdown = runtime.context.parser.parse(Path(state["pdf_path"]))
    if not markdown.strip():
        raise ValueError("The referral PDF produced empty Markdown.")
    return Command(
        update={"markdown": markdown, "outcome": "processing"},
        goto="extract_fields",
    )


def extract_fields(
    state: ReferralState, runtime: Runtime[GraphContext]
) -> Command[Literal["check_routing"]]:
    """Extract the small nested referral schema from parsed Markdown."""

    extracted = runtime.context.extractor.extract(state["markdown"])
    return Command(update={"extracted": extracted}, goto="check_routing")


def check_routing(
    state: ReferralState, runtime: Runtime[GraphContext]
) -> Command[Literal["validate_patient", "reject_referral"]]:
    """Apply the initial in-code specialty and subspecialty check."""

    extracted = state["extracted"]
    policy = runtime.context.routing_policy
    values = {
        "specialty": extracted.specialty,
        "subspecialty": extracted.subspecialty,
    }
    allowed = {
        "specialty": policy.specialties,
        "subspecialty": policy.subspecialties,
    }

    failures = [
        name
        for name, value in values.items()
        if value is None or value.casefold() not in allowed[name]
    ]
    if failures:
        return Command(
            update={
                "outcome": "rejected",
                "message": "Referral does not match the receiving practice's "
                f"routing rules: {', '.join(failures)}.",
            },
            goto="reject_referral",
        )
    return Command(
        update={"outcome": "processing", "message": ""},
        goto="validate_patient",
    )


def reject_referral(state: ReferralState) -> Command[Literal[END]]:
    """Finalize a routing rejection with a simple message."""

    return Command(
        update={
            "outcome": "rejected",
            "message": state.get("message", "Referral rejected by routing rules."),
        },
        goto=END,
    )


def validate_patient(
    state: ReferralState,
) -> Command[Literal["validate_insurance", "missing_information"]]:
    """Promote valid extracted patient data into top-level graph state."""

    extracted = state["extracted"].patient
    try:
        patient = Patient.model_validate(extracted.model_dump())
    except ValidationError as error:
        missing = _missing_fields("patient", error)
        return Command(
            update={
                "missing_fields": missing,
                "outcome": "needs_information",
                "message": (
                    f"Missing required patient information: {', '.join(missing)}."
                ),
            },
            goto="missing_information",
        )

    return Command(
        update={
            "patient": patient,
            "missing_fields": [],
            "outcome": "processing",
            "message": "",
        },
        goto="validate_insurance",
    )


def validate_insurance(
    state: ReferralState,
) -> Command[Literal["missing_information", END]]:
    """Promote valid extracted insurance data into top-level graph state."""

    extracted = state["extracted"].insurance
    try:
        insurance = Insurance.model_validate(extracted.model_dump())
    except ValidationError as error:
        missing = _missing_fields("insurance", error)
        return Command(
            update={
                "missing_fields": missing,
                "outcome": "needs_information",
                "message": (
                    f"Missing required insurance information: {', '.join(missing)}."
                ),
            },
            goto="missing_information",
        )

    return Command(
        update={
            "insurance": insurance,
            "missing_fields": [],
            "outcome": "ready_for_next_stage",
            "message": "Patient and insurance information validated.",
        },
        goto=END,
    )


def missing_information(state: ReferralState) -> Command[Literal[END]]:
    """Finalize a missing-information outcome."""

    return Command(
        update={
            "outcome": "needs_information",
            "message": state.get(
                "message", "Required referral information is missing."
            ),
        },
        goto=END,
    )


def _missing_fields(prefix: str, error: ValidationError) -> list[str]:
    """Return stable, user-facing paths for failed required fields."""

    return sorted({f"{prefix}.{item['loc'][0]}" for item in error.errors()})
