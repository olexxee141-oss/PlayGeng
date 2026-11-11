# PlayGeng Community Constitution — Three Arms of Governance

**Status:** Approved product direction. The Community Assembly decides every individual exemption and waiver request by member vote. Case-vote thresholds are ratified; notice, duration, and conflict procedures below are proposed for ratification.

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
- Decide every individual contribution exemption and waiver request by direct vote of the eligible Assembly.
- Hear appeals and constitutional disputes concerning decisions of the other arms.
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
- An officer cannot decide their own exemption, waiver, complaint, or dispute. A requester may present their case and answer questions but is excluded from voting on their own relief. Other direct conflicts are disclosed and handled under the recusal procedure.
- The TREASURER cannot approve their own financial relief or use Treasury access to decide whether relief should be granted.
- The ADMIN cannot independently grant an exemption merely because they administer a campaign or override an Assembly decision.
- The Executive implements final decisions and records the resulting Treasury adjustments; it does not alter the original assessment or journal history.

## 4. Judiciary: independent Review Council

The Judiciary is an independent constitutional-review and dispute-resolution arm. It does not decide the merits of ordinary contribution exemption or waiver requests; those decisions belong to the Community Assembly through a direct vote. The Judiciary interprets the constitution, reviews procedural fairness and jurisdictional disputes, and handles complaints or appeals assigned to it by Assembly-approved rules.

### Initial jurisdiction
- Constitutional interpretation and disputes about the meaning or application of Assembly-approved rules.
- Complaints alleging that an Executive officer exceeded authority or failed to implement an Assembly decision.
- Challenges alleging procedural defects, conflicts of interest, or denial of a fair Assembly vote.
- Appeals and disputes assigned to the Judiciary by the constitution.
- Review of whether an Assembly decision was reached under valid notice, electorate, quorum, voting, and conflict rules. The Judiciary does not substitute its policy preference for the Assembly's decision.
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
- The Judiciary cannot grant or deny the merits of an ordinary contribution exemption or waiver request; the Assembly decides those requests.
- The Judiciary may invalidate or remit a decision only for a constitutional or procedural defect, within its defined jurisdiction. It cannot replace the Assembly's substantive decision with its own preferred outcome.
- The Judiciary cannot execute transfers, issue receipts, edit ledger balances, or rewrite original obligations.

### Council size and terms
The Review Council should have an odd number of members to reduce deadlock. Three members is the proposed initial size, but the exact number, term length, replacement procedure, and decision threshold must be ratified before implementation.

## 5. Exemptions and waivers: required workflow

An exemption/waiver is a decision of the Community Assembly, not a discretionary Executive action or a Judiciary merits decision.

1. A member submits a private request against a specific campaign assessment or obligation, with a reason and any permitted supporting evidence.
2. The system checks that the requester is entitled to submit the request and records the request without changing the obligation.
3. The request is placed before the Community Assembly for a direct vote. The case electorate is snapshotted at the opening of the vote; later joiners do not vote in that case.
4. The Assembly records a reasoned outcome: approved, partially approved, or denied, with the applicable rule, vote totals, quorum result, recusals, and decision timestamp.
5. A member may challenge the constitutionality or procedure of the vote before the Judiciary within the configured challenge period. The Judiciary reviews process and jurisdiction, not the merits of the hardship request.
6. Once the decision is final, an authorized Executive/Treasury workflow applies the financial effect.
7. The system records the original obligation, Assembly decision, amount relieved, actor executing the decision, journal adjustment/reversal, and audit events. The original issued snapshot and obligation remain traceable.

### Important accounting distinctions
- **Pre-issuance exemption:** the eligible member is excluded from a future assessment only under a policy and authorization already in force. The issuance snapshot must explain the exclusion without fabricating an obligation.
- **Post-issuance waiver/reduction:** the issued obligation remains historically visible. A separately posted, authorized adjustment reduces the outstanding amount. Do not delete or mutate the original obligation.
- **Cancellation:** cancellation is not a refund. If money has already been allocated/received, a distinct refund workflow and authorization is required.
- **Refund:** return of settled money is a separate Treasury/provider process and must not be disguised as a waiver.

## 6. Separation-of-powers safeguards

- No arm may unilaterally appoint, remove, or control all members of another arm.
- Elections and votes use electorate snapshots, one member/one vote, quorum, documented thresholds, and immutable results.
- Privileged actions are authorized against the actor's current elected office at execution time.
- All Assembly decisions, constitutional review, and financial execution are separately attributed.
- Each exemption/waiver case vote uses one vote per eligible, non-recused member, a fixed electorate snapshot, published notice, at least 50% participation for quorum, approval by more than 50% of valid votes cast, and a recorded outcome. Abstentions do not count as votes cast.
- The requester may submit evidence and respond to questions but cannot vote on their own relief. Other members with a direct, material personal or financial interest must disclose and recuse; ordinary membership in the community is not by itself a conflict.
- Recusals and their reasons are recorded privately. The eligible electorate and quorum denominator are frozen only after conflict declarations and any required recusal determinations are completed.
- A decision-maker cannot execute the financial adjustment they approved where separation is required; the Treasury executor applies the final decision without changing its merits.
- Assembly recusals may change the eligible electorate only before the electorate snapshot is frozen; the 50% quorum is then calculated against that fixed denominator and cannot be lowered after voting opens. Judiciary recusals must not silently lower its required quorum; if the Review Council cannot reach a valid quorum, the matter is reassigned or escalated under a published rule.
- The creator, ADMIN, TREASURER, and ORGANIZER receive no undocumented override.
- All arms remain subject to the constitution and applicable law.

## 7. Implementation sequence

Do not implement the Judiciary as a simple extra ADMIN/TREASURER role. It is a separate governance domain with its own election, membership, case assignment, recusal, decision, appeal, and audit lifecycle.

Recommended sequence:

1. Ratify the Review Council's size, term, eligibility, election/recall, quorum, and constitutional-review jurisdiction.
2. Implement the ratified thresholds and, after ratification, the case procedure: at least 48 hours' notice before opening; a 72-hour voting window; frozen non-recused electorate; at least 50% participation quorum; more than 50% approval among valid votes cast; abstentions excluded; requester excluded from voting; direct material conflicts disclosed and recused; tie or failed quorum means not approved.
3. Extend governance elections to support independent Judiciary seats without granting Executive permissions.
4. Implement private exemption/waiver requests and direct Assembly case votes using the existing voting foundation.
5. Implement Judiciary review of constitutional and procedural challenges, without transferring merits decisions away from the Assembly.
6. Implement Treasury adjustment entries that apply final Assembly decisions without mutating issued obligations or posted journals.
7. Add integration tests for conflicts, officer cases, recusals, failed quorum, procedural challenges, idempotency, and ledger balance.

## 8. Decisions still required before code

### Ratified case-vote rules
- The electorate is frozen when voting opens, after applicable recusal determinations.
- Quorum requires at least 50% of the frozen eligible electorate to cast a valid YES or NO vote.
- Approval requires more than 50% of valid YES/NO votes cast.
- Abstentions do not count as votes cast.
- A tie or failed quorum means the request is not approved.
- The requester may present evidence and answer questions but cannot vote on their own relief.

### Proposed case-vote procedure — pending ratification
- **Notice:** publish the case notice at least 48 hours before voting opens.
- **Voting window:** keep the ballot open for 72 hours; close it automatically at the published deadline.
- **Electorate:** include active members eligible when the vote opens, excluding members whose direct, material personal or financial conflict has been established before the electorate is frozen. Later joiners are excluded.
- **Conflicts:** members must disclose direct, material personal or financial interests. The requester is automatically excluded from voting on their own relief. Ordinary membership or a general interest shared equally by the community is not, by itself, a conflict.
- **Recusal record:** store the recusal decision, reason category, deciding authority, and timestamp in the restricted case audit trail. Do not expose sensitive supporting details to the whole Assembly.
- **Quorum denominator:** freeze the eligible electorate after conflict declarations and determinations; calculate the 50% quorum against that fixed denominator. Do not change it after voting opens.
- **Disputed conflicts:** do not let the requester, subject, or a conflicted officer decide the dispute. Pause the vote until an independent, conflict-free authority can determine eligibility under the ratified procedure.
- **Privacy:** publish the request summary and relevant decision grounds needed for a fair vote, but restrict medical, financial, identity, and other sensitive evidence to authorized reviewers. Members should vote on the relief request, not receive unnecessary private documents.

### Judiciary parameters still required
- Review Council size (three proposed), term length, and staggered or simultaneous elections.
- Eligibility and disqualification rules for Judiciary candidates.
- Quorum and decision threshold for Judiciary case decisions.
- Recusal/replacement mechanics and what happens when Judiciary quorum cannot be formed.
- Appeal/challenge period, scope, and whether a successful challenge remits the matter for a fresh Assembly vote.
- Whether urgent temporary relief is permitted and who can authorize it.

The Assembly's authority to decide every exemption/waiver request and the case-vote thresholds are settled. The notice period, voting window, conflict determination and recusal process in this section are proposals, not yet ratified. Do not hard-code them until approved.
