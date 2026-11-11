# Community Contribution Issuance — Operations and Recovery

**Status:** Applies after the atomic issuance workflow (PR #31) and database immutability guards are deployed.

## Normal issuance

1. An elected ADMIN creates or configures the campaign and creates the draft assessment (or the monthly scheduler creates the draft).
2. The ADMIN sets and verifies the due date. The amount and currency are inherited from the campaign and community Treasury.
3. The currently elected TREASURER reviews the period, amount, currency, due date, and expected active membership.
4. The TREASURER issues the assessment. The API executes one serializable transaction that locks the community membership boundary and assessment, creates immutable member snapshots, creates one linked Treasury obligation per snapshot, posts the balanced receivable/income journal entries, writes financial audit events, and sets the assessment to `ISSUED` last.
5. ADMIN/TREASURER review the assessment report. Members see only their own history.

## Handling an uncertain API response

A timeout or lost response does not mean issuance failed.

1. Read the assessment status and its report; do not issue a second assessment for the same campaign period.
2. If status is `ISSUED` and the report says `complete: true` with zero integrity errors, the operation completed. A retry of the same issue request is idempotent and returns the existing issuance after verifying snapshot-to-obligation links and immutable terms.
3. If status remains `DRAFT`, the issuance transaction rolled back. Correct the underlying cause, then retry the same assessment.
4. If status is `ISSUED` but the report is incomplete or reports integrity errors, stop. Do not manually insert snapshots, obligations, or journal rows and do not attempt to reset the assessment to `DRAFT`. Escalate for controlled investigation using the audit trail and database backup.

The issuance transaction is atomic. There is no supported partially issued/resumable state.

## Database immutability

- Campaign lifecycle events are append-only; updates and deletes are rejected by PostgreSQL triggers.
- An issued assessment cannot be updated or deleted.
- Member snapshots can be created and linked while the assessment is a draft. Once the assessment is issued, inserts, updates, moves, and deletes are rejected.
- The transition from `DRAFT` to `ISSUED` is allowed only when assessment terms remain unchanged. Issuance metadata may be set by the issuing transaction.
- Do not bypass these guards with manual SQL. Corrections to financial history require a separately authorized, audited correction/reversal workflow.

## Reconciliation and incident handling

- Compare assessment snapshot count with linked contribution obligations and use the assessment report's `complete` and `integrityErrors` fields as the application-level integrity check.
- Compare obligation totals and journal postings through Treasury reports; issuance creates receivables and contribution income, not cash.
- Receipt verification and allocation are separate Treasury workflows. A receipt must be independently verified before it is allocated; an obligation is not evidence of money received.
- Preserve the assessment ID, campaign ID, community ID, request timestamp, actor ID, audit event IDs, database error, and relevant provider/bank reference (if a later external receipt is involved). Do not put full bank details or member PII in application logs.
- Do not repair a discrepancy by editing balances or posted journal entries. Use the approved Treasury reversal/adjustment workflow after investigation.

## Index and query expectations

The current schema has indexes for:
- Campaign listing by community/status/creation time.
- Assessment reporting by community/status/due date and campaign/creation time.
- Snapshot lookup by assessment/snapshot time and member/creation time.
- Campaign event history by campaign/creation time and actor/creation time.

Review query plans with production-like data before adding redundant indexes. Index changes must be justified by measured query plans and write-cost impact.

## Explicitly out of scope

This runbook does not authorize provider collection, pooled custody, transfers, withdrawals, refunds, or live money movement. Those remain separate workstreams with their own provider, legal/compliance, and financial controls.
