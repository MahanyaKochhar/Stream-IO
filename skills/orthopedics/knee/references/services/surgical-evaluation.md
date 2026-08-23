# Surgical Evaluation

Use with `SKILL.md` and the selected condition reference.

Extract or explicitly mark missing:

- requested procedure or surgical question
- symptom severity, duration, functional limitation, and patient goal
- relevant imaging date and impression
- nonsurgical treatments, duration when stated, and response
- previous knee surgery or hardware
- relevant comorbidities, medications, allergies, BMI, and tobacco use when
  documented
- urgent mechanical findings such as a locked knee when documented

## Requirement definitions

```yaml
requirements:
  - id: surgery.question
    description: Requested procedure or surgical question.
  - id: surgery.patient_goal
    description: Patient goal and functional impact.
  - id: surgery.nonoperative_care
    description: Nonsurgical treatments, duration, and response.
  - id: surgery.prior_procedure
    description: Previous knee surgery or hardware.
  - id: surgery.risk_factors
    description: Relevant comorbidities, BMI, tobacco use, medications, and allergies.
```

These fields support specialist review. Do not recommend surgery or determine
surgical candidacy.
