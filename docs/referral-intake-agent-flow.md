# Referral intake flow

[Setup and operation](../README.md) · [Standalone diagram](referral-intake-agent-flow.mmd)

```mermaid
flowchart TD
    START([Start]) --> INIT[start_intake]
    INIT --> PARSE[parse_pdf<br/>LlamaParse to Markdown]
    PARSE --> CLASSIFY{classify_document<br/>LLM: referral document?}
    CLASSIFY -->|No| NOT_REFERRAL([Not a referral document])
    CLASSIFY -->|Yes| EXTRACT[extract_fields<br/>Structured LLM output]
    EXTRACT --> ROUTING{check_routing}
    ROUTING -->|Mismatch| HUMAN[human_review<br/>Interrupt for routing note]
    HUMAN --> REVIEWED([Routing review recorded])
    ROUTING -->|Match| PATIENT{validate_patient}
    PATIENT -->|Missing fields| MISSING[missing_information]
    PATIENT -->|Valid| INSURANCE{validate_insurance}
    INSURANCE -->|Missing fields| MISSING
    MISSING --> INCOMPLETE([Needs information])
    INSURANCE -->|Valid| SELECT_SKILL

    subgraph CLINICAL[clinical_requirements subgraph]
        SELECT_SKILL[select_skill] --> LOAD_SKILL[load_skill]
        LOAD_SKILL --> SELECT_REFS[select_references<br/>LLM]
        SELECT_REFS --> LOAD_REFS[load_references]
        LOAD_REFS --> COMPILE[compile_requirements]
        COMPILE --> FINDINGS[extract_requirement_values<br/>LLM]
    end

    FINDINGS --> REVIEW[review_referral_packet<br/>Interrupt for editable findings and decision]
    REVIEW -->|Approve| APPROVED([Referral approved])
    REVIEW -->|Reject| REJECTED([Referral rejected])

    classDef decision fill:#fff7d6,stroke:#ca8a04,color:#422006;
    classDef attention fill:#ffedd5,stroke:#ea580c,color:#7c2d12;
    classDef success fill:#dcfce7,stroke:#16a34a,color:#14532d;
    class CLASSIFY,ROUTING,PATIENT,INSURANCE decision;
    class NOT_REFERRAL,INCOMPLETE,REVIEWED,REJECTED attention;
    class APPROVED success;
```

## Parent graph

Nodes return typed `Command(update=..., goto=...)` for routing. The only static
edges are `START → start_intake` and
`clinical_requirements → review_referral_packet`. `destinations` describes routes
for diagram rendering; it does not execute them.

| Node | Action and next path |
|---|---|
| `start_intake` | Start packet progress → `parse_pdf`. |
| `parse_pdf` | Save LlamaParse Markdown → `classify_document`. |
| `classify_document` | LLM classification: referral → `extract_fields`; non-referral → `END`. |
| `extract_fields` | Save typed `ReferralExtraction` → `check_routing`. |
| `check_routing` | Matching specialty/subspecialty → `validate_patient`; otherwise → `human_review`. |
| `human_review` | Interrupt for a non-empty routing note; save `human_reviewed` → `END`. |
| `validate_patient` | Valid patient → `validate_insurance`; otherwise → `missing_information`. |
| `validate_insurance` | Valid insurance → `clinical_requirements`; otherwise → `missing_information`. |
| `missing_information` | Save `needs_information` and missing-field message → `END`. |
| `clinical_requirements` | Run the clinical subgraph; return draft findings → `review_referral_packet`. |
| `review_referral_packet` | Interrupt for edited findings, `decision`, and `reviewed_by`; save `referral_approved` or `referral_rejected` → `END`. |

## Classification

- The LLM returns `is_referral` and a short `reason` in `DocumentClassification`.
  See [classification instructions](../src/referral_intake/classification.py).
- Accept patient-specific referral intent, regardless of specialty or missing details.
- Reject standalone records, blank forms, and unrelated documents without referral intent.
- Rejection sets `not_referral_document`, skips extraction and review, and displays
  “Not a referral document. Please upload a patient referral packet.”
- Packet progress stays active through parsing and classification.
- Empty Markdown, model failures, and invalid output are run errors.

## Clinical subgraph

- Supports `orthopedics/knee`: ACL, meniscus, and osteoarthritis; general consultation
  and surgical evaluation.
- Skill selection, file loading, and requirement compilation are deterministic.
- The LLM selects reference IDs and extracts findings from Markdown.
- Requirements include IDs, display descriptions, optional `guidance`, required flags,
  and sources. Findings include the requirement ID, documentation status, and value.
- Coordinators review clinical gaps. Missing required patient or insurance data stops
  the workflow before clinical extraction.
- Automatic clinical follow-up, scheduling, and other specialties are not implemented.

## State and UI

- Input: `pdf_path`, optional `pdf_name`; one thread per new packet.
- Results: Markdown, classification, extracted fields, validated patient and insurance
  data, and clinical findings.
- Status: `outcome`, `message`, `missing_fields`, and `review_text` as applicable.
- Clinical review pauses with an interrupt; an outcome may not yet exist.
- `workflow` tracks progress; `ui` holds progress, review, and completion messages.
  Non-referrals display “Not a referral” in the list.
- `GraphDependencies` keeps service clients and routing policy outside saved state.
  Subgraph input/output schemas keep internal instructions and working fields private.
- See the [README](../README.md#restart-rebuild-and-storage) for persistence and PDF storage.
