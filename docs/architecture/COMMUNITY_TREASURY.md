# Community Treasury — Architecture and Implementation Contract

**Status:** Approved implementation baseline, November 10, 2026  
**Scope:** Treasury ledger and obligations foundation. This document does not authorize production custody, payment collection, or withdrawal flows.

## 1. Audit findings

The repository currently has community membership and elected governance, community matches and participants, and competition entries/invitations. The Prisma schema has no treasury, obligation, payment, receipt, expense, journal, ledger-posting, webhook, or financial audit models. Match participants and competition entries do not currently carry payment state. There is no payment-provider module to extend.

Therefore, finance must be a shared domain. Match fees, recurring contributions, and competition registration fees must create obligations against the same treasury and use the same payment/receipt/ledger pipeline. They must not each invent their own paid flag or balance.

## 2. Domain boundaries

- **Treasury:** community-scoped accounts, obligations, journal transactions, postings, expenses, reconciliation and financial permissions.
- **Payments:** provider adapters, payment attempts, webhook ingestion, verification, refunds and provider reconciliation. Provider adapters never write ledger postings directly.
- **Matches / Competitions:** create and manage the business activity; when a fee is required, request an obligation from Treasury. They do not mark a participant paid based on client input.
- **Governance / Membership:** authoritative source for active membership and elected roles. Treasury checks current membership/role on every sensitive operation; it must not trust stale role data supplied by clients.

Keep the existing module convention: `db`, `service`, `controller`, `routes`, `validator`.

## 3. Financial invariants

1. A community has one treasury with one ISO-4217 currency in the first release. Currency is selected when the treasury is initialized and cannot be changed after the first posted journal transaction.
2. Store monetary values as integer minor units (for example, kobo for NGN). Never use floating-point arithmetic for money.
3. An obligation is an amount due; creating it does not increase cash or mark it paid.
4. A payment attempt is not a receipt. Only a verified provider event or an explicitly authorized, audited manual reconciliation can create a receipt.
5. A receipt is not a ledger posting until it is successfully posted exactly once.
6. The ledger is append-only. Posted journal transactions and postings cannot be edited or deleted. Corrections use linked reversing transactions with a reason.
7. Every journal transaction is balanced: total debits equal total credits, within the same treasury and currency. A transaction has at least two postings.
8. Ledger posting, receipt settlement and obligation allocation must be atomic and idempotent.
9. Provider event IDs and provider payment references are unique within their provider scope. Replayed webhooks must not create duplicate receipts or postings.
10. No client-supplied amount, status, account balance, provider reference, or "paid" flag is trusted without server-side validation.
11. Balances are projections/calculations from posted ledger entries. Cached balances, if later introduced, are disposable projections and must be reconcilable against the ledger.
12. All financial actions record the actor, timestamp, reason/context, and correlation/reference identifiers.

## 4. Accounting model

Use a double-entry journal, not a mutable transaction balance:

- **TreasuryAccount:** an account in the community's chart of accounts (initially cash/clearing, accounts receivable, contribution income, match income, registration income, expense categories, refunds/adjustments as required).
- **JournalTransaction:** one immutable posted financial event, scoped to one treasury, with type, description, source reference, actor and optional reversal link.
- **LedgerPosting:** debit or credit against one treasury account, in integer minor units.
- **Obligation:** what a member/team/entrant owes, including source type and source ID, amount, currency, due date and status.
- **ObligationAllocation:** allocation of a verified receipt to one or more obligations; total allocations cannot exceed the receipt or obligation outstanding amount.
- **PaymentAttempt:** an initiated payment request, provider, reference, expected amount and lifecycle status. It is not accounting evidence.
- **PaymentReceipt:** verified evidence of funds received, with provider/manual source, external reference, received amount, verification metadata and idempotency key.
- **Expense:** a request/record of community expenditure with category, amount, payee/description, evidence, actor and approval/payment lifecycle. Recording an expense request alone does not reduce cash; only a paid/settled expense creates a journal transaction.
- **FinancialAuditEvent:** append-only audit context for manual reconciliation, approvals, reversals and other sensitive actions.

### Posting examples

- Obligation issued: debit Accounts Receivable; credit the appropriate income account. This records earned/assessed revenue without pretending cash was received.
- Verified payment allocated: debit Cash/Clearing; credit Accounts Receivable.
- Direct contribution with no prior obligation: debit Cash/Clearing; credit Contribution Income.
- Paid expense: debit the relevant Expense account; credit Cash/Clearing.
- Refund/reversal: create a new journal transaction with opposite postings and a link/reason; never edit the original.

The accounting policy for recognizing each fee (when it becomes due versus when service is delivered) must be consistent and documented. The first implementation should use obligation issuance as the receivable/income recognition event and must not create an obligation for a merely tentative registration or unconfirmed match participant.

## 5. Obligation sources and idempotency

The shared obligation source types initially cover:
- community contribution campaign/member assessment;
- confirmed community match participation fee;
- approved competition registration fee.

Each source must provide a stable source ID and a deterministic idempotency key. A retry of the same business event must return the existing obligation rather than duplicate it. Match and competition domains own eligibility/lifecycle; Treasury owns the financial obligation and settlement state.

Obligation states should be derived/maintained from amount due, allocations and due date: OPEN, PARTIALLY_PAID, PAID, OVERDUE, CANCELLED. Cancellation is allowed only before settlement, or after an explicit audited reversal/refund workflow. Never erase an obligation with a payment history.

## 6. Authorization baseline

- Any active member may view their own obligations and payment status.
- Financial summary and transaction visibility must follow a community-level policy; default to members seeing community ledger summaries and posted transaction descriptions, while sensitive provider metadata and personal payment data remain restricted.
- TREASURER can create obligations, record expenses and initiate reconciliation workflows.
- ADMIN may inspect financial summaries and audit history but must not be implicitly granted authority to change or settle financial records.
- Manual receipt reconciliation requires a TREASURER action, evidence/reference, reason and audit event. It must never be a simple client-side paid toggle.
- A role change or membership removal takes effect immediately for subsequent authorization checks.
- No payout/withdrawal execution is included in this foundation. A separate custody and dual-authorization policy is required before enabling it.

The CREATOR identity does not confer a silent financial override. Creator status must not bypass elected financial permissions.

## 7. Funds custody and production boundary

The user requirement is that the community holds its funds. The application must not confuse this product rule with technical custody. A positive ledger balance is an accounting record, not proof that money exists in a bank or provider account.

This phase is provider-neutral and ledger-first. Do not activate production collection, custody, transfers, or withdrawals until the receiving-account structure, legal account holder, community-level segregation, access/withdrawal authorization, refund/dispute handling, provider terms and applicable Nigerian regulatory obligations are validated. Provider-specific integration follows this foundation and must reconcile external balances and settlement reports.

## 8. Delivery sequence

### Treasury Foundation (this phase)
1. Add treasury, chart-of-accounts, obligation, journal, posting and audit schema.
2. Add balanced, append-only journal posting service with reversal support.
3. Add obligation creation/cancellation and allocation logic with idempotency.
4. Add read APIs for treasury summary, ledger history and member obligations.
5. Add Treasurer authorization and manual-reconciliation controls.
6. Add PostgreSQL constraints and integration tests for balancing, over-allocation, duplicate source events, duplicate receipts, immutable posted entries, role revocation and concurrent posting.
7. Document operational reconciliation and migration behavior.

### Payment Integration (separate phase)
1. Select provider(s) and account/custody model.
2. Add payment attempts and webhook inbox with signature verification.
3. Verify provider status server-to-server before creating receipts.
4. Post receipt and allocations atomically and idempotently.
5. Implement refunds, disputes and reconciliation.

### Commercial workflows (later)
Connect match participation fees and competition registration fees to obligations. Do not add local payment booleans to those domains.

## 9. Acceptance criteria

- A community cannot have more than one treasury.
- Currency is valid ISO-4217 and immutable after first posting.
- Every posted journal transaction is balanced and contains at least two postings.
- Concurrent duplicate posting attempts create one financial effect.
- Posted journal transactions and postings cannot be updated or deleted through application APIs.
- Reversals preserve the original transaction and require a reason and actor.
- Obligation creation does not change cash balance.
- Allocations cannot exceed either the receipt amount or outstanding obligation amount.
- A payment attempt cannot settle an obligation.
- Manual reconciliation is restricted, evidenced, audited and idempotent.
- Removing a Treasurer or changing their role immediately revokes subsequent treasury write access.
- Tests prove the invariants under concurrency, not only happy-path service mocks.
