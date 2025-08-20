// src/store/redis.ts
var RedisStore = class {
  constructor(redis, defaultTTL = 300) {
    this.redis = redis;
    this.defaultTTL = defaultTTL;
  }
  async ensureConnection() {
    if (this.redis.isOpen === false) {
      throw new Error(
        "Redis client is not connected. Make sure to call redis.connect() before using RedisStore."
      );
    }
  }
  async set(record) {
    await this.ensureConnection();
    const key = this.getChallengeKey(record.userId, record.flow);
    const value = JSON.stringify(record);
    const ttlSeconds = Math.ceil((record.expiresAt - Date.now()) / 1e3);
    const finalTTL = Math.min(Math.max(ttlSeconds, 1), this.defaultTTL);
    try {
      await this.redis.set(key, value, { EX: finalTTL });
    } catch (error) {
      throw new Error(
        `Failed to store challenge in Redis: ${error instanceof Error ? error.message : String(error)}. Check your Redis connection and ensure the client is properly connected.`
      );
    }
  }
  async get(userId, flow) {
    await this.ensureConnection();
    const key = this.getChallengeKey(userId, flow);
    try {
      const value = await this.redis.get(key);
      if (!value) {
        return null;
      }
      const record = JSON.parse(value);
      if (Date.now() > record.expiresAt) {
        await this.redis.del(key);
        return null;
      }
      return record;
    } catch (error) {
      if (error instanceof SyntaxError) {
        await this.redis.del(key);
        return null;
      }
      throw new Error(
        `Failed to retrieve challenge from Redis: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  async delete(userId, flow) {
    await this.ensureConnection();
    const key = this.getChallengeKey(userId, flow);
    try {
      await this.redis.del(key);
    } catch (error) {
      throw new Error(
        `Failed to delete challenge from Redis: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  getChallengeKey(userId, flow) {
    return `passkey:challenge:${userId}:${flow}`;
  }
};

// src/store/supabase.ts
var SupabaseStore = class {
  constructor(supabase, tableName = "passkey_challenges") {
    this.supabase = supabase;
    this.tableName = tableName;
  }
  async set(record) {
    const { error } = await this.supabase.from(this.tableName).upsert({
      id: record.id,
      user_id: record.userId,
      flow: record.flow,
      challenge: record.challenge,
      expires_at: new Date(record.expiresAt).toISOString()
    });
    if (error) {
      throw new Error(`Failed to store challenge: ${error.message}`);
    }
  }
  async get(userId, flow) {
    const challengeId = `${userId}:${flow}`;
    const { data, error } = await this.supabase.from(this.tableName).select("*").eq("id", challengeId).single();
    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to retrieve challenge: ${error.message}`);
    }
    if (!data) {
      return null;
    }
    const expiresAt = new Date(data.expires_at).getTime();
    if (Date.now() > expiresAt) {
      await this.delete(userId, flow);
      return null;
    }
    return {
      id: data.id,
      userId: data.user_id,
      flow: data.flow,
      challenge: data.challenge,
      expiresAt
    };
  }
  async delete(userId, flow) {
    const challengeId = `${userId}:${flow}`;
    const { error } = await this.supabase.from(this.tableName).delete().eq("id", challengeId);
    if (error) {
      throw new Error(`Failed to delete challenge: ${error.message}`);
    }
  }
  /**
   * Clean up all expired challenges (optional maintenance method)
   */
  async cleanupExpired() {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const { error } = await this.supabase.from(this.tableName).delete().lt("expires_at", now);
    if (error) {
      throw new Error(`Failed to cleanup expired challenges: ${error.message}`);
    }
  }
};

// src/store/db.ts
var DbStore = class {
  constructor(db, tableName = "passkey_challenges") {
    this.db = db;
    this.tableName = tableName;
  }
  async set(record) {
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
      expiresAt
    ]);
  }
  async get(userId, flow) {
    await this.cleanupExpired();
    const id = this.getChallengeId(userId, flow);
    const sql = `
			SELECT id, user_id, flow, challenge, expires_at
			FROM ${this.tableName}
			WHERE id = ? AND expires_at > ?
		`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const rows = await this.db.query(sql, [id, now]);
    if (rows.length === 0) {
      return null;
    }
    const row = rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      flow: row.flow,
      challenge: row.challenge,
      expiresAt: new Date(row.expires_at).getTime()
    };
  }
  async delete(userId, flow) {
    const id = this.getChallengeId(userId, flow);
    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    await this.db.execute(sql, [id]);
  }
  /**
   * Clean up expired challenges (called automatically in get)
   */
  async cleanupExpired() {
    const sql = `DELETE FROM ${this.tableName} WHERE expires_at <= ?`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await this.db.execute(sql, [now]);
  }
  /**
   * Initialize the challenges table
   * Call this during setup to create the table
   */
  async initializeTable() {
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
    const indexSql = `
			CREATE INDEX IF NOT EXISTS idx_${this.tableName}_expires_at
			ON ${this.tableName} (expires_at)
		`;
    await this.db.execute(indexSql);
  }
  getChallengeId(userId, flow) {
    return `${userId}:${flow}`;
  }
};

export {
  RedisStore,
  SupabaseStore,
  DbStore
};
//# sourceMappingURL=chunk-RDZZEFHF.js.map