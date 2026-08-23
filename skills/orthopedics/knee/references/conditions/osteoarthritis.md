# Osteoarthritis

Use with the common requirements in `SKILL.md`.

Extract or explicitly mark missing:

- affected knee and symptom duration
- pain, stiffness, swelling, and functional limitations
- examination findings, including range of motion and gait when documented
- knee X-ray date and impression, including location and severity of
  degenerative changes
- medications, physical therapy or exercise, injections, bracing, assistive
  devices, and documented response
- previous knee procedures or surgery

## Requirement definitions

```yaml
requirements:
  - id: osteoarthritis.symptoms
    description: Pain, stiffness, swelling, symptom duration, and function.
  - id: osteoarthritis.exam
    description: Range of motion, gait, and other relevant examination findings.
  - id: osteoarthritis.xray
    description: X-ray date, location, and severity of degenerative changes.
  - id: osteoarthritis.nonoperative_care
    description: Medication, therapy, injections, bracing, devices, and response.
  - id: osteoarthritis.prior_surgery
    description: Previous knee procedures or surgery.
```

Do not infer clinical severity from imaging alone. MRI is not required for every
osteoarthritis referral.
