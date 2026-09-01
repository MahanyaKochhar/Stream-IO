# Referral Intake Agent Flow

Baseline version: `v1.2`

Updated: 2026-08-24

Status: clinical findings require human approval or rejection

The compiled `clinical_requirements` graph is one node in the parent referral
graph after insurance validation. Its working fields remain private; the parent
receives one typed `clinical_requirements` result containing the selected skill,
logical references, compiled requirements, extracted findings, and the human
decision.

```mermaid
flowchart TD
    START([Start])
    PARSE[Parse referral PDF into Markdown<br/>LlamaParse only]
    EXTRACT[Extract nested referral fields<br/>provider-neutral structured output]
    ROUTING{"Specialty and<br/>subspecialty match?"}
    PATIENT[Validate patient fields<br/>promote to graph state]
    PATIENT_VALID{"Patient valid?"}
    INSURANCE[Validate insurance fields<br/>promote to graph state]
    INSURANCE_VALID{"Insurance valid?"}

    subgraph CLINICAL_REQUIREMENTS["clinical_requirements subagent"]
        direction TB
        CR_START([Start])
        SELECT_SKILL[Select skill<br/>deterministic lookup]
        LOAD_SKILL[Load SKILL.md]
        SELECT_REFERENCES[Select condition and service<br/>reference IDs]
        LOAD_REFERENCES[Load selected references]
        COMPILE_REQUIREMENTS[Compile requirements<br/>deterministic]
        EXTRACT_REQUIREMENTS[Extract requirement values<br/>structured LLM output]
        REVIEW_PACKET[Human review<br/>approve or reject packet]

        CR_START --> SELECT_SKILL
        SELECT_SKILL --> LOAD_SKILL
        LOAD_SKILL --> SELECT_REFERENCES
        SELECT_REFERENCES --> LOAD_REFERENCES
        LOAD_REFERENCES --> COMPILE_REQUIREMENTS
        COMPILE_REQUIREMENTS --> EXTRACT_REQUIREMENTS
        EXTRACT_REQUIREMENTS --> REVIEW_PACKET
    end

    HUMAN_REVIEW[Human review<br/>enter review text]
    REVIEWED([Human review complete])
    MISSING_INFO([Missing information])
    APPROVED([Referral approved])
    REJECTED([Referral rejected])

    START --> PARSE
    PARSE --> EXTRACT
    EXTRACT --> ROUTING
    ROUTING -->|Yes| PATIENT
    ROUTING -->|No| HUMAN_REVIEW
    HUMAN_REVIEW --> REVIEWED
    PATIENT --> PATIENT_VALID
    PATIENT_VALID -->|Yes| INSURANCE
    PATIENT_VALID -->|No| MISSING_INFO
    INSURANCE --> INSURANCE_VALID
    INSURANCE_VALID -->|Yes| CR_START
    INSURANCE_VALID -->|No| MISSING_INFO
    REVIEW_PACKET -->|Approve| APPROVED
    REVIEW_PACKET -->|Reject| REJECTED

    classDef input fill:#e8f1ff,stroke:#2563eb,color:#172554,stroke-width:2px;
    classDef process fill:#f8fafc,stroke:#475569,color:#0f172a,stroke-width:2px;
    classDef decision fill:#fff7d6,stroke:#ca8a04,color:#422006,stroke-width:2px;
    classDef success fill:#dcfce7,stroke:#16a34a,color:#14532d,stroke-width:2px;
    classDef attention fill:#ffedd5,stroke:#ea580c,color:#7c2d12,stroke-width:2px;
    classDef failure fill:#fee2e2,stroke:#dc2626,color:#7f1d1d,stroke-width:2px;
    classDef subagent fill:#f3e8ff,stroke:#9333ea,color:#581c87,stroke-width:2px;

    class START,CR_START input;
    class PARSE,EXTRACT,PATIENT,INSURANCE,HUMAN_REVIEW process;
    class SELECT_SKILL,LOAD_SKILL,SELECT_REFERENCES,LOAD_REFERENCES,COMPILE_REQUIREMENTS,EXTRACT_REQUIREMENTS,REVIEW_PACKET subagent;
    class ROUTING,PATIENT_VALID,INSURANCE_VALID decision;
    class APPROVED success;
    class MISSING_INFO,REVIEWED,REJECTED attention;
```

## Current executable node contract

| Graph node | Responsibility | Next path |
|---|---|---|
| `parse_pdf` | Parse the PDF into Markdown using LlamaParse only | `Command(goto="extract_fields")` |
| `extract_fields` | Store provider-neutral `ReferralExtraction` under `state.extracted` | `Command(goto="check_routing")` |
| `check_routing` | Check specialty and subspecialty against in-code policy | Command to patient validation or human review |
| `human_review` | Pause with `interrupt()` and store non-empty reviewer text on resume | `Command(goto=END)` |
| `validate_patient` | Validate required patient fields and promote `state.patient` | Command to insurance validation or missing information |
| `validate_insurance` | Validate required insurance fields and promote `state.insurance` | Command to `clinical_requirements` or missing information |
| `clinical_requirements` | Run the compiled clinical subgraph through requirement extraction and human review | Referral approved or rejected |
| `missing_information` | Finalize the missing-field message | `Command(goto=END)` |

## Clinical requirements subagent

The parent graph treats the compiled `clinical_requirements` graph as one
node. Internally, its initial linear flow is:

| Subagent node | Initial responsibility | Next path |
|---|---|---|
| `select_skill` | Deterministically map normalized specialty and subspecialty to a typed skill ID | `Command(goto="load_skill")` |
| `load_skill` | Deterministically load the selected skill's complete `SKILL.md` | `Command(goto="select_references")` |
| `select_references` | Read `SKILL.md` and return one supported condition ID and one supported service ID | `Command(goto="load_references")` |
| `load_references` | Deterministically load both selected files, keyed by logical reference ID | `Command(goto="compile_requirements")` |
| `compile_requirements` | Deterministically merge the requirement definitions in `SKILL.md` and the selected references | `Command(goto="extract_requirement_values")` |
| `extract_requirement_values` | Use structured LLM output to extract one finding per compiled requirement from referral Markdown | `Command(goto="review_referral_packet")` |
| `review_referral_packet` | Pause once with `interrupt()` for a human to enter `approve` or `reject`; construct the final clinical result | `Command(goto=END)` |

The initial catalog contains only `orthopedics/knee`. Each Markdown file keeps
human-readable instructions and a YAML requirement-definition block with stable
IDs. The compiler reads those blocks without an LLM, preserves their source
logical IDs, rejects duplicates, and produces one ordered requirement list.

```text
skills/
├── orthopedics/
│   └── knee/
│       ├── SKILL.md
│       └── references/
│           ├── conditions/
│           │   ├── osteoarthritis.md
│           │   ├── acl-tear.md
│           │   └── meniscus-tear.md
│           └── services/
│               ├── surgical-evaluation.md
│               └── general-consult.md
└── cardiology/                       # empty placeholder
```

The decision diamonds are not separate Python nodes. Each node returns a typed
`Command` containing both its state update and `goto` destination. Each graph
builder declares only its required `START` edge and no explicit conditional
edges.

## State boundary

```text
ReferralState
├── pdf_path
├── markdown
├── extracted: ReferralExtraction
│   ├── patient: ExtractedPatient
│   │   └── sex
│   ├── insurance: ExtractedInsurance
│   ├── provider: Provider
│   ├── referring_provider: Provider
│   ├── specialty
│   ├── subspecialty
│   ├── service
│   ├── condition
│   ├── priority
│   ├── reason_for_referral
│   └── referral_type: ReferralType
├── patient: Patient                 # includes required validated sex
├── insurance: Insurance             # present only after validation
├── clinical_requirements: ClinicalRequirementsResult
│   ├── skill: ClinicalSkillName
│   ├── references: ReferenceSelection
│   │   ├── condition                # logical ID only
│   │   └── service                  # logical ID only
│   ├── requirements: list[RequirementDefinition]
│   │   ├── id
│   │   ├── description
│   │   ├── required
│   │   └── source                   # logical ID, never a file path
│   ├── findings: list[RequirementFinding]
│       ├── requirement_id
│       ├── status                   # documented or not_documented
│       └── value
│   └── decision                     # approve or reject
├── missing_fields
├── outcome
├── message
└── review_text                     # present after human review
```

```text
ClinicalRequirementsState extends ReferralState
│                                     # parent keys are inherited, not redeclared
├── selected_skill                    # private subgraph working field
├── skill_instructions
├── selected_references
├── reference_contents
├── compiled_requirements
├── extracted_findings
└── inherited clinical_requirements   # shared parent output
```

Because the compiled subgraph is registered directly as the parent graph's
`clinical_requirements` node, LangGraph passes matching parent channels into it.
The subgraph nodes use `ClinicalRequirementsState`, which inherits
`ReferralState` and adds only private working fields. The shared parent keys are
therefore defined once, and private fields are filtered out when the subgraph
returns. No separate state object is manually passed between the graphs.

`reason_for_referral` is read directly from `state.extracted`. Nodes write
`outcome` and `message` only for meaningful terminal, missing-information, or
human-review results; routine processing transitions are represented by
`Command(goto=...)` alone.

The requirement extraction LLM receives only the compiled definitions and full
referral Markdown. It returns structured findings and is instructed to avoid
inference. A human sees those findings, then explicitly approves or rejects the
packet. Deterministic finding validation is deferred for now.

Service clients and routing configuration are passed through LangGraph runtime
context and are not part of referral state. PostgreSQL checkpoints persist each
run under the configured `thread_id` so an interrupt can resume safely.

## Deferred work

- Define downstream handling for approved and rejected referrals.
- Add deterministic validation of generated findings when its policy is defined.
- Add shoulder and spine skill directories when their content is ready.
- Add `generate_plan` and `execute_plan` nodes after the skill format is stable.
- Define plan state, execution outputs, and failure paths.
- Add later treatment-plan or clinical-evidence nodes.
- Replace the initial in-code routing policy with receiving-practice data.
