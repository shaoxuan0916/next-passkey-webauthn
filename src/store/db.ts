import type { ChallengeRecord, ChallengeStore, Flow } from "../types/index";

/**
 * Generic database client interface for challenge storage
 */
export interface DatabaseClient {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<void>;
}

/**
 * Database-based challenge store
 * Works with any SQL database via generic interface
 */
export class DbStore implements ChallengeStore {
  constructor(
    private readonly db: DatabaseClient,
    /** Table name for challenges (default: "passkey_challenges") */
    private readonly tableName = "passkey_challenges"
  ) {}

  async set(record: ChallengeRecord): Promise<void> {
    const sql = `
			INSERT INTO ${this.tableName} (id, user_id, flow, challenge, expires_at)
			VALUES (?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				challenge = excluded.challenge,
				expires_at = excluded.expires_at
		`;

    const expiresAt = new Date(record.expiresAt).toISOString();

    await this.db.execute(sql, [
      record.id,
      record.userId,
      record.flow,
      record.challenge,
      expiresAt,
    ]);
  }

  async get(userId: string, flow: Flow): Promise<ChallengeRecord | null> {
    // First cleanup expired challenges
    await this.cleanupExpired();

    const id = this.getChallengeId(userId, flow);
    const sql = `
			SELECT id, user_id, flow, challenge, expires_at
			FROM ${this.tableName}
			WHERE id = ? AND expires_at > ?
		`;

    const now = new Date().toISOString();
    const rows = await this.db.query<{
      id: string;
      user_id: string;
      flow: Flow;
      challenge: string;
      expires_at: string;
    }>(sql, [id, now]);

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      flow: row.flow as Flow,
      challenge: row.challenge,
      expiresAt: new Date(row.expires_at).getTime(),
    };
  }

  async delete(userId: string, flow: Flow): Promise<void> {
    const id = this.getChallengeId(userId, flow);
    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    await this.db.execute(sql, [id]);
  }

  /**
   * Clean up expired challenges (called automatically in get)
   */
  async cleanupExpired(): Promise<void> {
    const sql = `DELETE FROM ${this.tableName} WHERE expires_at <= ?`;
    const now = new Date().toISOString();
    await this.db.execute(sql, [now]);
  }

  /**
   * Initialize the challenges table
   * Call this during setup to create the table
   */
  async initializeTable(): Promise<void> {
    const sql = `
			CREATE TABLE IF NOT EXISTS ${this.tableName} (
				id TEXT PRIMARY KEY,
				user_id TEXT NOT NULL,
				flow TEXT NOT NULL,
				challenge TEXT NOT NULL,
				expires_at TIMESTAMP NOT NULL
			)
		`;
    await this.db.execute(sql);

    // Create index for cleanup queries
    const indexSql = `
			CREATE INDEX IF NOT EXISTS idx_${this.tableName}_expires_at
			ON ${this.tableName} (expires_at)
		`;
    await this.db.execute(indexSql);
  }

  private getChallengeId(userId: string, flow: Flow): string {
    return `${userId}:${flow}`;
  }
}
