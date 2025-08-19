// src/store/memory.ts
var MemoryStore = class {
  constructor(cleanupIntervalMs = 6e4) {
    this.cleanupIntervalMs = cleanupIntervalMs;
    this.challenges = /* @__PURE__ */ new Map();
    this.startCleanup();
  }
  async set(record) {
    const key = this.getChallengeKey(record.userId, record.flow);
    this.challenges.set(key, record);
  }
  async get(userId, flow) {
    const key = this.getChallengeKey(userId, flow);
    const record = this.challenges.get(key);
    if (!record) {
      return null;
    }
    if (Date.now() > record.expiresAt) {
      this.challenges.delete(key);
      return null;
    }
    return record;
  }
  async delete(userId, flow) {
    const key = this.getChallengeKey(userId, flow);
    this.challenges.delete(key);
  }
  /**
   * Get challenge count (for testing/debugging)
   */
  size() {
    return this.challenges.size;
  }
  /**
   * Clear all challenges (for testing)
   */
  clear() {
    this.challenges.clear();
  }
  /**
   * Stop cleanup interval and clear memory
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = void 0;
    }
    this.clear();
  }
  getChallengeKey(userId, flow) {
    return `${userId}:${flow}`;
  }
  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, this.cleanupIntervalMs);
    this.cleanupInterval.unref?.();
  }
  cleanupExpired() {
    const now = Date.now();
    for (const [key, record] of this.challenges.entries()) {
      if (now > record.expiresAt) {
        this.challenges.delete(key);
      }
    }
  }
};

// src/store/redis.ts
var RedisStore = class {
  constructor(redis, defaultTTL = 300) {
    this.redis = redis;
    this.defaultTTL = defaultTTL;
  }
  async set(record) {
    const key = this.getChallengeKey(record.userId, record.flow);
    const value = JSON.stringify(record);
    const ttlSeconds = Math.ceil((record.expiresAt - Date.now()) / 1e3);
    const finalTTL = Math.min(Math.max(ttlSeconds, 1), this.defaultTTL);
    await this.redis.set(key, value, { EX: finalTTL });
  }
  async get(userId, flow) {
    const key = this.getChallengeKey(userId, flow);
    const value = await this.redis.get(key);
    if (!value) {
      return null;
    }
    try {
      const record = JSON.parse(value);
      if (Date.now() > record.expiresAt) {
        await this.redis.del(key);
        return null;
      }
      return record;
    } catch {
      await this.redis.del(key);
      return null;
    }
  }
  async delete(userId, flow) {
    const key = this.getChallengeKey(userId, flow);
    await this.redis.del(key);
  }
  getChallengeKey(userId, flow) {
    return `passkey:challenge:${userId}:${flow}`;
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
  MemoryStore,
  RedisStore,
  DbStore
};
//# sourceMappingURL=chunk-VAXUQYAM.js.map