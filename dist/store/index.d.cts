import { ChallengeStore, ChallengeRecord, Flow } from '../types/index.cjs';

/**
 * Redis client interface (compatible with node-redis, ioredis, etc.)
 */
interface RedisClient {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options?: {
        EX?: number;
    }): Promise<string | null>;
    del(key: string): Promise<number>;
    isOpen?: boolean;
    ping?(): Promise<string>;
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
declare class RedisStore implements ChallengeStore {
    private readonly redis;
    /** Default TTL in seconds (default: 300 = 5 minutes) */
    private readonly defaultTTL;
    constructor(redis: RedisClient, 
    /** Default TTL in seconds (default: 300 = 5 minutes) */
    defaultTTL?: number);
    private ensureConnection;
    set(record: ChallengeRecord): Promise<void>;
    get(userId: string, flow: Flow): Promise<ChallengeRecord | null>;
    delete(userId: string, flow: Flow): Promise<void>;
    private getChallengeKey;
}

/**
 * Supabase-based challenge store for production use
 * Stores challenges in a database table for persistence across server restarts
 */
declare class SupabaseStore implements ChallengeStore {
    private readonly supabase;
    /** Table name for challenges (default: "passkey_challenges") */
    private readonly tableName;
    constructor(supabase: any, // Compatible with @supabase/supabase-js
    /** Table name for challenges (default: "passkey_challenges") */
    tableName?: string);
    set(record: ChallengeRecord): Promise<void>;
    get(userId: string, flow: Flow): Promise<ChallengeRecord | null>;
    delete(userId: string, flow: Flow): Promise<void>;
    /**
     * Clean up all expired challenges (optional maintenance method)
     */
    cleanupExpired(): Promise<void>;
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

export { type DatabaseClient, DbStore, type RedisClient, RedisStore, SupabaseStore };
