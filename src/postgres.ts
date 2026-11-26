import { randomBytes } from "node:crypto";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import {
  attemptLifetimeSeconds,
  type PasskeyAttempt,
  type PasskeyCredential,
  type PasskeyStore,
  type PasskeySummary,
} from "./server";

/** Compatible with a node-postgres Pool or Client. */
export interface PostgresPasskeyDatabase {
  query<Row extends Record<string, unknown>>(
    text: string,
    values: unknown[],
  ): Promise<{ rows: Row[] }>;
}

export class PostgresPasskeyStore implements PasskeyStore {
  constructor(private readonly db: PostgresPasskeyDatabase) {}

  async getOrCreateUserHandle(rpId: string, accountId: string) {
    const existing = await this.db.query<{ handle: string }>(
      `SELECT user_handle AS handle FROM next_passkey.accounts WHERE rp_id = $1 AND account_id = $2`,
      [rpId, accountId],
    );
    if (existing.rows[0]) return existing.rows[0].handle;

    const { rows } = await this.db.query<{ handle: string }>(
      `INSERT INTO next_passkey.accounts (rp_id, account_id, user_handle) VALUES ($1, $2, $3)
       ON CONFLICT (rp_id, account_id) DO UPDATE SET user_handle = next_passkey.accounts.user_handle
       RETURNING user_handle AS handle`,
      [rpId, accountId, randomBytes(32).toString("base64url")],
    );
    return rows[0].handle;
  }

  async saveAttempt(rpId: string, attempt: PasskeyAttempt) {
    await this.db.query(
      `WITH expired AS (
         SELECT id FROM next_passkey.attempts WHERE expires_at <= now()
         ORDER BY expires_at LIMIT 50 FOR UPDATE SKIP LOCKED
       ), cleanup AS (
         DELETE FROM next_passkey.attempts WHERE id IN (SELECT id FROM expired)
       )
       INSERT INTO next_passkey.attempts (id, rp_id, kind, binding, challenge, account_id, user_handle, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now() + $8 * interval '1 second')`,
      [attempt.id, rpId, attempt.kind, attempt.binding, attempt.challenge,
        attempt.accountId, attempt.userHandle, attemptLifetimeSeconds],
    );
  }

  async consumeAttempt(rpId: string, attempt: Omit<PasskeyAttempt, "challenge" | "userHandle">) {
    const { rows } = await this.db.query<Pick<PasskeyAttempt, "challenge" | "userHandle">>(
      `DELETE FROM next_passkey.attempts
       WHERE rp_id = $1 AND id = $2 AND kind = $3 AND binding = $4 AND expires_at > now()
       AND account_id IS NOT DISTINCT FROM $5
       RETURNING challenge, user_handle AS "userHandle"`,
      [rpId, attempt.id, attempt.kind, attempt.binding, attempt.accountId],
    );
    return rows[0] ?? null;
  }

  async addCredential(rpId: string, credential: PasskeyCredential, name: string) {
    const { rows } = await this.db.query(
      `INSERT INTO next_passkey.credentials
         (rp_id, id, account_id, public_key, counter, transports, backup_eligible, backed_up, name)
       SELECT rp_id, $2, account_id, $3, $4, $5, $6, $7, $8 FROM next_passkey.accounts
       WHERE rp_id = $1 AND account_id = $9 AND user_handle = $10
       ON CONFLICT (rp_id, id) DO NOTHING RETURNING id`,
      [rpId, credential.id, Buffer.from(credential.publicKey), credential.counter,
        credential.transports ?? [], credential.backupEligible, credential.backedUp,
        name, credential.accountId, credential.userHandle],
    );
    return rows.length === 1;
  }

  async findCredential(rpId: string, id: string): Promise<PasskeyCredential | null> {
    const { rows } = await this.db.query<{
      id: string;
      accountId: string;
      userHandle: string;
      publicKey: Buffer;
      counter: string;
      transports: AuthenticatorTransportFuture[];
      backupEligible: boolean;
      backedUp: boolean;
    }>(
      `SELECT c.id, c.account_id AS "accountId", a.user_handle AS "userHandle", c.public_key AS "publicKey",
              c.counter::text, c.transports, c.backup_eligible AS "backupEligible", c.backed_up AS "backedUp"
       FROM next_passkey.credentials c JOIN next_passkey.accounts a USING (rp_id, account_id)
       WHERE c.rp_id = $1 AND c.id = $2`,
      [rpId, id],
    );
    const row = rows[0];
    return row ? { ...row, publicKey: Buffer.from(row.publicKey), counter: Number(row.counter) } : null;
  }

  async recordAuthentication(rpId: string, credential: PasskeyCredential, counter: number, backedUp: boolean) {
    const { rows } = await this.db.query(
      `UPDATE next_passkey.credentials SET counter = $3, backed_up = $4, last_used_at = now()
       WHERE rp_id = $1 AND id = $2 AND account_id = $5 AND public_key = $6 AND backup_eligible = $7
       AND (counter < $3 OR (counter = 0 AND $3 = 0)) RETURNING id`,
      [rpId, credential.id, counter, backedUp, credential.accountId,
        Buffer.from(credential.publicKey), credential.backupEligible],
    );
    return rows.length === 1;
  }

  async list(rpId: string, accountId: string): Promise<PasskeySummary[]> {
    const { rows } = await this.db.query<{
      id: string;
      name: string;
      createdAt: Date;
      lastUsedAt: Date | null;
      backedUp: boolean;
    }>(
      `SELECT id, name, created_at AS "createdAt", last_used_at AS "lastUsedAt", backed_up AS "backedUp"
       FROM next_passkey.credentials WHERE rp_id = $1 AND account_id = $2 ORDER BY created_at DESC, id`,
      [rpId, accountId],
    );
    return rows.map((row) => ({
      ...row, createdAt: row.createdAt.toISOString(), lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    }));
  }

  async rename(rpId: string, accountId: string, id: string, name: string) {
    const { rows } = await this.db.query(
      `UPDATE next_passkey.credentials SET name = $4 WHERE rp_id = $1 AND account_id = $2 AND id = $3 RETURNING id`,
      [rpId, accountId, id, name],
    );
    return rows.length === 1;
  }

  async revoke(rpId: string, accountId: string, id: string) {
    const { rows } = await this.db.query(
      `DELETE FROM next_passkey.credentials WHERE rp_id = $1 AND account_id = $2 AND id = $3 RETURNING id`,
      [rpId, accountId, id],
    );
    return rows.length === 1;
  }
}
