/**
 * next-passkey - Next.js Passkey (WebAuthn) SDK
 *
 * A focused, minimal, and extensible Passkey authentication library for Next.js
 *
 * @example
 * ```typescript
 * // Server-side
 * import { startRegistration, PrismaAdapter, RedisStore } from "next-passkey-webauthn/server";
 *
 * // Client-side
 * import { useRegisterPasskey } from "next-passkey-webauthn/client";
 *
 * // Types
 * import type { StoredCredential } from "next-passkey-webauthn/types";
 * ```
 */

// Re-export everything for convenience (main entry point)
export * from "./server/index.js";
export * from "./client/index.js";
export * from "./adapters/index.js";
export * from "./store/index.js";
export * from "./types/index.js";

// Named exports for better tree-shaking
export {
  // Server functions
  startRegistration,
  finishRegistration,
  startAuthentication,
  finishAuthentication,
  deletePasskey,
  listUserPasskeys,
} from "./server/index.js";

export {
  // Client hooks
  useRegisterPasskey,
  useAuthenticatePasskey,
  useManagePasskeys,
} from "./client/index.js";

export {
  // Adapters
  PrismaAdapter,
  SupabaseAdapter,
  type PrismaClient,
  type SupabaseClient,
} from "./adapters/index.js";

export {
  // Stores
  MemoryStore,
  RedisStore,
  DbStore,
  type RedisClient,
  type DatabaseClient,
} from "./store/index.js";

export {
  // Core types
  PasskeyError,
  ErrorCodes,
  type StoredCredential,
  type PasskeyAdapter,
  type ChallengeStore,
  type ChallengeRecord,
  type ServerOptions,
  type RPConfig,
  type ClientConfig,
  type Flow,
  type ErrorCode,
} from "./types/index.js";
