"""Domain models for extracted and validated referral data."""

from pydantic import BaseModel, ConfigDict, Field

from referral_intake.dates import BirthDate
from referral_intake.enums import (
    Condition,
    Priority,
    ReferralReason,
    ReferralType,
    Service,
    Specialty,
    Subspecialty,
)


class DomainModel(BaseModel):
    """Shared strict configuration for referral domain models."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ExtractedPatient(DomainModel):
    """Patient values as observed in the referral packet."""

    first_name: str | None = None
    last_name: str | None = None
    date_of_birth: BirthDate | None = Field(
        default=None,
        description="Date of birth from the source, formatted as MM-DD-YYYY.",
    )
    sex: str | None = None
    phone: str | None = None


class Patient(DomainModel):
    """Minimum patient data accepted into validated graph state."""

    first_name: str = Field(min_length=1)
    last_name: str = Field(min_length=1)
    date_of_birth: BirthDate
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


class ReferralExtraction(DomainModel):
    """Provider-neutral structured output produced from referral Markdown."""

    patient: ExtractedPatient
    insurance: ExtractedInsurance
    provider: Provider
    referring_provider: Provider
    specialty: Specialty | None = None
    subspecialty: Subspecialty | None = None
    service: Service | None = None
    condition: Condition | None = None
    priority: Priority | None = None
    reason_for_referral: ReferralReason | None = None
    referral_type: ReferralType | None = None
