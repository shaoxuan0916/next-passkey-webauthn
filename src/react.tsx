"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { browserSupportsWebAuthnAutofill, createPasskeyClient, PasskeyRequestError } from "./browser";
import type { PasskeySummary } from "./types";

function errorMessage(error: unknown) {
  if (error instanceof PasskeyRequestError) return error.message;
  if (error instanceof Error && (error.name === "NotAllowedError" || error.name === "AbortError" ||
      error.name === "WebAuthnError")) {
    return "The passkey prompt could not be completed. Try again or use your existing sign-in method.";
  }
  return "Something went wrong with passkeys. Try again.";
}

interface PasskeySignInProps {
  endpoint?: string;
  /** Enable alongside an input with autocomplete="username webauthn". */
  autofill?: boolean;
  onSignedIn?: () => void;
}

const reload = () => window.location.reload();

export function PasskeySignIn({ endpoint, autofill = false, onSignedIn = reload }: PasskeySignInProps) {
  const client = useMemo(() => createPasskeyClient(endpoint), [endpoint]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const explicitSignInStarted = useRef(false);

  useEffect(() => {
    if (!autofill) return;
    let active = true;
    void (async () => {
      if (!await browserSupportsWebAuthnAutofill() || !active || explicitSignInStarted.current) return;
      await client.signIn(true);
      if (active) onSignedIn();
    })().catch(() => { /* Explicit sign-in stays available if autofill is interrupted. */ });
    return () => { active = false; client.cancel(); };
  }, [autofill, client, onSignedIn]);

  async function signIn() {
    explicitSignInStarted.current = true;
    setError("");
    setPending(true);
    try {
      await client.signIn();
      onSignedIn();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return <>
    <button type="button" onClick={signIn} disabled={pending}>Sign in with a passkey</button>
    {error && <p role="alert">{error}</p>}
  </>;
}

export function PasskeySettings({ endpoint }: { endpoint?: string }) {
  const client = useMemo(() => createPasskeyClient(endpoint), [endpoint]);
  const [passkeys, setPasskeys] = useState<PasskeySummary[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const listVersion = useRef(0);

  useEffect(() => {
    const version = ++listVersion.current;
    setPasskeys(null);
    setPending(false);
    setError("");
    void client.list().then((rows) => { if (version === listVersion.current) setPasskeys(rows); })
      .catch((error) => { if (version === listVersion.current) setError(errorMessage(error)); });
    return () => { listVersion.current++; client.cancel(); };
  }, [client]);

  async function update(action: () => Promise<void>) {
    let version = listVersion.current;
    setPending(true);
    setError("");
    try {
      await action();
      if (version !== listVersion.current) return;
      version = ++listVersion.current;
      const rows = await client.list();
      if (version === listVersion.current) {
        setPasskeys(rows);
        setError("");
      }
    } catch (error) {
      if (version === listVersion.current) setError(errorMessage(error));
    } finally {
      if (version === listVersion.current) setPending(false);
    }
  }

  return <section aria-label="Passkeys" aria-busy={pending}>
    <h2>Passkeys</h2>
    <button type="button" disabled={pending} onClick={() => update(client.enroll)}>Add a passkey</button>
    {error && <p role="alert">{error}</p>}
    {passkeys?.length === 0 && <p>No passkeys registered.</p>}
    {!!passkeys?.length && <ul>
      {passkeys.map((passkey) => <li key={passkey.id}>
        <strong>{passkey.name}</strong>
        {passkey.lastUsedAt && <p>Last used <time dateTime={passkey.lastUsedAt}>{passkey.lastUsedAt.slice(0, 10)}</time></p>}
        <form onSubmit={(event) => {
          event.preventDefault();
          const name = new FormData(event.currentTarget).get("name");
          if (typeof name === "string") void update(() => client.rename(passkey.id, name));
        }}>
          <label>Passkey name <input name="name" defaultValue={passkey.name} required maxLength={80} /></label>
          <button type="submit" disabled={pending}>Rename</button>
          <button type="button" disabled={pending} onClick={() => {
            if (window.confirm(`Remove ${passkey.name}?`)) void update(() => client.revoke(passkey.id));
          }}>Revoke</button>
        </form>
      </li>)}
    </ul>}
  </section>;
}
