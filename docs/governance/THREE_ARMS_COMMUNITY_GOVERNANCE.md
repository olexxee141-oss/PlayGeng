# PlayGeng Community Constitution — Three Arms of Governance

**Status:** Approved product direction; detailed constitutional parameters remain subject to explicit community policy decisions.

## 1. Foundational principle

The community's authority belongs to its eligible members collectively. The creator is a member with one ordinary vote, not a sovereign office. No individual officeholder or arm may absorb the powers of the other arms.

Each community operates through three distinct arms:

1. **Legislature — Community Assembly**
2. **Executive — elected community officers**
3. **Judiciary — independent elected Review Council**

The Community Assembly is the highest community authority. Its authority is exercised through documented rules, elections, votes, and appeals—not through informal commands by the creator or an administrator.

## 2. Legislature: Community Assembly

### Composition
- All active, eligible community members form the Assembly.
- Each eligible member has one vote.
- The creator has one ordinary vote on the same terms as every other eligible member.
- Eligibility for a particular vote is snapshotted when that vote opens. Later joiners do not enter an active vote retroactively.
- Conflicts of interest and recusal rules apply to individual adjudication and must be recorded.

### Powers
- Adopt, amend, and repeal community rules and financial policies.
- Elect and remove officeholders through the documented election/recall process.
- Establish the structure, jurisdiction, and operating rules of the Judiciary.
- Approve major community decisions reserved to the Assembly by the constitution.
- Hear final appeals from Judiciary decisions.
- Amend the constitution prospectively.

### Limits
- Assembly decisions must follow published notice, eligibility, quorum, voting, and audit rules.
- The Assembly cannot silently rewrite historical financial records, erase issued obligations, or alter posted Treasury journal entries.
- Financial corrections must use explicit, authorized, audited adjustment or reversal entries.
- A vote cannot authorize conduct prohibited by applicable law or provider terms.

## 3. Executive: elected officers

The Executive implements community policy and manages daily operations.

### Offices
- **ADMIN:** campaign and community operations, execution of Assembly decisions, and administrative coordination.
- **TREASURER:** Treasury operations, assessment issuance, receipt verification/allocation, and other specifically authorized financial execution.
- **ORGANIZER:** match, event, and community activity operations within approved policy.

These offices remain separately elected under the existing election framework. The community creator does not receive an office or special executive authority by virtue of ownership/creation.

### Limits
- The Executive cannot create or change constitutional policy unilaterally.
- An officer cannot adjudicate their own exemption, waiver, complaint, or dispute.
- The TREASURER cannot approve their own financial relief or use Treasury access to decide whether relief should be granted.
- The ADMIN cannot override a Judiciary decision or independently grant an exemption merely because they administer a campaign.
- The Executive implements final decisions and records the resulting Treasury adjustments; it does not alter the original assessment or journal history.

## 4. Judiciary: independent Review Council

The Judiciary adjudicates individual cases under the rules adopted by the Assembly.

### Initial jurisdiction
- Contribution exemptions and waivers.
- Requests to reduce or forgive an issued obligation.
- Disputes about whether an exemption rule was correctly applied.
- Complaints involving an Executive officer's use of authority.
- Appeals from an initial administrative decision where the policy permits one.
- Conflicts of interest involving an officer or adjudicator.

### Independence
- Review Council members must be elected independently by eligible community members.
- A person cannot simultaneously hold an Executive office and a Judiciary seat.
- The creator has no automatic appointment or removal power over reviewers.
- Reviewers must disclose conflicts and recuse themselves where impartiality could reasonably be questioned.
- A reviewer must not participate in a case concerning their own obligation, a close personal/financial interest, or a decision they made in another capacity.
- The subject of a complaint or requested relief cannot select the reviewers for that case.

### Decisions
- Decisions must identify the rule applied, the outcome, the reason, the reviewers who participated, any recusals, and the decision timestamp.
- A decision must be recorded as an append-only case event.
- The person affected must receive a private notice of the outcome.
- The Judiciary may grant or deny relief only within the authority and limits established by Assembly policy.
- Final appeals go to the Community Assembly under a defined appeal window, eligibility snapshot, quorum, and voting threshold.
- The Judiciary cannot execute transfers, issue receipts, edit ledger balances, or rewrite original obligations.

### Council size and terms
The Review Council should have an odd number of members to reduce deadlock. Three members is the proposed initial size, but the exact number, term length, replacement procedure, and decision threshold must be ratified before implementation.

## 5. Exemptions and waivers: required workflow

An exemption/waiver is an adjudicated decision, not a discretionary Treasury edit.

1. A member submits a private request against a specific campaign assessment or obligation, with a reason and any permitted supporting evidence.
2. The system checks that the requester is entitled to submit the request and records the request without changing the obligation.
3. The Judiciary receives the case. Conflicted reviewers are excluded and replacements are assigned under the approved rules.
4. The Judiciary records a reasoned decision: approved, partially approved, or denied.
5. The affected member may appeal to the Assembly within the configured appeal window.
6. Once the decision is final, an authorized Executive/Treasury workflow applies the financial effect.
7. The system records the original obligation, decision, amount relieved, actor executing the decision, journal adjustment/reversal, and audit events. The original issued snapshot and obligation remain traceable.

### Important accounting distinctions
- **Pre-issuance exemption:** the eligible member is excluded from a future assessment only under a policy and authorization already in force. The issuance snapshot must explain the exclusion without fabricating an obligation.
- **Post-issuance waiver/reduction:** the issued obligation remains historically visible. A separately posted, authorized adjustment reduces the outstanding amount. Do not delete or mutate the original obligation.
- **Cancellation:** cancellation is not a refund. If money has already been allocated/received, a distinct refund workflow and authorization is required.
- **Refund:** return of settled money is a separate Treasury/provider process and must not be disguised as a waiver.

## 6. Separation-of-powers safeguards

- No arm may unilaterally appoint, remove, or control all members of another arm.
- Elections and votes use electorate snapshots, one member/one vote, quorum, documented thresholds, and immutable results.
- Privileged actions are authorized against the actor's current elected office at execution time.
- All adjudication and financial execution are separately attributed.
- A decision-maker cannot execute the financial adjustment they approved where separation is required; the Treasury executor applies the final decision without changing its merits.
- A conflict or recusal must never silently reduce the required quorum. If the Judiciary cannot reach a valid quorum, the case is reassigned or escalated under a published rule.
- The creator, ADMIN, TREASURER, and ORGANIZER receive no undocumented override.
- All arms remain subject to the constitution and applicable law.

## 7. Implementation sequence

Do not implement the Judiciary as a simple extra ADMIN/TREASURER role. It is a separate governance domain with its own election, membership, case assignment, recusal, decision, appeal, and audit lifecycle.

Recommended sequence:

1. Ratify council size, term, eligibility, election/recall, quorum, decision threshold, and appeal rules.
2. Extend governance elections to support independent Judiciary seats without granting Executive permissions.
3. Implement Review Council membership and case assignment with conflict/recusal handling.
4. Implement private exemption/waiver requests and append-only adjudication events.
5. Implement Assembly appeals using the existing election/voting foundation, with a case-specific electorate snapshot.
6. Implement Treasury adjustment entries that apply final decisions without mutating issued obligations or posted journals.
7. Add integration tests for conflicts, officer cases, recusals, failed quorum, appeals, idempotency, and ledger balance.

## 8. Decisions still required before code

- Review Council size (proposed: 3).
- Council term length and staggered or simultaneous elections.
- Eligibility and disqualification rules for Judiciary candidates.
- Quorum and decision threshold for case decisions.
- Recusal/replacement mechanics and what happens when quorum cannot be formed.
- Appeal period, Assembly quorum, and appeal voting threshold.
- Whether urgent temporary relief is permitted and who can authorize it.
- Whether the Judiciary may grant full/partial waivers or only recommend relief to the Assembly.

Until these parameters are ratified, do not hard-code assumptions into the election schema or financial adjustment services.
