"""Public referral data shared by tools, interrupts, and stream events."""

from collections.abc import Mapping
from typing import Any

from pydantic_core import to_jsonable_python

PUBLIC_FIELDS = frozenset(
    {
        "pdf_path",
        "pdf_name",
        "extracted",
        "patient",
        "insurance",
        "document_classification",
        "clinical_requirements",
        "outcome",
        "missing_fields",
        "message",
        "review_text",
    }
)


def public_referral(state: Mapping[str, Any]) -> dict[str, Any]:
    """Serialize only business data intended for the referral UI."""
    return to_jsonable_python(
        {key: value for key, value in state.items() if key in PUBLIC_FIELDS}
    )
