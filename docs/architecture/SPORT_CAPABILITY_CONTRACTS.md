# Sport capability and result contracts

## Why this boundary exists

A competition engine must not assume every sport is football. Scheduling operates on participants and fixtures; scoring, validation, standings and statistics are sport-specific.

The shared package exposes a versioned-in-code capability catalogue. The API and future Expo client can consume the same declarations without importing database or UI code.

## Current declarations

| Sport | Participant model | Result envelope | Competition enabled |
|---|---|---|---|
| Football | Team | Score | Yes |
| Basketball | Team | Score | Yes |
| Volleyball | Team | Sets | Yes |
| Tennis | Player | Sets | Yes |
| Table tennis | Player | Sets | Yes |
| Badminton | Player | Sets | Yes |
| Rugby | Team | Score | Yes |
| Cricket | Team | Custom adapter required | No |
| Esports | Either | Custom adapter required | No |
| Other | Either | Custom adapter required | No |

These are deliberately conservative defaults, not a claim that a generic score or set envelope implements every official rule of each sport.

## Result contract

- `SCORE` stores two non-negative integer scores.
- `SETS` stores one to seven non-tied, non-negative integer set scores.
- The shared validator checks envelope compatibility and basic structural invariants only.
- Sport adapters must implement official win conditions, set targets, tiebreaks, overtime, forfeits, points allocation, standings tie-breakers and sport-specific statistics before production competition workflows use those rules.
- A `CUSTOM` sport is not competition-enabled until its adapter is implemented and tested.

## Participant model

The declared participant mode informs the future competition participant model:
- `TEAM`: a community team participates.
- `PLAYER`: an individual community member participates.
- `EITHER`: a sport-specific adapter/configuration must select a supported participant kind.

A team roster membership is not itself a competition participant. A tournament entry must reference a stable participant record and snapshot its registration identity.

## Non-goals in this phase

- No tournament, fixture, bracket or standings tables.
- No fixture generation.
- No result persistence or approval workflow.
- No changes to the fixed Prisma `Sport` enum.
- No claim of full official-rule support from the generic envelope.

## Current implementation gates

- Competition persistence, registration and invite-only workflows are defined in [COMPETITION_FOUNDATION.md](./COMPETITION_FOUNDATION.md).
- Deterministic, participant-agnostic scheduling is defined in [DETERMINISTIC_SCHEDULING.md](./DETERMINISTIC_SCHEDULING.md).
- Sport-specific result validation, standings and statistics remain separate adapter work. A generic schedule must not infer sport scoring rules.
