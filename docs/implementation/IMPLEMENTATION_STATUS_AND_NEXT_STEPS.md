# PlayGeng — Reconciled Implementation Status and Remaining Work

**Last reconciled:** November 11, 2026  
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

The immediate implementation checkpoint is **PR #31: atomic contribution assessment issuance through Treasury**. It is open, and the latest observed CI run for head `3431e4efa85ce7e241b8c136f7f5d4b3fdf20a77` completed successfully. It has not been merged.

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
| #31 | Atomic assessment issuance through Treasury | **Open; latest observed CI successful** |
| #14 | Fixture persistence and generation | **Open; recorded CI run failed; separate older workstream** |

### Important PR dependencies and caveats

- PR #31 must be reviewed and merged before treating contribution issuance as complete. CI passing is necessary, not a substitute for reviewing the transaction and membership-locking guarantees.
- PR #32 is already merged, but its reporting layer does not implement or replace atomic issuance. Its own roadmap checkpoint explicitly notes that history can remain empty and draft assessments have no member obligations until PR B (#31) is merged.
- PR #14 is not a dependency for the financial work. It is an older open fixture-persistence PR with a failed recorded CI run. Rebase/audit it and inspect its current checks before deciding whether to continue, replace, or close it. Do not merge it based on its age or previous work.

---

## 3. Completed foundations and approved rules

### 3.1 Community identity and governance

Implemented through PRs #16 and #17.

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

**Not implemented by this foundation:** payment-provider collection, provider webhooks, funds custody, bank settlement, transfers, refunds, or withdrawals.

### 3.3 Community-only contributions

Implemented in part through PRs #27–32, with issuance in open PR #31.

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
| Atomic snapshot + obligation issuance | Open PR #31; CI passing on observed head |
| Member history and assessment reporting | Merged (#32) |
| Exemption/waiver authorization policy | Not finalized |
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

### A. Immediate: finish community contributions

1. Review PR #31's transaction and locking design, especially the shared community-row lock across issuance and membership add/remove/role changes.
2. Verify that every membership write path uses the same serialization boundary and that tests cover concurrent join/leave versus issuance.
3. Verify atomic rollback across snapshots, obligations, journal postings, audit events, and final ISSUED status.
4. Verify retry behavior and integrity checks for an already-issued assessment.
5. Review PR #31's latest CI and merge only after code review confirms the invariants.
6. Run the full contribution workflow from campaign creation through draft generation, due-date assignment, issuance, member history, and reporting.
7. Resolve the remaining contribution policy: who may approve exemptions/waivers/corrections, what happens when the Treasurer is the affected member, and how removal from a community affects outstanding obligations beyond the rule that they are not silently erased.
8. Add a distinct refund/reversal workflow before any settled receipt can be returned. Obligation cancellation is not a refund.

### B. Treasury operational hardening

1. Add end-to-end tests proving obligation issuance, receipt verification, allocations, and journal balances remain consistent under retries and concurrent operations.
2. Add an operational reconciliation process between internal journal totals and the actual external bank/provider statement.
3. Define evidence retention, audit access, correction procedures, and financial incident recovery.
4. Confirm pending withdrawal reservations, reversal handling, and provider reconciliation semantics before building transfer execution.
5. Keep all monetary calculations in integer minor units; do not use floating-point currency amounts.

### C. Separate Financial Service

Not yet implemented.

1. Finalize custody/provider permission and regulatory review.
2. Define service boundary and authenticated PlayGeng-to-Financial-Service contract.
3. Design provider-neutral collections, receipts, community attribution, ledger, beneficiary, withdrawal, transfer, reconciliation, and audit modules.
4. Implement one provider adapter first, subject to approval; do not create one Paystack account per community.
5. Ensure each incoming provider transaction is attributed exactly once to the correct community and cannot be double-posted by duplicate webhooks or manual reconciliation.
6. Implement verified beneficiary management and Treasurer-only withdrawal authorization.
7. Implement pending-transfer reservations, provider idempotency, webhook/status polling, failed-transfer release, and reconciliation.
8. Add sandbox/contract tests and failure-injection tests before enabling live money movement.

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

### F. Fixture persistence and results

PR #14 remains open with a recorded failing CI run. It covers fixture persistence and generation, but is not the immediate financial dependency.

Before resuming it:
- Rebase/audit against current main.
- Inspect the current head and latest CI rather than relying on the old run.
- Confirm that registration/payment lifecycle rules will not invalidate its scheduling gates.
- Keep fixture generation idempotent and transactionally tied to valid competition lifecycle state.
- Results, disputes, evidence, approval, standings, statistics, venue/time scheduling, and later knockout-round advancement remain separate future work unless already delivered by another verified PR.

---

## 6. Recommended implementation order

This is the reconciled order. It intentionally avoids building payment collection, withdrawals, or tournament fixtures on top of unfinished business rules.

| Order | Work | Exit condition |
|---|---|---|
| 1 | Review and merge contribution issuance PR #31 | CI passes on current head; atomicity and concurrency invariants reviewed |
| 2 | Finish contribution policy and workflow hardening | Exemption/waiver authority, audit, reporting, and refund boundary documented |
| 3 | Finalize custody and provider feasibility | Written provider approval and Nigerian compliance review for the intended pooled model |
| 4 | Specify and build Financial Service foundation | Authenticated service boundary, provider adapter, ledger, attribution, audit, reconciliation |
| 5 | Implement provider collection and verified receipt flow | Idempotent provider events reconcile to one community and one ledger receipt |
| 6 | Implement Treasurer-only withdrawals | Verified beneficiaries, reservations, transfers, final-status reconciliation, audit |
| 7 | Finalize and implement match obligations | Liability/cancellation/no-show/refund rules approved and tested |
| 8 | Finalize and implement competition commercial workflow | Payer/payment/capacity/refund rules approved and tested |
| 9 | Reconcile fixture PR #14 and continue competition scheduling/results | Current CI passes and scheduling gates match commercial rules |

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

**The next code action should be a focused review of PR #31, not another feature PR.** Its CI is currently successful on the observed head, but the atomic issuance and membership-locking implementation must be reviewed before merge.

After that, close the remaining contribution-policy gaps and obtain a real answer on pooled custody/provider permission. Only then should we implement the separate Financial Service's live collection and withdrawal paths.

