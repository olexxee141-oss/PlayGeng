# Sports-domain reuse audit and PlayGeng decisions

## Purpose

This document records the selective reuse assessment of the private `Olexxee/newDelyx` repository. PlayGeng will reuse proven domain ideas and independently implement them within its own architecture. No application modules, database schema, migration history, authentication code, or provider integrations are copied wholesale.

## Findings from newDelyx

Useful concepts:
- Round-robin scheduling with return fixtures and home/away balancing.
- Seed-aware knockout pairing and byes.
- Explicit competition lifecycle and registration workflows.
- Independent result reports, dispute handling, evidence and administrator review.
- Standings and rating calculations separated from competition orchestration.
- Persisted in-app notifications with best-effort push delivery.

Limitations identified:
- Participant and result persistence is player/user-centric despite generic fixture participant IDs.
- Standings sorting is football-specific and does not consistently apply configured tie-breakers.
- League scheduling does not safely handle odd participant counts in the active engine path.
- Shuffle paths are inconsistent; random comparator sorting is biased.
- Swiss is declared in parts of the application but is not implemented end-to-end.
- Cancellation transitions are inconsistent between lifecycle service and state machine.
- Tests cover only a small subset of scheduling and result-approval behavior.
- The repository has no complete baseline Prisma migration history.

## PlayGeng decisions

1. A community may enable multiple sports. Its existing `Community.sport` field remains the primary/default sport for backwards compatibility.
2. Enabled sports are represented by `CommunitySport`, scoped to one community.
3. Teams belong to one community and one enabled community sport.
4. Team roster members must already be members of the same community. Composite foreign keys enforce this invariant at the database layer.
5. Teams and rosters are not competition participants. A future `CompetitionParticipant` will represent either a player or a team, allowing fixtures to reference stable participant identities rather than user IDs.
6. Sport-specific result formats, statistics and standings will be implemented behind explicit sport rules/contracts. Football goals and goal difference must not be universal assumptions.
7. Fixture generation will be deterministic for a supplied participant order/seed and will be tested for odd/even counts, byes, duplicate pairings, home/away balance and progression.
8. Only approved results may affect standings or tournament progression. Result reports and review decisions must be auditable.

## Reuse plan

| newDelyx capability | PlayGeng decision |
|---|---|
| League scheduling | Adapt the algorithm after correcting odd-count handling and replacing biased shuffle |
| Knockout scheduling | Rebuild with explicit bracket slots and bye/progression records |
| Registration | Adapt to community roles and player/team participants |
| Result approval | Adapt the workflow, retaining independent reports, disputes, evidence and review notes |
| Lifecycle | Reimplement with one authoritative transition map |
| Standings | Rebuild around sport-specific rules and configured tie-breakers |
| Ratings | Defer until verified match history exists |
| Chat and media | Do not import; revisit when those modules are scheduled |
| Push notifications | Reuse the persisted-notification/best-effort-delivery principle |

## Delivery sequence

1. Community sports, teams and rosters.
2. Sport capability and result contracts.
3. Competition and generic participant foundation.
4. League and knockout scheduling.
5. Fixtures, reports, disputes and approval.
6. Sport-specific standings and statistics.
7. Competition progression and completion.

## Explicit non-goals

- Copying newDelyx services, repositories, controllers or Prisma models.
- Importing its migration history or deployment assumptions.
- Claiming support for Swiss, group-stage or other formats before implementation and tests exist.
- Treating a user account as equivalent to a team.
