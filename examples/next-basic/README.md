# Next.js and PostgreSQL reference app

This example exercises the 0.3 SDK with a local PostgreSQL database, two test accounts, and a signed demo session cookie. Use your app's own authentication and recovery when integrating the SDK. [Quickstart](../../docs/quickstart.md)

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

Open `http://localhost:3000` and sign in as `one@example.test` or `two@example.test` using the value of `DEMO_PASSWORD`. Add a passkey, sign out, and use **Sign in with a passkey**. Rename and revoke it from settings, then verify that password sign-in still works.

## Smoke test

After installing and building as above, install Chromium with `npx playwright install chromium` or use an installed Google Chrome by setting `PASSKEY_TEST_BROWSER=chrome`. Set `PASSKEY_TEST_DATABASE_URL` to a **fresh disposable PostgreSQL database** with a name ending in `_test`. The suite applies the migration, generates its own demo credentials, and starts Next.js with a virtual WebAuthn authenticator in the browser.

```sh
npm run test:e2e
```

Use a fresh test database for each run. Set `PASSKEY_TEST_PORT` if the default port `43127` is in use. Run `npm run typecheck` and `npm run build` to check the reference app's types and production build.
