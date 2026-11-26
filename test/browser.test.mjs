import assert from "node:assert/strict";
import test from "node:test";
import { createPasskeyClient, PasskeyRequestError } from "next-passkey-webauthn/browser";

test("passkey requests handle both non-JSON and JSON HTTP failures", async (t) => {
  globalThis.window = { location: { origin: "https://app.example.test" } };
  t.after(() => { delete globalThis.window; });

  const fetch = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: "RATE_LIMITED" }, { status: 429 }));
  fetch.mock.mockImplementationOnce(async () => new Response("<h1>Bad Gateway</h1>", {
    status: 502,
    headers: { "Content-Type": "text/html" },
  }));

  const client = createPasskeyClient();
  await assert.rejects(client.list(), (error) =>
    error instanceof PasskeyRequestError && error.code === "INTERNAL_ERROR");
  await assert.rejects(client.list(), (error) =>
    error instanceof PasskeyRequestError && error.code === "RATE_LIMITED");
});
