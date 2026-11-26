import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
  type WebAuthnCredential,
} from "@simplewebauthn/server";
import { parse } from "tldts";
import type { PasskeyAccount, PasskeySummary } from "./types";

export type { PasskeyAccount, PasskeySummary } from "./types";

export interface PasskeyAttempt {
  id: string;
  kind: "enroll" | "sign-in";
  binding: string;
  challenge: string;
  accountId: string | null;
  userHandle: string | null;
}

export interface PasskeyCredential extends WebAuthnCredential {
  accountId: string;
  userHandle: string;
  backupEligible: boolean;
  backedUp: boolean;
}

export interface PasskeyStore {
  getOrCreateUserHandle(rpId: string, accountId: string): Promise<string>;
  saveAttempt(rpId: string, attempt: PasskeyAttempt): Promise<void>;
  /** Atomically consume an unexpired attempt matching every supplied field. */
  consumeAttempt(
    rpId: string,
    attempt: Omit<PasskeyAttempt, "challenge" | "userHandle">,
  ): Promise<Pick<PasskeyAttempt, "challenge" | "userHandle"> | null>;
  addCredential(rpId: string, credential: PasskeyCredential, name: string): Promise<boolean>;
  findCredential(rpId: string, id: string): Promise<PasskeyCredential | null>;
  /** Update only a still-active credential with the same key and a valid counter transition. */
  recordAuthentication(
    rpId: string,
    credential: PasskeyCredential,
    counter: number,
    backedUp: boolean,
  ): Promise<boolean>;
  list(rpId: string, accountId: string): Promise<PasskeySummary[]>;
  rename(rpId: string, accountId: string, id: string, name: string): Promise<boolean>;
  revoke(rpId: string, accountId: string, id: string): Promise<boolean>;
}

export const attemptLifetimeSeconds = 300;

export interface PasskeyServiceOptions {
  rpId: string;
  rpName: string;
  origin: string;
  store: PasskeyStore;
}

function isSameOriginCeremony(clientDataJSON: string): boolean {
  const data: unknown = JSON.parse(Buffer.from(clientDataJSON, "base64url").toString("utf8"));
  return typeof data === "object" && data !== null &&
    (!("crossOrigin" in data) || data.crossOrigin === false);
}

export function createPasskeyService({ rpId, rpName, origin, store }: PasskeyServiceOptions) {
  const url = new URL(origin);
  const local = url.hostname === "localhost" && url.protocol === "http:";
  const rp = parse(rpId, { allowPrivateDomains: true, extractHostname: false });
  const matchesRp = url.hostname === rpId || (rp.domain !== null && url.hostname.endsWith(`.${rpId}`));
  if (url.origin !== origin || (!local && url.protocol !== "https:") || !rp.hostname || rp.isIp || !matchesRp ||
      (!local && !rpId.includes(".") && rpId !== "localhost") || !rpName.trim()) {
    throw new Error("Passkeys require an exact HTTPS origin and an RP ID matching its host or a registrable parent domain (HTTP localhost is allowed).");
  }

  return {
    async beginEnrollment(account: PasskeyAccount, id: string, binding: string) {
      const userHandle = await store.getOrCreateUserHandle(rpId, account.id);
      const existing = await store.list(rpId, account.id);
      const options = await generateRegistrationOptions({
        rpID: rpId,
        rpName,
        userID: new Uint8Array(Buffer.from(userHandle, "base64url")),
        userName: account.name,
        userDisplayName: account.displayName ?? account.name,
        timeout: attemptLifetimeSeconds * 1000,
        attestationType: "none",
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
        excludeCredentials: existing.map(({ id }) => ({ id })),
      });
      await store.saveAttempt(rpId, {
        id, binding, kind: "enroll", challenge: options.challenge, accountId: account.id, userHandle,
      });
      return options;
    },

    async finishEnrollment(accountId: string, id: string, binding: string, response: RegistrationResponseJSON) {
      const attempt = await store.consumeAttempt(rpId, { id, binding, kind: "enroll", accountId });
      if (!attempt?.userHandle) return false;

      let verification;
      try {
        if (!isSameOriginCeremony(response.response.clientDataJSON)) return false;
        verification = await verifyRegistrationResponse({
          response, expectedChallenge: attempt.challenge, expectedOrigin: origin, expectedRPID: rpId,
          requireUserVerification: true,
        });
      } catch {
        return false;
      }
      if (!verification.verified || !verification.registrationInfo) return false;

      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
      return store.addCredential(rpId, {
        ...credential,
        accountId,
        userHandle: attempt.userHandle,
        backupEligible: credentialDeviceType === "multiDevice",
        backedUp: credentialBackedUp,
      }, "Passkey");
    },

    async beginSignIn(id: string, binding: string) {
      const options = await generateAuthenticationOptions({
        rpID: rpId,
        timeout: attemptLifetimeSeconds * 1000,
        userVerification: "required",
      });
      await store.saveAttempt(rpId, {
        id, binding, kind: "sign-in", challenge: options.challenge, accountId: null, userHandle: null,
      });
      return options;
    },

    async finishSignIn(id: string, binding: string, response: AuthenticationResponseJSON) {
      const attempt = await store.consumeAttempt(rpId, { id, binding, kind: "sign-in", accountId: null });
      if (!attempt) return null;

      const credential = await store.findCredential(rpId, response.id);
      if (!credential || response.response.userHandle !== credential.userHandle) return null;

      let verification;
      try {
        if (!isSameOriginCeremony(response.response.clientDataJSON)) return null;
        verification = await verifyAuthenticationResponse({
          response, expectedChallenge: attempt.challenge, expectedOrigin: origin, expectedRPID: rpId,
          credential, requireUserVerification: true,
        });
      } catch {
        return null;
      }
      if (!verification.verified) return null;

      const { newCounter, credentialDeviceType, credentialBackedUp } = verification.authenticationInfo;
      if ((credentialDeviceType === "multiDevice") !== credential.backupEligible) return null;
      const recorded = await store.recordAuthentication(rpId, credential, newCounter, credentialBackedUp);
      return recorded ? credential.accountId : null;
    },

    list: (accountId: string) => store.list(rpId, accountId),
    rename: (accountId: string, id: string, name: string) => store.rename(rpId, accountId, id, name),
    revoke: (accountId: string, id: string) => store.revoke(rpId, accountId, id),
  };
}
