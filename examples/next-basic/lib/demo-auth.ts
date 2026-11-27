import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { PasskeySession } from "next-passkey-webauthn/next";

export const origin = process.env.APP_ORIGIN ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
const originURL = new URL(origin);
export const secure = originURL.protocol === "https:";
export const localDemo = !secure && originURL.protocol === "http:" && originURL.hostname === "localhost";
const cookieName = secure ? "__Host-passkey-example-session" : "passkey-example-session";
const lifetimeSeconds = 60 * 60;
export const demoAccounts = [
  { id: "demo-one", name: "one@example.test" },
  { id: "demo-two", name: "two@example.test" },
];

export function passkeyCacheScope(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("base64url");
}

function demoSecret() {
  const secret = process.env.DEMO_SESSION_SECRET;
  if (originURL.origin !== origin || (!secure && !localDemo) || !secret || secret.length < 32) {
    throw new Error("Set an exact HTTPS or localhost origin and a DEMO_SESSION_SECRET of at least 32 characters.");
  }
  return secret;
}

function mac(data: string): Buffer {
  return createHmac("sha256", demoSecret()).update(data).digest();
}

function findDemoAccount(id: string) {
  if (/^guest-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(id)) {
    return { id, name: `Demo ${id.slice(6, 14)}` };
  }
  return demoAccounts.find((account) => account.id === id);
}

export async function demoSession(): Promise<(PasskeySession & { usedPasskey: boolean }) | null> {
  const value = (await cookies()).get(cookieName)?.value;
  if (!value) return null;
  const separator = value.lastIndexOf(".");
  const data = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (separator < 0 || !/^[\w-]{43}$/u.test(signature)) return null;
  if (!timingSafeEqual(mac(data), Buffer.from(signature, "base64url"))) return null;
  const [accountId, time, id, method] = data.split(".");
  if (!accountId || !id) return null;
  const account = findDemoAccount(accountId);
  const authenticatedAt = Number(time);
  const age = Date.now() - authenticatedAt;
  return account && age >= 0 && age <= lifetimeSeconds * 1000 ? { account, id, authenticatedAt, usedPasskey: method === "passkey" } : null;
}

export async function startDemoSession(accountId: string, method: "passkey" | "demo"): Promise<boolean> {
  if (!findDemoAccount(accountId)) return false;
  const data = `${accountId}.${Date.now()}.${randomUUID()}.${method}`;
  const token = `${data}.${mac(data).toString("base64url")}`;
  (await cookies()).set(cookieName, token, { httpOnly: true, sameSite: "strict", secure, path: "/", maxAge: lifetimeSeconds });
  return true;
}

export async function demoPasswordSignIn(email: FormDataEntryValue | null, password: FormDataEntryValue | null) {
  const expected = process.env.DEMO_PASSWORD;
  if (!expected || expected.length < 16) throw new Error("Set DEMO_PASSWORD to at least 16 characters.");
  if (typeof password !== "string" || !timingSafeEqual(mac(expected), mac(password))) return false;
  const account = demoAccounts.find(({ name }) => name === email);
  return account ? startDemoSession(account.id, "demo") : false;
}

export async function endDemoSession() {
  (await cookies()).set(cookieName, "", { httpOnly: true, sameSite: "strict", secure, path: "/", maxAge: 0 });
}
