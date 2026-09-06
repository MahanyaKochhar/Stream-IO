"""Structured models for clinical requirement extraction."""

from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints


class ClinicalSkillName(StrEnum):
    """Clinical skills currently available to the subagent."""

    KNEE = "orthopedics/knee"


class ConditionReference(StrEnum):
    """Condition references supported by the knee skill."""

    OSTEOARTHRITIS = "conditions/osteoarthritis"
    ACL_TEAR = "conditions/acl-tear"
    MENISCUS_TEAR = "conditions/meniscus-tear"


class ServiceReference(StrEnum):
    """Service references supported by the knee skill."""

    SURGICAL_EVALUATION = "services/surgical-evaluation"
    GENERAL_CONSULT = "services/general-consult"


class ReferenceSelection(BaseModel):
    """Supported logical references selected from a loaded skill."""

    model_config = ConfigDict(extra="forbid")

    condition: ConditionReference | None = None
    service: ServiceReference | None = None


class RequirementDefinition(BaseModel):
    """One requirement compiled deterministically from skill content."""

    model_config = ConfigDict(extra="forbid")

    id: str
    description: str
    required: bool = True
    source: str


class RequirementStatus(StrEnum):
    """Whether the referral packet documents a requirement."""

    DOCUMENTED = "documented"
    NOT_DOCUMENTED = "not_documented"


class RequirementFinding(BaseModel):
    """Value extracted from the referral for one compiled requirement."""

    model_config = ConfigDict(extra="forbid")

    requirement_id: str
    status: RequirementStatus
    value: str | None = None


class RequirementExtraction(BaseModel):
    """Structured LLM output for all compiled requirements."""

    model_config = ConfigDict(extra="forbid")

    findings: list[RequirementFinding]


class ReferralDecision(StrEnum):
    """Human decision for the referral packet."""

    APPROVE = "approve"
    REJECT = "reject"


class ReferralReviewResponse(BaseModel):
    """Editable findings and decision returned by the coordinator UI."""

    model_config = ConfigDict(extra="forbid")

    decision: ReferralDecision
    findings: list[RequirementFinding]
    reviewed_by: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)
    ]


class ClinicalRequirementsResult(BaseModel):
    """Single clinical-requirements output returned to the parent graph."""

    model_config = ConfigDict(extra="forbid")

    skill: ClinicalSkillName
    references: ReferenceSelection
    requirements: list[RequirementDefinition]
    findings: list[RequirementFinding]
    decision: ReferralDecision | None = None
    reviewed_by: str | None = None
    reviewed_at: str | None = None
