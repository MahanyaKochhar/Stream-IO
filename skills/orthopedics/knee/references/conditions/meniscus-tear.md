# Meniscus Tear

Use with the common requirements in `SKILL.md`.

Extract or explicitly mark missing:

- affected knee, injury date, mechanism, and symptom duration
- medial or lateral joint-line pain
- swelling, catching, clicking, locking, giving way, and range-of-motion limits
- joint-line tenderness, effusion, and meniscus examination findings when
  documented
- X-ray date and impression, including degenerative changes
- MRI status and impression, including tear location or displacement when
  documented
- medications, activity modification, physical therapy, and response
- previous meniscus or knee surgery

## Requirement definitions

```yaml
requirements:
  - id: meniscus.joint_line_pain
    description: Medial or lateral joint-line pain.
  - id: meniscus.mechanical_symptoms
    description: Catching, clicking, locking, or giving way.
  - id: meniscus.exam_findings
    description: Joint-line tenderness, effusion, or meniscus examination findings.
  - id: meniscus.mri_status
    description: Whether MRI was performed and its impression when available.
  - id: meniscus.tear_details
    description: Tear location or displacement when documented.
  - id: meniscus.prior_surgery
    description: Previous meniscus or knee surgery.
```

Capture a locked knee or displaced tear when documented. Do not infer tear type,
repairability, or surgical candidacy.
