"""Node functions for the referral intake graph."""

from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from langgraph.graph import END
from langgraph.types import Command, interrupt
from pydantic import ValidationError

from referral_intake.classification import DocumentClassification
from referral_intake.clinical_requirements.models import (
    ClinicalRequirementsResult,
    ReferralDecision,
    ReferralReviewResponse,
)
from referral_intake.dependencies import GraphDependencies
from referral_intake.models import Insurance, Patient
from referral_intake.public import public_referral
from referral_intake.state import ReferralState


def start_intake(state: ReferralState) -> dict:
    """Record that intake has begun."""
    return {"outcome": "processing"}


def parse_pdf(
    state: ReferralState,
    dependencies: GraphDependencies,
) -> dict:
    """Parse the referral PDF into Markdown using LlamaParse."""

    markdown = dependencies.parser.parse(Path(state["pdf_path"]))
    if not markdown.strip():
        raise ValueError("The referral PDF produced empty Markdown.")
    return {"markdown": markdown}


def classify_document(
    state: ReferralState,
    dependencies: GraphDependencies,
) -> Command[Literal["extract_fields", END]]:
    """Route referrals to extraction and end unrelated document intake."""

    classification = DocumentClassification.model_validate(
        dependencies.classifier.classify(state["markdown"])
    )
    if not classification.is_referral:
        message = "Not a referral document. Please upload a patient referral packet."
        return Command(
            update={
                "document_classification": classification,
                "outcome": "not_referral_document",
                "message": message,
            },
            goto=END,
        )
    return Command(
        update={
            "document_classification": classification,
        },
        goto="extract_fields",
    )


def extract_fields(
    state: ReferralState,
    dependencies: GraphDependencies,
) -> dict:
    """Extract the small nested referral schema from parsed Markdown."""

    extracted = dependencies.extractor.extract(state["markdown"])
    return {"extracted": extracted}


def check_routing(
    state: ReferralState,
    dependencies: GraphDependencies,
) -> Command[Literal["validate_patient", "human_review"]]:
    """Apply the initial in-code specialty and subspecialty check."""

    extracted = state["extracted"]
    policy = dependencies.routing_policy
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
        message = "Referral does not match the receiving practice's " + (
            f"routing rules: {', '.join(failures)}."
        )
        return Command(
            update={
                "outcome": "human_review_required",
                "message": message,
            },
            goto="human_review",
        )
    return Command(goto="validate_patient")


def human_review(state: ReferralState) -> dict:
    """Pause a routing mismatch until a human records a review note."""
    review_text = interrupt(
        {
            "type": "routing_review",
            "referral": public_referral(state),
        }
    )
    if not isinstance(review_text, str) or not review_text.strip():
        raise ValueError("Human review text must be a non-empty string.")
    return {"outcome": "human_reviewed", "review_text": review_text.strip()}


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
                    "Missing required patient information: "
                    f"{_missing_field_labels(missing)}."
                ),
            },
            goto="missing_information",
        )

    return Command(
        update={
            "patient": patient,
            "missing_fields": [],
        },
        goto="validate_insurance",
    )


def validate_insurance(
    state: ReferralState,
) -> Command[Literal["missing_information", "clinical_requirements"]]:
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
                    "Missing required insurance information: "
                    f"{_missing_field_labels(missing)}."
                ),
            },
            goto="missing_information",
        )

    return Command(
        update={
            "insurance": insurance,
            "missing_fields": [],
        },
        goto="clinical_requirements",
    )


def review_referral_packet(
    state: ReferralState,
) -> dict:
    """Pause for a human to approve or reject the referral packet."""

    response = interrupt(
        {
            "type": "clinical_review",
            "referral": public_referral(state),
        }
    )
    review = ReferralReviewResponse.model_validate(response)
    decision = review.decision
    clinical = ClinicalRequirementsResult.model_validate(state["clinical_requirements"])
    expected_ids = {requirement.id for requirement in clinical.requirements}
    finding_ids = [finding.requirement_id for finding in review.findings]
    if len(finding_ids) != len(expected_ids) or set(finding_ids) != expected_ids:
        raise ValueError("Reviewed findings must match the clinical requirements.")

    outcome = (
        "referral_approved"
        if decision is ReferralDecision.APPROVE
        else "referral_rejected"
    )
    return {
        "clinical_requirements": ClinicalRequirementsResult(
            skill=clinical.skill,
            references=clinical.references,
            requirements=clinical.requirements,
            findings=review.findings,
            decision=decision,
            reviewed_by=review.reviewed_by,
            reviewed_at=datetime.now(UTC).isoformat(),
        ),
        "outcome": outcome,
    }


def missing_information(state: ReferralState) -> dict:
    """Finalize a missing-information outcome."""
    return {
        "outcome": "needs_information",
        "message": state.get("message", "Required referral information is missing."),
    }


def _missing_fields(prefix: str, error: ValidationError) -> list[str]:
    """Return stable field paths for programmatic validation handling."""

    return sorted({f"{prefix}.{item['loc'][0]}" for item in error.errors()})


def _missing_field_labels(fields: list[str]) -> str:
    """Format validation paths for referral coordinators."""

    return ", ".join(
        field.rsplit(".", 1)[-1]
        .replace("_", " ")
        .replace(" id", " ID")
        .replace("member ID", "Member ID")
        for field in fields
    )
