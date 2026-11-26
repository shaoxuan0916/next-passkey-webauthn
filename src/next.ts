import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { attemptLifetimeSeconds, createPasskeyService, type PasskeyServiceOptions } from "./server";
import type { PasskeyAccount } from "./types";

export interface PasskeySession {
  /** Stable for the current session and rotated on sign-in or reauthentication. Never use the user ID here. */
  id: string;
  account: PasskeyAccount;
  /** Server-verified primary authentication time in epoch milliseconds. */
  authenticatedAt: number;
}

export interface NextPasskeyOptions extends PasskeyServiceOptions {
  getSession(request: Request): Promise<PasskeySession | null>;
  /** Verify that this account may still sign in and establish a fresh application session. */
  signIn(accountId: string, request: Request): Promise<boolean>;
  /** Called with "request" before reading the body, then with the validated operation. Required over HTTPS. */
  rateLimit?(request: Request, scope: PasskeyOperation | "request"): boolean | Promise<boolean>;
  onError?(error: unknown): void;
}

const base64url = z.string().min(1).regex(/^[\w-]+$/u);
const credentialFields = {
  id: base64url.max(1366),
  rawId: base64url.max(1366),
  type: z.literal("public-key"),
  clientExtensionResults: z.object({}),
};
const finishFields = { attemptId: z.uuid() };
const command = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("begin-enrollment") }),
  z.strictObject({
    operation: z.literal("finish-enrollment"), ...finishFields,
    credential: z.object({ ...credentialFields, response: z.object({
      clientDataJSON: base64url,
      attestationObject: base64url,
      transports: z.array(z.enum(["ble", "cable", "hybrid", "internal", "nfc", "smart-card", "usb"])).max(16).optional(),
    }) }),
  }),
  z.strictObject({ operation: z.literal("begin-sign-in") }),
  z.strictObject({
    operation: z.literal("finish-sign-in"), ...finishFields,
    credential: z.object({ ...credentialFields, response: z.object({
      clientDataJSON: base64url,
      authenticatorData: base64url,
      signature: base64url,
      userHandle: base64url.max(86).optional(),
    }) }),
  }),
  z.strictObject({ operation: z.literal("list") }),
  z.strictObject({
    operation: z.literal("rename"), id: credentialFields.id,
    name: z.string().trim().min(1).max(80).refine((name) => !/[\u0000-\u001f\u007f]/u.test(name)),
  }),
  z.strictObject({ operation: z.literal("revoke"), id: credentialFields.id }),
]);

export type PasskeyOperation = z.infer<typeof command>["operation"];

const recentAuthenticationMs = 10 * 60 * 1000;
const maxRequestBytes = 64 * 1024;
const bodyReadTimeoutMs = 10_000;
const bodyReadTimedOut = Symbol("body read timed out");

async function readJSON(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json" ||
      !request.body || Number(request.headers.get("content-length")) > maxRequestBytes) return null;

  const reader = request.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    cancel();
  }, bodyReadTimeoutMs);
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let text = "";
    let size = 0;
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      size += chunk.value.byteLength;
      if (size > maxRequestBytes) {
        cancel();
        return null;
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return timedOut ? bodyReadTimedOut : JSON.parse(text + decoder.decode());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

function reply(body: object, status = 200, cookie?: string): Response {
  const headers = new Headers({ "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
  if (cookie) headers.set("Set-Cookie", cookie);
  return Response.json(body, { status, headers });
}

function binding(secret: string, origin: string, session: PasskeySession | null): string {
  return createHash("sha256")
    .update(JSON.stringify([secret, origin, session?.id, session?.account.id]))
    .digest("base64url");
}

function hasRecentAuthentication(session: PasskeySession): boolean {
  const age = Date.now() - session.authenticatedAt;
  return age >= 0 && age <= recentAuthenticationMs;
}

export function createNextPasskeys(options: NextPasskeyOptions) {
  const service = createPasskeyService(options);
  const { origin, getSession, signIn, rateLimit, onError } = options;
  const secure = origin.startsWith("https://");
  if (secure && !rateLimit) throw new Error("Passkey routes require a rateLimit hook over HTTPS.");
  const cookiePrefix = secure ? "__Host-next-passkey-" : "next-passkey-";

  function attemptCookie(id: string, secret: string, maxAge: number): string {
    return `${cookiePrefix}${id}=${secret}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
  }

  return {
    async POST(request: Request): Promise<Response> {
      if (request.headers.get("origin") !== origin) return reply({ error: "INVALID_ORIGIN" }, 403);
      try {
        if (rateLimit && !await rateLimit(request, "request")) return reply({ error: "RATE_LIMITED" }, 429);
        const body = await readJSON(request);
        if (body === bodyReadTimedOut) return reply({ error: "REQUEST_TIMEOUT" }, 408);
        const parsed = command.safeParse(body);
        if (!parsed.success) return reply({ error: "INVALID_REQUEST" }, 400);
        const data = parsed.data;
        if (rateLimit && !await rateLimit(request, data.operation)) return reply({ error: "RATE_LIMITED" }, 429);

        const isSignIn = data.operation === "begin-sign-in" || data.operation === "finish-sign-in";
        const session = isSignIn ? null : await getSession(request);
        if (!isSignIn && (!session?.id || !session.account.id)) {
          return reply({ error: "SIGN_IN_REQUIRED" }, 401);
        }
        if (session && (data.operation === "begin-enrollment" || data.operation === "finish-enrollment" ||
            data.operation === "revoke") && !hasRecentAuthentication(session)) {
          return reply({ error: "RECENT_SIGN_IN_REQUIRED" }, 403);
        }

        if (data.operation === "begin-enrollment" || data.operation === "begin-sign-in") {
          const attemptId = randomUUID();
          const secret = randomBytes(32).toString("base64url");
          const attemptBinding = binding(secret, origin, session);
          const optionsJSON = session
            ? await service.beginEnrollment(session.account, attemptId, attemptBinding)
            : await service.beginSignIn(attemptId, attemptBinding);
          return reply({ attemptId, optionsJSON }, 200, attemptCookie(attemptId, secret, attemptLifetimeSeconds));
        }

        if (data.operation === "finish-enrollment" || data.operation === "finish-sign-in") {
          const key = `${cookiePrefix}${data.attemptId}=`;
          const secret = request.headers.get("cookie")?.split(";")
            .map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(key))?.slice(key.length);
          if (!secret || !/^[\w-]{43}$/u.test(secret)) return reply({ error: "VERIFICATION_FAILED" }, 400);
          const clearCookie = attemptCookie(data.attemptId, "", 0);
          const attemptBinding = binding(secret, origin, session);
          if (data.credential.id !== data.credential.rawId) return reply({ error: "INVALID_REQUEST" }, 400, clearCookie);

          if (data.operation === "finish-enrollment") {
            const enrolled = session && await service.finishEnrollment(
              session.account.id, data.attemptId, attemptBinding, data.credential,
            );
            return enrolled ? reply({ ok: true }, 200, clearCookie)
              : reply({ error: "VERIFICATION_FAILED" }, 400, clearCookie);
          }

          const accountId = await service.finishSignIn(data.attemptId, attemptBinding, data.credential);
          return accountId && await signIn(accountId, request) ? reply({ ok: true }, 200, clearCookie)
            : reply({ error: "VERIFICATION_FAILED" }, 400, clearCookie);
        }

        if (!session) return reply({ error: "SIGN_IN_REQUIRED" }, 401);
        const { id: accountId } = session.account;
        if (data.operation === "list") return reply({ passkeys: await service.list(accountId) });
        const changed = data.operation === "rename" ? await service.rename(accountId, data.id, data.name)
          : await service.revoke(accountId, data.id);
        return changed ? reply({ ok: true }) : reply({ error: "PASSKEY_NOT_FOUND" }, 404);
      } catch (error) {
        onError?.(error);
        return reply({ error: "INTERNAL_ERROR" }, 500);
      }
    },
  };
}
