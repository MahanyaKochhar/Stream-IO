# Referral Intake Agent Flow

Baseline version: `v0.3`  
Updated: 2026-08-15

This diagram tracks the executable LangGraph workflow. Future workflow changes
should update this file and the corresponding code in the same change.

```mermaid
flowchart TD
    START([Start])
    PARSE[Parse referral PDF into Markdown<br/>LlamaParse only]
    EXTRACT[Extract nested referral fields<br/>provider-neutral structured output]
    ROUTING{"Specialty, subspecialty,<br/>and provider match?"}
    PATIENT[Validate patient fields<br/>promote to graph state]
    PATIENT_VALID{"Patient valid?"}
    INSURANCE[Validate insurance fields<br/>promote to graph state]
    INSURANCE_VALID{"Insurance valid?"}

    REJECT([Reject referral])
    MISSING_INFO([Missing information])
    NEXT_STAGE([Ready for next stage])

    START --> PARSE
    PARSE --> EXTRACT
    EXTRACT --> ROUTING
    ROUTING -->|Yes| PATIENT
    ROUTING -->|No| REJECT
    PATIENT --> PATIENT_VALID
    PATIENT_VALID -->|Yes| INSURANCE
    PATIENT_VALID -->|No| MISSING_INFO
    INSURANCE --> INSURANCE_VALID
    INSURANCE_VALID -->|Yes| NEXT_STAGE
    INSURANCE_VALID -->|No| MISSING_INFO

    classDef input fill:#e8f1ff,stroke:#2563eb,color:#172554,stroke-width:2px;
    classDef process fill:#f8fafc,stroke:#475569,color:#0f172a,stroke-width:2px;
    classDef decision fill:#fff7d6,stroke:#ca8a04,color:#422006,stroke-width:2px;
    classDef success fill:#dcfce7,stroke:#16a34a,color:#14532d,stroke-width:2px;
    classDef attention fill:#ffedd5,stroke:#ea580c,color:#7c2d12,stroke-width:2px;
    classDef failure fill:#fee2e2,stroke:#dc2626,color:#7f1d1d,stroke-width:2px;

    class START input;
    class PARSE,EXTRACT,PATIENT,INSURANCE process;
    class ROUTING,PATIENT_VALID,INSURANCE_VALID decision;
    class NEXT_STAGE success;
    class MISSING_INFO attention;
    class REJECT failure;
```

## Executable node contract

| Graph node | Responsibility | Next path |
|---|---|---|
| `parse_pdf` | Parse the PDF into Markdown using LlamaParse only | `Command(goto="extract_fields")` |
| `extract_fields` | Store provider-neutral `ReferralExtraction` under `state.extracted` | `Command(goto="check_routing")` |
| `check_routing` | Check specialty and subspecialty against in-code policy | Command to patient validation or rejection |
| `reject_referral` | Finalize the simple rejection message | `Command(goto=END)` |
| `validate_patient` | Validate required patient fields and promote `state.patient` | Command to insurance validation or missing information |
| `validate_insurance` | Validate required insurance fields and promote `state.insurance` | Command to `END` or missing information |
| `missing_information` | Finalize the missing-field message | `Command(goto=END)` |

The decision diamonds are not separate Python nodes. Each node returns a typed
`Command` containing both its state update and `goto` destination. The graph
builder has one explicit edge—`START` to `parse_pdf`—and no explicit
conditional edges.

## State boundary

```text
ReferralState
├── pdf_path
├── markdown
├── extracted: ReferralExtraction
│   ├── patient: ExtractedPatient
│   ├── insurance: ExtractedInsurance
│   ├── provider: Provider
│   ├── referring_provider: Provider
│   ├── specialty
│   ├── subspecialty
│   └── service
├── patient: Patient                 # present only after validation
├── insurance: Insurance             # present only after validation
├── missing_fields
├── outcome
└── message
```

Service clients and routing configuration are passed through LangGraph runtime
context and are not part of referral state.

## Deferred work

- Select and implement the structured-output LLM provider.
- Add treatment-plan or clinical-evidence nodes.
- Add persistence and human review.
- Replace the initial in-code routing policy with receiving-practice data.
