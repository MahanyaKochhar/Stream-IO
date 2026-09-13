# Healthcare Referral AI

Help specialty-practice staff turn referral PDFs into structured cases, identify
missing information, and review findings before deciding whether to accept a referral.
The current app focuses on orthopedic knee referrals.

## Implemented

- **PDF intake:** Upload one packet per case, classify referral intent, and stop
  processing documents that are not referrals.
- **Structured extraction:** Extract patient, referring provider, insurance, and
  clinical details using predefined categories.
- **Intake checks:** Check specialty routing and required patient and insurance
  fields. Explain missing information in readable language.
- **Knee requirements:** Support ACL tears, meniscus tears, and osteoarthritis for
  general consultation and surgical evaluation. Identify documented and missing findings.
- **Coordinator review:** Display findings beside the source PDF. Staff can edit
  findings, approve or reject the referral, and record their name and decision time.
- **Live workspace:** Use Next.js and `useStream` to show progress and separate
  Processing, Review, and Completed queues. Mark incomplete cases “Needs information.”
- **Saved cases:** Run LangGraph Agent Server with PostgreSQL for threads and
  checkpoints. Keep uploaded PDFs in an ignored local folder shared with the backend.
- **Case notes:** Save text messages with each referral; conversational agent replies
  are not implemented yet.

## Future work

- **Supervisor agent:** Make referral intake the first tool of a broader assistant.
  Keep one case per chat; initially handle packet uploads and reply “Coming soon”
  for unsupported requests.
- **Conversational follow-up:** Answer case questions and accept missing details or
  corrections, with validation before updating the referral.
- **More specialties:** Add clinical requirements and workflows beyond knee referrals.
- **Evidence and matching:** Link individual findings to source pages, match patients
  and providers, and flag conflicting information across documents.
- **Authorized integrations:** Retrieve missing information from approved records
  and prepare follow-up requests for staff review.
- **Authorization and scheduling:** Check payer requirements, prepare authorization
  requests, and track scheduling readiness. Start with simulated integrations.
- **Deployment and access:** Add user access controls, audit history, and hosted
  deployment. Move PDFs to shared object storage when needed.
- **Voice interaction:** Add spoken questions and actions over the same case workflow.

Clinical acceptance and rejection remain staff decisions. The goal is to reduce
manual intake work and make incomplete referrals easier to resolve.

See the [README](README.md) for setup and the
[workflow](docs/referral-intake-agent-flow.md) for implementation details.
