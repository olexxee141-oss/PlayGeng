# PlayGeng ⚽

> **Organize your games. Manage your people. Track your money.**

PlayGeng is a sports community and tournament management platform designed to help informal sports groups, teams, communities, and tournament organizers manage players, games, contributions, finances, registrations, and competitions from one system.

The product starts with football, inspired by the real-world problem of groups of friends regularly organizing games and contributing money. The architecture is intentionally broader: PlayGeng should eventually support multiple sports and sports communities.

---

## Table of Contents

- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Product Vision](#product-vision)
- [Target Users](#target-users)
- [Core Product Concepts](#core-product-concepts)
- [Core Features](#core-features)
- [User Roles](#user-roles)
- [Financial Architecture](#financial-architecture)
- [Tournament Architecture](#tournament-architecture)
- [System Architecture](#system-architecture)
- [Implementation Phases](#implementation-phases)
- [Community Contributions Implementation Plan](docs/implementation/COMMUNITY_CONTRIBUTIONS_README.md)
- [Reconciled Implementation Status and Remaining Work](docs/implementation/IMPLEMENTATION_STATUS_AND_NEXT_STEPS.md)
- [MVP Scope](#mvp-scope)
- [Data Model](#data-model)
- [API Architecture](#api-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Payments](#payments)
- [Notifications](#notifications)
- [Security](#security)
- [Business Model](#business-model)
- [Technology Direction](#technology-direction)
- [Development Principles](#development-principles)
- [Roadmap](#roadmap)

---

# The Problem

Informal sports communities commonly manage their activities through a fragmented combination of:

- WhatsApp groups
- Google Forms
- Spreadsheets
- Bank transfers
- Payment screenshots
- Manual calculations
- Verbal agreements

This creates recurring operational problems.

## Match Organization

Organizers need answers to questions such as:

- Who is available to play?
- How many players have confirmed?
- Are enough players available?
- Who paid?
- Who cancelled?
- Who failed to show up?
- How should teams be arranged?

## Shared Money

Groups that collect money need to know:

- Who contributed?
- Who has not paid?
- What was the money spent on?
- What is the actual balance?
- Who recorded an expense?
- Can every financial movement be verified?

Money is where informal groups become vulnerable to disputes. The financial model therefore cannot be an afterthought.

## Community Contributions

Community-only assessments and recurring contributions are governed by the [Community Obligations architecture contract](docs/architecture/COMMUNITY_OBLIGATIONS.md). The initial release supports one-off and monthly assessments, immutable membership snapshots, equal per-member amounts, explicit due dates and audited campaign lifecycle transitions. Match and competition obligations remain separate future work.

## Tournaments

Tournament organizers often separately manage:

- Registration forms
- Teams
- Registration fees
- Player information
- Fixtures
- Results
- Standings
- Prize information

PlayGeng brings these workflows together.

---

# The Solution

PlayGeng provides a central operating system for sports communities.

A community can:

- Manage members
- Schedule games and matches
- Track player availability
- Manage attendance
- Collect and track contributions
- Record expenses
- Maintain a transparent financial ledger
- Organize tournaments
- Accept registrations
- Track registration payments
- Manage teams
- Generate fixtures
- Record results
- Build player and community statistics

---

# Product Vision

The initial use case is simple:

> A group of people regularly plays football and needs a reliable way to organize games, players, contributions, and tournaments.

The broader vision is:

> **Become the operating system for sports communities, competitions, and shared sports finances.**

## Product Map

```text
                         PLAYGENG
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
     Communities           Matches          Tournaments
          │                  │                  │
       Members          Attendance         Registration
       Roles            Teams              Teams
       Finance          Results            Fixtures
          │              Statistics        Results
          └──────────────────┼──────────────────┘
                             │
                      FINANCIAL LEDGER
                             │
                         PAYMENTS
```

---

# Target Users

## 1. Sports Communities

Groups that regularly play a sport.

Examples:

- Weekend football groups
- University sports communities
- Estate sports groups
- Workplace teams

They need member, match, attendance, and finance management.

## 2. Team Managers

People responsible for managing a particular team.

They need:

- Player management
- Match scheduling
- Availability tracking
- Financial records

## 3. Tournament Organizers

People or organizations running competitions.

They need:

- Registration forms
- Team registration
- Payment tracking
- Fixtures
- Results
- Standings or brackets

## 4. Individual Players

Players need to:

- Join communities
- Confirm availability
- Pay required fees
- View matches and fixtures
- Track their activity and statistics

---

# Core Product Concepts

## User

A person with a PlayGeng account.

A user can belong to multiple communities.

```text
User
 ├── Community A
 ├── Community B
 └── Tournament Team
```

## Community

A sports group or organization.

Examples:

- Lekki Weekend Football
- Campus Football Association
- Lagos Basketball Community

A community owns or manages:

- Members
- Matches
- Financial activity
- Teams
- Tournaments
- Announcements

## Sport

PlayGeng starts with football but must not permanently assume every activity is football.

Initial support:

```text
FOOTBALL
```

Future support may include:

```text
BASKETBALL
VOLLEYBALL
TENNIS
TABLE_TENNIS
ESPORTS
OTHER
```

## Match

A scheduled sporting activity with:

- Date and time
- Venue
- Capacity
- Participants
- Fees
- Teams
- Result

## Contribution

Money contributed by members for a community or purpose.

Examples:

- Monthly contribution
- Match contribution
- Equipment contribution

## Expense

Money spent by the community.

Examples:

- Pitch rental
- Jerseys
- Footballs
- Referee fees
- Equipment

## Tournament

A structured competition containing:

- Registration
- Teams
- Fixtures
- Matches
- Results
- Standings or brackets

---

# Core Features

## 1. Authentication and User Management

Users should be able to:

- Register
- Log in
- Log out
- Reset passwords
- Manage their profile

Initial profile data:

- Full name
- Username
- Phone number
- Profile image

---

## 2. Community Management

Users can create and manage communities.

```text
Community
├── Members
├── Matches
├── Finance
├── Teams
├── Tournaments
└── Announcements
```

Authorized users can:

- Invite members
- Remove members
- Assign roles
- Create matches
- Manage finances
- Organize tournaments

---

## 3. Match Management

Administrators can create matches or regular game sessions.

Example:

```text
Sunday Football Session

Date: Sunday
Time: 4:00 PM
Location: Lekki Sports Center

Player Limit: 20
Participation Fee: ₦2,000
```

Members can:

- Join
- Decline
- Cancel
- Join a waitlist when capacity is full

### Participant Status

```text
PENDING
CONFIRMED
DECLINED
WAITLISTED
CANCELLED
PLAYED
NO_SHOW
```

---

## 4. Attendance Management

The system should distinguish between:

- A player who registered
- A player who confirmed
- A player who actually played
- A player who failed to show up

This creates reliable historical data for future statistics and organizer decisions.

---

## 5. Team Management

Teams can initially be created manually.

Future versions may support automatic team balancing using:

- Player ratings
- Positions
- Skill level
- Historical results

Example:

```text
TEAM A
- Player 1
- Player 2
- Player 3

TEAM B
- Player 4
- Player 5
- Player 6
```

AI-assisted balancing is a future feature, not an MVP dependency.

---

## 6. Contributions

Communities can create contribution campaigns.

Example:

```text
November Monthly Contribution

Amount: ₦5,000
Due Date: November 30
```

The system tracks member payment status:

```text
John       PAID
David      PAID
Michael    PENDING
James      OVERDUE
```

---

# Financial Architecture

Financial transparency is a core product requirement.

## The Fundamental Rule

**The group balance must not be manually edited.**

Balances should be derived from a financial ledger.

Example:

```text
+ ₦5,000   Contribution
+ ₦5,000   Contribution
+ ₦10,000  Contribution

- ₦15,000  Pitch Rental
- ₦5,000   Equipment

-----------------------

Current Balance
= calculated from transactions
```

## Transaction Types

```text
CONTRIBUTION
MATCH_PAYMENT
TOURNAMENT_REGISTRATION
MEMBERSHIP_PAYMENT

EXPENSE
REFUND
ADJUSTMENT
PAYOUT
```

## Transaction Status

```text
PENDING
PROCESSING
COMPLETED
FAILED
CANCELLED
REFUNDED
```

## Financial Rules

1. Completed financial records must not be silently deleted.
2. Corrections should create reversing or adjustment transactions where appropriate.
3. Every important transaction requires an audit trail.
4. Community balances should be derived from ledger data.
5. External payment references must be stored.
6. Payment webhooks must be idempotent.
7. Payment provider events must never create duplicate financial records.

---

## 7. Expenses

Authorized users can record expenses.

Example:

```text
Expense: Pitch Rental

Amount: ₦30,000
Category: VENUE
Recorded By: Admin
Date: November 8
```

Financial visibility should be controlled by community permissions.

---

# Tournament Architecture

## Tournament Creation

Organizers can create a tournament with:

- Name
- Sport
- Registration fee
- Team capacity
- Registration deadline
- Tournament format
- Rules
- Prize information

Example:

```text
Lagos Weekend Football Tournament

Sport: Football
Registration Fee: ₦20,000
Maximum Teams: 16
Registration Deadline: December 10
```

## Registration Workflow

```text
START
  │
  ▼
SUBMIT REGISTRATION
  │
  ▼
PENDING PAYMENT
  │
  ├── Payment Failed
  │
  ▼
PAYMENT CONFIRMED
  │
  ▼
REGISTRATION CONFIRMED
```

## Tournament Formats

The architecture should eventually support:

```text
KNOCKOUT
ROUND_ROBIN
LEAGUE
GROUP_STAGE
GROUP_STAGE_AND_KNOCKOUT
```

However, the MVP should implement only the formats necessary for validation. Building a universal tournament engine before users exist would be wasted effort.

## Fixtures

Example:

```text
QUARTER FINAL

Team A vs Team B
Team C vs Team D
```

Future functionality:

- Automatic fixture generation
- Manual fixture editing
- Venue assignment
- Match scheduling

## Results

Authorized users can record results.

```text
Team A  3 - 2  Team B
```

Results can trigger:

- Tournament progression
- Standings updates
- Statistics updates

---

# User Roles

The system requires centralized authorization.

## Platform Roles

```text
SUPER_ADMIN
SUPPORT
USER
```

## Community Roles

```text
OWNER
ADMIN
TREASURER
ORGANIZER
MEMBER
```

Typical responsibilities:

| Role | Responsibility |
|---|---|
| OWNER | Full control of the community |
| ADMIN | General community management |
| TREASURER | Financial operations |
| ORGANIZER | Matches and tournaments |
| MEMBER | Participation and permitted actions |

Permissions should not be scattered as hardcoded checks throughout controllers.

---

# System Architecture

The backend should use a modular architecture.

Every major domain should follow:

```text
module/
├── module.db.ts
├── module.service.ts
├── module.controller.ts
├── module.routes.ts
└── module.validator.ts
```

Example:

```text
communities/
├── communities.db.ts
├── communities.service.ts
├── communities.controller.ts
├── communities.routes.ts
└── communities.validator.ts
```

## Request Flow

```text
CLIENT
  │
  ▼
ROUTE
  │
  ▼
VALIDATOR
  │
  ▼
CONTROLLER
  │
  ▼
SERVICE
  │
  ▼
DATABASE LAYER
  │
  ▼
DATABASE
```

### Responsibilities

**Route**
- Endpoint definition
- Middleware composition

**Validator**
- Request input validation

**Controller**
- HTTP request and response concerns

**Service**
- Business rules and workflows

**Database Layer**
- Database queries and persistence

---

# Global Backend Infrastructure

The following must exist from the beginning:

- Centralized error middleware
- Async error wrapper
- Authentication middleware
- Authorization middleware
- Request validation
- Structured logging
- Environment validation
- Rate limiting
- Security headers
- CORS configuration
- Health checks

These are foundation work, not polish to postpone indefinitely.

---

# Implementation Phases

## Phase 0 — Product Definition

Define:

- Product scope
- MVP boundaries
- User roles
- Primary workflows
- Financial rules
- Tournament rules

Deliverables:

- Product README
- Architecture blueprint
- Initial data model
- Implementation roadmap

---

## Phase 1 — Project Foundation

Build:

- Monorepo
- Backend application
- Frontend application
- Shared packages
- Database package
- Environment configuration
- TypeScript configuration
- Linting and formatting
- Error handling
- Logging
- CI foundation

---

## Phase 2 — Authentication

Implement:

- Registration
- Login
- Logout
- Password reset
- Authentication middleware
- Authorization
- User profiles

---

## Phase 3 — Communities

Implement:

- Create community
- Update community
- Invite members
- Membership management
- Roles
- Permissions

---

## Phase 4 — Match Management

Implement:

- Create matches
- Join matches
- Player limits
- Waitlists
- Attendance
- Match status

---

## Phase 5 — Finance and Contributions

Implement:

- Contributions
- Expenses
- Financial ledger
- Balance calculation
- Transaction history
- Audit logging

This phase requires particularly careful testing.

---

## Phase 6 — Payments

Implement:

- Payment initialization
- Provider abstraction
- Webhooks
- Payment verification
- Idempotency
- Financial ledger integration

---

## Phase 7 — Tournament Management

Implement:

- Create tournaments
- Registration
- Teams
- Registration fees
- Registration approval

---

## Phase 8 — Fixtures and Results

Implement:

- Fixture generation
- Match scheduling
- Result submission
- Tournament progression

---

## Phase 9 — Statistics

Implement:

- Player statistics
- Match statistics
- Community leaderboards

Possible statistics:

```text
Matches Played
Goals
Assists
Wins
Losses
Draws
MVP Awards
```

---

## Phase 10 — Notifications and Expansion

Implement:

- In-app notifications
- Email notifications
- Push notifications

Examples:

```text
You have been invited to a match.
Your contribution is due tomorrow.
Tournament registration confirmed.
A fixture has been updated.
```

---

# MVP Scope

The MVP should prove that PlayGeng solves a real organizational problem.

## Included

### Authentication
- Registration
- Login
- Profile

### Communities
- Create community
- Invite members
- Membership roles

### Matches
- Create match
- Join or decline
- Capacity management
- Attendance tracking

### Finance
- Contributions
- Expenses
- Transaction history
- Calculated balance

### Tournaments
- Create tournament
- Register teams
- Track registration status and payment

## Explicitly Excluded From the Initial MVP

Do not prematurely build:

- AI features
- Advanced recommendation systems
- Social media feeds
- Marketplace functionality
- Every tournament format
- Complex multi-country financial systems
- Advanced venue discovery
- Sophisticated analytics

The architecture can permit expansion without implementing speculative features.

---

# Data Model

Initial high-level entities:

```text
User

Community
CommunityMember

Sport

Match
MatchParticipant
MatchTeam
MatchResult

Contribution
ContributionPayment

Expense

FinancialTransaction
Payment

Tournament
TournamentRegistration
TournamentTeam
TournamentMatch

Notification
AuditLog
```

## Relationship Overview

```text
USER
 │
 ├────────────┐
 │            │
 ▼            ▼
COMMUNITY   TOURNAMENT REGISTRATION
 │
 ├── MEMBERS
 │
 ├── MATCHES
 │     ├── PARTICIPANTS
 │     ├── TEAMS
 │     └── RESULTS
 │
 ├── CONTRIBUTIONS
 │
 ├── EXPENSES
 │
 └── TOURNAMENTS
       ├── REGISTRATIONS
       ├── TEAMS
       └── MATCHES
```

---

# API Architecture

Initial REST direction:

```text
/api/v1/auth
/api/v1/users

/api/v1/communities
/api/v1/communities/:communityId/members

/api/v1/matches
/api/v1/matches/:matchId/participants

/api/v1/contributions
/api/v1/expenses
/api/v1/transactions

/api/v1/tournaments
/api/v1/tournaments/:tournamentId/registrations
/api/v1/tournaments/:tournamentId/fixtures

/api/v1/payments
/api/v1/notifications
```

API versioning is included early to avoid unnecessary breaking changes later.

---

# Frontend Architecture

The frontend should be organized by domain rather than becoming a collection of unrelated pages.

```text
src/
├── app/
├── components/
├── features/
│   ├── auth/
│   ├── communities/
│   ├── matches/
│   ├── finance/
│   ├── tournaments/
│   └── notifications/
├── hooks/
├── lib/
├── pages/
├── services/
├── types/
└── utils/
```

Frontend code should not become the sole source of critical business rules. Important authorization and financial rules belong on the backend.

---

# Payments

PlayGeng should initially support Nigerian payment infrastructure while keeping the architecture provider-independent.

Potential providers:

- Paystack
- Flutterwave

Recommended abstraction:

```text
Payment Service
       │
       ├── Payment Provider Interface
       │
       ├── Paystack Provider
       │
       └── Future Providers
```

The rest of the business logic should not be tightly coupled to a specific provider.

---

# Notifications

Notifications should be event-driven.

Example events:

```text
MATCH_CREATED
MEMBER_JOINED_MATCH
CONTRIBUTION_DUE
PAYMENT_CONFIRMED
TOURNAMENT_REGISTRATION_CONFIRMED
FIXTURE_CREATED
```

Delivery channels can later include:

```text
IN_APP
EMAIL
PUSH
WHATSAPP
```

---

# Security

The platform must implement:

- Secure password hashing
- Authentication
- Role-based authorization
- Input validation
- Rate limiting
- CORS
- Security headers
- Secure webhook verification
- Audit logs for sensitive operations

Sensitive financial and user data must not be exposed through API responses.

---

# Non-Functional Requirements

## Reliability

Financial operations must be consistent and recoverable.

## Scalability

The architecture should support growth from:

```text
1 community
    ↓
100 communities
    ↓
10,000+ communities
```

without requiring a complete rewrite.

## Auditability

Important operations should be traceable, especially:

- Payments
- Contributions
- Expenses
- Role changes
- Administrative actions

## Performance

Common operations should remain responsive:

- Viewing a community
- Viewing upcoming matches
- Joining a match
- Viewing transaction history

---

# Business Model

Possible monetization paths:

## 1. Community Subscription

Free and paid tiers.

Example:

```text
FREE
- Basic community management
- Basic match organization

PRO
- Advanced finance
- Advanced reporting
- More administrative tools
- Advanced tournament features
```

## 2. Tournament Tools

Charge organizers for premium features such as:

- Advanced registration
- Public tournament pages
- Custom branding
- Advanced reporting

## 3. Transaction Revenue

Where commercially and legally viable, generate revenue from payment activity.

The business model should be validated against real usage before becoming a core engineering assumption.

---

# Technology Direction

The initial direction is:

## Backend

```text
Node.js
TypeScript
Express
```

## Database

```text
PostgreSQL
Prisma
```

## Frontend

```text
React
TypeScript
```

## Payments

```text
Paystack
```

The final stack should be locked before Phase 1 implementation so the repository structure is deliberate rather than repeatedly rewritten.

---

# Local Database Setup

PlayGeng uses PostgreSQL. The repository includes a Docker Compose configuration for local development.

## Prerequisites

Install:

- Node.js 26 or newer
- npm 11 or newer
- Docker Desktop

## 1. Clone and install dependencies

```bash
git clone https://github.com/olexxee141-oss/PlayGeng.git
cd PlayGeng
npm install
```

## 2. Create your environment file

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

The default local database configuration is:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/playgeng?schema=public
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/playgeng?schema=public
```

## 3. Start PostgreSQL

```bash
docker compose up -d postgres
```

Check that PostgreSQL is running:

```bash
docker compose ps
```

View database logs if startup fails:

```bash
docker compose logs -f postgres
```

## 4. Generate the Prisma client

From the repository root:

```bash
npm run db:generate
```

## 5. Apply migrations

For local development:

```bash
npm run db:migrate:dev
```

For environments where migrations already exist and should only be applied:

```bash
npm run db:migrate:deploy
```

Do **not** use `db:migrate:dev` in production.

## 6. Open Prisma Studio

```bash
npm run db:studio
```

Prisma Studio provides a local interface for inspecting database records.

## Daily Development Commands

Start the database:

```bash
docker compose up -d postgres
```

Stop the database:

```bash
docker compose stop postgres
```

Stop and remove the container:

```bash
docker compose down
```

Reset the local database completely, including stored Docker volume data:

```bash
docker compose down -v
docker compose up -d postgres
npm run db:migrate:dev
```

**Warning:** `docker compose down -v` permanently deletes your local database data.

## Verify the Full Database Setup

Run:

```bash
docker compose up -d postgres
npm run db:generate
npm run db:migrate:dev
npm run db:studio
```

If all commands complete successfully, the local PostgreSQL and Prisma setup is working.


---

# Proposed Repository Structure

```text
playgeng/
├── apps/
│   ├── api/
│   └── web/
│
├── packages/
│   ├── database/
│   ├── shared/
│   └── config/
│
├── docs/
│   ├── architecture/
│   ├── product/
│   └── api/
│
├── README.md
├── package.json
└── .env.example
```

---

# Development Principles

## 1. No Business Logic in Controllers

Controllers coordinate HTTP requests and responses.

Business rules belong in services.

## 2. Database Access Is Organized

Persistence logic belongs in dedicated database layers.

## 3. Validate Every External Input

Never trust:

- Request bodies
- Query parameters
- Route parameters
- External webhooks

## 4. Financial Records Must Be Auditable

A mutable balance field must never be the only source of truth.

## 5. Build for Expansion, Not Speculation

Design boundaries that allow future growth.

Do not implement future features simply because they might someday be useful.

## 6. Test Critical Workflows

Prioritize tests around:

- Authorization
- Financial calculations
- Payments
- Webhook idempotency
- Tournament progression

---

# Future Expansion

Potential future capabilities include:

## Multiple Sports

```text
Football
Basketball
Volleyball
Tennis
Table Tennis
eSports
```

## Venue Management

- Discover venues
- Book pitches
- Track bookings
- Split booking costs

## AI Features

Potential future uses:

- Team balancing
- Match predictions
- Player recommendations
- Tournament scheduling optimization

AI is not part of the MVP.

## Public Discovery

Users could eventually discover:

- Sports groups
- Public tournaments
- Open matches
- Teams looking for players

---

# Roadmap

```text
PHASE 0 — Product Definition
        │
        ▼
PHASE 1 — Project Foundation
        │
        ▼
PHASE 2 — Authentication
        │
        ▼
PHASE 3 — Communities
        │
        ▼
PHASE 4 — Match Management (merged)
        │
        ▼
PHASE 5 — Sports & Teams (merged)
        │
        ▼
PHASE 6 — Sport Capability Contracts (merged)
        │
        ▼
PHASE 7 — Competition & Participant Foundation
        │
        ▼
PHASE 8 — Scheduling, Fixtures & Results
        │
        ▼
PHASE 9 — Standings, Statistics & Progression
        │
        ▼
FINANCE, PAYMENTS, NOTIFICATIONS & EXPANSION
```

---

# Current Status

**Current delivery status (November 2026)**

- Phase 1 — Foundation: merged.
- Phase 2 — Authentication: merged.
- Phase 3 — Communities and memberships: merged.
- Phase 4 — Match management: merged.
- Phase 5 — Community sports, teams and rosters: merged.
- Phase 6 — Sport capability and result contracts: merged (PR #8).
- Phase 7 — Competition and participant foundation: merged (PR #10 and PR #11).
- Phase 8 — Scheduling, fixtures and results: in progress (deterministic schedulers merged in PR #13; schedule persistence and generation API in progress).

### What was established in Phase 6

The shared package now defines sport capability metadata and generic result envelopes for score-based, sets-based and custom-result sports. These contracts describe supported participant modes and broad competition capability.

They are **not** complete sport rules engines. Official scoring, tiebreaks, standings points, forfeits, overtime, statistics and progression rules still require sport-specific adapters. Do not treat the current contracts as sufficient to validate every sport's result.

### Existing implementation reviewed: newDelyx

The existing [newDelyx repository](https://github.com/Olexxee/newDelyx) was reviewed as a source of domain ideas, not as a codebase to copy wholesale.

Potentially reusable concepts include:
- Round-robin scheduling and home/away balancing.
- Knockout seeding, bracket generation and byes.
- Competition lifecycle and registration workflows.
- Result reporting, disputes, evidence and administrative approval.
- Standings and optional player-rating strategies.

The audit also identified important mismatches that must be addressed before reuse:
- Its competition engine is primarily player-versus-player; PlayGeng must support both player-versus-player and team-versus-team competitions.
- Some statistics and standings logic assume football-specific fields.
- A declared Swiss format does not have a complete matching engine and validator.
- Randomized fixture ordering needs deterministic behavior and tests.
- Its persistence history and module boundaries do not match PlayGeng's Prisma/workspace architecture.

Therefore, reuse the domain concepts selectively. Do not copy its database schema, migration history, or competition modules directly.

### Current architecture decisions

1. Competition scheduling must operate on a generic participant abstraction, not directly on users or teams.
2. A competition is scoped to one community and one enabled community sport.
3. A player participant must be a member of the owning community; a team participant must belong to that same community and sport.
4. Registration needs explicit lifecycle states and authorization for approval/rejection.
5. Competition format support must be capability-gated. A format is not supported merely because an enum value exists.
6. Sport-specific result rules belong behind adapters; the generic competition engine should orchestrate workflows without embedding football assumptions.
7. Fixture generation remains deferred until participant identity, registration, lifecycle and result contracts are stable.

### Phase 7 — Competition and Participant Foundation (complete)

The completed Phase 7 foundation includes persistence and community-scoped API workflows before fixture generation:

- Competition ownership by community and enabled sport.
- Explicitly supported formats only (initially round-robin and knockout, subject to capability checks).
- Competition lifecycle: draft, registration open/closed, in progress, completed and cancelled.
- Registration modes: open, approval-based and invite-only.
- Generic entries supporting both individual players and teams, with database-enforced community consistency.
- Registration states: pending, approved, rejected and withdrawn.
- Duplicate-registration prevention, eligibility checks and participant identity snapshots.
- Versioned sport-adapter/ruleset metadata so later rule changes do not silently reinterpret existing competitions.

Required tests cover cross-community access, invalid participant type/sport combinations, duplicate and re-registration behavior, approval authorization, lifecycle transitions, team/player registration, invitation authorization/expiry, and concurrent capacity.

**Out of scope for Phase 7:** fixture generation, bracket progression, standings calculation, result approval and sport-specific statistics. These belong in later phases after the foundation is proven.

### Phase 8 — Scheduling, Fixtures and Results

Phase 8 now has pure deterministic schedulers (PR #13) and is adding competition-scoped schedule/fixture persistence. Round-robin uses the circle method; knockout uses standard seed placement and produces only the first round with explicit byes. Both consume generic CompetitionEntry IDs. The schedule API stores algorithm version and participant order, inserts fixtures and moves the competition to IN_PROGRESS atomically, resolves pending invitations, and returns the existing schedule on repeated generation. Pending registrations must be resolved before generation; explicit seeds can be assigned after registration closes and before schedule creation. The contract is documented in docs/architecture/DETERMINISTIC_SCHEDULING.md. Result approval, knockout advancement and standings remain separate work. Do not copy newDelyx's player-centric fixture schema or randomized shuffle implementation.

### Session checkpoint — November 9, 2026

Phase 6 is merged and the newDelyx reuse audit is documented in that repository. Phase 7 is complete: PR #10 merged competition/entry persistence, registration, approval, withdrawal, lifecycle and PostgreSQL integration coverage; PR #11 merged invite-only invitations for individual players and team captains, including expiry, authorization, and capacity-safe acceptance. Email/push invitation delivery is deferred to the notifications phase. Phase 8 is in progress: PR #13 merged deterministic generic round-robin and knockout engines; the next slice adds persisted schedules, fixtures, seeding and idempotent generation. Results, knockout progression and standings remain gated behind this persistence layer. Use the newDelyx audit as design input, not as code to copy.

---

## Long-Term Vision

PlayGeng begins by solving a small, concrete problem:

> **Helping sports groups organize games and shared money properly.**

The long-term objective is broader:

> **Build the operating system for sports communities, competitions, and shared sports activity.**


---

# Product Decision Record — Community Governance and Treasury

**Recorded: November 10, 2026**

This section captures product direction agreed during planning. It is intended to prevent these requirements from being lost when implementation resumes. It does not claim that the features are already implemented.

## 1. Community matches are the core recurring activity

PlayGeng's existing Match domain represents the regular games held by a sports community (for example, a weekly football session). These community matches are distinct from tournament fixtures.

Do not replace or conflate the two concepts:

- **Community Match:** a recurring or one-off game organized by a community, with its own participants, attendance, fees, teams and result.
- **Tournament Fixture:** a scheduled contest generated or managed inside a structured competition, involving that competition's registered entries.

Tournament scheduling must build on the existing generic competition and participant foundations. It must not redefine ordinary community matches as tournament fixtures.

## 2. Community governance and role elections

A community must not operate as the personal property of its creator. The creator is a distinct, protected origin role; all other community roles are intended to be assigned through a community voting process.

The voting requirement applies to every non-creator role, including the roles currently defined as:

- ADMIN
- TREASURER
- ORGANIZER

It must also apply to additional non-creator roles introduced later, rather than silently making new privileged roles appointable without a vote.

Membership itself is not an elected office. A person first becomes an eligible community member; elections then determine who occupies a community role.

### Governance capabilities to design

The governance domain must support:

- Role nominations and candidate eligibility.
- Elections scoped to a specific community and role.
- A defined voting window and election status.
- One valid ballot per eligible voter per election.
- Vote validation and duplicate-vote prevention.
- Tallying and recording election outcomes.
- Assigning the elected role only after a valid outcome.
- Election history and an auditable record of nominations, ballots, results and role changes.
- Vacancies, resignation, removal and replacement elections.
- Revoking role-specific permissions when a person's role ends.

Governance must be enforced by the backend. Hiding UI controls is not authorization.

### Governance rules still requiring an explicit product decision

Do not invent these rules during implementation. Confirm and document them before building the election workflow:

- Whether the creator has any emergency or override powers, and their exact limits.
- Voter eligibility (for example, membership tenure or account standing).
- Candidate eligibility for each role.
- Whether an election requires a minimum participation quorum.
- Whether a role is won by a simple majority, plurality, or another defined threshold.
- Tie handling, failed elections, uncontested candidates and repeat elections.
- Term length, re-election limits and when a role can be recalled.
- Whether communities can configure election rules or must follow one platform-wide policy.

The creator's exemption from role elections must not be interpreted as permission to bypass the governance system. Any exceptional powers must be explicit, narrow, authorized and auditable.

## 3. Community-owned treasury

Community funds are held for the community, not owned personally by the community creator or by whichever member currently has the Treasurer role.

The product must provide a **Community Treasury** with clear financial ownership, transparent records and controlled operations.

The treasury must account for:

- Member contributions and contribution campaigns.
- Match fees and match-related collections.
- Tournament registration collections.
- Other community income.
- Expenses and refunds.
- Payouts and withdrawals.
- Amounts due, paid, unpaid and overdue.
- Pending, processing, completed, failed, cancelled and refunded payment states.
- Transaction references, supporting metadata and audit history.

The system must distinguish at least three concepts:

1. **Obligation:** what a member or participant is required to pay, including amount, due date and current paid/unpaid/overdue state.
2. **Payment:** the payment attempt and its provider-confirmed outcome.
3. **Ledger entry:** the accounting record created from a verified financial event.

A person being marked as paid must be backed by a verified payment or an explicitly authorized, audited manual reconciliation. Creating an obligation must not itself increase the treasury balance.

### Treasury controls

- The ledger is the accounting source of truth; balances are derived, never manually edited.
- Completed entries are immutable. Corrections use reversals or adjustments with reasons and audit records.
- Payment webhooks and provider references must be verified and idempotent.
- Financial actions require explicit permissions and must be attributable to an actor.
- Role changes must immediately affect treasury permissions.
- Withdrawals and payouts need authorization rules separate from the ability to record an expense.
- Members should be able to inspect the financial information the community policy makes visible, including their own obligations and payment status.
- Financial reporting must reconcile obligations, verified payments, ledger entries and externally held funds.

### Critical custody distinction

An in-app ledger is not a bank account and does not prove that PlayGeng or a community physically holds the money.

Before implementing collection, storage or withdrawal flows, decide how funds are actually held and controlled. Evaluate the supported payment-provider and banking arrangements, including who legally owns or controls the receiving account, how community-level segregation works, who can authorize withdrawals, how refunds/disputes are handled, and the applicable Nigerian regulatory and provider requirements.

Do not describe funds as being held by a community merely because the application displays a positive ledger balance. The custody model must be validated with the relevant payment provider and qualified legal/compliance advice before production money movement.

## 4. Domain boundaries

Keep these concerns separate even when they share community membership and authorization:

| Domain | Responsibility |
|---|---|
| Membership | Joining, invitations, member status and eligibility |
| Governance | Nominations, elections, ballots, outcomes and role assignments |
| Community Matches | Regular community games, participants, attendance, teams and results |
| Treasury | Obligations, collections, payments, expenses, payouts and ledger |
| Payments | Provider integration, verification, webhooks, refunds and reconciliation |
| Competitions | Tournament lifecycle, registrations, entries, fixtures and progression |

Do not place election logic inside the community CRUD module or financial ledger logic inside payment-provider adapters. Services may coordinate across domains, but each domain must own its rules and persistence boundaries.

## 5. Revised implementation priority

The existing competition and participant foundation (Phase 7) is already merged. The deterministic scheduling work recorded under Phase 8 remains a valid technical track, but the next product priorities must not be inferred from the older roadmap diagram alone.

The agreed priority is:

1. Finish and verify the deterministic scheduling contract already in progress, without expanding into advanced tournament formats or speculative fixture features.
2. Audit the current schema and community authorization implementation before adding governance or finance models.
3. Define and implement Community Governance, including elections for every non-creator community role.
4. Define the Community Treasury, obligations, paid/unpaid tracking, auditable ledger and financial permissions.
5. Decide and validate the real-world funds custody and payment-provider model before enabling production collections or withdrawals.
6. Integrate payment flows with verified obligations and ledger events.
7. Return to tournament commercial workflows (registration fees, payment status, refunds and reconciliation), then continue fixture persistence, results, standings and progression in dependency order.

This priority supersedes the older roadmap's placement of finance after tournament fixtures and statistics. Existing merged competition work is retained; it is not a reason to postpone governance and treasury foundations.

## 6. Required repository audit before implementation

Before designing migrations or endpoints, inspect the actual implementation and report what already exists.

Audit at minimum:

- Prisma models and enums for communities, memberships, roles and permissions.
- Community creation, invitation, membership removal and role assignment services.
- Existing authorization middleware and every community-scoped permission check.
- Match participation and match-fee handling.
- Competition registration, entry, invitation and payment-related fields.
- Existing payment, contribution, expense, transaction, audit-log and webhook models/modules.
- Database constraints, transaction boundaries and integration tests relevant to concurrency and financial consistency.

The audit output must identify existing behavior, missing behavior, unsafe assumptions, schema changes required and migration dependencies. Do not duplicate existing concepts or start migrations based only on this README.

## 7. Implementation constraints

- Preserve the modular backend convention: `db`, `service`, `controller`, `routes` and `validator`.
- Keep business rules in services and persistence in the database layer.
- Use database transactions and appropriate constraints for elections, role assignment, capacity, payments and ledger posting.
- Test authorization at service/API boundaries, not only in the frontend.
- Add auditability for governance and financial actions from the first implementation.
- Update this README and the relevant architecture documents when decisions are finalized or implementation status changes.


### Confirmed first-election policy — November 10, 2026

The following baseline rules are approved for the first governance implementation:

- The community creator may vote as an ordinary eligible member and receives exactly one vote per election.
- The creator has no additional vote weight, unilateral veto or power to appoint elected officers outside the election process.
- Each eligible community member may cast one ballot per election. Duplicate ballots are prevented by a database uniqueness constraint.
- An election requires a participation quorum. The numeric quorum threshold must be finalized in the governance implementation before elections can open; it must not be guessed in code.
- The winner must receive a simple majority of valid votes. A tie or failed quorum produces no appointment and requires a new election.
- Elected officers have no fixed term in the first release. They remain in office until resignation, a valid removal process or a subsequent election.
- Membership is not an elected office. Members become eligible voters and candidates only under the published eligibility rules.
- The creator is represented by the immutable `Community.ownerId` identity. The membership enum uses `CREATOR` only as a display/classification label; authorization must derive creator privileges from `Community.ownerId`, not from the membership role string.
- ADMIN, TREASURER and ORGANIZER are elected offices. Adding another privileged community role must require an explicit governance policy and election path.

These defaults do not authorize the creator to bypass election results. Emergency powers, candidate tenure requirements, recall thresholds and numerical quorum remain explicit policy decisions and must be documented before the related workflows ship.


### Governance implementation contract

The first election workflow uses these explicit rules:

- ADMIN, TREASURER and ORGANIZER are the elected offices. MEMBER is ordinary membership; CREATOR is a distinct immutable identity.
- Any active community member may initiate an election for an office. Only one non-terminal election for the same office may exist in a community at a time.
- The eligible electorate is snapshotted when the election is created. Every active member at that point is included, including the creator. New members do not join an election already in progress.
- The creator has exactly one ballot and is not eligible to stand for an elected office.
- Candidates nominate themselves. A candidate must be in the snapshotted electorate, remain an active community member and hold no other elected office. An incumbent may stand for re-election to the same office.
- Each election must declare a quorum between 50% and 100% of the snapshotted electorate. The quorum is calculated against that frozen electorate, not only the people who remain members later.
- An officer is appointed only if quorum is met and one candidate receives strictly more than half of valid ballots. Ties, no majority, no candidates, failed quorum or an ineligible winner result in no appointment.
- Ballots are immutable and the database enforces one ballot per voter per election. Ballot choices are not returned by election read endpoints; vote totals are revealed only after the election is terminal.
- Role assignment and election completion occur in one serializable database transaction. Previous holders of that office are demoted to MEMBER as the winner is assigned.
- Election and ballot records are retained as the governance history. Manual privileged-role changes remain disabled.

The first API implementation exposes elections under `/api/v1/communities/:communityId/elections`. Treasury permissions and financial controls are intentionally not included in this module.


## Community Treasury implementation contract — November 10, 2026

The first governance workflow is merged (PR #17). Treasury is now the next financial foundation.

The repository audit found no existing treasury, payment, receipt, obligation, expense, journal, ledger, webhook or financial audit models. Match participants and competition entries also have no payment state. Finance will therefore be implemented as a shared domain rather than separate paid flags in matches and competitions.

The architecture and invariants are documented in [docs/architecture/COMMUNITY_TREASURY.md](docs/architecture/COMMUNITY_TREASURY.md). Key rules:

- Use a double-entry, append-only journal. Posted entries are immutable; corrections are reversals.
- Store money as integer minor units and give each community treasury one ISO-4217 currency, immutable after its first posting.
- Separate obligations, payment attempts, verified receipts and ledger postings. An obligation is not cash; a payment attempt is not proof of receipt.
- Enforce balanced debit/credit postings, atomic settlement, idempotency and audit attribution.
- Match participation and approved competition registration create obligations through Treasury; those domains do not own payment status.
- Manual reconciliation requires Treasurer authorization, evidence, a reason and an audit record.
- The Creator role does not provide a hidden financial override. Current elected-role authorization is checked at operation time.
- Production collection, custody, transfers and withdrawals remain disabled until the receiving-account/custody model, segregation, dual authorization, provider terms and Nigerian compliance requirements are validated.

### Treasury delivery order

1. Treasury and chart-of-accounts schema. (PR #19)
2. Append-only balanced journal posting and reversal service. (current PR)
3. Idempotent obligations, receipts and allocation rules.
4. Treasury summary, ledger and member-obligation read APIs.
5. Treasurer permissions, manual reconciliation and audit trail.
6. PostgreSQL integrity constraints and concurrency-focused integration tests.
7. Payment-provider and funds-custody integration as a separate phase.


### Treasury journal API foundation

The treasury API is mounted at `/api/v1/communities/:communityId/treasury` and currently provides:

- `POST /`: initialize a treasury using an ISO-4217 currency code and seed the standard chart of accounts.
- `GET /`: retrieve treasury accounts and calculated balances.
- `POST /journal`: post a balanced journal transaction using integer minor-unit strings and an idempotency key.
- `GET /journal`: list posted journal transactions.
- `POST /journal/:transactionId/reverse`: create a linked reversing transaction with a mandatory reason.

Authorization is intentionally narrower than the general community permission helper: only the currently elected TREASURER can initialize, post or reverse. ADMIN and TREASURER can inspect treasury summaries and journal history. CREATOR does not receive an implicit financial override.

The database transaction writes the draft header and postings, then changes the journal to POSTED in one serializable transaction. Deferred PostgreSQL constraints verify that posted journals have at least two postings and equal debit/credit totals. Idempotency retries return the original transaction only when the supplied transaction details match. Reversals write opposite postings; original posted records remain immutable.

This API is an internal ledger foundation, not a payment confirmation or cash custody integration. Only verified receipts/manual reconciliation in a later phase may justify posting real receipts. The current journal endpoint must not be exposed as a general public payment endpoint.


### Verified receipts and obligation allocation schema

The treasury schema now separates:

- **Obligations:** amounts a member owes for a contribution, match fee, competition registration or other approved source.
- **Verified receipts:** money independently received and reconciled, with an external reference, evidence reference, verifying Treasurer and idempotency key.
- **Allocations:** the amount of a verified receipt applied to a specific obligation.

A receipt is not a payment attempt, and an obligation is not a payment. Partial allocations are supported by the data model; paid and outstanding amounts are derived from allocations rather than mutable balance fields. Database relations prevent allocations across different treasuries or members.

The current schema foundation supports manual reconciliation only. Receipt creation, allocation services, ledger posting, member-facing obligation reads and payment-provider integration are separate implementation steps. No unverified payment claim can settle an obligation.


## Obligation service implementation checkpoint — November 10, 2026

The first obligation service layer is implemented on branch `feat/treasury-obligation-services` (pending CI/review):

- Treasurer-only obligation issuance against an active community member.
- Stable source identity and treasury-scoped idempotency; repeated requests must match the original obligation details.
- Obligation issuance and its journal entry are written in one serializable transaction: debit RECEIVABLES and credit the source-appropriate income account. Creating a due amount does not increase CASH.
- Cancellation is permitted only before any receipt allocation exists. It writes an immutable reversing journal entry, records the cancellation reason and actor, and marks the obligation cancelled in the same transaction.
- Members can read only their own obligations. ADMIN/TREASURER can inspect the community obligation list; only TREASURER can create or cancel obligations.
- Amounts are integer minor-unit strings. Outstanding and allocated amounts are calculated from allocation rows; overdue is derived from due date at read time.

Endpoints under `/api/v1/communities/:communityId/treasury/obligations`:

- `POST /` create an obligation.
- `GET /` list all obligations for ADMIN/TREASURER.
- `GET /mine` list the authenticated member's obligations.
- `GET /:obligationId` retrieve an obligation subject to ownership/finance-role checks.
- `POST /:obligationId/cancel` cancel an unsettled obligation with an audited reversal.

Receipt verification, allocations and cash receipt posting are deliberately not included in this checkpoint. The next service must make receipt creation, allocation and DR CASH / CR RECEIVABLES posting atomic; it must reject unallocated excess receipts rather than silently creating a negative receivable.


### Journal workflow guardrails added with obligation services

The generic journal endpoint is now restricted to documented opening balances and non-cash adjustments. An opening balance must debit CASH and credit OPENING_EQUITY and include a source reference; it is audited. Generic adjustments cannot touch CASH, RECEIVABLES or operational income accounts. Obligation-issued journals cannot be reversed through the generic reversal endpoint; they must use the obligation cancellation workflow. This prevents a manual journal request from bypassing receipt verification or leaving an obligation open after its receivable has been reversed.


## Treasury implementation checkpoint — manual receipts

The obligation issuance/cancellation services and the first manual receipt workflow are implemented.

- Only the currently elected Treasurer can verify a manual receipt.
- A verified receipt must include an independently reconciled external reference and evidence reference.
- One receipt may be allocated across multiple obligations for the same member, but allocation amounts must add up exactly to the receipt amount.
- Allocations cannot exceed the remaining balance of an obligation. Concurrent receipt allocations and obligation cancellation are serialized.
- Receipt creation, allocations, DR CASH / CR RECEIVABLES journal posting and the audit event are atomic and idempotent.
- Members can see only their own obligations and receipts; ADMIN/TREASURER can inspect community finance records.
- This is manual reconciliation only. It does not integrate a payment provider, accept unverified member claims, move funds, or prove custody of community money.

See [Community Treasury Architecture](docs/architecture/COMMUNITY_TREASURY.md) for the implementation contract and API details.


## Commercial workflow audit — November 10, 2026

**Status:** Initial code audit documented; no commercial workflow integration implemented in this phase.

The current implementation was inspected in `apps/api/src/modules/matches`, `apps/api/src/modules/competitions`, `apps/api/src/modules/communities`, the shared community authorization policy, and `packages/database/prisma/schema.prisma`.

### Verified current behavior

| Domain | Existing behavior | Financial integration status |
|---|---|---|
| Community contributions | The product README describes contribution campaigns and recurring/monthly contributions. | No contribution campaign/assessment model or contribution API module exists in the inspected schema/API. |
| Community matches | Managers create, edit and cancel scheduled matches. Members join, decline, leave or waitlist; managers record ATTENDED/NO_SHOW. Capacity checks and participant changes use database transactions. | No fee configuration, obligation source record, payment status or receipt relation exists on Match/MatchParticipant. Joining a match does not create an obligation. |
| Competitions | Supports TEAM and PLAYER entries; OPEN registrations auto-approve, APPROVAL_REQUIRED entries begin PENDING, and INVITE_ONLY uses invitations. Capacity is checked under a competition row lock. Entries can be reviewed or withdrawn before the competition starts. | No registration fee, payment state, obligation reference or payment gate exists on Competition/CompetitionEntry. |
| Invitations | Invite-only registration has expiry, acceptance and decline flows. Team invitations are addressed to the active captain. | No payment obligation is created on invitation or acceptance. |
| Treasury | Treasury owns obligations, verified manual receipts, allocations and the ledger. | It is not yet invoked by match or competition lifecycle services. |

### Lifecycle observations and gaps

**Matches**
- A participant is created as CONFIRMED unless capacity is full, in which case the participant is WAITLISTED.
- Leaving a scheduled match changes an active participant to CANCELLED; the earliest waitlisted participant is promoted when a confirmed participant leaves.
- Attendance changes a confirmed participant to ATTENDED or NO_SHOW; a NO_SHOW can also promote the earliest waitlisted participant.
- Match cancellation currently changes only the Match status to CANCELLED. It does not transition participant rows or create a cancellation event for downstream consumers.
- Match edits are restricted to SCHEDULED matches. There is no explicit rescheduling event or history record.
- No fee or payment behavior exists, so current code cannot distinguish a free match from a fee-bearing match.

**Competitions**
- Registration is accepted only while status is REGISTRATION_OPEN and within configured opening/closing times.
- OPEN mode creates APPROVED entries; APPROVAL_REQUIRED creates PENDING entries; INVITE_ONLY uses invitation acceptance to create an APPROVED entry.
- TEAM registration requires a team captain or community competition manager. PLAYER registration is for the active community member.
- Entries can be withdrawn while the competition is not IN_PROGRESS, COMPLETED or CANCELLED. This includes both PENDING and APPROVED entries.
- Competition cancellation is a status transition available from non-terminal states. The transition does not itself change active entry statuses or expire/cancel pending invitations.
- There is no fee, paid/unpaid state, payment deadline, refund state, or obligation check before approval, acceptance, or starting the competition.
- The schema supports one entry per participant under its uniqueness constraints, but there is no commercial rule defining whether a team fee is paid by the team, captain, or split among players.

**Contributions**
- The README describes monthly and purpose-specific contributions, but the inspected Prisma schema has no campaign, assessment, schedule, contribution-member assignment, or contribution payment model.
- The Treasury obligation source enum already includes CONTRIBUTION, but that is only a generic source classification. It does not provide a contribution campaign lifecycle or stable source record by itself.
- Recurring generation, member eligibility snapshots, due dates, exemptions, proration and campaign cancellation are not implemented.

### Cross-domain findings

1. The Treasury service is a separate financial domain. Match and competition services currently do not call it; do not add independent `isPaid` booleans to their models.
2. Obligation issuance must be tied to a durable business event and a deterministic source identity. Retries must not create duplicate obligations.
3. A tentative registration, invitation, waitlist position or unapproved entry must not automatically create a payable obligation without an explicit product rule.
4. Cancellation/withdrawal after an obligation exists needs an explicit policy: cancel an unsettled obligation, retain it, or route a settled amount through a refund workflow. The current Treasury cancellation service only supports cancellation before any receipt allocation; it is not a refund mechanism.
5. Attendance status is recorded only for a scheduled match and only for confirmed participants. The product must decide whether match liability is based on confirmation, actual attendance, or a cutoff rule. The current model does not preserve an immutable confirmation/cancellation history.
6. The shared community permission helper grants the community owner all generic community permissions by checking `Community.ownerId` before role permissions. Treasury write endpoints have narrower Treasurer-specific checks. Future commercial integrations must preserve that separation and must not infer financial authority from match/competition management authority.
7. Competition capacity counts PENDING and APPROVED entries. Any payment-gated design must decide whether unpaid pending entries reserve capacity, and for how long.

### Decisions required before implementation

Do not guess these rules in code. Finalize them in the product/architecture contract first:

- **Contributions:** one-off versus recurring campaigns; who can create/approve them; whether every active member is assessed by default; exemptions; due dates; schedule generation; joining/leaving mid-cycle; cancellation and adjustments.
- **Matches:** whether a fee is optional per match; the exact liability trigger (confirmation versus attendance/cutoff); whether waitlisted participants owe anything before promotion; what happens when a player cancels; whether a NO_SHOW remains liable; match cancellation/rescheduling and refunds.
- **Competitions:** whether fees are per team or per player; who is the liable payer for a team entry; when an obligation is created (registration submission, approval, or invitation acceptance); payment deadline; whether payment is required before approval, before entry confirmation, or before fixtures; withdrawal, rejection, competition cancellation and refund policy; capacity reservation and expiry for unpaid entries.
- **Operations:** who can waive or adjust an obligation, how the action is approved/audited, and how removal from a community affects outstanding obligations.

### Recommended implementation order

1. Finalize the business rules above and document the accepted state transitions.
2. Design contribution campaigns/assessments as a first-class domain; do not treat the generic Treasury source enum as the contribution model.
3. Add match-to-obligation integration at the agreed liability trigger, with atomic/idempotent source identity and explicit cancellation handling.
4. Add competition-to-obligation integration at the agreed registration/approval trigger, including team-versus-player payer semantics and payment gating.
5. Add provider payment attempts/webhooks only after these commercial event flows and the separate custody decision are ready.

**Phase 1 audit constraint:** this checkpoint records observed behavior and implementation gaps only. It does not authorize new fee rules, payment-provider integration, custody, or withdrawal functionality.


---

# Current implementation status — November 11, 2026

The consolidated, repository-verified status of completed work, open pull requests, approved product decisions, unresolved policies, and the recommended implementation sequence is maintained in:

[Reconciled Implementation Status and Remaining Work](docs/implementation/IMPLEMENTATION_STATUS_AND_NEXT_STEPS.md).

That document supersedes older phase summaries and historical audit statements where later merged PRs have changed the implementation status. In particular, contribution campaign administration and reporting are implemented; atomic assessment issuance remains in open PR #31.
