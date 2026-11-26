import {
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  startRegistration,
  WebAuthnAbortService,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import type { PasskeySummary } from "./types";

export { browserSupportsWebAuthnAutofill };
export type { PasskeySummary } from "./types";

const messages: Record<string, string> = {
  INVALID_ORIGIN: "Passkeys are unavailable on this origin.",
  SIGN_IN_REQUIRED: "Sign in to manage your passkeys.",
  RECENT_SIGN_IN_REQUIRED: "Sign in again before adding or removing a passkey.",
  VERIFICATION_FAILED: "The passkey could not be verified. Try again or use your existing sign-in method.",
  RATE_LIMITED: "Too many requests. Try again shortly.",
  REQUEST_TIMEOUT: "The passkey request timed out. Try again.",
  PASSKEY_NOT_FOUND: "This passkey no longer exists.",
};

export class PasskeyRequestError extends Error {
  constructor(readonly code: string) {
    super(Object.prototype.hasOwnProperty.call(messages, code) ? messages[code] : "The passkey request failed. Try again.");
    this.name = "PasskeyRequestError";
  }
}

let nativeCeremony: AbortSignal | undefined;

export function createPasskeyClient(endpoint = "/api/passkeys") {
  let current: AbortController | undefined;

  async function send<T>(operation: string, data = {}, signal?: AbortSignal): Promise<T> {
    const url = new URL(endpoint, window.location.origin);
    if (url.origin !== window.location.origin) throw new Error("The passkey endpoint must be same-origin.");
    const result = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({ operation, ...data }),
    });
    const body: unknown = await result.json();
    if (!result.ok) {
      const code = typeof body === "object" && body !== null && "error" in body &&
        typeof body.error === "string" ? body.error : "INTERNAL_ERROR";
      throw new PasskeyRequestError(code);
    }
    // The paired app route owns this JSON response contract.
    return body as T;
  }

  async function ceremony<Options, Credential>(
    begin: string,
    finish: string,
    prompt: (options: Options) => Promise<Credential>,
  ) {
    current?.abort();
    const controller = new AbortController();
    current = controller;
    const { signal } = controller;
    signal.addEventListener("abort", () => {
      if (nativeCeremony === signal) WebAuthnAbortService.cancelCeremony();
    }, { once: true });

    try {
      const { attemptId, optionsJSON } = await send<{ attemptId: string; optionsJSON: Options }>(begin, {}, signal);
      signal.throwIfAborted();
      nativeCeremony = signal;
      const credential = await prompt(optionsJSON);
      if (nativeCeremony === signal) nativeCeremony = undefined;
      signal.throwIfAborted();
      await send(finish, { attemptId, credential }, signal);
    } finally {
      if (nativeCeremony === signal) nativeCeremony = undefined;
      if (current === controller) current = undefined;
    }
  }

  return {
    enroll: () => ceremony("begin-enrollment", "finish-enrollment",
      (optionsJSON: PublicKeyCredentialCreationOptionsJSON) => startRegistration({ optionsJSON })),
    signIn: (useBrowserAutofill = false) => ceremony("begin-sign-in", "finish-sign-in",
      (optionsJSON: PublicKeyCredentialRequestOptionsJSON) => startAuthentication({ optionsJSON, useBrowserAutofill })),
    cancel: () => current?.abort(),
    list: async () => (await send<{ passkeys: PasskeySummary[] }>("list")).passkeys,
    async rename(id: string, name: string) { await send("rename", { id, name }); },
    async revoke(id: string) { await send("revoke", { id }); },
  };
}
