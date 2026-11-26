import { Pool } from "pg";
import { createNextPasskeys } from "next-passkey-webauthn/next";
import { PostgresPasskeyStore } from "next-passkey-webauthn/postgres";
import { demoSession, origin, startDemoSession } from "./demo-auth";

export const passkeys = createNextPasskeys({
  origin,
  rpId: "localhost",
  rpName: "Passkey example",
  store: new PostgresPasskeyStore(new Pool({ connectionString: process.env.DATABASE_URL })),
  getSession: demoSession,
  signIn: startDemoSession,
  onError: console.error,
});
