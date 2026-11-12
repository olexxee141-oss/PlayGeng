# Community Governance Implementation Plan

**Status:** Implementation contract for the ratified community governance policies.  
**Last reconciled:** November 12, 2026.  
**Authority:** [Three Arms of Community Governance](../governance/THREE_ARMS_COMMUNITY_GOVERNANCE.md) and the [ratified Community Review Council Charter](../governance/PROPOSED_REVIEW_COUNCIL_CHARTER.md).

This plan turns the approved governance rules into ordered, testable implementation slices. It does not amend the constitution or grant any arm powers that are not already ratified.

## 1. Current implementation baseline

The repository currently has an Executive election foundation:

- CommunityElection, ElectionEligibleVoter, ElectionNomination, and ElectionBallot persist office elections.
- The electorate is snapshotted when an election is created.
- Elections use one-member/one-vote ballots, configured quorum, majority outcome, and transactional role assignment.
- ADMIN, TREASURER, and ORGANIZER are assigned through this existing Executive election workflow.
- The community creator remains a distinct identity and has one ordinary Assembly vote.

The following are **not implemented**:

- Independent Review Council election, seats, alternates, terms, vacancies, and recall.
- Private exemption/waiver requests and Assembly case votes.
- Conflict declarations, recusals, and independent disputed-conflict determination.
- Judiciary case assignment, decisions, appeals, and interim relief.
- Audited Treasury adjustments applying final Assembly relief decisions.

Do not describe the current Executive election module as implementation of all three arms.

## 2. Constitutional boundaries

### Community Assembly

- The Assembly consists of eligible active community members.
- It is the highest community authority.
- It decides the merits of each individual exemption/waiver request by direct case vote.
- The requester may submit evidence and respond to questions but cannot vote on their own request.
- The electorate is frozen when voting opens, after required conflict determinations and recusals.

### Executive

- The elected ADMIN, TREASURER, and ORGANIZER offices execute community administration.
- Executive authority does not include appointing, removing, or controlling the Judiciary.
- The elected Treasurer remains the only initial authority for ordinary withdrawal authorization under the separate Financial Service policy.
- Executive permissions must not be granted to Review Council members or alternates.

### Judiciary — Community Review Council

- Three elected members and two ranked elected alternates.
- Independently elected by the Assembly.
- Twelve-month terms, maximum two consecutive full terms.
- No concurrent Executive office.
- No creator appointment, removal, veto, or override.
- Two of three conflict-free assigned reviewers form quorum; a binding ruling requires two affirmative votes.
- Jurisdiction is constitutional interpretation, Executive complaints, procedural challenges, and disputed recusals.
- It does not decide the merits of exemption/waiver requests, alter obligations, edit journals, approve withdrawals, or execute Treasury adjustments.

## 3. Non-negotiable case-vote procedure

Every Assembly exemption/waiver case vote must enforce:

1. At least 48 hours' notice before voting opens.
2. A 72-hour voting window, closed at the published deadline.
3. An immutable electorate snapshot created after conflict declarations and recusal determinations.
4. At least 50% of the frozen eligible electorate casting a valid YES or NO vote for quorum.
5. Approval only when more than 50% of valid YES/NO votes cast are YES.
6. Abstentions do not count as votes cast.
7. A tie or failed quorum means the request is not approved.
8. The requester is automatically excluded from voting on their own request.
9. Direct, material personal or financial conflicts must be disclosed and recused. Ordinary membership or a general interest shared equally by the community is not, by itself, a conflict.
10. A disputed conflict is determined by an independent, conflict-free authority. The requester, subject, conflicted officer, creator, or ordinary Executive officer cannot decide it.
11. Sensitive evidence is restricted to authorized reviewers; the Assembly sees only the information needed for a fair decision.
12. All notices, electorate snapshots, recusals, ballots, quorum calculations, outcomes, and execution events are attributable and auditable.

A case vote must remain pending if a disputed recusal cannot be independently determined. Do not bypass the transitional rule by allowing an Executive officer to decide it.

## 4. Implementation sequence

### PR A — Independent Review Council election and membership

Build the Judiciary's institutional foundation before enabling Assembly case voting.

Deliverables:

- Separate Review Council election-cycle and seat records. Do not add a generic JUDGE permission to CommunityMember.role.
- Three Council member seats and two alternate seats, with alternate rank explicitly persisted.
- Active-member eligibility, required disclosures, and exclusion of anyone holding an Executive office.
- Independent Assembly electorate snapshot and one-member/one-vote ballot enforcement.
- Ratified election quorum and majority rules for every filled seat. A seat without a qualifying winner remains vacant; never promote a runner-up who failed the threshold.
- Twelve-month terms and two-consecutive-full-term limit.
- Acceptance and substitution of the highest-ranked eligible alternate for a vacancy or case recusal.
- By-election when no eligible alternate can fill a vacancy.
- Assembly recall under the ratified notice, electorate, quorum, and majority safeguards.
- No Executive, creator, or Treasury write permissions for Council members or alternates.
- Immutable election and membership history, audit events, and integration tests.

**Ballot mechanics constraint:** preserve the existing one-voter/one-candidate, quorum, and strict-majority semantics. The implementation must make the five seats and alternate ranking explicit and deterministic; it must not silently substitute plurality or ranked-choice voting. The exact seat-round sequencing must be documented in the PR before schema migration.

Exit condition: a community can elect and maintain the Review Council without granting Judiciary members Executive permissions, and all vacancy/recusal/recall paths are tested.

### PR B — Assembly exemption/waiver requests and case votes

Deliverables:

- Private request against a specific contribution obligation or assessment.
- Requester eligibility and status validation.
- Case notice with at least 48 hours before opening.
- Conflict disclosure and recusal workflow before electorate freeze.
- Independent Review Council determination for disputed conflicts.
- Fixed electorate snapshot, including a recorded quorum denominator.
- 72-hour YES/NO voting window; no vote changes or duplicate ballots.
- Requester exclusion and conflict-recusal enforcement at the database boundary.
- Quorum and strict-majority calculation exactly as ratified.
- Immutable case outcome with reasons, vote totals, quorum result, recusals, and timestamps.
- Restricted evidence access and privacy-safe Assembly summaries.
- No change to the obligation or Treasury when a request is submitted or while voting is pending.
- Tests for requester exclusion, late joiners, leavers, conflicts, recusals, failed quorum, ties, duplicate votes, race conditions, and privacy boundaries.

Exit condition: the Assembly can decide a case under the ratified rules, while the original obligation remains unchanged.

### PR C — Judiciary review, appeals, and interim relief

Deliverables:

- Judiciary case records and jurisdiction validation.
- Conflict checks, case assignment, alternate substitution, and restricted recusal records.
- Council deliberation and immutable reasoned decisions.
- Two-of-three conflict-free quorum and at least two affirmative votes for binding decisions.
- Unresolved status where quorum or the two-affirmative threshold is not met.
- Seven-calendar-day challenge period and defined appeal boundaries.
- Narrow, time-limited interim relief requiring at least two conflict-free Council members.
- No interim relief that grants a waiver, changes a ledger, erases an obligation, or authorizes a transfer.
- Assembly remittal only within the charter's appeal limits.
- Audit events, privacy restrictions, and tests for conflicts, vacancies, recusals, panel quorum, dissents, appeals, and urgent relief.

Exit condition: procedural and constitutional review is independent, bounded, auditable, and cannot decide the merits of a member's hardship request.

### PR D — Treasury relief execution and refund boundary

Deliverables:

- A final Assembly outcome is translated into a separate, authorized Treasury adjustment/reversal.
- The original obligation, issued assessment, member snapshot, and posted journal remain immutable.
- The executing actor, decision reference, amount, reason, and resulting journal entries are linked and audited.
- The decision-maker does not execute their own financial adjustment where separation is required.
- Idempotent execution prevents duplicate adjustments.
- A settled receipt refund is a separate workflow with its own authorization, provider status, and ledger reversal.
- Waiver, obligation cancellation, and refund are distinct states and operations.

Exit condition: approved relief changes the outstanding amount only through balanced, traceable Treasury entries; refunds cannot be represented as waivers or cancellations.

## 5. Data and authorization design rules

- Keep Judiciary seats and case assignments separate from CommunityMember.role and Executive permissions.
- Reuse shared policy helpers where they are genuinely common; do not force the multi-seat Council election into the existing single-winner Executive role-assignment flow.
- Use immutable electorate snapshots and unique constraints for one ballot per voter per contest/case.
- Use serializable transactions and the established community membership-boundary lock where electorate eligibility or membership can race.
- Check current office/seat status at execution time, not only when a request is created.
- Keep sensitive evidence and conflict details in restricted records; never expose them through ordinary community member endpoints.
- All privileged state changes must have actor, timestamp, reason/decision reference, and audit history.
- Treasury adjustments must use Treasury services and balanced journal entries. Governance code must not write ledger rows directly.
- Do not allow generic community owner/creator shortcuts to bypass elected authority.

## 6. Explicitly deferred

Do not combine this work with:

- Match-fee liability or match-to-Treasury integration.
- Competition registration fees or payment gates.
- Live Paystack collection or transfer execution.
- A user-facing wallet.
- Generic platform-wide voting unrelated to the ratified community constitution.

The pooled Financial Service custody model still requires written provider permission and Nigerian legal/compliance review. The provider-independent Financial Service foundation is merged, but that does not authorize live movement of community funds.

## 7. Required validation for every PR

Every implementation PR must include:

- Prisma migration and generated-client validation.
- Typecheck and workspace build.
- Unit tests for policy calculations and state transitions.
- PostgreSQL integration tests for constraints, transactions, concurrency, and authorization.
- Cross-community isolation tests.
- Audit and privacy tests.
- Failure-injection tests for partial operations and retries.
- An update to IMPLEMENTATION_STATUS_AND_NEXT_STEPS.md when the delivery state changes.

Never merge based on CI from an older head. Inspect the workflow runs associated with the exact latest PR head SHA.
