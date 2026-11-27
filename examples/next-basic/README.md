# Next.js and PostgreSQL reference app

This example exercises the SDK with a local PostgreSQL database, individual guest accounts, and a signed demo session cookie. Two password-based accounts are available for testing the fallback flow. Use your app's own authentication and recovery when integrating the SDK. [Quickstart](../../docs/quickstart.md)

## Run locally

Use Node.js 20.9 or later and a running PostgreSQL instance. From the repository root, run `npm ci && npm run build`. Then run `npm ci` from `examples/next-basic`.

From `examples/next-basic`, set `DATABASE_URL` to an empty local database and generate the demo credentials. The app defaults to `http://localhost:3000`. If you start it on another port, set `APP_ORIGIN` to the matching `http://localhost:<port>` URL.

```sh
export DATABASE_URL='<local PostgreSQL connection URL>'
export DEMO_SESSION_SECRET="$(openssl rand -hex 32)"
export DEMO_PASSWORD="$(openssl rand -hex 16)"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../../migrations/001_passkeys.sql
npm run dev
```

Open `http://localhost:3000` and select **Start demo**. Add a passkey, sign out, then use **Sign in with a passkey** to return to the same guest account. You can rename or revoke the key in settings.

To try password sign-in or username autofill, open **How it works** and select **Use a local test account**. Sign in as `one@example.test` or `two@example.test` using `DEMO_PASSWORD`. These accounts are separate from guest accounts.

## Deploy on Vercel

Set the project's Root Directory to `examples/next-basic` and enable **Include source files outside of the Root Directory in the Build Step**. The example's Vercel config builds the SDK from the repository root before installing the app.

Connect a dedicated PostgreSQL database and set `DATABASE_URL` to its pooled URL. Apply the schema and the demo's rate limit table using the database owner's connection string.

```sh
psql "$DIRECT_DATABASE_URL" -v ON_ERROR_STOP=1 -f ../../migrations/001_passkeys.sql
psql "$DIRECT_DATABASE_URL" -v ON_ERROR_STOP=1 -f demo-rate-limits.sql
```

Set `DEMO_SESSION_SECRET` to a stable random value of at least 32 characters. In Production, set `APP_ORIGIN` to the permanent HTTPS URL with no trailing slash. Preview deployments can use their own Vercel deployment hostname via the system-provided `VERCEL_URL`. Passkeys are scoped to the hostname where they were enrolled. HTTPS deployments use guest accounts and PostgreSQL-backed rate limiting.

## Smoke test

After installing and building as above, install Chromium with `npx playwright install chromium` or use an installed Google Chrome by setting `PASSKEY_TEST_BROWSER=chrome`. Set `PASSKEY_TEST_DATABASE_URL` to a **fresh disposable PostgreSQL database** with a name ending in `_test`. The suite applies the migration, generates its own demo credentials, and starts Next.js with a virtual WebAuthn authenticator in the browser.

```sh
npm run test:e2e
```

Use a fresh test database for each run. Set `PASSKEY_TEST_PORT` if the default port `43127` is in use. Run `npm run typecheck` and `npm run build` to check the reference app's types and production build.
