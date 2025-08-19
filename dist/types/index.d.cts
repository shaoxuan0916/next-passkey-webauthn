/**
 * Core types and interfaces for the next-passkey library
 */
/**
 * WebAuthn flow types
 */
type Flow = "registration" | "authentication";
/**
 * Stored credential data structure
 * Represents a passkey credential stored in the database
 */
type StoredCredential = {
    /** Local database ID (cuid/uuid) */
    id: string;
    /** User ID this credential belongs to */
    userId: string;
    /** Base64url representation of the credential ID (unique) */
    credentialId: string;
    /** Base64url encoded public key */
    publicKey: string;
    /** Authenticator counter value */
    counter: number;
    /** Optional authenticator transports */
    transports?: string[];
    /** Optional user display name */
    userDisplayName?: string;
    /** Optional user name/identifier */
    userName?: string;
    /** ISO string of creation timestamp */
    createdAt: string;
    /** ISO string of last update timestamp */
    updatedAt?: string;
};
/**
 * Adapter interface for credential persistence
 * Implementations handle storing and retrieving passkey credentials
 */
interface PasskeyAdapter {
    /**
     * Create a new passkey credential
     */
    createPasskey(data: Omit<StoredCredential, "id" | "createdAt">): Promise<StoredCredential>;
    /**
     * Find a credential by its credential ID
     */
    findByCredentialId(credentialId: string): Promise<StoredCredential | null>;
    /**
     * List all passkeys for a user
     */
    listUserPasskeys(userId: string): Promise<StoredCredential[]>;
    /**
     * Update the counter value for a credential
     */
    updateCounter(id: string, counter: number): Promise<void>;
    /**
     * Delete a passkey credential
     */
    deletePasskey(id: string): Promise<void>;
}
/**
 * Challenge record for WebAuthn flows
 * Stored temporarily during registration/authentication flows
 */
interface ChallengeRecord {
    /** Unique challenge ID, typically `${userId}:${flow}` */
    id: string;
    /** User ID this challenge belongs to */
    userId: string;
    /** The WebAuthn flow type */
    flow: Flow;
    /** Base64url encoded challenge */
    challenge: string;
    /** Expiration timestamp in epoch milliseconds */
    expiresAt: number;
}
/**
 * Challenge store interface for temporary challenge storage
 * Implementations handle storing challenges during WebAuthn flows
 */
interface ChallengeStore {
    /**
     * Store a challenge record
     */
    set(record: ChallengeRecord): Promise<void>;
    /**
     * Retrieve a challenge record by user ID and flow
     */
    get(userId: string, flow: Flow): Promise<ChallengeRecord | null>;
    /**
     * Delete a challenge record by user ID and flow
     */
    delete(userId: string, flow: Flow): Promise<void>;
}
/**
 * Configuration for WebAuthn relying party
 */
interface RPConfig {
    /** Relying Party ID (domain) */
    rpID: string;
    /** Relying Party name */
    rpName: string;
    /** Expected origin for WebAuthn operations */
    expectedOrigin: string | string[];
}
/**
 * Server function options
 */
interface ServerOptions {
    /** Credential storage adapter */
    adapter: PasskeyAdapter;
    /** Challenge storage implementation */
    store: ChallengeStore;
    /** Relying party configuration */
    rpConfig: RPConfig;
}
/**
 * Registration start options
 */
interface RegistrationStartOptions {
    /** User display name for the credential */
    userDisplayName?: string;
    /** User name/identifier for the credential */
    userName?: string;
    /** Challenge timeout in milliseconds (default: 300000 = 5 minutes) */
    timeout?: number;
}
/**
 * Authentication start options
 */
interface AuthenticationStartOptions {
    /** Challenge timeout in milliseconds */
    timeout?: number;
    /** User verification requirement */
    userVerification?: "required" | "preferred" | "discouraged";
}
/**
 * Common error types
 */
declare class PasskeyError extends Error {
    code: string;
    details?: unknown | undefined;
    constructor(message: string, code: string, details?: unknown | undefined);
}
/**
 * Error codes for common scenarios
 */
declare const ErrorCodes: {
    readonly CHALLENGE_NOT_FOUND: "CHALLENGE_NOT_FOUND";
    readonly CHALLENGE_EXPIRED: "CHALLENGE_EXPIRED";
    readonly CREDENTIAL_NOT_FOUND: "CREDENTIAL_NOT_FOUND";
    readonly VERIFICATION_FAILED: "VERIFICATION_FAILED";
    readonly INVALID_INPUT: "INVALID_INPUT";
    readonly STORAGE_ERROR: "STORAGE_ERROR";
};
type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
/**
 * Client hook configuration
 */
interface ClientConfig {
    /** API endpoints for server calls */
    endpoints: {
        /** Registration start endpoint */
        registerStart: string;
        /** Registration finish endpoint */
        registerFinish: string;
        /** Authentication start endpoint */
        authenticateStart: string;
        /** Authentication finish endpoint */
        authenticateFinish: string;
        /** Delete passkey endpoint */
        deletePasskey: string;
        /** List passkeys endpoint */
        listPasskeys: string;
    };
}
/**
 * Hook return types for loading states and errors
 */
interface HookState {
    /** Loading state */
    loading: boolean;
    /** Error state */
    error: string | null;
}
/**
 * Registration hook return type
 */
interface RegisterPasskeyHook extends HookState {
    /** Register a new passkey */
    register: (userId: string, options?: RegistrationStartOptions) => Promise<{
        verified: boolean;
        credential?: StoredCredential;
    }>;
}
/**
 * Authentication hook return type
 */
interface AuthenticatePasskeyHook extends HookState {
    /** Authenticate with a passkey */
    authenticate: (userId: string, options?: AuthenticationStartOptions) => Promise<{
        verified: boolean;
        credential?: StoredCredential;
    }>;
}
/**
 * Management hook return type
 */
interface ManagePasskeysHook extends HookState {
    /** List user's passkeys */
    list: (userId: string) => Promise<StoredCredential[]>;
    /** Delete a passkey */
    remove: (credentialId: string) => Promise<void>;
}

export { type AuthenticatePasskeyHook, type AuthenticationStartOptions, type ChallengeRecord, type ChallengeStore, type ClientConfig, type ErrorCode, ErrorCodes, type Flow, type HookState, type ManagePasskeysHook, type PasskeyAdapter, PasskeyError, type RPConfig, type RegisterPasskeyHook, type RegistrationStartOptions, type ServerOptions, type StoredCredential };
