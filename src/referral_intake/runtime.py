"""Runtime dependencies used by graph nodes."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol

from referral_intake.gemini import GeminiReferralExtractor
from referral_intake.models import ReferralExtraction


class PdfParser(Protocol):
    """Convert a referral PDF into Markdown."""

    def parse(self, pdf_path: Path) -> str: ...


class ReferralExtractor(Protocol):
    """Produce structured referral fields from Markdown."""

    def extract(self, markdown: str) -> ReferralExtraction: ...


class LlamaParsePdfParser:
    """LlamaParse-only PDF-to-Markdown adapter."""

    def parse(self, pdf_path: Path) -> str:
        if pdf_path.suffix.lower() != ".pdf":
            raise ValueError("Referral input must be a PDF file.")
        if not pdf_path.is_file():
            raise FileNotFoundError(f"Referral PDF not found: {pdf_path}")

        # Imported lazily so pure graph tests do not initialize a cloud client.
        from dotenv import load_dotenv
        from llama_cloud import LlamaCloud

        load_dotenv()
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
        default_factory=lambda: frozenset({"orthopedic surgery", "orthopaedic surgery"})
    )
    subspecialties: frozenset[str] = field(default_factory=lambda: frozenset({"knee"}))


@dataclass(frozen=True)
class GraphContext:
    """Dependencies and policy supplied when invoking the graph."""

    parser: PdfParser = field(default_factory=LlamaParsePdfParser)
    extractor: ReferralExtractor = field(default_factory=GeminiReferralExtractor)
    routing_policy: RoutingPolicy = field(default_factory=RoutingPolicy)
