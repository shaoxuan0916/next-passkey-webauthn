# Next.js and PostgreSQL quickstart

Add passkeys to an existing Next.js App Router application using its PostgreSQL database and session system. The SDK handles WebAuthn, verification attempts, storage, and the browser UI. Keep your existing login and recovery paths available during rollout.

## Upgrading from 0.1.x or 0.2.x

0.3.0 replaces the legacy APIs and starts with an empty PostgreSQL schema. Before switching sign-in, verify that every affected user has a working sign-in or recovery method independent of their old passkey. Preserve existing credential data during rollout and test fallback in a development environment. After the switch, users sign in through that method and enroll a new passkey.

## 1. Install the SDK and prepare PostgreSQL

Use Node.js 20 or later and meet your Next.js version's Node.js requirement. Install the 0.3 release line from your app directory.

```sh
npm install next-passkey-webauthn@^0.3.0
```

To install from source, build a tarball from the 0.3.0 checkout.

```sh
npm ci
npm pack
```

From your app directory, run `npm install /path/to/next-passkey-webauthn-0.3.0.tgz`. If your app needs a PostgreSQL driver, install `pg` and add `@types/pg` as a development dependency.

Copy the packaged migration into your app's normal database migration workflow. The package exposes the SQL path for tools that need a filename.

```sh
node -p "require.resolve('next-passkey-webauthn/migrations/001_passkeys.sql')"
```

Apply it first to a development database. It creates a separate `next_passkey` schema. Keep it private to backend roles and grant the app role schema usage and the required table permissions. The runtime needs `SELECT`, `INSERT`, and `UPDATE` on `accounts`, and `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on `credentials` and `attempts`. Use one connection pool per app process. Use a separate database for environments or apps with distinct account namespaces that share an RP ID.

## 2. Mount the route and connect application auth

Use `db` for your app's PostgreSQL pool and implement the `auth` methods with your server-side authentication code. For a working example with a local test session, see the reference app. [Example wiring](https://github.com/shaoxuan0916/next-passkey-webauthn/blob/main/examples/next-basic/lib/passkeys.ts)

```ts
// app/api/passkeys/route.ts
import { createNextPasskeys } from "next-passkey-webauthn/next";
import { PostgresPasskeyStore } from "next-passkey-webauthn/postgres";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const { PASSKEY_ORIGIN: origin, PASSKEY_RP_ID: rpId } = process.env;
if (!origin || !rpId) throw new Error("Set PASSKEY_ORIGIN and PASSKEY_RP_ID.");

const passkeys = createNextPasskeys({
  origin,
  rpId,
  rpName: "My app",
  store: new PostgresPasskeyStore(db),
  getSession: (request) => auth.readPasskeySession(request),
  signIn: (accountId, request) => auth.establishPasskeySession(accountId, request),
  rateLimit: (request, scope) => scope === "request"
    ? auth.allowPasskeyRequest(request)
    : auth.allowPasskeyOperation(request, scope),
});

export const POST = passkeys.POST;
```

- **`getSession`** returns `null` or `{ id, account: { id, name, displayName? }, authenticatedAt }` from a validated, active application session. Use a separate opaque session ID and rotate it on sign-in or reauthentication. Set `authenticatedAt` to the time of the last successful full authentication in epoch milliseconds and preserve it on routine session refreshes. Enrollment and revocation require authentication within 10 minutes. Use your existing flow when the SDK asks for fresh authentication.
- **`signIn`** receives the account ID resolved from a verified passkey. Apply the existing login rules, including disabled-account and mandatory authentication policy, before issuing the application's normal fresh session. Return `true` after establishing the session, or `false` if policy declines it. In a Next.js route you can set the app's session cookie with `await cookies()`.
- **`rateLimit`** is required over HTTPS. The `"request"` scope runs before the handler reads the body. Use it for a general request budget without reading the body in the hook. After validation, apply a separate budget for the named operation. Use verified client information and return `false` when either budget is exceeded. Configure request limits and read deadlines at the ingress as well. The handler caps reads at 64 KiB and returns HTTP 408 if the body takes more than 10 seconds to read. HTTP localhost can omit the hook for development.

Locally, set `PASSKEY_ORIGIN=http://localhost:3000` and `PASSKEY_RP_ID=localhost`. In production, configure the exact HTTPS browser origin without a trailing slash. Use that hostname or a registrable parent domain as your relying-party ID. For `https://app.example.com`, `app.example.com` confines credentials to that host. Keep the RP ID stable across deployments. The route and UI run on the same origin.

Revocation takes effect on future passkey assertions. Existing sessions follow your application's session policy. Keep an independent authentication or recovery method available for users who revoke or lose all their passkeys.

### Account deletion

Use an immutable `account.id` that your application never reassigns. When deleting an account, invalidate its sessions and have both auth hooks reject the deleted account. Remove its passkey records for each RP ID the application uses. Run the following statements in a transaction using a backend role with `SELECT` and `DELETE` on `next_passkey.attempts` and `next_passkey.accounts`. Bind `$1` to the RP ID and `$2` to the deleted account ID. Deleting the SDK account row cascades to its credentials.

```sql
DELETE FROM next_passkey.attempts WHERE rp_id = $1 AND account_id = $2;
DELETE FROM next_passkey.accounts WHERE rp_id = $1 AND account_id = $2;
```

## 3. Add sign-in and settings UI

Render `<PasskeySignIn />` alongside your existing login form. Render `<PasskeySettings />` in the signed-in account area. Import each component where you render it.

```tsx
import { PasskeySettings, PasskeySignIn } from "next-passkey-webauthn/react";
```

To enable browser autofill, set `autoComplete="username webauthn"` on the existing username or email field and render `<PasskeySignIn autofill />`. Explicit sign-in stays available. Both components default to `/api/passkeys`; set `endpoint` if the route uses another path. For custom UI, use `createPasskeyClient` from `next-passkey-webauthn/browser`.

## 4. Verify the integration

1. Sign in using the app's existing method and enroll a passkey. Confirm it appears in settings.
2. Sign out and select **Sign in with a passkey**. Confirm the app restores the correct user's session without an account hint.
3. Rename and revoke the passkey. Confirm the revoked passkey can no longer sign in, then sign back in through the original method.
4. With a separate test account, confirm it cannot manage the first account's credentials.

The reference app includes a Chromium and PostgreSQL test for enrollment, sign-in, credential management, and fallback. [Reference app](https://github.com/shaoxuan0916/next-passkey-webauthn/tree/main/examples/next-basic)
