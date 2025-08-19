# API Reference

Complete reference for all next-passkey functions, hooks, and types.

## Server Functions

### Registration

#### `startRegistration(userId, options, registrationOptions?)`

Initiates the passkey registration flow by generating WebAuthn creation options.

**Parameters:**
- `userId: string` - Unique identifier for the user
- `options: ServerOptions` - Server configuration object
- `registrationOptions?: RegistrationStartOptions` - Optional registration settings

**Returns:** `Promise<PublicKeyCredentialCreationOptionsJSON>`

**Example:**
```typescript
import { startRegistration } from "next-passkey-webauthn/server";

const creationOptions = await startRegistration("user-123", {
  adapter: new PrismaAdapter(prisma),
  store: new RedisStore(redis),
  rpConfig: {
    rpID: "example.com",
    rpName: "Your App",
    expectedOrigin: ["https://example.com"]
  }
}, {
  timeout: 300000 // 5 minutes
});
```

---

#### `finishRegistration(userId, credential, options)`

Completes the passkey registration flow by verifying the WebAuthn attestation.

**Parameters:**
- `userId: string` - Unique identifier for the user
- `credential: RegistrationResponseJSON` - WebAuthn registration response from browser
- `options: ServerOptions` - Server configuration object

**Returns:** `Promise<{ verified: boolean; credential?: StoredCredential }>`

**Example:**
```typescript
import { finishRegistration } from "next-passkey-webauthn/server";

const result = await finishRegistration("user-123", credential, serverOptions);

if (result.verified) {
  console.log("Registration successful!", result.credential);
} else {
  console.log("Registration failed");
}
```

### Authentication

#### `startAuthentication(userId, options, authOptions?)`

Initiates the passkey authentication flow by generating WebAuthn request options.

**Parameters:**
- `userId: string` - Unique identifier for the user
- `options: ServerOptions` - Server configuration object
- `authOptions?: AuthenticationStartOptions` - Optional authentication settings

**Returns:** `Promise<PublicKeyCredentialRequestOptionsJSON>`

**Example:**
```typescript
import { startAuthentication } from "next-passkey-webauthn/server";

const requestOptions = await startAuthentication("user-123", serverOptions, {
  timeout: 300000,
  userVerification: "preferred"
});
```

---

#### `finishAuthentication(userId, credential, options)`

Completes the passkey authentication flow by verifying the WebAuthn assertion.

**Parameters:**
- `userId: string` - Unique identifier for the user
- `credential: AuthenticationResponseJSON` - WebAuthn authentication response from browser
- `options: ServerOptions` - Server configuration object

**Returns:** `Promise<{ verified: boolean; credential?: StoredCredential }>`

**Example:**
```typescript
import { finishAuthentication } from "next-passkey-webauthn/server";

const result = await finishAuthentication("user-123", credential, serverOptions);

if (result.verified) {
  console.log("Authentication successful!", result.credential);
  // Create user session, JWT, etc.
} else {
  console.log("Authentication failed");
}
```

### Management

#### `listUserPasskeys(userId, options)`

Lists all passkey credentials for a specific user.

**Parameters:**
- `userId: string` - Unique identifier for the user
- `options: ServerOptions` - Server configuration object

**Returns:** `Promise<StoredCredential[]>`

**Example:**
```typescript
import { listUserPasskeys } from "next-passkey-webauthn/server";

const passkeys = await listUserPasskeys("user-123", serverOptions);
console.log(`User has ${passkeys.length} passkeys`);
```

---

#### `deletePasskey(userId, credentialId, options)`

Deletes a specific passkey credential for a user.

**Parameters:**
- `userId: string` - Unique identifier for the user
- `credentialId: string` - The credential ID to delete
- `options: ServerOptions` - Server configuration object

**Returns:** `Promise<void>`

**Example:**
```typescript
import { deletePasskey } from "next-passkey-webauthn/server";

await deletePasskey("user-123", "credential-abc", serverOptions);
console.log("Passkey deleted successfully");
```

## Client Hooks

### `useRegisterPasskey(config)`

React hook for handling passkey registration on the client side.

**Parameters:**
- `config: ClientConfig` - Client configuration with API endpoints

**Returns:** `RegisterPasskeyHook`
```typescript
{
  register: (userId: string, options?: RegistrationStartOptions) => Promise<{verified: boolean; credential?: StoredCredential}>;
  loading: boolean;
  error: string | null;
}
```

**Example:**
```tsx
import { useRegisterPasskey } from "next-passkey-webauthn/client";

function RegisterButton({ userId }: { userId: string }) {
  const { register, loading, error } = useRegisterPasskey({
    endpoints: {
      registerStart: "/api/passkey/register/start",
      registerFinish: "/api/passkey/register/finish",
      authenticateStart: "/api/passkey/authenticate/start",
      authenticateFinish: "/api/passkey/authenticate/finish",
      deletePasskey: "/api/passkey/delete",
      listPasskeys: "/api/passkey/list",
    }
  });

  const handleRegister = async () => {
    try {
      const result = await register(userId);
      
      if (result.verified) {
        alert("Passkey registered successfully!");
      }
    } catch (err) {
      console.error("Registration failed:", err);
    }
  };

  return (
    <button onClick={handleRegister} disabled={loading}>
      {loading ? "Registering..." : "Register Passkey"}
    </button>
  );
}
```

---

### `useAuthenticatePasskey(config)`

React hook for handling passkey authentication on the client side.

**Parameters:**
- `config: ClientConfig` - Client configuration with API endpoints

**Returns:** `AuthenticatePasskeyHook`
```typescript
{
  authenticate: (userId: string, options?: AuthenticationStartOptions) => Promise<{verified: boolean; credential?: StoredCredential}>;
  loading: boolean;
  error: string | null;
}
```

**Example:**
```tsx
import { useAuthenticatePasskey } from "next-passkey-webauthn/client";

function LoginButton({ userId }: { userId: string }) {
  const { authenticate, loading, error } = useAuthenticatePasskey({
    endpoints: {
      registerStart: "/api/passkey/register/start",
      registerFinish: "/api/passkey/register/finish",
      authenticateStart: "/api/passkey/authenticate/start",
      authenticateFinish: "/api/passkey/authenticate/finish",
      deletePasskey: "/api/passkey/delete",
      listPasskeys: "/api/passkey/list",
    }
  });

  const handleLogin = async () => {
    try {
      const result = await authenticate(userId);
      
      if (result.verified) {
        // Handle successful authentication
        window.location.href = "/dashboard";
      }
    } catch (err) {
      console.error("Authentication failed:", err);
    }
  };

  return (
    <button onClick={handleLogin} disabled={loading}>
      {loading ? "Signing in..." : "Sign in with Passkey"}
    </button>
  );
}
```

---

### `useManagePasskeys(config)`

React hook for managing user passkeys (list, delete).

**Parameters:**
- `config: ClientConfig` - Client configuration with API endpoints

**Returns:** `ManagePasskeysHook`
```typescript
{
  list: (userId: string) => Promise<StoredCredential[]>;
  remove: (credentialId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}
```

**Example:**
```tsx
import { useManagePasskeys } from "next-passkey-webauthn/client";
import { useEffect, useState } from "react";

function PasskeyManager({ userId }: { userId: string }) {
  const [passkeys, setPasskeys] = useState<StoredCredential[]>([]);
  const { list, remove, loading, error } = useManagePasskeys({
    endpoints: {
      registerStart: "/api/passkey/register/start",
      registerFinish: "/api/passkey/register/finish",
      authenticateStart: "/api/passkey/authenticate/start",
      authenticateFinish: "/api/passkey/authenticate/finish",
      deletePasskey: "/api/passkey/delete",
      listPasskeys: "/api/passkey/list",
    }
  });

  useEffect(() => {
    loadPasskeys();
  }, [userId]);

  const loadPasskeys = async () => {
    try {
      const userPasskeys = await list(userId);
      setPasskeys(userPasskeys);
    } catch (err) {
      console.error("Failed to load passkeys:", err);
    }
  };

  const handleDelete = async (credentialId: string) => {
    try {
      await remove(credentialId);
      await loadPasskeys(); // Refresh the list
    } catch (err) {
      console.error("Failed to delete passkey:", err);
    }
  };

  return (
    <div>
      <h3>Your Passkeys</h3>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      
      {passkeys.map((passkey) => (
        <div key={passkey.id}>
          <span>Created: {new Date(passkey.createdAt).toLocaleDateString()}</span>
          <button onClick={() => handleDelete(passkey.credentialId)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
```

## Types

### Core Types

#### `StoredCredential`

Represents a passkey credential stored in the database.

```typescript
type StoredCredential = {
  id: string;              // Local database ID (cuid/uuid)
  userId: string;          // User ID this credential belongs to
  credentialId: string;    // Base64url representation of credential ID (unique)
  publicKey: string;       // Base64url encoded public key
  counter: number;         // Authenticator counter value
  transports?: string[];   // Optional authenticator transports
  createdAt: string;       // ISO string of creation timestamp
  updatedAt?: string;      // ISO string of last update timestamp
};
```

#### `Flow`

WebAuthn flow types.

```typescript
type Flow = "registration" | "authentication";
```

#### `ServerOptions`

Configuration object for server functions.

```typescript
interface ServerOptions {
  adapter: PasskeyAdapter;     // Credential storage adapter
  store: ChallengeStore;       // Challenge storage implementation
  rpConfig: RPConfig;          // Relying party configuration
}
```

#### `RPConfig`

WebAuthn relying party configuration.

```typescript
interface RPConfig {
  rpID: string;                    // Relying Party ID (domain)
  rpName: string;                  // Relying Party name
  expectedOrigin: string | string[]; // Expected origin(s) for WebAuthn operations
}
```

### Option Types

#### `RegistrationStartOptions`

Optional parameters for starting registration.

```typescript
interface RegistrationStartOptions {
  userDisplayName?: string; // User display name for the credential (optional)
  userName?: string;        // User name/identifier for the credential (optional)
  timeout?: number;         // Challenge timeout in milliseconds (default: 300000)
}
```

#### `AuthenticationStartOptions`

Optional parameters for starting authentication.

```typescript
interface AuthenticationStartOptions {
  timeout?: number;                                           // Challenge timeout in milliseconds
  userVerification?: "required" | "preferred" | "discouraged"; // User verification requirement
}
```

#### `ClientConfig`

Configuration for client-side hooks.

```typescript
interface ClientConfig {
  endpoints: {
    registerStart: string;      // Registration start endpoint
    registerFinish: string;     // Registration finish endpoint
    authenticateStart: string;  // Authentication start endpoint
    authenticateFinish: string; // Authentication finish endpoint
    deletePasskey: string;      // Delete passkey endpoint
    listPasskeys: string;       // List passkeys endpoint
  };
}
```

### Interface Types

#### `PasskeyAdapter`

Interface for credential storage implementations.

```typescript
interface PasskeyAdapter {
  createPasskey(data: Omit<StoredCredential, "id" | "createdAt">): Promise<StoredCredential>;
  findByCredentialId(credentialId: string): Promise<StoredCredential | null>;
  listUserPasskeys(userId: string): Promise<StoredCredential[]>;
  updateCounter(id: string, counter: number): Promise<void>;
  deletePasskey(id: string): Promise<void>;
}
```

#### `ChallengeStore`

Interface for challenge storage implementations.

```typescript
interface ChallengeStore {
  set(record: ChallengeRecord): Promise<void>;
  get(userId: string, flow: Flow): Promise<ChallengeRecord | null>;
  delete(userId: string, flow: Flow): Promise<void>;
}
```

#### `ChallengeRecord`

Challenge record structure for temporary storage.

```typescript
interface ChallengeRecord {
  id: string;        // Unique challenge ID, typically `${userId}:${flow}`
  userId: string;    // User ID this challenge belongs to
  flow: Flow;        // The WebAuthn flow type
  challenge: string; // Base64url encoded challenge
  expiresAt: number; // Expiration timestamp in epoch milliseconds
}
```

### Error Types

#### `PasskeyError`

Custom error class for passkey operations.

```typescript
class PasskeyError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  );
}
```

#### `ErrorCodes`

Predefined error codes for common scenarios.

```typescript
const ErrorCodes = {
  CHALLENGE_NOT_FOUND: "CHALLENGE_NOT_FOUND",
  CHALLENGE_EXPIRED: "CHALLENGE_EXPIRED",
  CREDENTIAL_NOT_FOUND: "CREDENTIAL_NOT_FOUND",
  VERIFICATION_FAILED: "VERIFICATION_FAILED",
  INVALID_INPUT: "INVALID_INPUT",
  STORAGE_ERROR: "STORAGE_ERROR",
} as const;

type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
```

### Hook Return Types

#### `HookState`

Base interface for hook loading and error states.

```typescript
interface HookState {
  loading: boolean;      // Loading state
  error: string | null;  // Error state
}
```

#### `RegisterPasskeyHook`

Return type for `useRegisterPasskey` hook.

```typescript
interface RegisterPasskeyHook extends HookState {
  register: (userId: string, options?: RegistrationStartOptions) => Promise<{verified: boolean; credential?: StoredCredential}>;
}
```

#### `AuthenticatePasskeyHook`

Return type for `useAuthenticatePasskey` hook.

```typescript
interface AuthenticatePasskeyHook extends HookState {
  authenticate: (userId: string, options?: AuthenticationStartOptions) => Promise<{verified: boolean; credential?: StoredCredential}>;
}
```

#### `ManagePasskeysHook`

Return type for `useManagePasskeys` hook.

```typescript
interface ManagePasskeysHook extends HookState {
  list: (userId: string) => Promise<StoredCredential[]>;
  remove: (credentialId: string) => Promise<void>;
}
```

## Adapters

### `PrismaAdapter(prisma)`

Prisma-based credential storage adapter.

**Parameters:**
- `prisma: PrismaClient` - Prisma client instance

**Example:**
```typescript
import { PrismaAdapter } from "next-passkey-webauthn/adapters";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const adapter = new PrismaAdapter(prisma);
```

### `SupabaseAdapter(supabase, tableName?)`

Supabase-based credential storage adapter.

**Parameters:**
- `supabase: SupabaseClient` - Supabase client instance
- `tableName?: string` - Table name (default: "passkeys")

**Example:**
```typescript
import { SupabaseAdapter } from "next-passkey-webauthn/adapters";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(url, key);
const adapter = new SupabaseAdapter(supabase);
```

## Stores

### `MemoryStore(cleanupIntervalMs?)`

In-memory challenge storage (development only).

**Parameters:**
- `cleanupIntervalMs?: number` - Cleanup interval in milliseconds (default: 60000)

**Methods:**
- `size(): number` - Get current challenge count
- `clear(): void` - Clear all challenges
- `destroy(): void` - Stop cleanup and clear memory

### `RedisStore(redis, defaultTTL?)`

Redis-based challenge storage (production recommended).

**Parameters:**
- `redis: RedisClient` - Redis client instance
- `defaultTTL?: number` - Default TTL in seconds (default: 300)

### `DbStore(db, tableName?)`

Database-based challenge storage.

**Parameters:**
- `db: DatabaseClient` - Database client instance
- `tableName?: string` - Table name (default: "passkey_challenges")

**Methods:**
- `initializeTable(): Promise<void>` - Create the challenges table
- `cleanupExpired(): Promise<void>` - Remove expired challenges