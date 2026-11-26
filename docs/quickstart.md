# Next.js and PostgreSQL quickstart

This guide adds passkeys to an existing Next.js App Router app. The SDK handles WebAuthn and stores passkeys in PostgreSQL. Your app still owns accounts, sign-in rules, sessions, and account recovery.

## Upgrading from 0.1.x or 0.2.x

Version 0.3.0 replaces the old APIs and starts with a fresh PostgreSQL schema. It does not import existing passkeys. Before you switch, test your fallback in development and make sure everyone who uses an old passkey has another way to sign in or recover their account. Keep the old credential data during the rollout. After the switch, users can sign in with their fallback and add a new passkey.

## 1. Install the SDK and run the migration

Use Node.js 20 or later, or a newer version if your Next.js release requires it. Run this command from your app directory.

```sh
npm install next-passkey-webauthn@^0.3.1
```

If you're installing from source, run `npm ci` and `npm pack` in the SDK checkout. Then install the tarball from your app directory, for example with `npm install /path/to/next-passkey-webauthn-0.3.1.tgz`.

Use this command to find the SQL migration in the installed package.

```sh
node -p "require.resolve('next-passkey-webauthn/migrations/001_passkeys.sql')"
```

Copy the file into your app's migration workflow and apply it to a development database first. The migration creates a separate `next_passkey` schema. Give only backend roles access. Your app role needs `USAGE` on the schema and the table permissions below.

| Table | Permissions |
| --- | --- |
| `accounts` | `SELECT`, `INSERT`, `UPDATE` |
| `credentials` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` |
| `attempts` | `SELECT`, `INSERT`, `UPDATE`, `DELETE` |

Reuse your existing PostgreSQL connection pool. If you need one, install `pg` and add `@types/pg` as a development dependency. Create one pool per app process, outside the route handler.

```ts
// lib/db.ts
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL.");

export const db = new Pool({ connectionString });
```

Use separate databases when apps or environments share a relying party ID (RP ID) but have different sets of account IDs.

## 2. Add the passkey route

For local development, add these values to `.env.local`.

```dotenv
PASSKEY_ORIGIN=http://localhost:3000
PASSKEY_RP_ID=localhost
```

In production, use the exact HTTPS origin users see in the browser, with no trailing slash. For `https://app.example.com`, use `app.example.com` as the RP ID to restrict credentials to that host. You can also use a registrable parent domain such as `example.com`. Keep the RP ID stable across deployments. The route and UI must share the same origin.

Create `app/api/passkeys/route.ts`. This example uses `@/` for imports within the app. The next sections show the three hooks imported here.

```ts
// app/api/passkeys/route.ts
import { createNextPasskeys } from "next-passkey-webauthn/next";
import { PostgresPasskeyStore } from "next-passkey-webauthn/postgres";
import { db } from "@/lib/db";
import { getSession, signIn } from "@/lib/passkey-auth";
import { rateLimit } from "@/lib/passkey-rate-limit";

export const runtime = "nodejs";

const { PASSKEY_ORIGIN: origin, PASSKEY_RP_ID: rpId } = process.env;
if (!origin || !rpId) throw new Error("Set PASSKEY_ORIGIN and PASSKEY_RP_ID.");

const passkeys = createNextPasskeys({
  origin,
  rpId,
  rpName: "My app",
  store: new PostgresPasskeyStore(db),
  getSession,
  signIn,
  ...(origin.startsWith("https://") ? { rateLimit } : {}),
});

export const POST = passkeys.POST;
```

The `auth` methods in the next two examples stand for your app's server-side authentication code. The reference app shows both hooks wired to a working local session. [Reference app code](https://github.com/shaoxuan0916/next-passkey-webauthn/tree/main/examples/next-basic/lib)

### `getSession` reads the current session

The SDK calls this hook when a user adds or manages passkeys. Verify the app session on the server and return `null` if it is missing, expired, or belongs to a deleted account.

```ts
// lib/passkey-auth.ts
import type { PasskeySession } from "next-passkey-webauthn/next";
import { auth } from "@/lib/auth";

export async function getSession(request: Request): Promise<PasskeySession | null> {
  const session = await auth.readActiveSession(request);
  if (!session) return null;

  return {
    id: session.id,
    account: { id: session.user.id, name: session.user.email },
    authenticatedAt: session.lastAuthenticatedAt.getTime(),
  };
}
```

Use an opaque session ID that stays the same across requests and changes after sign-in or reauthentication. The account ID is separate. It must be permanent and never reassigned. Use the email or username for `account.name`. You can also set `account.displayName`.

`authenticatedAt` is the server-verified time of the last full authentication, in epoch milliseconds. Keep it unchanged on ordinary session refreshes. Adding or revoking a passkey requires authentication within the last 10 minutes. Use your existing sign-in flow if the user needs to authenticate again.

### `signIn` starts a new session

The SDK calls this hook with the verified passkey's account ID. Look up that account and apply your usual sign-in rules, including any mandatory extra verification. Return `true` only after your app has started a fresh session. Return `false` if the account or the sign-in policy blocks access.

```ts
// Add to lib/passkey-auth.ts
export async function signIn(accountId: string, request: Request): Promise<boolean> {
  const account = await auth.findAccountById(accountId);
  if (!account || account.disabledAt) return false;

  const allowed = await auth.canCompleteSignIn({ account, request, method: "passkey" });
  if (!allowed) return false;

  await auth.startSession({ accountId: account.id, request });
  return true;
}
```

Reuse the same session creation code your app uses after a successful sign-in. It should create a new session ID, record the authentication time, and set the app's session cookie. In an App Router route handler, the session helper can set the cookie with `await cookies()` from `next/headers`. [Next.js `cookies` reference](https://nextjs.org/docs/app/api-reference/functions/cookies)

### `rateLimit` protects the HTTPS route

HTTPS requires this hook. The SDK calls it first with `"request"` before reading the body. It calls the hook again with the operation name after validating the request. Use a separate budget for each scope. Leave the body unread in the hook.

```ts
// lib/passkey-rate-limit.ts
import type { PasskeyOperation } from "next-passkey-webauthn/next";
import { consumeRateLimit, getTrustedClientKey } from "@/lib/rate-limits";

export async function rateLimit(request: Request, scope: PasskeyOperation | "request") {
  const clientKey = getTrustedClientKey(request);
  if (!clientKey) return false;

  return consumeRateLimit({
    key: `passkeys:${scope}:${clientKey}`,
    limit: scope === "request" ? 120 : 30,
    windowMs: 60_000,
  });
}
```

Replace the imports with your app's rate limiter. In this example, `getTrustedClientKey` reads a client key verified by your server or trusted proxy. `consumeRateLimit` checks and increments the request count atomically in a store shared by all app instances. It returns `false` when the budget is exhausted. Use limits that fit your app's traffic.

Also set request limits and body read deadlines at your reverse proxy or load balancer. The SDK limits request bodies to 64 KiB and returns HTTP 408 if it takes more than 10 seconds to read the body. If you're only testing on HTTP localhost, you can leave the `rateLimit` import and option out until you configure them for HTTPS.

### Revocation and account deletion

Revoking a passkey blocks future sign-ins with that credential. Existing sessions follow your app's session policy. Keep another sign-in or recovery method available to users who lose or revoke all their passkeys.

When you delete an account, invalidate its sessions and make sure both auth hooks reject it. Clean up the account's passkey records for each RP ID your app uses. Run these statements in a single transaction with a backend role that has `SELECT` and `DELETE` on both tables. Bind `$1` to the RP ID and `$2` to the account ID. PostgreSQL deletes the credentials when you delete the matching account row.

```sql
DELETE FROM next_passkey.attempts WHERE rp_id = $1 AND account_id = $2;
DELETE FROM next_passkey.accounts WHERE rp_id = $1 AND account_id = $2;
```

## 3. Add passkey sign-in and account settings

Use `PasskeySignIn` next to your existing sign-in form. This example enables autofill using both the `autofill` prop and `autoComplete="username webauthn"` on the form's email field. The passkey button also works on its own with `<PasskeySignIn />`.

```tsx
import { PasskeySignIn } from "next-passkey-webauthn/react";

export function SignInOptions() {
  return (
    <>
      <PasskeySignIn autofill />
      <form action="/api/sign-in" method="post">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username webauthn" required />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        <button type="submit">Sign in with password</button>
      </form>
    </>
  );
}
```

Use your existing form handler in place of `/api/sign-in`. Render `PasskeySettings` in the account area that already requires sign-in.

```tsx
import { PasskeySettings } from "next-passkey-webauthn/react";

export function AccountPasskeys() {
  return <PasskeySettings />;
}
```

Both components use `/api/passkeys` by default. If you put the route elsewhere, pass the matching `endpoint` to both components.

### Use your own UI

Create a browser client once and reuse it in your event handlers. This example signs in and reloads the page so it reflects the new session. Have the UI await the handler and display errors to the user.

```ts
import { createPasskeyClient, PasskeyRequestError } from "next-passkey-webauthn/browser";

const passkeys = createPasskeyClient("/api/passkeys");

export async function signInWithPasskey(): Promise<string | undefined> {
  try {
    await passkeys.signIn();
    window.location.reload();
  } catch (error) {
    return error instanceof PasskeyRequestError
      ? error.message
      : "The passkey prompt could not be completed. Try again or use your usual sign-in method.";
  }
}
```

Use these calls for the rest of your UI. `id` comes from `list()`. After a change, call `list()` again to refresh the visible list.

| Action | Example |
| --- | --- |
| Add a passkey from an active session | `await passkeys.enroll()` |
| List the signed-in user's passkeys | `const rows = await passkeys.list()` |
| Rename a passkey | `await passkeys.rename(id, "Work laptop")` |
| Revoke a passkey after the user confirms | `await passkeys.revoke(id)` |
| Cancel the current passkey prompt | `passkeys.cancel()` |

## 4. Try the full flow

1. Sign in with your existing method. Open account settings, add a passkey, and check that it appears in the list.
2. Sign out. Select **Sign in with a passkey** without entering a username. Check that the app signs you in to the right account.
3. Rename the passkey. Sign out and sign in to a second test account. Confirm that it cannot list, rename, or revoke the first account's passkey.
4. Sign back in to the first account and revoke the passkey. Sign out and confirm that the passkey no longer works and your original sign-in method still does.

The reference app has an automated test with Chromium and PostgreSQL that covers this flow. [Run the reference app and its tests](https://github.com/shaoxuan0916/next-passkey-webauthn/tree/main/examples/next-basic#smoke-test)
