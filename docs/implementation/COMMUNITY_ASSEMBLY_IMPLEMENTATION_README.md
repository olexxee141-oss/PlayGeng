# Community Assembly Implementation

**Status:** Policy foundation merged (#44); private case intake in progress (PR #45). This document tracks implementation of the ratified Community Assembly rules; it does not create or amend constitutional authority.

## Constitutional baseline

The Community Assembly consists of active, eligible community members. The creator has one ordinary vote. The Assembly is the highest community authority and decides individual contribution exemption/waiver requests directly. The Executive cannot decide a request on the Assembly's behalf, and the Review Council reviews constitutional or procedural validity rather than the merits of hardship relief.

## Ratified individual case-vote procedure

- Publish notice at least 48 hours before voting opens.
- Keep voting open for exactly 72 hours.
- Freeze the electorate only after applicable conflict declarations and recusal determinations.
- Exclude the requester from voting on their own request.
- Exclude members whose direct, material personal or financial conflict has been established before the electorate is frozen.
- Require at least 50% of the frozen eligible electorate to cast a valid YES or NO ballot.
- Approve only when YES votes exceed 50% of valid YES/NO votes cast.
- Abstentions do not count as votes cast.
- A tie or failed quorum means the request is not approved.
- Do not lower the frozen quorum denominator after voting opens.
- Sensitive evidence remains restricted; the Assembly receives only the information needed for a fair decision.
- Record notices, electorate snapshots, recusals, ballots, quorum calculations, outcomes, and execution events for audit.

A disputed conflict must be determined by an independent, conflict-free authority. If that determination cannot be made, the vote remains pending; an Executive officer or the conflicted person cannot decide it.

## Delivery slices

### Slice 1 — Pure policy foundation

- Shared constants for 48-hour notice, 72-hour voting window, and 50% quorum.
- Deterministic schedule validation.
- Deterministic vote outcome calculation against the frozen, non-recused electorate.
- Abstentions excluded from the vote totals.
- Tests for minimum notice, exact duration, odd-sized electorate quorum, strict majority, ties, invalid counts, and ballot totals.

### Slice 2 — Private case intake (PR #45)

- A member may submit a private request only against their own issued contribution assessment snapshot and non-cancelled obligation.
- The request reason is visible only through the requester's own case endpoints; there is no community-wide or Executive listing endpoint.
- Only one submitted case may be open for an issued assessment-member snapshot at a time; a withdrawn case remains in history and does not permanently block a later submission.
- Submission and requester withdrawal are recorded as append-only audit events.
- Filing or withdrawing a request does not mutate the assessment, obligation, allocation, or Treasury.
- Secure evidence upload and restricted evidence references are not included in this slice; they require a trusted storage upload/verification boundary before any evidence object key is accepted.

### Slice 3 — Conflict declarations and electorate freeze

- Per-case declarations and restricted recusal decisions.
- Independent determination for disputed conflicts.
- Requester and recused-member exclusion.
- Immutable electorate snapshot and recorded quorum denominator.
- Vote cannot open while a material conflict dispute remains unresolved.

### Slice 4 — Case notice and voting

- Published notice and scheduled voting window.
- One YES/NO ballot per frozen eligible voter.
- Automatic closure at the published deadline.
- Immutable outcome, vote totals, quorum calculation, and audit trail.
- Assembly recall of Review Council members uses this same voting machinery, with recall-specific subject exclusion and safeguards.

### Slice 5 — Judiciary review and Treasury execution

- Seven-calendar-day procedural challenge window.
- Review Council jurisdiction, conflict-free panel assignment, quorum, decisions, appeals, and limited interim relief.
- Final Assembly relief decisions are applied through separate authorized Treasury adjustments.
- Refunds remain distinct from waivers and cancellations.

## Non-negotiable boundaries

- Do not add Assembly voting permissions to Executive roles.
- Do not add a generic JUDGE role.
- Do not expose private evidence through ordinary community or election endpoints.
- Do not change an issued obligation or posted journal entry as a side effect of filing or voting.
- Do not allow the decision-maker to execute their own financial adjustment where separation is required.
- Do not connect Paystack, collection, transfers, or withdrawals in this phase.

## Current implementation status

The policy helper and unit tests are merged (#44). PR #45 proposes persistent private case intake, requester-only retrieval, requester withdrawal, and append-only lifecycle events; merge remains pending exact-head CI. Evidence upload, conflict/recusal workflow, electorate snapshots, notices, ballots, Judiciary review, and user interfaces remain unimplemented.
