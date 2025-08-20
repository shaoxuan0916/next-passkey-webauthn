import type { ChallengeRecord, ChallengeStore, Flow } from "../types/index";

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
  isOpen?: boolean; // For node-redis v4+
  ping?(): Promise<string>; // For connection testing
}

/**
 * Redis-based challenge store - RECOMMENDED for all environments
 *
 * Benefits:
 * - Automatic TTL handling (no manual cleanup needed)
 * - Excellent performance
 * - Works perfectly in development with Docker
 * - Production-ready for multi-node deployments
 * - No database schema changes required
 *
 */
export class RedisStore implements ChallengeStore {
  constructor(
    private readonly redis: RedisClient,
    /** Default TTL in seconds (default: 300 = 5 minutes) */
    private readonly defaultTTL = 300
  ) {}

  private async ensureConnection(): Promise<void> {
    if (this.redis.isOpen === false) {
      throw new Error(
        "Redis client is not connected. Make sure to call redis.connect() before using RedisStore."
      );
    }
  }

  async set(record: ChallengeRecord): Promise<void> {
    await this.ensureConnection();

    const key = this.getChallengeKey(record.userId, record.flow);
    const value = JSON.stringify(record);
    const ttlSeconds = Math.ceil((record.expiresAt - Date.now()) / 1000);

    // Use the shorter of record expiration or default TTL
    const finalTTL = Math.min(Math.max(ttlSeconds, 1), this.defaultTTL);

    try {
      await this.redis.set(key, value, { EX: finalTTL });
    } catch (error) {
      throw new Error(
        `Failed to store challenge in Redis: ${
          error instanceof Error ? error.message : String(error)
        }. ` +
          "Check your Redis connection and ensure the client is properly connected."
      );
    }
  }

  async get(userId: string, flow: Flow): Promise<ChallengeRecord | null> {
    await this.ensureConnection();

    const key = this.getChallengeKey(userId, flow);

    try {
      const value = await this.redis.get(key);

      if (!value) {
        return null;
      }

      const record: ChallengeRecord = JSON.parse(value);

      // Double-check expiration (Redis TTL might not be exact)
      if (Date.now() > record.expiresAt) {
        await this.redis.del(key);
        return null;
      }

      return record;
    } catch (error) {
      if (error instanceof SyntaxError) {
        // Invalid JSON, delete the key
        await this.redis.del(key);
        return null;
      }
      throw new Error(
        `Failed to retrieve challenge from Redis: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  async delete(userId: string, flow: Flow): Promise<void> {
    await this.ensureConnection();

    const key = this.getChallengeKey(userId, flow);

    try {
      await this.redis.del(key);
    } catch (error) {
      throw new Error(
        `Failed to delete challenge from Redis: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private getChallengeKey(userId: string, flow: Flow): string {
    return `passkey:challenge:${userId}:${flow}`;
  }
}
