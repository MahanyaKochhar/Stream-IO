"""Structured models for clinical skill selection."""

from enum import StrEnum

from pydantic import BaseModel, ConfigDict


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

    condition: ConditionReference
    service: ServiceReference
