"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPasskeyClient, PasskeyRequestError, type PasskeySummary } from "next-passkey-webauthn/browser";
import { isFresh, readPasskeyList, writePasskeyList, type PasskeyListSnapshot } from "./passkey-list-cache";

type Mutation = "add" | "rename" | "remove";
type Selection = { action: "rename" | "remove"; passkey: PasskeySummary };

const formatDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const successMessage = {
  add: "Passkey added. Sign out to try it.",
  rename: "Passkey renamed.",
  remove: "Passkey removed.",
};

function Loading({ children }: { children: string }) {
  return <span className="loading-label"><span className="spinner" aria-hidden="true" />{children}</span>;
}

export function PasskeySignOut({ cacheScope }: { cacheScope: string }) {
  return (
    <form action="/api/demo-session" method="post" onSubmit={() => writePasskeyList(cacheScope, null)}>
      <button className="text-action" name="operation" value="sign-out">Sign out</button>
    </form>
  );
}

export function PasskeyManager({ cacheScope }: { cacheScope: string }) {
  const client = useMemo(() => createPasskeyClient(`/api/passkeys?scope=${cacheScope}`), [cacheScope]);
  const [snapshot, setSnapshot] = useState<PasskeyListSnapshot | null>(null);
  const passkeys = snapshot?.rows;
  const listRequest = useRef<Promise<PasskeySummary[]> | null>(null);
  const [pending, setPending] = useState<Mutation | "list" | null>("list");
  const [listAttempt, setListAttempt] = useState(0);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [notice, setNotice] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const cached = listAttempt === 0 ? readPasskeyList(cacheScope) : null;
    if (cached) {
      setSnapshot(cached);
      setPending(null);
      return;
    }

    let active = true;
    listRequest.current ??= client.list().finally(() => { listRequest.current = null; });
    void listRequest.current.then((rows) => {
      if (!active) return;
      const next = { fetchedAt: Date.now(), rows };
      writePasskeyList(cacheScope, next);
      setSnapshot(next);
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof PasskeyRequestError && cause.code === "SIGN_IN_REQUIRED") {
        writePasskeyList(cacheScope, null);
        setSnapshot(null);
        setListError(cause.message);
      } else {
        setListError("Couldn’t load your passkeys. Try again.");
      }
    }).finally(() => {
      if (active) setPending(null);
    });
    return () => { active = false; };
  }, [cacheScope, client, listAttempt]);

  useEffect(() => () => client.cancel(), [client]);

  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === "visible" && !pending && !selection && !listError &&
          snapshot && !isFresh(snapshot)) {
        setPending("list");
        setListAttempt((attempt) => attempt + 1);
      }
    }
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [listError, pending, selection, snapshot]);

  useEffect(() => {
    if (selection && !dialog.current?.open) dialog.current?.showModal();
  }, [selection]);

  function reloadList() {
    setError("");
    setListError("");
    setPending("list");
    setListAttempt((attempt) => attempt + 1);
  }

  function updateRows(rows: PasskeySummary[]) {
    if (!snapshot) return;
    const next = { ...snapshot, rows };
    writePasskeyList(cacheScope, next);
    setSnapshot(next);
  }

  async function update(action: Mutation, operation: () => Promise<void>) {
    if (pending) return;
    setPending(action);
    setError("");
    setNotice("");
    try {
      await operation();
    } catch (cause) {
      writePasskeyList(cacheScope, null);
      if (snapshot) setSnapshot({ ...snapshot, fetchedAt: 0 });
      if (cause instanceof PasskeyRequestError && cause.code === "PASSKEY_NOT_FOUND") {
        dialog.current?.close();
        setNotice(cause.message);
        reloadList();
        addButton.current?.focus();
        return;
      }
      if (cause instanceof PasskeyRequestError && cause.code === "SIGN_IN_REQUIRED") {
        setSnapshot(null);
        setListError(cause.message);
        if (!selection) {
          setPending(null);
          return;
        }
      }
      setError(cause instanceof PasskeyRequestError ? cause.message : action === "add"
        ? "The passkey setup didn’t finish. Try again."
        : "Couldn’t update this passkey. Try again.");
      setPending(null);
      return;
    }

    setNotice(successMessage[action]);
    if (action === "add") {
      writePasskeyList(cacheScope, null);
      reloadList();
    } else {
      dialog.current?.close();
      setPending(null);
      if (action === "remove") addButton.current?.focus();
    }
  }

  function edit(action: Selection["action"], passkey: PasskeySummary) {
    if (pending || listError) return;
    setError("");
    setSelection({ action, passkey });
  }

  function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection || !passkeys || pending || listError) return;
    const { passkey, action } = selection;
    if (action === "remove") {
      void update(action, async () => {
        await client.revoke(passkey.id);
        updateRows(passkeys.filter((row) => row.id !== passkey.id));
      });
    } else {
      const name = new FormData(event.currentTarget).get("name");
      if (typeof name !== "string" || !name.trim()) {
        setError("Enter a name for this passkey.");
        return;
      }
      void update(action, async () => {
        const trimmed = name.trim();
        await client.rename(passkey.id, trimmed);
        updateRows(passkeys.map((row) => row.id === passkey.id ? { ...row, name: trimmed } : row));
      });
    }
  }

  const canAdd = !!passkeys && !pending && !listError;
  const removing = selection?.action === "remove";
  const lastPasskey = passkeys?.length === 1;

  return (
    <section className="settings" aria-labelledby="passkeys-title">
      <div className="settings-heading">
        <h2 id="passkeys-title">Passkeys</h2>
        <button className="primary" type="button" ref={addButton} aria-disabled={!canAdd}
          onClick={() => { if (canAdd) void update("add", client.enroll); }}>
          {pending === "add" ? <Loading>Adding passkey…</Loading> : "Add a passkey"}
        </button>
      </div>

      <div className="settings-feedback" role="status">
        {pending === "list" && <Loading>Loading passkeys…</Loading>}
        {pending === "add" && <p>Follow the prompt on your device.</p>}
        {!pending && notice && <p className="success">{notice}</p>}
      </div>
      {error && !selection && <p role="alert">{error}</p>}
      {listError && (
        <>
          <p role="alert">{listError}</p>
          <button className="text-action" type="button" onClick={reloadList}>Try again</button>
        </>
      )}

      {passkeys?.length === 0 && pending !== "list" &&
        <p className="settings-empty">No passkeys yet. Add one to sign in without a password.</p>}
      {!!passkeys?.length && (
        <ul className="passkey-list">
          {passkeys.map((passkey) => {
            const date = passkey.lastUsedAt ?? passkey.createdAt;
            return (
              <li className="passkey-row" key={passkey.id}>
                <div className="passkey-info">
                  <div className="passkey-name">
                    <strong>{passkey.name}</strong>
                    <button className="rename-passkey" type="button" aria-label={`Rename ${passkey.name}`}
                      aria-disabled={!!pending || !!listError} onClick={() => edit("rename", passkey)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m15 5 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20Z" />
                      </svg>
                    </button>
                  </div>
                  <p>{passkey.lastUsedAt ? "Last used" : "Added"}{" "}
                    <time dateTime={date}>{formatDate.format(new Date(date))}</time></p>
                </div>
                <button className="remove-passkey" type="button" aria-label={`Remove ${passkey.name}`}
                  aria-disabled={!!pending || !!listError} onClick={() => edit("remove", passkey)}>
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <dialog className="passkey-dialog" aria-labelledby="passkey-dialog-title"
        aria-describedby={removing ? "passkey-remove-help" : undefined} ref={dialog}
        onCancel={(event) => { if (pending) event.preventDefault(); }}
        onClose={() => { setSelection(null); setError(""); }}>
        {selection && (
          <form onSubmit={confirm}>
            <h2 id="passkey-dialog-title">{removing ? "Remove passkey?" : "Rename passkey"}</h2>
            {removing ? (
              <p id="passkey-remove-help">
                <strong>{selection.passkey.name}</strong> will stop working for this demo.
                You can also remove it from your password manager or device.
                {lastPasskey && " To keep signing in with a passkey, add another before signing out."}
              </p>
            ) : (
              <label>Passkey name
                <input name="name" defaultValue={selection.passkey.name} required maxLength={80} readOnly={!!pending} />
              </label>
            )}
            {error && <p role="alert">{error}</p>}
            <div className="dialog-actions">
              <button type="button" disabled={!!pending} onClick={() => dialog.current?.close()}>Cancel</button>
              <button className={removing ? "danger-button" : "primary"} type="submit" disabled={!!pending}>
                {pending === "rename" && <Loading>Saving name…</Loading>}
                {pending === "remove" && <Loading>Removing…</Loading>}
                {!pending && (removing ? "Remove passkey" : "Save name")}
              </button>
            </div>
            <span className="visually-hidden" role="status">
              {pending === "rename" && "Saving passkey name."}
              {pending === "remove" && "Removing passkey."}
            </span>
          </form>
        )}
      </dialog>
    </section>
  );
}
