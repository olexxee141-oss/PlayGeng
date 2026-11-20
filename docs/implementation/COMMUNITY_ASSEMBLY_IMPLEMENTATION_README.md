# Community Assembly Implementation

**Status:** Policy foundation (#44) and private case intake (#45) merged; conflict review and electorate freeze implemented in PR #46 (pending exact-head CI). This document tracks implementation of the ratified Community Assembly rules; it does not create or amend constitutional authority.

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

### Slice 3 — Conflict declarations and electorate freeze (PR #46)

- Any active community member may confidentially declare a direct, material conflict against another active member; self-disclosure is supported.
- Declarations are case-specific, reasoned, retained for audit, and limited to one open declaration per subject per case.
- The subject can view the allegation without the declarant's identity and submit one response before independent review begins.
- An active primary Review Council member closes declaration intake and starts the independent review stage.
- The requester, declarant, subject, and any Council member who is themselves the subject of an open or confirmed conflict declaration are excluded from deciding that declaration.
- Only active primary Review Council members may decide; at least two eligible independent decisions and a strict majority are required. A tie or insufficient panel leaves the declaration unresolved.
- The electorate cannot be frozen while any declaration remains unresolved.
- Freeze records every active member, marks the requester and members with confirmed material conflicts ineligible, and stores the immutable eligible count used as the later quorum denominator.
- No evidence upload is accepted in this slice; secure evidence storage remains blocked on a trusted storage verification boundary.

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

The policy helper (#44), private case intake (#45), and Treasury-safe case intake foundation are merged. PR #46 implements confidential conflict declarations, one-time subject responses, independent primary-Council determinations, and an immutable electorate snapshot with the frozen quorum denominator. Evidence upload, Judiciary review, Treasury relief execution, and user interfaces remain unimplemented. Notice publication and the Assembly voting lifecycle are implemented in PR #47 (pending CI).


### Slice 4 — Case notice and Assembly voting (PR #47)

- A frozen electorate is required before notice publication.
- Notice publication records the public lifecycle timestamp and enforces a minimum 48-hour notice period before voting can open.
- Voting opens for exactly 72 hours.
- Only members marked eligible in the immutable electorate snapshot may cast a ballot.
- Each voter has one immutable YES/NO ballot.
- The database independently rejects ballots outside the voting window or from ineligible voters.
- Quorum is half of the frozen eligible electorate, rounded up.
- Approval requires quorum and a strict YES majority; ties and insufficient quorum reject the case.
- A primary Review Council member who is not the requester or an active conflict participant finalizes the outcome after the window closes.
