export interface PasskeyAccount {
  /** Stable application user ID that is never reassigned, including after account deletion. */
  id: string;
  name: string;
  displayName?: string;
}

export interface PasskeySummary {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  backedUp: boolean;
}
