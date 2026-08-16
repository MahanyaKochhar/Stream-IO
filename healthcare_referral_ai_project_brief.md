# Agentic Referral Intake and Prior-Authorization Readiness Platform

## Project Idea

A healthcare AI system for small and mid-sized specialty practices that converts inbound referral packets into structured, evidence-linked, reviewable cases and moves them toward a clear operational outcome:

> **Ready for scheduling, ready for prior authorization, or blocked for a clearly explained reason.**

The product is not limited to extracting fields from referral PDFs. It manages the full intake workflow, enriches missing information from authorized sources, detects conflicts, identifies unresolved requirements, and routes exceptions to staff for approval.

---

## Problem

Referral intake remains fragmented across:

- Fax and scanned PDFs
- EHR referral orders
- Provider portals
- Secure email
- Payer portals
- Phone and manual follow-up

Staff often need to:

1. Read multi-page referral packets.
2. Enter patient, provider, insurance, and clinical information.
3. Match the patient to an existing record.
4. Determine whether the referral belongs to the correct specialty.
5. Check specialty-specific requirements.
6. Search the chart for missing information.
7. Identify insurance and prior-authorization requirements.
8. Contact the referring office for unresolved items.
9. Track the referral until it becomes schedulable.

The primary issue is not document ingestion alone. It is converting incomplete and unstructured information into a complete, auditable workflow state.

---

## Target Users

The initial users are referral coordinators, intake staff, schedulers, nurses, and practice managers at referral-heavy specialty practices.

Relevant settings include:

- Orthopaedics and spine
- Neurology
- Gastroenterology
- Behavioural health
- Sleep medicine
- Infusion services
- Physical therapy
- Durable medical equipment

---

## Core Product Direction

The platform acts as a **Referral Readiness and Exception-Resolution Copilot**.

It:

- Receives referral documents.
- Classifies and extracts their contents.
- Creates a persistent referral case.
- Links every extracted value to its source.
- Matches the patient and referring provider.
- Retrieves specialty-specific requirements.
- Detects missing or conflicting information.
- Searches authorized records for supportable information.
- Suggests normalized diagnosis or procedure codes when supported.
- Separates facts, AI suggestions, conflicts, and unknowns.
- Generates the minimum necessary follow-up.
- Tracks the referral through review, authorization, scheduling, and completion.

---

## Referral Workflow

```text
Referral received
        ↓
Documents classified
        ↓
Patient, provider, insurance, and clinical data extracted
        ↓
Patient and provider matched
        ↓
Specialty and requested service identified
        ↓
Specialty requirements retrieved
        ↓
Missing information and conflicts detected
        ↓
Authorized records searched for supporting information
        ↓
Each unresolved field classified
        ↓
Human review and approval
        ↓
Outreach, routing, authorization, or scheduling
        ↓
Referral status updated
```

Typical statuses:

```text
New
Processing
Needs information
Pending administrative review
Pending clinical review
Pending authorization
Ready to schedule
Scheduled
Completed
Redirected
Declined
```

---

## Evidence-Grounded Enrichment

Missing information is divided into four categories.

### Automatically recoverable

Information already present in an authorized source.

Examples:

- Patient phone number from the EHR
- Insurance member ID from an insurance-card image
- Referring provider NPI from a provider directory
- Imaging report from the patient chart

### Normalizable or suggestible

Information documented in narrative form but not structured.

Examples:

- Free-text diagnosis mapped to an ICD-10-CM suggestion
- Provider name mapped to an NPI
- Narrative referral reason mapped to a specialty
- Free-text clinical concept mapped to standardized terminology

These additions retain source evidence and require review when clinically meaningful.

### Conflicting

Information that differs across documents.

Examples:

- Left knee in the referral order and right knee in the imaging report
- Different dates of birth
- Conflicting diagnoses
- Different requested specialties
- Duplicate patient candidates

The system surfaces the conflict rather than silently selecting a value.

### Not inferable

Information that is not present and cannot be safely derived.

Examples:

- Symptom duration
- Failed treatments
- Disease stage
- Clinical urgency
- Medical necessity
- Clinician attestation

These items are escalated or included in a clarification request.

---

## Data Provenance Model

The system preserves a clear distinction between:

1. **Original referral data**
2. **Information retrieved from authorized systems**
3. **Deterministically normalized data**
4. **AI-generated suggestions**
5. **Human-approved values**
6. **Unresolved conflicts**

Example:

```json
{
  "field": "diagnosis_code",
  "original_value": null,
  "proposed_value": "M54.50",
  "source_text": "Persistent low-back pain",
  "source_document": "PCP_note.pdf",
  "source_page": 2,
  "generated_by": "terminology_agent",
  "status": "pending_review"
}
```

The original referral is never silently rewritten.

---

## Prior-Authorization Readiness

Prior authorization extends the referral workflow by determining whether the requested service requires payer approval and whether the required evidence is available.

```text
Referral complete
        ↓
Insurance plan identified
        ↓
Requested service identified
        ↓
Coverage and authorization requirements discovered
        ↓
Clinical evidence collected
        ↓
Requirements mapped to supporting documents
        ↓
Missing or conflicting evidence identified
        ↓
Human review
        ↓
Authorization request prepared
        ↓
Approved, denied, or more information requested
```

The project aligns with the modern electronic prior-authorization model:

- **CRD:** Determine whether authorization is required and what documentation is needed.
- **DTR:** Populate structured questions using existing clinical data.
- **PAS:** Submit the authorization request and receive a response.

The semester system can simulate these payer interactions using mocked FHIR-style APIs.

---

## LangGraph Architecture

LangGraph manages the durable, multi-step workflow.

```text
Referral ingestion
        ↓
Document classification
        ↓
Parallel extraction
 ┌──────────┬──────────┬───────────┬──────────┐
 ↓          ↓          ↓           ↓
Patient   Clinical   Insurance   Provider
data      data       data        data
 └──────────┴──────────┴───────────┴──────────┘
        ↓
Patient and provider matching
        ↓
Specialty requirement retrieval
        ↓
Coverage and authorization requirement discovery
        ↓
Parallel evidence retrieval
        ↓
Completeness and conflict analysis
        ↓
Next-action planning
        ↓
Human approval interrupt
        ↓
Outreach, routing, authorization, or scheduling
```

LangGraph provides:

- Persistent state
- Parallel branches
- Checkpoints
- Human-in-the-loop interrupts
- Re-entry after missing information arrives
- Workflow replay
- Explicit state transitions
- Event streaming to the frontend

Deterministic software handles exact validation, permissions, status rules, and audit history. LLMs handle document interpretation, ambiguous classification, explanation, evidence mapping, and drafting.

---

## Dynamic UI

The frontend represents the workflow as a changing case rather than a static chatbot.

### Case summary

```text
Patient: Sarah Miller
Requested specialty: Orthopaedic spine
Referral readiness: 74%
Authorization readiness: 60%
Status: Needs information
```

### Live workflow state

```text
✓ Documents classified
✓ Patient matched
✓ Insurance extracted
✓ Specialty identified
⚠ Diagnosis-code suggestion requires review
✗ MRI report missing
○ Waiting for coordinator approval
```

### Evidence-linked field review

```text
Diagnosis: Low-back pain
Suggested code: M54.50
Source: PCP note, page 2
Confidence: 96%

[Approve] [Edit] [Reject]
```

### Exception view

```text
Conflict detected

Referral order: Left knee
Imaging report: Right knee

[Request clarification] [Assign for clinical review]
```

### Readiness view

```text
Referral requirements
✓ Referral order
✓ Clinical note
✓ Patient demographics
✗ MRI report

Authorization requirements
✓ Conservative treatment history
△ Diagnosis code pending review
✗ Imaging evidence unavailable
```

---

## Voice Layer

Voice is a later interaction layer over structured referral state.

Example commands:

- “Why is this referral blocked?”
- “Show the source for the diagnosis.”
- “Approve the patient match.”
- “Which fields were added by AI?”
- “Change the destination to orthopaedic spine.”
- “Draft a request for the missing MRI report.”
- “Show referrals ready for authorization.”
- “Summarize unresolved issues.”

Voice does not operate as simple transcription. It queries and updates the workflow through structured commands, permissions, and approval steps.

---

## Human-Controlled Decisions

The system supports but does not independently make sensitive clinical decisions.

Human review remains required for:

- Clinical urgency
- Ambiguous patient matching
- Unsupported diagnosis specificity
- Conflicting laterality
- Specialty redirection
- Medical necessity
- Final authorization submission
- External communication
- Clinical acceptance or rejection
- Overrides of intake requirements

---

## Market Positioning

The market already contains vendors for:

- Referral fax ingestion
- Document extraction
- EHR data entry
- Patient matching
- Eligibility checking
- Referral tracking
- Scheduling and outreach

The project is positioned beyond generic intake automation.

Its focus is:

> **Evidence-grounded enrichment, conflict detection, referral readiness, prior-authorization readiness, and exception-based human review.**

The product is intended to reduce the amount of referral work from:

```text
Read documents
Search the chart
Identify missing fields
Resolve conflicts
Check payer requirements
Draft follow-up
Update the tracker
```

to:

```text
Review highlighted exceptions
Approve supported additions
Send the prepared next action
```

---

## Business Value

The product connects AI automation to operational outcomes:

- Less manual referral data entry
- Faster identification of incomplete referrals
- Reduced chart-searching time
- Fewer repeated calls to referring providers
- Faster time to ready-to-schedule
- Faster time to authorization submission
- Fewer avoidable authorization denials
- Better visibility into referral backlogs
- Higher referral-to-appointment conversion
- Reduced referral leakage
- Complete auditability of AI-assisted changes

The central business metric is not extraction accuracy alone. It is:

> **Time from referral receipt to schedulable and authorization-ready status.**

---

## Semester Scope

The semester implementation is a focused version of the platform:

- One specialty
- One referral workflow
- Synthetic referral packets and chart data
- PDF or fax-style document ingestion
- Structured extraction
- Patient matching
- Specialty-specific requirements
- Evidence-grounded enrichment
- Missing-information detection
- Conflict detection
- Human approval checkpoints
- Dynamic event-driven UI
- Mocked payer-requirements API
- DTR-style evidence questionnaire
- PAS-style authorization submission simulation
- Voice commands as a later extension

External EHR, fax, payer, and scheduling systems are represented through mocked tools and FHIR-inspired interfaces.

---

## Project Definition

> **An agentic referral and prior-authorization readiness platform for specialty practices that converts unstructured referral packets into evidence-linked cases, retrieves supportable missing information, detects conflicts, discovers payer requirements, and routes unresolved exceptions through a human-reviewed workflow until the case is ready for scheduling or authorization.**
