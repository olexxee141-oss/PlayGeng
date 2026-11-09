# Phase 8 — Deterministic Scheduling Contract

## Scope of the first scheduling slice

Phase 8 starts with a pure, database-independent scheduler. It consumes approved competition entry identities and returns deterministic pairings. It does not create database fixtures, advance brackets, or accept results in this slice.

This is intentional: pairing correctness, byes, stable seeding, and edge cases must be proven before persistence and API orchestration are introduced.

## Generic participant contract

The scheduler receives:

- `entryId`: stable CompetitionEntry identity. It does not receive a user ID or team ID.
- `registeredAt`: timestamp used as a deterministic fallback ordering key.
- `seed`: optional positive, unique competition seed.

The scheduler never needs to know whether an entry represents a player or a team. The API must supply only approved entries from one competition.

Ordering is deterministic:

1. Explicitly seeded entries sort by ascending seed.
2. Unseeded entries follow seeded entries.
3. Within each group, order by registration timestamp and then entry ID.

Duplicate entry IDs, duplicate explicit seeds, invalid seeds, invalid timestamps, and fewer than two participants are rejected. There is no implicit random shuffle.

## Round-robin algorithm

- Uses the circle/rotation method.
- Produces a complete single round-robin: every pair meets exactly once.
- Even participant counts produce `n - 1` rounds.
- Odd participant counts add a virtual bye slot and produce `n` rounds.
- Every participant in an odd-sized field receives exactly one bye.
- Participant A/B are neutral fixture slots. They are not home/away labels. Sport-specific side assignment can be layered on later where a sport actually has home/away semantics.

Expected invariants:

- Match count: `n * (n - 1) / 2`.
- No participant appears twice in one round.
- No unordered participant pair appears more than once.

## Knockout algorithm

- Uses the next power-of-two bracket size.
- Places participants into standard seed positions.
- Higher seeds receive byes before lower seeds.
- Produces only the first round. Later rounds cannot be generated until winners are derived from approved results.
- A bye is explicit in the output and advances exactly one participant; it is not represented as a fake opponent.

The output contains bracket size, total round count, first-round match count, bye count, and neutral participant slots.

## Determinism and idempotency

The pure scheduler is deterministic for the same participant identities, timestamps, seeds, format, and algorithm version, regardless of input array order.

Persistence must later enforce:

- One schedule record per competition.
- Unique fixture identity within a schedule (round + fixture number).
- Fixture participants must reference entries belonging to that same competition.
- Schedule generation and fixture insertion happen in one transaction.
- Repeated generation requests return the existing schedule rather than creating duplicate fixtures.
- Once a schedule is generated, registration and withdrawal are frozen.
- Store algorithm version and seed/order metadata with the schedule for auditability.

The pure engine does not claim database idempotency by itself; those guarantees belong to the persistence/service layer.

## NewDelyx reuse decisions

The earlier audit found useful round-robin rotation, knockout seeding/byes, and home/away balancing concepts. It also found a biased random comparator in the registered league scheduler and player-specific fixture fields.

PlayGeng therefore:

- Reuses the circle method and standard knockout seed-placement concepts.
- Does not copy the random sort comparator.
- Does not persist player IDs or team IDs directly on fixtures.
- Uses CompetitionEntry IDs as generic participants.
- Keeps home/away assignment out of the generic scheduler.
- Generates knockout rounds incrementally after approved results, not all future rounds with unknown winners.

## Test gate

The pure test suite covers even and odd round-robin fields, pair uniqueness, one appearance per round, input-order determinism, standard knockout seeding, byes, participant coverage, duplicate IDs, duplicate seeds, invalid seeds, invalid timestamps, and minimum field size.

No fixture persistence or result workflow should be added until this contract and test suite pass CI.
