"""External services and policy used by the referral graph."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol

from referral_intake.clinical_requirements.models import (
    ReferenceSelection,
    RequirementDefinition,
    RequirementExtraction,
)
from referral_intake.enums import Specialty, Subspecialty
from referral_intake.llm_navigator import (
    StructuredReferenceSelector,
    StructuredReferralExtractor,
    StructuredRequirementExtractor,
)
from referral_intake.models import ReferralExtraction


class PdfParser(Protocol):
    """Convert a referral PDF into Markdown."""

    def parse(self, pdf_path: Path) -> str: ...


class ReferralExtractor(Protocol):
    """Produce structured referral fields from Markdown."""

    def extract(self, markdown: str) -> ReferralExtraction: ...


class ClinicalReferenceSelector(Protocol):
    """Select supported references from loaded skill instructions."""

    def select(
        self,
        skill_instructions: str,
        condition: str | None,
        service: str | None,
        reason_for_referral: str | None,
    ) -> ReferenceSelection: ...


class ClinicalRequirementExtractor(Protocol):
    """Extract values for deterministic clinical requirement definitions."""

    def extract(
        self,
        markdown: str,
        requirements: list[RequirementDefinition],
    ) -> RequirementExtraction: ...


class LlamaParsePdfParser:
    """LlamaParse-only PDF-to-Markdown adapter."""

    def parse(self, pdf_path: Path) -> str:
        if pdf_path.suffix.lower() != ".pdf":
            raise ValueError("Referral input must be a PDF file.")
        if not pdf_path.is_file():
            raise FileNotFoundError(f"Referral PDF not found: {pdf_path}")

        from llama_cloud import LlamaCloud

        with LlamaCloud() as client:
            uploaded = client.files.create(file=pdf_path, purpose="parse")
            result = client.parsing.parse(
                file_id=uploaded.id,
                tier="agentic",
                version="latest",
                expand=["markdown"],
            )

        if result.markdown is None or not result.markdown.pages:
            raise RuntimeError("LlamaParse returned no Markdown pages.")

        pages = [page.markdown.strip() for page in result.markdown.pages]
        return "\n\n".join(page for page in pages if page)


@dataclass(frozen=True)
class RoutingPolicy:
    """Initial receiving-practice routing rules kept in code."""

    specialties: frozenset[str] = field(
        default_factory=lambda: frozenset(value.casefold() for value in Specialty)
    )
    subspecialties: frozenset[str] = field(
        default_factory=lambda: frozenset(value.casefold() for value in Subspecialty)
    )


@dataclass(frozen=True)
class GraphDependencies:
    """Services and policy shared by every node in one compiled graph."""

    parser: PdfParser = field(default_factory=LlamaParsePdfParser)
    extractor: ReferralExtractor = field(default_factory=StructuredReferralExtractor)
    reference_selector: ClinicalReferenceSelector = field(
        default_factory=StructuredReferenceSelector
    )
    requirement_extractor: ClinicalRequirementExtractor = field(
        default_factory=StructuredRequirementExtractor
    )
    routing_policy: RoutingPolicy = field(default_factory=RoutingPolicy)
