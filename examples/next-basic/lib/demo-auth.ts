import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { PasskeySession } from "next-passkey-webauthn/next";

export const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
const cookieName = "passkey-example-session";
const lifetimeSeconds = 60 * 60;
export const demoAccounts = [
  { id: "demo-one", name: "one@example.test" },
  { id: "demo-two", name: "two@example.test" },
];

function demoSecret() {
  const secret = process.env.DEMO_SESSION_SECRET;
  if (new URL(origin).origin !== origin || !origin.startsWith("http://localhost:") || !secret || secret.length < 32) {
    throw new Error("This demo requires a localhost APP_ORIGIN and a DEMO_SESSION_SECRET of at least 32 characters.");
  }
  return secret;
}

function mac(data: string): Buffer {
  return createHmac("sha256", demoSecret()).update(data).digest();
}

export async function demoSession(): Promise<PasskeySession | null> {
  const value = (await cookies()).get(cookieName)?.value;
  if (!value) return null;
  const [accountId, time, id, signature] = value.split(".");
  if (!accountId || !id || !signature || !/^[\w-]{43}$/u.test(signature)) return null;
  if (!timingSafeEqual(mac(`${accountId}.${time}.${id}`), Buffer.from(signature, "base64url"))) return null;
  const account = demoAccounts.find((account) => account.id === accountId);
  const authenticatedAt = Number(time);
  const age = Date.now() - authenticatedAt;
  return account && age >= 0 && age <= lifetimeSeconds * 1000 ? { account, id, authenticatedAt } : null;
}

export async function startDemoSession(accountId: string): Promise<boolean> {
  if (!demoAccounts.some((account) => account.id === accountId)) return false;
  const data = `${accountId}.${Date.now()}.${randomUUID()}`;
  const token = `${data}.${mac(data).toString("base64url")}`;
  (await cookies()).set(cookieName, token, { httpOnly: true, sameSite: "strict", path: "/", maxAge: lifetimeSeconds });
  return true;
}

export async function demoPasswordSignIn(email: FormDataEntryValue | null, password: FormDataEntryValue | null) {
  const expected = process.env.DEMO_PASSWORD;
  if (!expected || expected.length < 16) throw new Error("Set DEMO_PASSWORD to at least 16 characters.");
  if (typeof password !== "string" || !timingSafeEqual(mac(expected), mac(password))) return false;
  const account = demoAccounts.find(({ name }) => name === email);
  return account ? startDemoSession(account.id) : false;
}

export async function endDemoSession() {
  (await cookies()).delete(cookieName);
}
