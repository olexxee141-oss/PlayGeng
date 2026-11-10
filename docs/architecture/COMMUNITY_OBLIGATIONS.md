# Community-Only Obligations — Product and Architecture Contract

**Status:** Scope, membership-liability, campaign-creation and equal-assessment-amount policies approved; remaining assessment rules are open.  
**Date:** November 10, 2026  
**Current implementation phase:** Community-only obligations. Match and competition commercial integrations are excluded.

## 1. Scope boundary

This phase implements obligations that a community assesses independently of a match, competition, tournament, or other event.

Examples include monthly or periodic community contributions, one-off assessments for equipment, venue deposits, maintenance, emergency needs or other shared purposes, and membership dues if a community explicitly adopts them.

Explicitly out of scope:
- Match participation fees and match cancellation liability.
- Competition/tournament registration fees.
- Competition registration forms, custom form builders, team/player payer rules and payment gates.
- Payment-provider collection, webhooks, custody, transfers and withdrawals.
- Refund execution. Existing obligation cancellation only supports obligations with no receipt allocations; it is not a refund workflow.

## 2. Domain ownership

- **Community Contributions domain:** owns campaigns/assessments, purpose, assessment rules, eligibility policy, schedule, due dates, exemptions and assessment lifecycle.
- **Community membership:** authoritative source for membership state at the instant an assessment is issued.
- **Treasury:** owns resulting member obligations, verified receipts, allocations, outstanding amounts, payment status, journal postings and financial audit trail.

A campaign is not an obligation, and an obligation is not a payment. One assessment issues one obligation to each included member. Treasury remains the single source of truth for amounts owed and settled.

Do not add contribution-specific paid flags or balances. Do not duplicate Treasury allocation or payment state in the contribution domain.

## 3. Approved eligibility and membership-liability policy

**Every member whose community membership is active at the instant an assessment is issued receives an obligation.** Eligibility is frozen at issuance. The eligible-member set must be persisted as an immutable snapshot.

At issuance:
1. Read the authoritative community membership state and identify every active member.
2. Persist an immutable snapshot of those member identities and the relevant membership facts needed to explain inclusion.
3. Issue exactly one obligation for each snapshotted member, using a deterministic source identity and idempotency key.
4. Persist the assessment and its member obligations consistently so a partial failure cannot leave an assessment appearing fully issued when only some obligations exist.

Consequences:
- A member joining after issuance is not added retroactively. They may be assessed in a later assessment.
- A member leaving after issuance remains in the historical snapshot, and leaving does not silently erase or cancel the existing obligation.
- A later role or membership-status change does not rewrite the snapshot or automatically cancel the obligation.
- Exemptions and cancellations require an explicitly authorized action, with actor attribution, reason, timestamp and an audit record. They are never inferred from a membership change.
- Retrying issuance must not create duplicate snapshots or obligations.
- Corrections must be explicit, authorized and audited. Never mutate the historical snapshot to match current membership.

The snapshot is per assessment, not a permanently cached campaign list. Each future assessment takes a new snapshot at its own issuance time.

## 4. Approved assessment amount policy

**Every member included in a single assessment is assigned the same fixed amount.**

- The amount is defined for the assessment and applies uniformly to every member in its membership snapshot.
- Per-member pricing, variable amounts, individualized discounts and member-specific rates are not supported in this phase.
- The assessment amount and currency are frozen once issued; later campaign edits cannot alter existing obligations.
- The assessment uses the community Treasury's configured currency. Do not introduce per-member or per-assessment currency selection.
- An authorized exemption or cancellation is a separately recorded action. It must not be implemented by silently changing an individual's assessed amount or mutating the snapshot.

## 5. Assessment lifecycle and consistency

Distinguish:
- Campaign definition/configuration.
- An assessment occurrence (for example, the November 2026 monthly assessment).
- The frozen eligible-member snapshot for that occurrence.
- The fixed amount and currency for that occurrence.
- The Treasury obligation issued for each assessed member.

Campaign edits after issuance must not change that assessment's amount, currency, due date, purpose or membership snapshot. Corrections use an explicit adjustment/cancellation workflow with actor, reason, timestamp and audit evidence.

Issuance must be idempotent. Use a stable assessment ID as source identity and a deterministic key for each member obligation. A retry must return or complete the same issuance, not create another assessment or debt.

The assessment and obligation creation boundary must be atomic where they share a database transaction. If cross-module transaction boundaries make that impractical, use a durable outbox/state-machine workflow with retryable idempotent consumers. Never report an assessment as ISSUED until every expected obligation exists or the system can reliably resume issuance without duplicates.

## 6. Authorization and financial controls

The following authority boundaries apply:
- **ADMIN** is the only community role authorized to create and configure community contribution campaigns/assessments.
- Creating or configuring a campaign does not itself issue a financial obligation or grant Treasury write access.
- Only the currently elected **TREASURER** may issue/cancel Treasury obligations under the current service policy.
- ADMIN/TREASURER read access and member-own-obligation visibility remain as currently implemented.
- Community owner/creator identity and generic community-management permissions do not imply Treasury write authority.
- Exemptions, waivers, corrections and cancellations require explicit authorization, actor attribution, reason and audit history. Their detailed role policy remains to be finalized; campaign-creation permission alone does not grant this authority.
- A settled obligation must not be cancelled as if no money had been received. A separate refund/reversal workflow is required.

## 7. Decisions deliberately not assumed

The following rules remain undecided and must not be invented:
1. Which frequencies are supported initially (one-off, monthly or other recurring intervals).
2. The exemption request, approval, duration and review process; the authorization and audit requirements themselves are mandatory.
3. Due dates, grace periods, reminders and overdue treatment.
4. Whether members joining mid-cycle can be included in a later catch-up assessment.
5. Whether a campaign can be paused, ended or cancelled, and what happens to already-issued obligations.
6. Who can authorize waivers or adjustments, including when the Treasurer is the affected member.
7. How removal from a community affects outstanding obligations beyond the approved rule that removal does not silently erase them.

These are product policy decisions, not implementation details. The data model must not hardcode assumptions that foreclose them.

## 8. Implementation sequence

1. Finalize the unresolved assessment policies in Section 7.
2. Audit the current membership model and Treasury obligation source fields to define stable foreign keys and source identity.
3. Design campaign, assessment occurrence and immutable eligibility snapshot schema.
4. Implement the contribution module using the repository convention: `db`, `service`, `controller`, `routes` and `validator`.
5. Implement idempotent assessment issuance into Treasury obligations, with transactional/outbox guarantees.
6. Add read APIs for campaigns, assessments, assessed members and member contribution obligations, respecting Treasury privacy rules.
7. Add integration tests for snapshot correctness, equal amount enforcement, membership changes after issuance, retries, partial-failure recovery, authorization, duplicate prevention and audited corrections.
8. Only after community-only obligations are complete should match obligations be designed and integrated. Competition obligations remain deferred.

## 9. Acceptance criteria

- Only ADMIN can create/configure contribution campaigns.
- Campaign creation/configuration does not bypass Treasurer-only Treasury write authorization.
- The issued assessment retains the exact snapshot of all active members at issuance.
- Every member in one assessment receives an obligation for the same fixed amount and currency.
- Per-member variable amounts are rejected.
- Members joining after issuance are not added to that assessment.
- Members leaving after issuance do not disappear from the snapshot or have obligations silently cancelled.
- Later campaign edits or assessments do not mutate a prior assessment.
- Each snapshotted member receives at most one obligation per assessment.
- Exemptions and cancellations occur only through authorized, attributable, reasoned and audited actions.
- Retrying issuance produces no duplicate assessment, obligation or journal effect.
- Assessment issuance cannot be reported complete while expected obligations are missing.
- Treasury remains the sole source of truth for outstanding and settled amounts.
- Match and competition workflows are not introduced in this phase.
