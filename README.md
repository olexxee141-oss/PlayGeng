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
PHASE 4 — Match Management
        │
        ▼
PHASE 5 — Finance & Contributions
        │
        ▼
PHASE 6 — Payments
        │
        ▼
PHASE 7 — Tournaments
        │
        ▼
PHASE 8 — Fixtures & Results
        │
        ▼
PHASE 9 — Statistics
        │
        ▼
PHASE 10 — Notifications & Expansion
```

---

# Current Status

🚧 **Phase 0 — Product definition and architecture.**

The immediate next decisions are:

1. Lock the MVP boundaries.
2. Lock the initial technology stack.
3. Define the monorepo and package architecture.
4. Design the initial database schema.
5. Create the project foundation.
6. Implement the platform incrementally by phase.

---

## Long-Term Vision

PlayGeng begins by solving a small, concrete problem:

> **Helping sports groups organize games and shared money properly.**

The long-term objective is broader:

> **Build the operating system for sports communities, competitions, and shared sports activity.**
