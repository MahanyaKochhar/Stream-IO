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

## Common knee requirements

Extract or explicitly mark missing:

- affected knee and reason for referral
- requested service and priority
- symptom or injury onset, duration, and mechanism
- pain location, swelling, instability, catching or locking, and functional
  limitations
- relevant examination findings
- imaging type, date, laterality, and impression; note when MRI was not done
- treatments attempted, duration when stated, and response
- previous knee injury, procedure, or surgery
- relevant medications, allergies, and comorbidities
- documented urgent features such as inability to bear weight, a locked knee,
  fever, redness, or neurovascular symptoms

## Requirement definitions

```yaml
requirements:
  - id: knee.affected_side
    description: Affected knee or laterality.
  - id: referral.reason
    description: Reason for referral.
  - id: referral.service
    description: Requested service.
  - id: referral.priority
    description: Referral priority.
  - id: symptoms.timeline_mechanism
    description: Symptom onset, duration, and injury mechanism.
  - id: symptoms.knee_details
    description: Pain location, swelling, instability, catching, or locking.
  - id: symptoms.functional_limitations
    description: Documented functional limitations.
  - id: exam.knee_findings
    description: Relevant knee examination findings.
  - id: imaging.knee_summary
    description: Imaging type, date, laterality, impression, and MRI status.
  - id: treatment.history_response
    description: Treatments attempted, duration, and response.
  - id: history.knee
    description: Previous knee injury, procedure, or surgery.
  - id: clinical.background
    description: Relevant medications, allergies, and comorbidities.
  - id: urgent.features
    description: Urgent features documented as present or absent.
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
