# Financial Service Foundation — Phase A

**Status:** Approved implementation direction; provider-independent foundation begins here.  
**Scope:** Collection lifecycle, provider abstraction, idempotency, settlement boundaries, reconciliation and audit.  
**Explicitly excluded:** Live provider credentials, custody assumptions, beneficiary transfers, withdrawals, refunds and community wallet UX.

## 1. Why this is a separate domain

PlayGeng already has a Community Treasury. Treasury answers:

- What does a community member owe?
- What receipt was verified?
- How was a receipt allocated?
- What journal entries were posted?
- What is the community's derived accounting position?

The Financial Service answers a different set of questions:

- How was a payment collection initiated with an external provider?
- Which provider reference identifies it?
- What provider event was received?
- Has that event been processed exactly once?
- When is provider evidence sufficient to settle an internal financial obligation?
- Has the provider-side position been reconciled with the internal record?

These domains must integrate, but neither may duplicate the other's source of truth.

## 2. Phase A architecture boundary

```text
PlayGeng Community / Contributions
             |
             v
      Treasury obligations
             |
             v
       Financial Service
   -----------------------
   Collection lifecycle
   Provider abstraction
   External event ingestion
   Idempotency
   Settlement coordination
   Reconciliation
   Audit
   -----------------------
             |
             v
       Provider Adapter
        (Paystack first)
```

The provider adapter is an infrastructure boundary. Paystack-specific payloads, headers, signatures and status names must not leak into Treasury or community business services.

## 3. Core lifecycle

Phase A establishes this lifecycle:

```text
COLLECTION_REQUESTED
        |
        v
COLLECTION_PENDING
   |          |
   |          +--> COLLECTION_FAILED
   |
   v
PROVIDER_EVENT_RECEIVED
        |
        v
EVENT_VALIDATED
        |
        v
SETTLEMENT_PENDING
        |
        +--> SETTLED
        |
        +--> RECONCILIATION_REQUIRED
```

Provider events are evidence, not automatically Treasury journal entries. A settlement coordinator must validate the mapping and idempotency boundary before invoking the Treasury integration.

## 4. Non-negotiable invariants

1. Provider references must be unique within the provider scope.
2. The same provider event must never settle money twice.
3. Webhook/event processing must be idempotent.
4. Raw provider payloads are evidence and must be retained according to security policy.
5. Provider status must not be treated as a generic internal status enum without preserving provider semantics.
6. Financial Service may not directly mutate a community balance.
7. Treasury remains authoritative for obligations, allocations and accounting journal effects.
8. A provider collection cannot be marked internally settled merely because a browser callback occurred.
9. Settlement must have a stable source identity and idempotency key.
10. Every material lifecycle transition must be attributable and auditable.
11. Phase A does not claim legal segregation or custody merely because the ledger attributes money to communities.

## 5. Provider abstraction

The application boundary should expose capabilities conceptually equivalent to:

- create collection
- verify collection
- parse and validate provider event
- normalize provider event identity
- query provider collection status

The domain must consume normalized provider results rather than provider SDK objects.

Do not expose a generic `any` payload through business services.

## 6. Required records

The implementation should introduce records equivalent to:

### FinancialProvider
A configured provider identity and capability metadata.

### Collection
An internal request to collect money for a specific source obligation or payable.

### ProviderReference
The provider's unique reference and provider-specific identifiers.

### ProviderEvent
An immutable inbound event record with:
- provider
- external event ID/reference
- event type
- received timestamp
- validation result
- processing state
- raw payload/evidence reference where permitted

### Settlement
The internal decision that a collection is sufficiently verified to trigger Treasury settlement coordination.

### ReconciliationRecord
A record of a discrepancy, successful match or required follow-up between provider evidence and internal records.

Exact schema names should be adapted to the existing repository conventions and current Prisma models.

## 7. Idempotency model

There are three separate idempotency boundaries:

### A. Collection creation
A caller retry must return the same collection intent rather than create multiple provider charges.

### B. Provider event ingestion
The same provider event may be delivered multiple times. Only one durable event identity may exist.

### C. Treasury settlement
A successfully processed provider event must map to one settlement source identity. Retrying after a crash must not duplicate receipt/allocation/journal effects.

Never use one idempotency key for all three boundaries.

## 8. Security boundary

Phase A must include:

- signature/authenticity validation before an inbound event is trusted
- replay/duplicate protection
- secrets only through environment configuration
- no provider secret exposed to frontend clients
- audit logs without leaking sensitive credentials or full payment details unnecessarily

## 9. Paystack

Paystack is the proposed first adapter, not the Financial Service domain model.

No live collection or transfer flow should be enabled until the proposed multi-community merchant/custody model has been confirmed as permitted for the intended use.

## 10. Phase A delivery sequence

1. Audit current Treasury and database models.
2. Add provider-independent domain schema.
3. Add module structure following repository conventions.
4. Implement collection creation and idempotency.
5. Implement immutable provider-event ingestion and duplicate protection.
6. Implement settlement coordination boundary without bypassing Treasury.
7. Add reconciliation states and audit records.
8. Add integration tests for retries, duplicates, ordering and partial failures.
9. Only then add the Paystack adapter.

## 11. Acceptance criteria

Phase A is complete only when:

- no provider SDK type appears in Treasury domain APIs;
- duplicate collection creation is prevented;
- duplicate provider events are persisted/processed safely;
- settlement retries cannot duplicate Treasury effects;
- lifecycle transitions are auditable;
- reconciliation can represent mismatch instead of forcing a false success;
- the implementation can add Paystack without changing core financial domain rules.
