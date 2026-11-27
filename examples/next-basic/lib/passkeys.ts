import { createNextPasskeys } from "next-passkey-webauthn/next";
import { PostgresPasskeyStore } from "next-passkey-webauthn/postgres";
import { demoSession, origin, passkeyCacheScope, secure, startDemoSession } from "./demo-auth";
import { pool, rateLimit } from "./database";

export const passkeys = createNextPasskeys({
  origin,
  rpId: new URL(origin).hostname,
  rpName: "Passkey example",
  store: new PostgresPasskeyStore(pool),
  rateLimit: secure ? rateLimit : undefined,
  async getSession(request) {
    const session = await demoSession();
    const scope = new URL(request.url).searchParams.get("scope");
    if (session && scope !== null && scope !== passkeyCacheScope(session.id)) return null;
    return session;
  },
  signIn: (accountId) => startDemoSession(accountId, "passkey"),
  onError: console.error,
});
