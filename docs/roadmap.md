# Passkey SDK roadmap

## 0.3 scope

The self-hosted SDK adds passkey enrollment, discoverable sign-in, and credential management to an existing Next.js App Router app with PostgreSQL. It provides a route, migration, WebAuthn verification, browser client, and React controls. The application owns accounts, sessions, login policy, recovery, and rate limiting for HTTPS. [Quickstart](quickstart.md)

## Verification

- The PostgreSQL and Chromium suite covers attempt isolation, expiration, and atomic consumption. It also verifies recent-authentication requirements and the enrollment, sign-in, rename, revocation, and password fallback flow. [Smoke test](../examples/next-basic/README.md#smoke-test)
- On 26 November 2026, physical passkey checks on macOS Chrome and Safari covered enrollment, autofill, explicit sign-in, rename, revocation, and password fallback. A fresh assertion using a revoked physical credential and a second physical device remain unverified.

## After 0.3.0

1. Add step-up verification for an application-owned sensitive action. Bind fresh verification to that action and session, then recheck authorization when consuming the approval.
2. Validate the quickstart in a second app with a different session implementation before expanding framework and database support.
3. Evaluate hosted verification after self-hosted users identify what they want someone else to operate. Passkey-first signup, automatic creation, and related-origin support remain future work.
