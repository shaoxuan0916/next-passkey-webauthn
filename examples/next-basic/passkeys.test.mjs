import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { after, before, test } from "node:test";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { Pool } from "pg";
import { createNextPasskeys } from "next-passkey-webauthn/next";
import { PostgresPasskeyStore } from "next-passkey-webauthn/postgres";

const require = createRequire(import.meta.url);
const databaseURL = process.env.PASSKEY_TEST_DATABASE_URL;
assert(databaseURL, "Set PASSKEY_TEST_DATABASE_URL to a fresh, disposable PostgreSQL database ending in _test.");
const pool = new Pool({ connectionString: databaseURL });
const port = process.env.PASSKEY_TEST_PORT ?? "43127";
const origin = `http://localhost:${port}`;
const password = randomBytes(24).toString("base64url");
const firstAccount = "one@example.test";
let app;
let browser;
let output = "";

before(async () => {
  const { rows: [db] } = await pool.query(
    "SELECT current_database() AS name, to_regnamespace('next_passkey') AS schema",
  );
  assert(db.name.endsWith("_test") && !db.schema, "The suite requires a fresh, disposable *_test database.");
  await pool.query(await readFile(require.resolve("next-passkey-webauthn/migrations/001_passkeys.sql"), "utf8"));

  app = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "--hostname", "localhost", "--port", port], {
    cwd: fileURLToPath(new URL(".", import.meta.url)),
    env: {
      ...process.env, APP_ORIGIN: origin, DATABASE_URL: databaseURL, NEXT_TELEMETRY_DISABLED: "1",
      DEMO_SESSION_SECRET: randomBytes(32).toString("base64url"), DEMO_PASSWORD: password,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  app.stdout.on("data", (chunk) => { output += chunk; });
  app.stderr.on("data", (chunk) => { output += chunk; });
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline && app.exitCode === null) {
    const response = await fetch(origin, { signal: AbortSignal.timeout(5_000) }).catch(() => null);
    if (response?.ok) return;
    await setTimeout(250);
  }
  throw new Error(`Reference app did not start.\n${output}`);
}, { timeout: 55_000 });

after(async () => {
  await browser?.close();
  app?.kill();
  await pool.end();
});

test("PostgreSQL isolates and atomically consumes expiring attempts", async () => {
  const store = new PostgresPasskeyStore(pool);
  const rp = "store-test.example.test";
  const accountId = "store-test";
  const handles = await Promise.all([store.getOrCreateUserHandle(rp, accountId), store.getOrCreateUserHandle(rp, accountId)]);
  assert.equal(handles[0], handles[1]);

  const claim = { id: randomUUID(), kind: "enroll", binding: "browser", accountId };
  const payload = { challenge: "challenge", userHandle: handles[0] };
  const second = { ...claim, id: randomUUID() };
  await Promise.all([store.saveAttempt(rp, { ...claim, ...payload }), store.saveAttempt(rp, { ...second, ...payload })]);
  assert.equal(await store.consumeAttempt("wrong.example.test", claim), null);
  assert.equal(await store.consumeAttempt(rp, { ...claim, binding: "wrong-browser" }), null);
  assert.equal(await store.consumeAttempt(rp, { ...claim, accountId: "wrong-account" }), null);
  const results = await Promise.all([store.consumeAttempt(rp, claim), store.consumeAttempt(rp, claim)]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.deepEqual(results.find(Boolean), payload);
  assert.deepEqual(await store.consumeAttempt(rp, second), payload);

  await store.saveAttempt(rp, { ...claim, ...payload });
  await pool.query("UPDATE next_passkey.attempts SET expires_at = now() WHERE id = $1", [claim.id]);
  assert.equal(await store.consumeAttempt(rp, claim), null);
});

test("Account cleanup removes credentials and enrollment attempts", async () => {
  const store = new PostgresPasskeyStore(pool);
  const scope = ["cleanup.example.test", "cleanup-account"];
  const [rpId, accountId] = scope;
  const userHandle = await store.getOrCreateUserHandle(rpId, accountId);
  const id = randomUUID();
  const credential = { id, accountId, userHandle, publicKey: randomBytes(32), counter: 0, backupEligible: false, backedUp: false };
  assert.equal(await store.addCredential(rpId, credential, "Test passkey"), true);
  const attempt = { id: randomUUID(), kind: "enroll", binding: "browser", accountId };
  await store.saveAttempt(rpId, { ...attempt, challenge: "challenge", userHandle });

  await pool.query("DELETE FROM next_passkey.attempts WHERE rp_id = $1 AND account_id = $2", scope);
  await pool.query("DELETE FROM next_passkey.accounts WHERE rp_id = $1 AND account_id = $2", scope);
  assert.equal(await store.findCredential(rpId, id), null);
  assert.equal(await store.consumeAttempt(rpId, attempt), null);
});

test("App Router handlers require fresh authentication for enrollment and revocation", async () => {
  const options = {
    origin, rpId: "localhost", rpName: "Test", store: new PostgresPasskeyStore(pool),
    getSession: async () => ({
      id: "test-session", account: { id: "stale-session-test", name: "Test" },
      authenticatedAt: Date.now() - 11 * 60_000,
    }),
    signIn: async () => { assert.fail("The session issuer should not run in this test."); },
  };
  const { POST } = createNextPasskeys(options);
  function request(operation, data = {}) {
    return new Request(`${origin}/api/passkeys`, {
      method: "POST", headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ operation, ...data }),
    });
  }
  assert.equal((await POST(request("list"))).status, 200);
  for (const response of [await POST(request("begin-enrollment")), await POST(request("revoke", { id: "test" }))]) {
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "RECENT_SIGN_IN_REQUIRED" });
  }
});

test("HTTPS validates RP IDs and applies both request budgets", async () => {
  const origin = "https://login.example.co.uk";
  const options = {
    origin, rpId: "example.co.uk", rpName: "Test", store: new PostgresPasskeyStore(pool),
    getSession: async () => assert.fail("Rejected requests should not read a session."),
    signIn: async () => assert.fail("Rejected requests should not create a session."),
  };
  assert.throws(() => createNextPasskeys(options), /require a rateLimit hook/);
  for (const [invalidOrigin, rpId] of [[origin, "co.uk"], ["https://login.tenant.github.io", "github.io"]]) {
    assert.throws(() => createNextPasskeys({ ...options, origin: invalidOrigin, rpId, rateLimit: () => true }),
      /registrable parent domain/);
  }
  assert.doesNotThrow(() => createNextPasskeys({ ...options, origin: "https://login.tenant.github.io",
    rpId: "tenant.github.io", rateLimit: () => true }));

  const scopes = [];
  let allowRequest = false;
  const { POST } = createNextPasskeys({ ...options, rateLimit: (_request, scope) => {
    scopes.push(scope);
    return scope === "request" && allowRequest;
  } });
  function request() {
    return new Request(`${origin}/api/passkeys`, {
      method: "POST", headers: { origin, "content-type": "application/json" }, body: '{"operation":"list"}',
    });
  }
  const unread = request();
  assert.equal((await POST(unread)).status, 429);
  assert.equal(unread.bodyUsed, false);
  assert.deepEqual(scopes.splice(0), ["request"]);

  allowRequest = true;
  assert.equal((await POST(request())).status, 429);
  assert.deepEqual(scopes, ["request", "list"]);
});

test("The request body deadline cancels an incomplete read", { timeout: 20_000 }, async () => {
  const { POST } = createNextPasskeys({
    origin, rpId: "localhost", rpName: "Test", store: new PostgresPasskeyStore(pool),
    getSession: async () => assert.fail("An incomplete request should not read a session."),
    signIn: async () => assert.fail("An incomplete request should not create a session."),
  });
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('{"operation":"list"}')); },
    cancel() { cancelled = true; },
  });
  const response = await POST(new Request(`${origin}/api/passkeys`, {
    method: "POST", headers: { origin, "content-type": "application/json" }, body, duplex: "half",
  }));
  assert.equal(response.status, 408);
  assert.deepEqual(await response.json(), { error: "REQUEST_TIMEOUT" });
  assert.equal(cancelled, true);
});

test("Next.js enrolls, signs in, renames and revokes a browser credential", { timeout: 45_000 }, async () => {
  const channel = process.env.PASSKEY_TEST_BROWSER;
  browser = await chromium.launch(channel ? { channel } : {});
  const context = await browser.newContext();
  const page = await context.newPage();
  const devtools = await context.newCDPSession(page);
  await devtools.send("WebAuthn.enable");
  await devtools.send("WebAuthn.addVirtualAuthenticator", { options: {
    protocol: "ctap2", transport: "internal", hasResidentKey: true,
    hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true,
  } });
  // Exercise the explicit button even in browsers with conditional mediation.
  await page.addInitScript(() => {
    PublicKeyCredential.isConditionalMediationAvailable = async () => false;
  });

  function post(data, requestOrigin = origin) {
    return context.request.post(`${origin}/api/passkeys`, { headers: { origin: requestOrigin }, data });
  }

  async function fallback(email) {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in with password" }).click();
    await page.getByText(`Signed in as ${email}`).waitFor();
  }

  async function signOut() {
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("button", { name: "Sign in with a passkey" }).waitFor();
  }

  await page.goto(origin);
  await page.getByLabel("Email").fill(firstAccount);
  await page.getByLabel("Password").fill("incorrect-demo-password");
  await page.getByRole("button", { name: "Sign in with password" }).click();
  await page.getByRole("alert").filter({ hasText: "didn’t match" }).waitFor();
  assert.equal((await post({ operation: "list" })).status(), 401);
  assert.equal((await post({ operation: "begin-sign-in" }, "https://other.example.test")).status(), 403);
  assert.equal((await post({ operation: "list", userId: "demo-one" })).status(), 400);

  let receiveInitialList;
  let releaseInitialLists;
  const initialList = new Promise((resolve) => { receiveInitialList = resolve; });
  const release = new Promise((resolve) => { releaseInitialLists = resolve; });
  const delayedLists = [];
  let enrollmentStarted = false;
  await page.route("**/api/passkeys", async (route) => {
    const operation = route.request().postDataJSON().operation;
    if (operation === "begin-enrollment") enrollmentStarted = true;
    if (enrollmentStarted || operation !== "list") return route.continue();
    delayedLists.push(route.request().response().then((response) => response?.finished()));
    const response = await route.fetch();
    const snapshot = await response.json();
    receiveInitialList(snapshot);
    await release;
    await route.fulfill({ status: response.status(), json: snapshot });
  });
  try {
    await fallback(firstAccount);
    assert.deepEqual(await initialList, { passkeys: [] });
    await page.getByRole("button", { name: "Add a passkey" }).click();
    await page.getByLabel("Passkey name").waitFor();

    releaseInitialLists();
    await Promise.all(delayedLists);
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.getByLabel("Passkey name").count(), 1);
  } finally {
    releaseInitialLists();
    await page.unrouteAll({ behavior: "wait" });
  }
  const list = await (await post({ operation: "list" })).json();
  assert.equal(list.passkeys.length, 1);
  const [{ id }] = list.passkeys;
  assert.deepEqual(Object.keys(list.passkeys[0]).sort(), ["backedUp", "createdAt", "id", "lastUsedAt", "name"]);
  await page.getByLabel("Passkey name").fill("Renamed test passkey");
  await page.getByRole("button", { name: "Rename" }).click();
  await page.getByText("Renamed test passkey", { exact: true }).waitFor();

  await signOut();
  await fallback("two@example.test");
  assert.deepEqual(await (await post({ operation: "list" })).json(), { passkeys: [] });
  assert.equal((await post({ operation: "rename", id, name: "Wrong owner" })).status(), 404);
  assert.equal((await post({ operation: "revoke", id })).status(), 404);
  await signOut();

  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await page.getByText(`Signed in as ${firstAccount}`).waitFor();
  await page.getByText("Last used").waitFor();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Revoke" }).click();
  await page.getByText("No passkeys registered.").waitFor();

  await signOut();
  await page.getByRole("button", { name: "Sign in with a passkey" }).click();
  await page.getByRole("alert").filter({ hasText: "could not be verified" }).waitFor();
  await fallback(firstAccount);
  await page.getByText("No passkeys registered.").waitFor();
  await context.close();
});
