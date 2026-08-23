# ACL Tear

Use with the common requirements in `SKILL.md`.

Extract or explicitly mark missing:

- affected knee, injury date, mechanism, and activity at injury
- pop sensation, early swelling, and ability to bear weight
- instability or giving way, locking or catching, and functional limitations
- range of motion, effusion, gait, and ligament examination findings such as
  Lachman, anterior drawer, or pivot shift
- X-ray and MRI dates and impressions
- associated meniscus, cartilage, bone, or other ligament injuries
- bracing, activity restriction, physical therapy, and response
- previous knee injury or surgery

## Requirement definitions

```yaml
requirements:
  - id: acl.injury_context
    description: Injury date, mechanism, activity, pop, swelling, and weight-bearing.
  - id: acl.instability
    description: Instability or giving way and functional limitations.
  - id: acl.ligament_exam
    description: Lachman, anterior drawer, pivot shift, or other ligament findings.
  - id: acl.mri_status
    description: Whether MRI was performed and its impression when available.
  - id: acl.associated_injuries
    description: Associated meniscus, cartilage, bone, or ligament injuries.
  - id: acl.treatment
    description: Bracing, activity restriction, physical therapy, and response.
```

Do not infer an ACL tear from symptoms alone or use this reference for an
isolated PCL injury.
