/**
 * Challenge store implementations
 *
 * Recommended order of preference:
 * 1. RedisStore - Best performance, handles TTL automatically, works great locally with Docker
 * 2. SupabaseStore - Good for Supabase users, reliable database persistence
 * 3. DbStore - Generic database solution for other database setups
 */

export { RedisStore, type RedisClient } from "./redis";
export { SupabaseStore } from "./supabase";
export { DbStore, type DatabaseClient } from "./db";
