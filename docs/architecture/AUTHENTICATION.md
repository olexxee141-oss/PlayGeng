# Authentication and Identity

## Initial account model

- Email and password registration.
- Email addresses are normalized to lowercase and treated as unique.
- Passwords are stored only as strong one-way hashes; plaintext passwords are never persisted or logged.
- Email verification is required before a user can access protected application features.
- Suspended accounts cannot authenticate.
- A user may later belong to multiple communities. Community roles are not global user roles.

## Token strategy

- Short-lived signed access tokens are used by both native mobile and future web clients.
- Long-lived refresh tokens are opaque, random values. Only their SHA-256 hashes are stored.
- Refresh tokens rotate on every successful refresh. The previous token is revoked as part of the same database transaction.
- Logout revokes the current refresh-token session.
- Password reset and email verification tokens are random, single-use, time-limited values. Only hashes are stored.
- Password changes revoke all active sessions.

## API contract

Initial endpoints under /api/v1/auth:

- POST /register
- POST /login
- POST /refresh
- POST /logout
- POST /verify-email
- POST /forgot-password
- POST /reset-password
- GET /me

All request bodies are validated at the HTTP boundary. Responses use the common API envelope. Authentication middleware verifies access tokens and reloads the user status from the database.

## Security requirements

- Do not reveal whether an email exists in login, registration, or password-reset responses where that would enable account enumeration.
- Apply rate limiting to registration, login, verification, refresh and password-reset endpoints before production exposure.
- Never log credentials, access tokens, refresh tokens, verification tokens or reset tokens.
- Refresh token rotation and one-time token consumption must be atomic.
- Enforce email verification and active account status in backend services, not only in clients.
- Use HTTPS in every non-local environment.

## Deferred decisions

OAuth providers, phone-number login, MFA, device management and social login are intentionally deferred until the email/password flow is secure and tested.
