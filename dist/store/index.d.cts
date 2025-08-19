import { ChallengeStore, ChallengeRecord, Flow } from '../types/index.cjs';

/**
 * In-memory challenge store for development
 * Not suitable for production multi-node deployments
 */
declare class MemoryStore implements ChallengeStore {
    /** Cleanup interval in milliseconds (default: 60000 = 1 minute) */
    private readonly cleanupIntervalMs;
    private challenges;
    private cleanupInterval?;
    constructor(
    /** Cleanup interval in milliseconds (default: 60000 = 1 minute) */
    cleanupIntervalMs?: number);
    set(record: ChallengeRecord): Promise<void>;
    get(userId: string, flow: Flow): Promise<ChallengeRecord | null>;
    delete(userId: string, flow: Flow): Promise<void>;
    /**
     * Get challenge count (for testing/debugging)
     */
    size(): number;
    /**
     * Clear all challenges (for testing)
     */
    clear(): void;
    /**
     * Stop cleanup interval and clear memory
     */
    destroy(): void;
    private getChallengeKey;
    private startCleanup;
    private cleanupExpired;
}

/**
 * Redis client interface (compatible with node-redis, ioredis, etc.)
 */
interface RedisClient {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options?: {
        EX?: number;
    }): Promise<string | null>;
    del(key: string): Promise<number>;
}
/**
 * Redis-based challenge store for production
 * Recommended for multi-node deploymentss
 */
declare class RedisStore implements ChallengeStore {
    private readonly redis;
    /** Default TTL in seconds (default: 300 = 5 minutes) */
    private readonly defaultTTL;
    constructor(redis: RedisClient, 
    /** Default TTL in seconds (default: 300 = 5 minutes) */
    defaultTTL?: number);
    set(record: ChallengeRecord): Promise<void>;
    get(userId: string, flow: Flow): Promise<ChallengeRecord | null>;
    delete(userId: string, flow: Flow): Promise<void>;
    private getChallengeKey;
}

/**
 * Generic database client interface for challenge storage
 */
interface DatabaseClient {
    query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    execute(sql: string, params?: unknown[]): Promise<void>;
}
/**
 * Database-based challenge store
 * Works with any SQL database via generic interface
 */
declare class DbStore implements ChallengeStore {
    private readonly db;
    /** Table name for challenges (default: "passkey_challenges") */
    private readonly tableName;
    constructor(db: DatabaseClient, 
    /** Table name for challenges (default: "passkey_challenges") */
    tableName?: string);
    set(record: ChallengeRecord): Promise<void>;
    get(userId: string, flow: Flow): Promise<ChallengeRecord | null>;
    delete(userId: string, flow: Flow): Promise<void>;
    /**
     * Clean up expired challenges (called automatically in get)
     */
    cleanupExpired(): Promise<void>;
    /**
     * Initialize the challenges table
     * Call this during setup to create the table
     */
    initializeTable(): Promise<void>;
    private getChallengeId;
}

export { type DatabaseClient, DbStore, MemoryStore, type RedisClient, RedisStore };
