# API Reference

## Server Functions

### `startRegistration(userId, options, registrationOptions?)`

```typescript
startRegistration(
  userId: string,
  options: ServerOptions,
  registrationOptions?: RegistrationStartOptions & {
    deviceInfo?: PasskeyDeviceInfo;
    managementOptions?: PasskeyManagementOptions;
  }
): Promise<PublicKeyCredentialCreationOptionsJSON>
```

### `finishRegistration(userId, credential, options, registrationOptions?)`

```typescript
finishRegistration(
  userId: string,
  credential: RegistrationResponseJSON,
  options: ServerOptions,
  registrationOptions?: RegistrationStartOptions & {
    deviceInfo?: PasskeyDeviceInfo;
    managementOptions?: PasskeyManagementOptions;
  }
): Promise<{ verified: boolean; credential?: StoredCredential }>
```

### `startAuthentication(userId, options, authOptions?)`

```typescript
startAuthentication(
  userId: string,
  options: ServerOptions,
  authOptions?: AuthenticationStartOptions
): Promise<PublicKeyCredentialRequestOptionsJSON>
```

### `finishAuthentication(userId, credential, options)`

```typescript
finishAuthentication(
  userId: string,
  credential: AuthenticationResponseJSON,
  options: ServerOptions
): Promise<{ verified: boolean; credential?: StoredCredential }>
```

### `deletePasskey(userId, credentialId, options)`

```typescript
deletePasskey(
  userId: string,
  credentialId: string,
  options: ServerOptions
): Promise<void>
```

### `listUserPasskeys(userId, options)`

```typescript
listUserPasskeys(
  userId: string,
  options: ServerOptions
): Promise<StoredCredential[]>
```

## Client Hooks

### `useRegisterPasskey(config)`

```typescript
useRegisterPasskey(config: ClientConfig): RegisterPasskeyHook

// Returns:
{
  register: (userId: string, options?: RegistrationStartOptions & {
    managementOptions?: PasskeyManagementOptions;
    nickname?: string;
  }) => Promise<{ verified: boolean; credential?: StoredCredential }>;
  loading: boolean;
  error: string | null;
}
```

### `useAuthenticatePasskey(config)`

```typescript
useAuthenticatePasskey(config: ClientConfig): AuthenticatePasskeyHook

// Returns:
{
  authenticate: (userId: string, options?: AuthenticationStartOptions) => 
    Promise<{ verified: boolean; credential?: StoredCredential }>;
  loading: boolean;
  error: string | null;
}
```

### `useManagePasskeys(config)`

```typescript
useManagePasskeys(config: ClientConfig): ManagePasskeysHook

// Returns:
{
  list: (userId: string) => Promise<StoredCredential[]>;
  remove: (userId: string, credentialId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}
```

## Adapters

### `PrismaAdapter`

```typescript
new PrismaAdapter(prisma: PrismaClient): PasskeyAdapter
```

### `SupabaseAdapter`

```typescript
new SupabaseAdapter(supabase: any, tableName?: string): PasskeyAdapter
```

## Stores

### `RedisStore`

```typescript
new RedisStore(redis: RedisClient, ttlSeconds: number): ChallengeStore
```

### `DbStore`

```typescript
new DbStore(database: DatabaseClient, tableName: string, ttlSeconds: number): ChallengeStore
```

### `SupabaseStore`

```typescript
new SupabaseStore(supabase: any, tableName: string, ttlSeconds: number): ChallengeStore
```

## Utilities

### `detectDeviceInfo(userAgent?)`

```typescript
detectDeviceInfo(userAgent?: string): PasskeyDeviceInfo
```

### `generatePasskeyNickname(deviceInfo, authenticatorAttachment?)`

```typescript
generatePasskeyNickname(
  deviceInfo: PasskeyDeviceInfo,
  authenticatorAttachment?: AuthenticatorAttachment
): string
```

### `getPasskeyIcon(credential)`

```typescript
getPasskeyIcon(credential: {
  authenticatorAttachment?: AuthenticatorAttachment;
  deviceInfo?: PasskeyDeviceInfo;
  transports?: string[];
}): string
```

### `isSameAuthenticator(credential1, credential2)`

```typescript
isSameAuthenticator(
  credential1: { authenticatorAttachment?, deviceInfo?, transports? },
  credential2: { authenticatorAttachment?, deviceInfo?, transports? }
): boolean
```

## Types

### `ServerOptions`

```typescript
interface ServerOptions {
  adapter: PasskeyAdapter;
  store: ChallengeStore;
  rpConfig: RPConfig;
}
```

### `ClientConfig`

```typescript
interface ClientConfig {
  endpoints: {
    registerStart: string;
    registerFinish: string;
    authenticateStart: string;
    authenticateFinish: string;
    deletePasskey: string;
    listPasskeys: string;
  };
}
```

### `StoredCredential`

```typescript
type StoredCredential = {
  id: string;
  userId: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  userName?: string;
  userDisplayName?: string;
  authenticatorAttachment?: AuthenticatorAttachment;
  deviceInfo?: PasskeyDeviceInfo;
  backupEligible?: boolean;
  backupState?: boolean;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt?: string;
}
```

### `PasskeyDeviceInfo`

```typescript
interface PasskeyDeviceInfo {
  deviceType?: string;
  os?: string;
  browser?: string;
  nickname?: string;
}
```

### `ChallengeRecord`

```typescript
interface ChallengeRecord {
  id: string;
  userId: string;
  flow: Flow;
  challenge: string;
  expiresAt: number;
}
```

### `PasskeyAdapter`

```typescript
interface PasskeyAdapter {
  createPasskey(data: Omit<StoredCredential, "id" | "createdAt">): Promise<StoredCredential>;
  findByCredentialId(credentialId: string): Promise<StoredCredential | null>;
  listUserPasskeys(userId: string): Promise<StoredCredential[]>;
  updateCounter(id: string, counter: number): Promise<void>;
  deletePasskey(id: string): Promise<void>;
}
```

### `ChallengeStore`

```typescript
interface ChallengeStore {
  set(record: ChallengeRecord): Promise<void>;
  get(userId: string, flow: Flow): Promise<ChallengeRecord | null>;
  delete(userId: string, flow: Flow): Promise<void>;
}
```

### `Flow`

```typescript
type Flow = "registration" | "authentication"
```

### `AuthenticatorAttachment`

```typescript
type AuthenticatorAttachment = "platform" | "cross-platform"
```

### `PasskeyError`

```typescript
class PasskeyError extends Error {
  constructor(message: string, code: string, details?: unknown)
}
```

### `ErrorCodes`

```typescript
const ErrorCodes = {
  CHALLENGE_NOT_FOUND: "CHALLENGE_NOT_FOUND",
  CHALLENGE_EXPIRED: "CHALLENGE_EXPIRED",
  CREDENTIAL_NOT_FOUND: "CREDENTIAL_NOT_FOUND",
  VERIFICATION_FAILED: "VERIFICATION_FAILED",
  INVALID_INPUT: "INVALID_INPUT",
  STORAGE_ERROR: "STORAGE_ERROR",
} as const
```
