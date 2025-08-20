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
export * from "./server/index";
export * from "./client/index";
export * from "./adapters/index";
export * from "./store/index";
export * from "./types/index";

// Named exports for better tree-shaking
export {
  // Server functions
  startRegistration,
  finishRegistration,
  startAuthentication,
  finishAuthentication,
  deletePasskey,
  listUserPasskeys,
} from "./server/index";

export {
  // Client hooks
  useRegisterPasskey,
  useAuthenticatePasskey,
  useManagePasskeys,
} from "./client/index";

export {
  // Adapters
  PrismaAdapter,
  SupabaseAdapter,
  type PrismaClient,
} from "./adapters/index";

export {
  // Stores
  RedisStore,
  DbStore,
  type RedisClient,
  type DatabaseClient,
} from "./store/index";

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
} from "./types/index";
