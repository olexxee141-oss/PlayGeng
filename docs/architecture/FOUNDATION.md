# PlayGeng Engineering Foundation

## Runtime and framework decisions

- Node.js 26 LTS
- TypeScript with strict compiler checks
- Express 5 for the HTTP API
- React for the web application
- PostgreSQL as the primary relational database
- Prisma ORM 7 as the initial database access layer
- npm workspaces for the monorepo

Prisma ORM 8 is currently a release candidate, so the project will use the stable Prisma 7 line rather than adopting a pre-release ORM in the foundation.

## Repository boundaries

- `apps/api`: HTTP API and backend application.
- `apps/web`: React web application.
- `packages/database`: Prisma schema, migrations, client and database utilities.
- `packages/shared`: domain-neutral shared contracts, enums and schemas.
- `packages/config`: shared tooling configuration where reuse is justified.

## Backend module convention

Every business module follows this structure:

```text
module/
├── module.db.ts
├── module.service.ts
├── module.controller.ts
├── module.routes.ts
└── module.validator.ts
```

Responsibilities:

- `db`: persistence queries only.
- `service`: business rules and orchestration.
- `controller`: HTTP request/response mapping.
- `routes`: endpoint and middleware composition.
- `validator`: request input schemas.

## Cross-cutting API infrastructure

The API foundation will provide:

- Application error types
- Async handler wrapper
- Not-found middleware
- Centralized error middleware
- Request validation middleware
- Structured logging
- Environment validation
- Authentication and authorization middleware
- Health and readiness endpoints

## Financial integrity constraints

Financial functionality must use an auditable ledger. A cached balance may be introduced for read performance later, but it must never become the authoritative financial record.

Payment webhooks and financial commands must be idempotent. Completed ledger entries must not be silently edited or deleted.

## Delivery rules

1. Keep business logic out of controllers.
2. Keep Prisma client initialization in the database package.
3. Validate all external input at the API boundary.
4. Enforce tenant/community ownership in backend services.
5. Add tests alongside each business capability.
6. Do not add speculative infrastructure without a concrete requirement.
