import type { PasskeySummary } from "next-passkey-webauthn/browser";

const key = "next-passkey-demo:list:v1";
const maxAge = 60_000;

export type PasskeyListSnapshot = { fetchedAt: number; rows: PasskeySummary[] };

export function isFresh({ fetchedAt }: PasskeyListSnapshot) {
  const age = Date.now() - fetchedAt;
  return age >= 0 && age < maxAge;
}

function isSummary(value: unknown): value is PasskeySummary {
  if (!value || typeof value !== "object" || !("id" in value) || !("name" in value) ||
      !("createdAt" in value) || !("lastUsedAt" in value) || !("backedUp" in value)) return false;
  return typeof value.id === "string" && typeof value.name === "string" &&
    typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt)) &&
    (value.lastUsedAt === null || (typeof value.lastUsedAt === "string" && Number.isFinite(Date.parse(value.lastUsedAt)))) &&
    typeof value.backedUp === "boolean";
}

export function readPasskeyList(scope: string): PasskeyListSnapshot | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (value && typeof value === "object" && "scope" in value && value.scope === scope &&
        "fetchedAt" in value && typeof value.fetchedAt === "number" &&
        "rows" in value && Array.isArray(value.rows) && value.rows.every(isSummary)) {
      const snapshot = { fetchedAt: value.fetchedAt, rows: value.rows };
      if (isFresh(snapshot)) return snapshot;
    }
    sessionStorage.removeItem(key);
  } catch {
    // Storage can be unavailable in private browsing or contain an invalid entry.
  }
  return null;
}

export function writePasskeyList(scope: string, snapshot: PasskeyListSnapshot | null) {
  try {
    if (snapshot) sessionStorage.setItem(key, JSON.stringify({ scope, ...snapshot }));
    else sessionStorage.removeItem(key);
  } catch {
    // The in-memory list still works when browser storage is unavailable.
  }
}
