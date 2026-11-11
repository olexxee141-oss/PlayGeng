# Community Contributions — Implementation Roadmap

> Status: implementation plan  
> Scope: community-only contribution campaigns and assessments  
> Depends on: Treasury foundation and the community obligations policy

This document is the execution plan for implementing community-only contributions in PlayGeng. It deliberately separates campaign administration, financial issuance, and member-facing reporting so each boundary can be reviewed and tested independently.

The product and financial rules in [Community Obligations](../architecture/COMMUNITY_OBLIGATIONS.md) are authoritative. If this roadmap conflicts with that policy, the policy wins and this document must be updated.

## 1. Scope boundary

### Included

- One-off and monthly community contribution campaigns.
- An ADMIN-selected assessment generation mode for monthly campaigns: AUTOMATIC or MANUAL.
- One fixed amount per assessment, applied equally to every member in that assessment's immutable active-member snapshot.
- Explicit due dates and the community Treasury's configured currency.
- ADMIN-controlled campaign configuration and lifecycle.
- TREASURER-controlled financial issuance through the shared Treasury.
- Immutable member snapshots and auditable corrections/exemptions/cancellations.
- Member-specific obligation visibility and finance reporting.

### Explicitly excluded

- Match participation fees and match obligations.
- Competition registration fees, entry payments, forms, and payer rules.
- Payment-provider integrations, automated collection, custody, transfers, withdrawals, and refunds.
- Weekly, quarterly, or custom recurrence.
- Per-member amounts, discounts, proration, catch-up assessments, or retroactive charges.
- Automated contribution reminders (reserved for the notifications phase).

Do not expand scope through convenience fields or generic abstractions that implicitly implement these excluded workflows.

## 2. Non-negotiable domain rules

1. A campaign is configuration; it is not itself a financial obligation.
2. An assessment is one occurrence of a campaign. Each occurrence has a unique campaign/period key.
3. The active membership set is captured at the exact issuance boundary. Members joining later are not added retroactively.
4. Leaving after issuance does not erase an obligation.
5. Every snapshot member receives the same amount and currency for that assessment.
6. Amount, currency, due date, period key, and member snapshot are immutable after issuance.
7. Only an elected ADMIN may create/configure campaigns and perform campaign lifecycle actions.
8. Only the currently elected TREASURER may issue or cancel Treasury obligations under the existing Treasury authorization contract.
9. ADMIN/TREASURER can inspect community assessment and obligation status; a member can inspect only their own financial records.
10. Creator identity and generic community-management permissions do not grant Treasury write authority.
11. Exemptions, corrections, and cancellations must be explicit, authorized, attributed, reasoned, timestamped, and audited.
12. An issued assessment must never be presented as ISSUED while only some of its expected obligations exist.
13. Retries and concurrent requests must not duplicate assessment occurrences, snapshots, obligations, or journal postings.
14. A settled obligation cannot be cancelled as though no money was received. Refunds/reversals are separate workflows.

## 3. Workstream and pull-request plan

The work is intentionally divided into small PRs. Each PR must include its own tests and pass the repository's configured CI before merge.

### Assessment generation mode (approved product decision)

Each monthly campaign has an ADMIN-controlled `assessmentGenerationMode` setting with two values:

- `AUTOMATIC`: the system creates the month's assessment occurrence on the configured monthly schedule. The generated assessment is a draft awaiting financial issuance.
- `MANUAL`: the system does not generate monthly occurrences. An ADMIN explicitly creates each month's assessment occurrence when ready.

This is a per-campaign setting, not a global community setting. The ADMIN may change it only for future, uncreated occurrences; changing the mode never deletes, duplicates, or rewrites an existing assessment. The campaign's period key remains unique regardless of mode, so switching modes cannot create two assessments for the same month.

**Automatic generation is not automatic financial issuance.** In both modes, the assessment remains unissued until the currently elected TREASURER explicitly issues it. The scheduler must never create obligations, journal entries, receipts, or cash movements. This preserves the separation between campaign administration and Treasury authorization.

The monthly schedule is the **1st day of each month at 00:00 in the community's configured IANA timezone** (default `UTC`). The scheduler may run later after downtime and must still create the current month's draft if the campaign was active at that month's boundary. The campaign's state at the boundary determines whether that period exists: a campaign paused at the boundary does not generate that month, while a pause after the boundary affects the next month. Resuming after a paused boundary never backfills the skipped month. A campaign ended after the boundary still receives the already-due period draft if the worker was offline; ending before the boundary suppresses it. A campaign created after the month's boundary starts generating from the next month. Store the intended `YYYY-MM` period key independently of job execution time. Scheduler retries and delayed runs must be idempotent. The ADMIN may set the due date on the generated draft; the TREASURER must explicitly issue it. Pausing a campaign suppresses future automatic occurrences; resuming does not backfill paused periods. Ending a campaign stops future generation. A generated but unissued assessment remains subject to the existing campaign lifecycle rules and must not be silently discarded.

For one-off campaigns, the ADMIN explicitly creates the single assessment occurrence; the monthly generation-mode switch does not apply.

### PR A — Campaign administration and assessment lifecycle

**Proposed branch:** `feat/community-contribution-campaigns`  
**Depends on:** merged PR #27 schema foundation

Implement the `contributions` API module using the repository's standard architecture:

```text
contributions/
├── contributions.db.ts
├── contributions.service.ts
├── contributions.controller.ts
├── contributions.routes.ts
└── contributions.validator.ts
```

Responsibilities:

- ADMIN-only campaign creation and configuration, including the monthly assessment generation mode switch (`AUTOMATIC` / `MANUAL`).
- Validate positive integer minor-unit amounts, campaign name/description, and supported frequency.
- Resolve currency from the community Treasury; never accept a caller-selected assessment currency.
- Require an initialized Treasury before campaign creation.
- Create one-off assessment occurrences explicitly; create monthly occurrences manually or through an idempotent scheduler according to the campaign's generation mode. Every occurrence has a stable period key and explicit due date.
- Enforce uniqueness for campaign + period; make occurrence creation idempotent under retries and concurrency.
- Implement pause, resume, end, and cancel-before-first-issuance transitions.
- Require a reason for every lifecycle transition and write append-only campaign events.
- Do not create obligations or journal entries in this PR.
- Do not permit edits to financial terms on an issued assessment. Campaign edits affect only future, unissued occurrences.

Acceptance criteria:

- Non-ADMIN roles, including CREATOR, TREASURER and ORGANIZER, cannot create or administer campaigns unless they separately hold the ADMIN office.
- Campaign creation does not grant Treasury write access.
- One-off campaign has exactly one explicitly created occurrence.
- Monthly campaigns support ADMIN-selected AUTOMATIC and MANUAL generation modes.
- AUTOMATIC mode creates draft occurrences only; it never issues obligations or posts financial entries.
- MANUAL mode creates no monthly occurrence until an ADMIN explicitly requests it.
- Switching modes cannot duplicate or rewrite an existing period; occurrence identity is deterministic and duplicate-safe.
- Automatic scheduling uses a documented timezone and period boundary; retries and delayed jobs are idempotent.
- Paused campaigns produce no future occurrences; resuming does not create catch-up periods.
- Ended campaigns cannot resume or create future occurrences.
- Campaign cancellation is rejected once any assessment has been issued.
- Lifecycle actions preserve actor, reason, and timestamp in an append-only event history.
- Unit/integration tests cover permissions, valid/invalid transitions, duplicate occurrence creation, and concurrent requests.

### PR B — Atomic assessment issuance through Treasury

**Branch:** `feat/community-contribution-issuance`

**Implementation contract:** issuance, membership joins/leaves, and elected-role assignment serialize on the community row. Membership and governance transactions retry serialization conflicts. The assessment row is then locked; each snapshot receives one linked Treasury obligation through the transaction-aware Treasury primitive; `ISSUED` is the final write. Retried issuance verifies every snapshot-to-obligation link and immutable financial term before returning success. Any mismatch is an integrity failure, not a successful retry.  
**Depends on:** PR A

This is the financial-critical workstream. Before issuing any assessment, inspect and explicitly address membership write paths and transaction isolation.

Responsibilities:

- TREASURER-only issuance; verify the actor's current active community membership and elected role at execution time.
- Verify campaign and assessment belong to the requested community and the community Treasury exists.
- Establish a consistent issuance boundary against membership joins/leaves/role changes. Use a documented locking strategy shared with membership mutations, or a rigorously tested serializable transaction strategy that guarantees the intended snapshot semantics.
- Capture every active community membership and the required member identity/role/joined-at facts in the immutable assessment snapshot.
- Create exactly one Treasury obligation for each snapshot member, with identical amount, currency, due date, and stable source identity.
- Link each snapshot row to its obligation.
- Create obligation journal postings and financial audit events through the shared Treasury domain logic; do not duplicate accounting rules in the contributions module.
- Persist the assessment's issuer and issued timestamp only after every snapshot and obligation is present.
- Make the full operation atomic where possible. If it cannot fit in one transaction, implement a durable resumable issuance state machine/outbox; never expose partial issuance as complete.
- Handle retries and unique-constraint races by verifying the complete existing issuance matches the requested assessment, not by blindly returning an existing row.

Required Treasury refactor:

The current `obligations.db.ts` creation function owns its own serializable transaction. Assessment issuance cannot safely call that function repeatedly and claim the overall assessment is atomic.

Refactor the Treasury database operation into a transaction-client-aware primitive, for example:

- A low-level `createObligationInTransaction(tx, input)` that performs the existing obligation + journal + audit writes using a caller-provided `Prisma.TransactionClient`.
- The existing standalone Treasury workflow continues to open its own serializable transaction and delegates to that primitive.
- Contributions issuance calls the same primitive inside its encompassing transaction.

Keep authorization in the Treasury service boundary. Do not expose a general-purpose route that lets the contributions module bypass Treasury authorization. If internal domain composition requires a dedicated Treasury service method, keep it internal and explicitly authorize the Treasurer before entering the transaction.

Membership consistency is a release blocker:

- Inspect all membership creation, removal, and role mutation paths.
- Determine the database provider's row-lock semantics and Prisma transaction behavior.
- Use a consistent lock order to avoid deadlocks.
- Ensure a join or leave concurrent with issuance is deterministically before or after the issuance boundary.
- Add integration tests proving the snapshot outcome for concurrent join/leave operations.
- If a safe shared locking contract cannot be implemented in the same transaction, use a durable issuance state machine with an explicit, recorded snapshot boundary; do not guess based on application timestamps alone.

Acceptance criteria:

- Every active member at the issuance boundary has exactly one snapshot row and one linked obligation.
- Members joining after the boundary have no obligation in that assessment.
- Members leaving after the boundary retain their issued obligation.
- All obligations have identical amount, currency, and due date.
- Snapshot rows and issued financial terms cannot be edited through public APIs.
- Repeated issuance with the same request is safe and produces no duplicates.
- Concurrent issuance requests produce one complete issuance.
- Any injected failure rolls back all writes, or leaves a durable resumable state that is not marked ISSUED.
- Existing standalone Treasury obligation creation behavior and tests remain intact.
- Financial ledger remains balanced; no cash is recorded merely because an obligation was issued.

### PR C — Assessment, snapshot, and obligation visibility

**Proposed branch:** `feat/community-contribution-reporting`  
**Depends on:** PR B

Responsibilities:

- ADMIN/TREASURER can list and inspect community campaigns, occurrences, member snapshots, and derived collection progress.
- Members can inspect only their own assessment participation and linked obligations.
- Reuse Treasury allocation data as the sole source of settled/partially settled/outstanding balances.
- Derive overdue state from due date and outstanding balance; do not add contribution-specific paid/overdue flags.
- Preserve visibility of an issued obligation and snapshot when a member later leaves the community.
- Use cursor pagination and stable ordering.
- Return minor-unit amounts as strings; never serialize JavaScript floating-point currency values.
- Do not expose evidence references or another member's personal financial records to ordinary members.

Acceptance criteria:

- Members cannot enumerate another member's obligations or receipt allocations.
- ADMIN/TREASURER read access does not imply Treasury write access.
- Outstanding, partially paid, paid, and overdue states agree with Treasury allocations and due dates.
- A fully settled obligation is never overdue.
- Former members' issued obligations remain attributable and reportable to authorized finance roles.
- Pagination, authorization, and status derivation have integration coverage.

### PR D — Hardening and operational readiness

**Proposed branch:** `test/community-contributions-hardening`  
**Depends on:** PRs A–C

Responsibilities:

- Run migration validation against the actual schema history and supported database.
- Verify Prisma schema generation and generated client compatibility.
- Add failure-injection tests for transaction rollback and resumability.
- Add concurrency tests for campaign occurrence creation, issuance, and membership mutations.
- Verify append-only behavior for campaign events and issued snapshots at the API and database permission boundaries.
- Review indexes and query plans for campaign, occurrence, snapshot, obligation, and member access patterns.
- Document operational recovery for any resumable issuance state.
- Verify logs do not leak member PII or financial evidence references.

Acceptance criteria:

- Prisma validation, migration deployment, typecheck, unit tests, integration tests, and build pass in CI where configured.
- No test relies on timing sleeps to establish concurrency correctness.
- All public mutation paths enforce authorization and audit requirements.
- No unresolved partial issuance can be mistaken for a completed assessment.

## 4. API direction

Exact endpoint names should follow existing route conventions after inspecting the current API mount structure. Expected resource operations:

```text
/api/v1/communities/:communityId/contributions/campaigns
/api/v1/communities/:communityId/contributions/campaigns/:campaignId
/api/v1/communities/:communityId/contributions/campaigns/:campaignId/pause
/api/v1/communities/:communityId/contributions/campaigns/:campaignId/resume
/api/v1/communities/:communityId/contributions/campaigns/:campaignId/end
/api/v1/communities/:communityId/contributions/campaigns/:campaignId/cancel
/api/v1/communities/:communityId/contributions/assessments
/api/v1/communities/:communityId/contributions/assessments/:assessmentId
/api/v1/communities/:communityId/contributions/assessments/:assessmentId/issue
/api/v1/communities/:communityId/contributions/assessments/:assessmentId/members
/api/v1/communities/:communityId/contributions/assessments/:assessmentId/mine
```

The API must not expose snapshot mutation, arbitrary obligation creation, or direct ledger posting through contribution endpoints.

## 5. Test matrix

At minimum, cover:

| Area | Required cases |
|---|---|
| Authorization | ADMIN campaign actions; TREASURER issuance; ADMIN/TREASURER read; member-own read; CREATOR identity is not an override |
| Campaign lifecycle | pause/resume/end/cancel rules; cancellation prohibited after first issue |
| Frequency/generation | one-off single occurrence; monthly AUTOMATIC/MANUAL modes; deterministic timezone/period; idempotent scheduler; no catch-up after pause; scheduler never issues obligations |
| Snapshot | active members included; later joiners excluded; leavers retain obligations; roles and identity facts captured |
| Uniform assessment | same amount/currency/due date for every snapshot member |
| Treasury | receivable/income journal balanced; no cash increase; receipt allocations drive settlement |
| Idempotency | duplicate campaign request, occurrence request, issuance request, and retry after uncertain response |
| Concurrency | concurrent occurrence creation; concurrent issuance; join/leave racing with issuance; cancellation/allocation race remains safe |
| Failure handling | failure after snapshot creation, obligation creation, journal creation, and audit write |
| Reporting | outstanding/partial/paid/overdue derived from allocations and due date; former-member history retained |
| Privacy | member cannot see another member's financial details or evidence references |

## 6. Implementation rules

- Keep domain logic in services and persistence in database modules.
- Keep validators strict; reject unknown fields.
- Keep controllers thin.
- Reuse existing authentication and authorization patterns, but do not reuse generic community-owner permission helpers for Treasury writes.
- Do not duplicate Treasury accounting logic.
- Use integer minor units and ISO-4217 Treasury currency.
- Use stable source identities and idempotency keys scoped to the Treasury.
- Use serializable transactions and explicit locking where required; retry serialization conflicts safely.
- Treat audit history as append-only.
- Every PR must include tests and update this roadmap if decisions change.
- Do not merge a PR solely because it was opened or because a previous PR merged. Inspect all required checks on its current head.

## 7. Execution order

1. PR A — campaign administration, monthly generation-mode switch, and assessment lifecycle (including scheduler for AUTOMATIC mode).
2. PR B — Treasury transaction composition, membership snapshot consistency, and atomic issuance.
3. PR C — visibility and reporting.
4. PR D — hardening and operational readiness.

Do not begin match obligations, competition fees, payment-provider integration, or withdrawals until this community-only contribution workflow is complete and its financial invariants are verified.


## 8. PR C — Contribution visibility and reporting implementation

**Branch:** `feat/community-contribution-reporting`

The read-only reporting layer is implemented independently of the still-unmerged atomic issuance work:

- `GET /api/v1/communities/:communityId/contributions/mine` returns only the authenticated user's immutable contribution snapshot rows and linked Treasury allocation totals. It does not require current community membership, so an active user retains access to their own historical records after leaving.
- `GET /api/v1/communities/:communityId/contributions/assessments/:assessmentId/report` returns assessment metadata, snapshot count, assessed/collected/outstanding minor-unit totals, and derived status counts. Only elected ADMIN and TREASURER roles can access it.
- `GET /api/v1/communities/:communityId/contributions/assessments/:assessmentId/members` returns paginated snapshot member rows for elected ADMIN/TREASURER roles. Member identity fields come from the immutable snapshot, not current membership.
- Allocation sums are read from Treasury and no contribution-specific paid, overdue, or balance columns are introduced.
- Draft assessments with no snapshot are not represented as collectible member obligations.
- An ISSUED assessment with a missing obligation link is surfaced through `counts.integrityErrors` and `totals.complete: false`; it is not silently counted as unpaid.
- Amounts are serialized as integer minor-unit strings. Reporting pagination is bounded to 1–100 rows (default 25).

This reporting layer does not repair or validate PR B. Until atomic issuance is merged, member history may be empty and draft assessments will have no issued member rows. PR C must still pass its own migration, typecheck, test, and build checks before merge.
