# PlayGeng — Reconciled Implementation Status and Remaining Work

**Last reconciled:** November 12, 2026  
**Repository:** `olexxee141-oss/PlayGeng`  
**Purpose:** One current source of truth for what has shipped, what is in progress, what remains unimplemented, and which product decisions must be settled before additional financial work begins.

> This document reconciles the merged pull-request history with the current README, Community Treasury architecture, Community Obligations policy, and Community Contributions implementation roadmap. It supersedes older status statements where later PRs have changed implementation reality. It does not silently approve unresolved business or custody rules.

---

## 1. Executive status

PlayGeng has moved beyond the initial product and community foundations. The repository now contains:

- Community identity and membership foundations.
- Elected community governance and centralized role authorization.
- A community Treasury schema and append-only double-entry journal.
- Obligation issuance/cancellation and manually verified receipts with obligation allocations.
- Community contribution campaign administration and monthly draft generation.
- Member contribution history and assessment reporting.
- PostgreSQL-enforced immutability for issued contribution assessments, member snapshots, and campaign lifecycle events (PR #34).
- Provider-independent Financial Service schema and service foundation, including collection idempotency, provider-event identity, verified-event settlement coordination, and reconciliation records (PR #40).
- Deterministic competition schedule and fixture persistence, seed assignment, and idempotent generation (PR #14).

PR #31 (atomic contribution assessment issuance), PR #34 (contribution immutability hardening), PR #40 (Financial Service foundation), and PR #14 (fixture persistence) are merged. The latest CI runs for PR #40 and PR #14 passed on their exact merged heads.

The financial system is **not production payment/custody infrastructure yet**. Current receipt verification is manual. No payment-provider collection, provider webhook settlement, pooled custody arrangement, provider transfer execution, or withdrawal workflow is implemented.

Match and competition workflows are not yet connected to Treasury. Their fee, liability, cancellation, refund, and payer rules remain to be decided before implementation.

---

## 2. Pull-request reconciliation

Repository status was checked against GitHub on November 11, 2026.

| PR | Scope | Status |
|---|---|---|
| #16 | Separate creator identity from elected offices; role authorization foundation | Merged |
| #17 | Community elections and elected ADMIN/TREASURER/ORGANIZER offices | Merged |
| #19 | Community Treasury and chart-of-accounts schema | Merged |
| #20 | Balanced journal posting and reversal APIs | Merged |
| #21 | Receipt and obligation-allocation schema | Merged |
| #22 | Treasury migration ordering correction | Merged |
| #23 | Obligation issuance and cancellation services | Merged |
| #24 | Manual receipt verification and allocation | Merged |
| #25 | Match, contribution, and competition commercial-workflow audit | Merged |
| #26 | Community-only obligation policy | Merged |
| #27 | Community contribution schema foundation | Merged |
| #28 | Contribution implementation roadmap | Merged |
| #29 | Monthly assessment AUTOMATIC/MANUAL generation policy | Merged |
| #30 | Campaign administration and monthly draft scheduler | Merged |
| #32 | Member visibility and assessment reporting | Merged |
| #31 | Atomic assessment issuance through Treasury | Merged (`bde0b87`) |
| #34 | Contribution database immutability and recovery runbook | Merged |
| #39 | Ratified Community Review Council charter | Merged |
| #40 | Provider-independent Financial Service foundation | Merged (`f8f368c`) |
| #14 | Fixture persistence and generation | Merged (`d6a2abe`) |

### Important PR dependencies and caveats

- PR #31 is merged. Its issuance transaction, shared membership-boundary locking, retry handling, and integration tests are now part of `main`.
- PR #32's reporting layer and PR #31's issuance workflow are both merged. Reporting now reads the immutable snapshots and Treasury allocations created by issuance.
- PR #14 is merged. Competition schedules and fixtures are now persisted, and schedule generation is idempotent and transactional. Result submission/approval, disputes, evidence, knockout advancement, standings, statistics, and venue/time scheduling are still separate work.
- PR #34's PostgreSQL triggers and recovery runbook complete the previously listed contribution-hardening PR D. The remaining contribution work is operational end-to-end validation and governance-authorized relief/refund workflows, not basic snapshot immutability.
- PR #40 is a provider-independent foundation, not a live payment integration. It does not implement provider signature verification, a Paystack adapter, live collection initiation, transfer execution, beneficiaries, or withdrawals.

---

## 3. Completed foundations and approved rules

### 3.1 Community identity and governance

Implemented through PRs #16 and #17. The three-arm constitutional direction is now documented in [Three Arms of Community Governance](../governance/THREE_ARMS_COMMUNITY_GOVERNANCE.md).

**Approved direction (November 11):** community members collectively form the highest authority (Community Assembly); elected ADMIN/TREASURER/ORGANIZER officers form the Executive; and an independent, separately elected Review Council forms the Judiciary. The Assembly directly decides every individual contribution exemption/waiver request. The Judiciary handles constitutional interpretation, Executive complaints, and procedural challenges; it does not decide the merits of relief requests. The creator retains one ordinary member vote and no special appointment or override power.

This is a governance direction, not yet implemented. Case-vote thresholds are ratified: the electorate is frozen when voting opens; quorum requires at least 50% of the frozen eligible electorate to cast a valid YES/NO vote; approval requires more than 50% of valid YES/NO votes cast; abstentions do not count as votes cast; a tie or failed quorum means not approved. The requester may present their case but cannot vote on their own relief. The ratified procedure requires 48 hours' notice, a 72-hour voting window, requester exclusion from voting, disclosure and recusal for direct material conflicts, and a fixed electorate after recusal determinations. Sensitive evidence remains restricted; the Assembly receives only information needed for a fair decision. The Review Council charter was ratified on November 11, 2026: three elected members plus two ranked alternates; 12-month terms and a two-consecutive-term limit; independent Assembly election; no concurrent Executive office; defined vacancy/recall and recusal rules; two-of-three conflict-free quorum and two affirmative votes for binding decisions; constitutional/procedural jurisdiction; seven-day challenge period; limited appeals and urgent relief. Do not add a generic "JUDGE" privilege to Executive authorization.

- The community creator is an immutable identity tied to `Community.ownerId`; creator identity is not an elected office.
- ADMIN, TREASURER, and ORGANIZER are elected offices.
- The creator has one ordinary vote and cannot stand as a candidate for those elected offices.
- The electorate is snapshotted when an election is created; later joiners do not enter an active election.
- Each eligible member gets one ballot.
- Quorum is declared per election within the documented 50%–100% range.
- Appointment requires quorum and a candidate receiving strictly more than half of valid ballots.
- A tie, failed quorum, no majority, or no eligible winner appoints nobody.
- Ballots and election history are retained; role assignment is transactional.
- Direct privileged-role assignment is not a substitute for the election workflow.
- Treasury authorization must not use the generic community-owner permission shortcut. Creator identity alone does not confer financial write authority.

### 3.2 Community Treasury

Implemented through PRs #19–24.

- Treasury is a shared financial domain, not a collection of unrelated paid flags in matches, competitions, and contributions.
- The journal is double-entry and append-only. Posted entries are not silently edited or deleted; corrections use reversing/adjustment entries.
- Money is stored as integer minor units. Each community Treasury has one ISO-4217 currency, fixed after its first posting.
- Obligations, payment attempts, verified receipts, allocations, and ledger postings are distinct concepts.
- An obligation records an amount owed; it does not represent cash received.
- A payment attempt is not proof of receipt.
- Verified manual receipt creation, allocation, DR CASH / CR RECEIVABLES journal posting, and audit recording are atomic and idempotent.
- Receipt allocations must exactly account for the verified receipt amount and cannot over-allocate an obligation.
- Member-visible financial records are restricted to the member's own records; ADMIN/TREASURER finance-read access is separately controlled.
- Treasury write operations are restricted to the currently elected TREASURER under the implemented policy.
- Manual reconciliation requires an independently checked external reference and evidence reference. An evidence reference is not proof of custody.
- No generic endpoint should permit arbitrary cash, receivable, or operational-income journal manipulation.

**Implemented by PR #40:** provider-independent provider/collection/event/settlement/reconciliation records; collection idempotency; duplicate provider-event identity; validated-event settlement coordination; atomic Treasury receipt/journal/allocation settlement; and mismatch reconciliation.

**Still not implemented:** provider signature verification, a production webhook endpoint/adapter, Paystack SDK/API integration, live collection initialization, external bank/provider statement reconciliation, custody approval, beneficiary verification, transfers, refunds, or withdrawals. Do not treat the current internal verified-event function as proof that an external event is authentic.

### 3.3 Community-only contributions

Implemented through PRs #27–32, including atomic issuance in merged PR #31.

Approved rules:

- This scope is for community-wide obligations independent of a match, competition, or tournament.
- Initial campaign types are one-off and monthly.
- An ADMIN creates/configures campaigns and controls their lifecycle.
- Monthly campaigns support an ADMIN-selected generation mode per campaign:
  - `AUTOMATIC`: creates a monthly draft assessment.
  - `MANUAL`: an ADMIN explicitly creates the monthly draft.
- Automatic generation does **not** automatically issue obligations. A currently elected TREASURER must explicitly issue the assessment.
- The monthly period boundary is the first day of the month at 00:00 in the community's configured IANA timezone; default timezone is UTC.
- Every active member at the issuance boundary is included in an immutable membership snapshot.
- Members joining after issuance are not added retroactively; monthly joiners become eligible at a later assessment, with no catch-up assessment in this scope.
- Leaving after issuance does not erase an existing obligation.
- Every member in one assessment receives the same fixed amount and currency.
- A due date is required before issuance and is frozen once issued.
- Overdue is derived from a passed due date and a positive outstanding amount; no initial grace period applies.
- Pause/end/cancel affect future campaign activity, not issued financial history. Cancellation is prohibited after the first assessment has been issued.
- Exemptions, waivers, corrections, and cancellations must be explicit, authorized, reasoned, attributable, timestamped, and audited.
- Treasury allocations remain the source of truth for amounts paid, outstanding, and overdue.

Current contribution delivery:

| Workstream | Status |
|---|---|
| Contribution campaign/assessment schema | Merged (#27) |
| Implementation roadmap and test contract | Merged (#28) |
| Monthly generation mode policy | Merged (#29) |
| Campaign administration and monthly draft scheduler | Merged (#30) |
| Atomic snapshot + obligation issuance | Merged (#31) |
| Member history and assessment reporting | Merged (#32) |
| Database immutability and issuance recovery runbook | Merged (#34) |
| Exemption/waiver authorization policy | Assembly authority, case-vote rules, and Review Council charter ratified; implementation pending |
| Refund workflow for settled obligations | Not implemented |

### 3.4 Current match and competition behavior

The November 10 commercial-workflow audit remains the factual baseline, with the following key findings:

**Matches**
- Participants can join, leave, be waitlisted, and have attendance recorded.
- There is no fee configuration, Treasury obligation link, payment gate, or refund integration.
- Match cancellation does not currently transition participant rows or emit the complete financial coordination history needed for downstream liability/refund handling.
- The product has not decided whether the fee liability trigger is confirmation, attendance, or a cutoff rule.

**Competitions**
- TEAM and PLAYER registration exist, with OPEN, APPROVAL_REQUIRED, and INVITE_ONLY flows.
- No registration fee, obligation link, paid/unpaid state, payment deadline, payment gate, or refund state exists.
- The product has not decided whether a fee is charged per team or per player, or who is liable for a team entry.
- Withdrawal, rejection, cancellation, unpaid capacity reservation, and refund consequences are not yet defined.

Do not add `isPaid` or mutable balance fields to MatchParticipant or CompetitionEntry. Treasury must remain the source of truth for obligations, allocations, and settlement.

---

## 4. New financial-service direction agreed November 11

The latest product direction is to keep payment execution outside the PlayGeng application and use one provider integration for all communities, rather than opening a separate Paystack account for each community.

### Intended model

- One Paystack merchant integration is the proposed first provider.
- One separate Financial Service handles collection attribution, ledgering, reconciliation, and transfer execution.
- The service maintains distinct accounting records for each community even though provider collection is centralized.
- PlayGeng remains responsible for community identity, governance, and initiating authorized workflows; it does not become a user-facing wallet.
- Community entitlements are tracked in the Financial Service's accounting ledger. An internal ledger balance is not a wallet or a claim that funds are legally segregated.
- The initial withdrawal rule is **the currently elected community TREASURER alone may initiate/authorize a withdrawal**. No community-wide vote or second officer approval is required for the initial version.
- Every withdrawal must still pass available-balance checks, beneficiary verification, idempotency, audit logging, provider-status handling, and reconciliation.
- The service should use a provider adapter boundary so Paystack is not permanently embedded throughout the domain model.

### Custody is still unresolved

The one-provider/one-integration model is a product direction, not yet an approved custody arrangement.

Before live collection or transfers, obtain written confirmation from Paystack that it permits the proposed use: one merchant integration receiving funds attributable to multiple independent communities, keeping their entitlements in an internal subledger, and transferring approved amounts to their verified beneficiaries. Also obtain appropriate Nigerian legal/compliance advice on the custody, safeguarding, third-party funds, settlement, and payout model.

A database subledger does not itself segregate funds legally, protect community funds from a provider/account freeze, or prove that the merchant may hold funds for third parties. Do not launch live money movement until those points are resolved.

### Withdrawal accounting rules

- The treasurer authorizes; the Financial Service executes and records.
- A withdrawal cannot exceed that community's available entitlement.
- A pending transfer must reserve the amount against further withdrawals so concurrent requests cannot overspend.
- On provider-confirmed success, post the final debit/settlement entry.
- On definitive failure, release the reservation and leave the community's entitlement intact.
- Unknown/pending provider outcomes must remain pending and be reconciled; never assume success or failure from a timeout.
- Beneficiary account details must be verified and changes audited.
- The former Treasurer must lose withdrawal authority immediately when their elected office ends.
- No administrator, creator, or other role gets an undocumented override.

---

## 5. Everything still awaiting implementation or final policy

### A. Contribution workflow — hardening baseline merged; policy workflows remain

1. Execute the full campaign-to-reporting workflow against PostgreSQL in CI/staging, including automatic/manual draft generation, due-date assignment, issuance, member history, and reports.
2. Retain PR #34's database immutability guards and runbook; add failure-injection/concurrency cases only where a coverage review identifies a real gap.
3. Implement Assembly-authorized exemptions/waivers using the ratified case-vote procedure, but do not enable case voting in production until an independent Review Council is operational for disputed recusals.
4. Apply final relief through separately authorized Treasury adjustment/reversal entries; never mutate issued assessments, snapshots, obligations, or posted journal entries.
5. Implement a distinct refund workflow before any settled receipt can be returned. Obligation cancellation or waiver is not a refund.

### B. Treasury operational hardening

1. Add end-to-end tests proving obligation issuance, receipt verification, allocations, and journal balances remain consistent under retries and concurrent operations.
2. Add an operational reconciliation process between internal journal totals and the actual external bank/provider statement.
3. Define evidence retention, audit access, correction procedures, and financial incident recovery.
4. Confirm pending withdrawal reservations, reversal handling, and provider reconciliation semantics before building transfer execution.
5. Keep all monetary calculations in integer minor units; do not use floating-point currency amounts.

### C. Financial Service — provider-independent foundation merged; live integration blocked by custody approval

PR #40 establishes the first provider-independent database and service boundary. It creates collection intents, stores provider event identities, coordinates settlement only for events already marked VALIDATED by a trusted adapter, and atomically records Treasury receipts/journal postings/obligation allocations or reconciliation discrepancies.

Remaining work:
1. Finalize the authenticated PlayGeng-to-Financial-Service service contract and service-to-service identity model.
2. Obtain written Paystack approval for the proposed single merchant integration receiving funds attributable to multiple independent communities, plus Nigerian legal/compliance advice on custody, safeguarding, third-party funds, settlement, and payouts.
3. Implement a Paystack adapter only after approval, including request signing, webhook signature verification, replay protection, provider API idempotency, status polling, and sandbox/contract tests.
4. Add explicit collection lifecycle transitions and external-reference binding; ensure provider callbacks cannot be trusted merely because they reach an internal service function.
5. Add external statement reconciliation and operational exception handling.
6. Design verified beneficiary management, Treasurer-only withdrawal authorization, pending reservations, transfer execution, definitive failure release, and unknown-outcome reconciliation as a separate later phase.
7. Do not enable live collection or movement of funds before provider permission and legal/compliance validation.

### D. Match-to-Treasury integration

Must be designed after community-only obligations are complete.

Policy decisions required before code:

- Is a match fee optional per match?
- At what point does a player become liable: joining/confirmation, attendance, or a defined cutoff?
- Does a WAITLISTED player owe anything before promotion?
- What happens when a confirmed player cancels or leaves?
- Is a NO_SHOW still liable?
- What happens to obligations and settled receipts when a match is cancelled or rescheduled?
- Who can waive a match fee, and how is that audited?
- What happens if a player is removed from the community while a match obligation is outstanding?

Implementation then needs durable match lifecycle events, stable source IDs, idempotent obligation creation, cancellation/refund coordination, and tests for all transitions. Do not create obligations from tentative states without an explicit rule.

### E. Competition/tournament commercial integration

Must be designed after the match rules and Treasury integration pattern are proven.

Policy decisions required before code:

- Is the registration fee per team or per player?
- For a team entry, is the payer the team, captain, or individual players?
- When is the obligation created: registration submission, approval, or invitation acceptance?
- What is the payment deadline?
- Must payment precede approval, confirmed entry, or fixture generation?
- Do unpaid pending entries reserve capacity, and for how long?
- What happens on rejection, withdrawal, competition cancellation, or a failed payment?
- Who is entitled to a refund and who authorizes it?

Then implement obligation creation and payment gates through Treasury, not local paid flags. Tournament fixture generation must not proceed on an unresolved registration/payment state if the eventual policy requires payment first.

### F. Competition fixtures and results

PR #14 is merged. It delivers competition-scoped schedule and fixture persistence, explicit seed assignment, deterministic generation, transactionally coupled competition start, pending-registration resolution, invitation cancellation, and idempotent schedule retrieval/generation.

Remaining work:
- Result submission, result approval, and correction/reversal policy.
- Evidence attachment, disputes, conflict handling, and appeal boundaries for disputed results.
- Knockout advancement based only on approved results.
- Standings and statistics after sport-specific result semantics are validated.
- Venue/time scheduling and fixture rescheduling.
- Revisit commercial registration gates only after the competition payer, fee, liability, cancellation, and refund policies are approved.

---

## 6. Recommended implementation order

This is the reconciled order. It intentionally avoids building payment collection, withdrawals, or tournament fixtures on top of unfinished business rules.

| Order | Work | Exit condition |
|---|---|---|
| 1 | Governance foundation: independent Review Council election and membership lifecycle | Three elected members plus two ranked alternates; independent Assembly election; eligibility, terms, conflicts, vacancies, recall, and permission separation enforced |
| 2 | Ratified Assembly case-vote and Judiciary review workflows | 48-hour notice, 72-hour voting, frozen non-recused electorate, 50% quorum, strict majority, requester exclusion, restricted evidence, conflict review, seven-day challenges, Council quorum/decision rules, and audit trail tested |
| 3 | Treasury relief and contribution refund/reversal workflows | Final Assembly decisions create auditable adjustments without mutating original obligations; refunds are separate from waivers and cancellation |
| 4 | Financial Service integration readiness | Authenticated service boundary and external reconciliation are defined; no live movement until provider and legal approval |
| 5 | Provider adapter and verified collection flow | Written provider/custody approval; signed requests/webhooks, replay protection, provider idempotency, sandbox tests, and one receipt per verified collection |
| 6 | Treasurer-only withdrawals | Verified beneficiaries, pending reservations, provider idempotency, definitive failure release, unknown-outcome reconciliation, and audit |
| 7 | Match-to-Treasury integration | Liability trigger, waitlist, cancellation, no-show, reschedule, waiver, and refund rules approved and tested |
| 8 | Competition commercial integration | Fee payer, obligation trigger, deadline, capacity reservation, withdrawal, rejection, cancellation, and refund rules approved and tested |
| 9 | Competition result lifecycle | Result submission/approval, disputes/evidence, knockout advancement, standings, statistics, venue/time scheduling |
| 10 | Product-wide operational readiness | Full end-to-end workflows, security review, observability, backup/recovery, and production runbooks pass |

If provider approval or compliance review rejects pooled custody, stop before live collections and redesign the custody arrangement. Do not quietly work around provider restrictions.

---

## 7. Non-negotiable engineering invariants

- An obligation is not a payment; a payment attempt is not a verified receipt; a receipt is not a transfer.
- No manual balance editing.
- No direct CRUD on posted ledger entries.
- Double-entry postings balance and are append-only; corrections are explicit reversals/adjustments.
- No duplicate effects from webhook retries, request retries, scheduler retries, or concurrent issuance.
- No community can spend another community's recorded entitlement.
- Pending withdrawals reserve funds; final debits depend on confirmed provider outcomes.
- No financial permission is inferred from creator identity or generic ADMIN/community-management permissions.
- The elected Treasurer alone authorizes withdrawals in the initial version.
- Every privileged financial action is attributable, reasoned where applicable, and audited.
- No live provider custody or transfer flow before provider permission and legal/compliance validation.
- Match and competition domains own their lifecycle rules; Treasury owns the financial obligations and settlement state.

---

## 8. Current next action

**The contribution-hardening PR D is merged (#34), the provider-independent Financial Service foundation is merged (#40), and fixture persistence is merged (#14). The next implementation phase is the ratified three-arm community governance workflow, beginning with independent Review Council election and membership lifecycle.**

Do not start live Paystack collection or withdrawal execution as a shortcut. The pooled custody model still requires written provider permission and Nigerian legal/compliance review. Governance must be implemented before enabling Assembly exemption/waiver case votes, because disputed recusals require an independent Judiciary. See [Community Governance Implementation Plan](COMMUNITY_GOVERNANCE_IMPLEMENTATION_README.md) for the ordered implementation contract.

