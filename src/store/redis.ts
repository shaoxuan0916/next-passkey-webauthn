import type { ChallengeRecord, ChallengeStore, Flow } from "../types/index.js";

/**
 * Redis client interface (compatible with node-redis, ioredis, etc.)
 */
export interface RedisClient {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    options?: { EX?: number }
  ): Promise<string | null>;
  del(key: string): Promise<number>;
}

/**
 * Redis-based challenge store for production
 * Recommended for multi-node deploymentss
 */
export class RedisStore implements ChallengeStore {
  constructor(
    private readonly redis: RedisClient,
    /** Default TTL in seconds (default: 300 = 5 minutes) */
    private readonly defaultTTL = 300
  ) {}

  async set(record: ChallengeRecord): Promise<void> {
    const key = this.getChallengeKey(record.userId, record.flow);
    const value = JSON.stringify(record);
    const ttlSeconds = Math.ceil((record.expiresAt - Date.now()) / 1000);

    // Use the shorter of record expiration or default TTL
    const finalTTL = Math.min(Math.max(ttlSeconds, 1), this.defaultTTL);

    await this.redis.set(key, value, { EX: finalTTL });
  }

  async get(userId: string, flow: Flow): Promise<ChallengeRecord | null> {
    const key = this.getChallengeKey(userId, flow);
    const value = await this.redis.get(key);

    if (!value) {
      return null;
    }

    try {
      const record: ChallengeRecord = JSON.parse(value);

      // Double-check expiration (Redis TTL might not be exact)
      if (Date.now() > record.expiresAt) {
        await this.redis.del(key);
        return null;
      }

      return record;
    } catch {
      // Invalid JSON, delete the key
      await this.redis.del(key);
      return null;
    }
  }

  async delete(userId: string, flow: Flow): Promise<void> {
    const key = this.getChallengeKey(userId, flow);
    await this.redis.del(key);
  }

  private getChallengeKey(userId: string, flow: Flow): string {
    return `passkey:challenge:${userId}:${flow}`;
  }
}
