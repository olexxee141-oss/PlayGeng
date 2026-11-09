# Authentication API Verification

## Local setup

1. Copy `.env.example` to `.env`.
2. Set a unique `JWT_ACCESS_SECRET` with at least 32 characters.
3. Start PostgreSQL with `docker compose up -d postgres`.
4. Install dependencies with `npm install`.
5. Generate Prisma Client with `npm run db:generate`.
6. Apply migrations with `npm run db:migrate:deploy`.
7. Start the API with `npm run dev:api`.

When Resend is not configured in development, registration and password-reset responses include one-time development tokens. Never enable this behavior in production.

## Endpoint checklist

- [ ] Register a user with a valid email, first name, last name and password of at least 12 characters.
- [ ] Confirm the response does not return the password or password hash.
- [ ] Verify the email with the one-time verification token.
- [ ] Confirm the verification token cannot be used twice.
- [ ] Log in with the verified account and confirm access and refresh tokens are returned.
- [ ] Call `GET /api/v1/auth/me` with the access token.
- [ ] Refresh the session and confirm the old refresh token is rejected.
- [ ] Log out with the current refresh token and confirm it is rejected.
- [ ] Request a password reset and confirm the response is generic for unknown and known email addresses.
- [ ] Reset the password and confirm all previous sessions are revoked.
- [ ] Confirm suspended and unverified users cannot log in or refresh sessions.
- [ ] Confirm invalid request payloads return validation errors.
- [ ] Confirm repeated authentication requests are rate limited.

## Security checks

- Inspect database rows and confirm refresh, verification and reset tokens are stored as SHA-256 hashes, not raw values.
- Confirm password hashes use the `scrypt` format and are never returned by user endpoints.
- Confirm access tokens expire according to `JWT_ACCESS_TTL_SECONDS`.
- Confirm logs contain no credentials, bearer tokens or one-time codes.
