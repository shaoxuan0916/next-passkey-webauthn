import type { ChallengeRecord, ChallengeStore, Flow } from "../types/index.js";

/**
 * In-memory challenge store for development
 * Not suitable for production multi-node deployments
 */
export class MemoryStore implements ChallengeStore {
  private challenges = new Map<string, ChallengeRecord>();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    /** Cleanup interval in milliseconds (default: 60000 = 1 minute) */
    private readonly cleanupIntervalMs = 60_000
  ) {
    this.startCleanup();
  }

  async set(record: ChallengeRecord): Promise<void> {
    const key = this.getChallengeKey(record.userId, record.flow);
    this.challenges.set(key, record);
  }

  async get(userId: string, flow: Flow): Promise<ChallengeRecord | null> {
    const key = this.getChallengeKey(userId, flow);
    const record = this.challenges.get(key);

    if (!record) {
      return null;
    }

    // Check if expired
    if (Date.now() > record.expiresAt) {
      this.challenges.delete(key);
      return null;
    }

    return record;
  }

  async delete(userId: string, flow: Flow): Promise<void> {
    const key = this.getChallengeKey(userId, flow);
    this.challenges.delete(key);
  }

  /**
   * Get challenge count (for testing/debugging)
   */
  size(): number {
    return this.challenges.size;
  }

  /**
   * Clear all challenges (for testing)
   */
  clear(): void {
    this.challenges.clear();
  }

  /**
   * Stop cleanup interval and clear memory
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.clear();
  }

  private getChallengeKey(userId: string, flow: Flow): string {
    return `${userId}:${flow}`;
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, this.cleanupIntervalMs);

    // Don't keep the process alive for cleanup
    this.cleanupInterval.unref?.();
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, record] of this.challenges.entries()) {
      if (now > record.expiresAt) {
        this.challenges.delete(key);
      }
    }
  }
}
