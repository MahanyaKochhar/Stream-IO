"""Domain models for extracted and validated referral data."""

from datetime import date
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class DomainModel(BaseModel):
    """Shared strict configuration for referral domain models."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ExtractedPatient(DomainModel):
    """Patient values as observed in the referral packet."""

    first_name: str | None = None
    last_name: str | None = None
    date_of_birth: date | None = None
    sex: str | None = None
    phone: str | None = None


class Patient(DomainModel):
    """Minimum patient data accepted into validated graph state."""

    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    date_of_birth: date
    sex: str = Field(min_length=1)
    phone: str | None = None


class ExtractedInsurance(DomainModel):
    """Insurance values as observed in the referral packet."""

    payer_name: str | None = None
    member_id: str | None = None
    group_number: str | None = None


class Insurance(DomainModel):
    """Minimum insurance data accepted into validated graph state."""

    payer_name: str = Field(min_length=1)
    member_id: str = Field(min_length=1)
    group_number: str | None = None


class Provider(DomainModel):
    """Requested or referring provider details."""

    name: str | None = None
    npi: str | None = None
    organization: str | None = None


class ReferralType(StrEnum):
    """Currently supported clinical referral classifications."""

    GENERAL_KNEE_PAIN = "general knee pain"
    MENISCUS_INTERNAL_DERANGEMENT = "meniscus/internal derangement"
    ACL_PCL_INJURY = "ACL/PCL injury"
    KNEE_OSTEOARTHRITIS_JOINT_REPLACEMENT = "knee osteoarthritis/joint replacement"


class ReferralExtraction(DomainModel):
    """Provider-neutral structured output produced from referral Markdown."""

    patient: ExtractedPatient
    insurance: ExtractedInsurance
    provider: Provider
    referring_provider: Provider
    specialty: str | None = None
    subspecialty: str | None = None
    service: str | None = None
    condition: str | None = None
    priority: str | None = None
    reason_for_referral: str | None = None
    referral_type: ReferralType | None = None
