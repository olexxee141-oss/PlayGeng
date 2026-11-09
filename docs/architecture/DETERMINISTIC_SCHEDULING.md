# Phase 8 — Deterministic Scheduling Contract

## Scope

Phase 8 is delivered in layers. PR #13 added the pure, database-independent scheduler and its algorithm tests. The current persistence/API slice consumes approved competition entry identities and stores deterministic pairings. It does not advance brackets or accept results yet.

This separation proves pairing correctness, byes, stable seeding, and edge cases before persistence and API orchestration are coupled to the algorithms.

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

Persistence enforces:

- One schedule record per competition, enforced by a unique competition ID.
- A schedule stores format, algorithm version, participant order snapshot, round count, participant count, fixture count, match count, bye count, and creator.
- Unique fixture identity within a schedule (round + fixture number).
- Fixture participants must reference entries belonging to that same competition, enforced with composite foreign keys.
- Bye fixtures have one participant and an automatically advanced winner; ordinary fixtures have two distinct participants.
- Explicit positive seeds are unique among active entries and can only be assigned after registration closes and before generation.
- Schedule generation and fixture insertion happen in one transaction.
- Repeated generation requests return the existing schedule rather than creating duplicate fixtures.
- Once a schedule is generated, registration and withdrawal are frozen.
- Store algorithm version and seed/order metadata with the schedule for auditability.

The schedule-generation endpoint is idempotent: repeat calls return the existing schedule. Fixture insertion and the competition transition to IN_PROGRESS happen in one serializable transaction. Manual status changes cannot move a competition to IN_PROGRESS; schedule generation owns that transition.

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

## API workflow in the persistence slice

- `PATCH /api/v1/communities/:communityId/competitions/:competitionId/entries/:entryId/seed`: assign or clear a positive seed after registration closes.
- `POST /api/v1/communities/:communityId/competitions/:competitionId/schedule`: generate the schedule once and return the existing schedule on repeat calls.
- `GET /api/v1/communities/:communityId/competitions/:competitionId/schedule`: retrieve the schedule and ordered fixtures.

Round-robin generates the complete set of rounds. Knockout generates only round one; later rounds require approved winners and belong to the progression/result workflow.

## Not implemented in this slice

- Fixture rescheduling, venue assignment, or cancellation workflows.
- Result reports, disputes, evidence, and approval.
- Knockout advancement after approved results.
- Standings and statistics.
- Competition completion. The API continues to block COMPLETED until result verification exists.
