# Competition and registration foundation

## Scope

This foundation introduces community-owned competitions and registration entries. It deliberately does not generate fixtures, store results, calculate standings, or advance brackets.

Only `ROUND_ROBIN` and `KNOCKOUT` are persisted formats in this first implementation. They are declarations of intended scheduling formats; fixture engines are not yet implemented.

## Domain model

- A `Competition` belongs to exactly one community and one enabled `CommunitySport`.
- The creator must be a user and community manager (enforced by the API service in the competition module).
- A competition stores its participant type (`TEAM` or `PLAYER`), registration mode, lifecycle status, capacity, registration window, and adapter/ruleset versions.
- A `CompetitionEntry` represents one team or one individual community member.
- Entries retain a participant-name snapshot so later profile/team renames do not rewrite historical registration identity.
- Entries have review states `PENDING`, `APPROVED`, `REJECTED`, and `WITHDRAWN`.

## Database invariants

The migration and Prisma schema enforce:

1. Competition sport must be enabled by the same community through a composite foreign key to `CommunitySport(id, communityId)`.
2. An entry's competition, community, and participant type must match a single competition through a composite foreign key.
3. Team entries must reference a team in the same community.
4. Player entries must reference a community membership in the same community.
5. An entry must reference exactly one participant identity: team XOR player.
6. The same team or player cannot be registered twice in one competition.
7. Capacity cannot be less than two, when configured.
8. Registration opening must precede registration closing, when both are configured.

The application must still enforce lifecycle transitions, registration windows, role authorization, active membership/team status, capacity, and sport capability compatibility. Those are workflow rules, not substitutes for the database constraints above.

## Sport compatibility

Competition creation must consult `SPORT_CAPABILITIES`:

- `competitionSupported` must be true.
- `TEAM` sports accept team entries only.
- `PLAYER` sports accept individual community-member entries only.
- `EITHER` is rejected until a sport-specific adapter explicitly defines the participant model.

The selected sport adapter and ruleset versions are persisted on each competition. Updating a future adapter must not silently change the rules used by existing competitions.

## Lifecycle

Expected lifecycle:

```text
DRAFT -> REGISTRATION_OPEN -> REGISTRATION_CLOSED -> IN_PROGRESS -> COMPLETED
  |              |                    |                 |
  +--------------+--------------------+-----------------+-> CANCELLED
```

The API must reject invalid transitions; direct arbitrary status updates are not permitted.

Registration modes:

- `OPEN`: eligible entries are approved immediately.
- `APPROVAL_REQUIRED`: entries begin pending and require an authorized review.
- `INVITE_ONLY`: registration requires a future invitation capability; public/self-service registration is rejected until that workflow exists.

## Explicit non-goals

- Fixture generation or manual fixture editing.
- Bracket progression, byes, or standings.
- Result submission, disputes, evidence, or approval.
- Tournament payments and ledger integration.
- Public registration outside community membership.

These are separate implementation gates. In particular, a format enum does not imply a scheduler exists.
