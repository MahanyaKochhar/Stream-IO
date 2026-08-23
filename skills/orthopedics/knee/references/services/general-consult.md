# General Consult

Use with `SKILL.md` and the selected condition reference.

Extract or explicitly mark missing:

- consultation question or evaluate-and-treat request
- primary complaint, timeline, and functional impact
- working diagnosis and relevant examination findings
- available imaging and whether MRI was performed
- treatments attempted and response

## Requirement definitions

```yaml
requirements:
  - id: consult.question
    description: Consultation question or evaluate-and-treat request.
  - id: consult.working_diagnosis
    description: Working diagnosis documented by the referring clinician.
  - id: consult.available_imaging
    description: Imaging available for specialist review.
```

Do not require failed conservative treatment or MRI for every general consult.
