---
name: knee
description: Extract clinical completeness requirements from orthopedic knee referral packets and route to supported knee condition and service references.
---

# Knee Referral Intake

Use this skill to check whether a knee referral packet contains the basic
clinical information needed for orthopedic review.

## Rules

- Use only information documented in the referral packet.
- Do not infer diagnoses, results, treatment response, or surgical candidacy.
- Mark required information as `documented` or `not documented`.

## Shared checklist

Use `description` as the concise UI label and `guidance` as the extraction criteria.
Apply these requirements once for every knee referral. Condition and service
references add only distinct findings; do not repeat shared rows.
Explicit negative findings and statements that a study was not performed count
as documentation. Do not infer normal findings from silence. If a study was
performed but its report is unavailable, preserve that distinction and flag the
missing report. A text report does not establish that images are available.
An atraumatic history satisfies the injury-mechanism component.

## Requirement definitions

```yaml
requirements:
- id: knee.affected_side
  description: Affected knee
  guidance: 'Affected knee: left, right, or bilateral.'
- id: referral.reason
  description: Referral reason
  guidance: Referral question or requested procedure.
- id: referral.service
  description: Requested service
  guidance: Requested consultation or surgical evaluation.
- id: referral.priority
  description: Referral priority
  guidance: Documented referral urgency.
- id: symptoms.timeline_mechanism
  description: Onset and injury mechanism
  guidance: Symptom onset, duration, and injury mechanism, if any.
- id: symptoms.knee_details
  description: Knee symptoms
  guidance: Pain location, swelling, instability, catching, and locking.
- id: symptoms.functional_limitations
  description: Functional limitations
  guidance: Limitations in walking, stairs, work, or sport.
- id: exam.knee_findings
  description: Knee examination
  guidance: Knee range of motion, gait, and effusion.
- id: imaging.knee_summary
  description: Knee imaging
  guidance: Imaging modality, date, side, MRI status, and key findings (tear details, associated injury, or degenerative severity).
- id: treatment.history_response
  description: Treatment history and response
  guidance: Prior treatments, duration when stated, and response.
- id: history.knee
  description: Prior knee history
  guidance: Prior knee injuries, procedures, surgery, or retained hardware.
- id: clinical.background
  description: Medical history, medications, and allergies
  guidance: Relevant comorbidities, medications, and allergies.
- id: urgent.features
  description: Red flags
  guidance: Weight-bearing inability, locked knee, fever, erythema, or neurovascular symptoms.
```

## Reference selection

Select only these logical IDs. Return `null` when no listed reference clearly
matches.

- `conditions/osteoarthritis` — documented or suspected knee osteoarthritis,
  degenerative changes, or joint-replacement evaluation
- `conditions/acl-tear` — documented or suspected ACL injury
- `conditions/meniscus-tear` — documented or suspected meniscus injury or
  meniscal internal derangement
- `services/surgical-evaluation` — explicit request for a surgical opinion or
  procedure evaluation
- `services/general-consult` — consultation, second opinion, or evaluate and
  treat without an explicit surgical request

Load the selected condition and service files and apply them with the common
requirements above.

## Terminology source

[Knee Pain in Adults and Adolescents: The Initial Evaluation](https://pubmed.ncbi.nlm.nih.gov/30325638/)
informs history, examination, imaging, and red-flag terminology. This is a local
referral-documentation checklist, not a universal requirement for tests or surgery.
