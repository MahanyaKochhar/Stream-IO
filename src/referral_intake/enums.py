"""Canonical categories supported by structured referral extraction."""

from enum import StrEnum


class Specialty(StrEnum):
    ORTHOPEDIC_SURGERY = "Orthopedic Surgery"


class Subspecialty(StrEnum):
    KNEE = "Knee"


class Service(StrEnum):
    GENERAL_CONSULT = "General consultation"
    SURGICAL_EVALUATION = "Surgical evaluation"


class Condition(StrEnum):
    OSTEOARTHRITIS = "Osteoarthritis"
    ACL_TEAR = "ACL tear"
    MENISCUS_TEAR = "Meniscus tear"


class Priority(StrEnum):
    ROUTINE = "Routine"
    URGENT = "Urgent"
    EMERGENCY = "Emergency"


class ReferralReason(StrEnum):
    EVALUATE_AND_TREAT = "Evaluate and treat"
    SURGICAL_EVALUATION = "Surgical evaluation"
    NONOPERATIVE_MANAGEMENT = "Nonoperative symptom management"


class ReferralType(StrEnum):
    """Currently supported clinical referral classifications."""

    GENERAL_KNEE_PAIN = "general knee pain"
    MENISCUS_INTERNAL_DERANGEMENT = "meniscus/internal derangement"
    ACL_PCL_INJURY = "ACL/PCL injury"
    KNEE_OSTEOARTHRITIS_JOINT_REPLACEMENT = "knee osteoarthritis/joint replacement"
