import { ClientConfig, RegisterPasskeyHook, AuthenticatePasskeyHook, ManagePasskeysHook } from '../types/index.js';

/**
 * React hook for passkey registration
 */
declare function useRegisterPasskey(config: ClientConfig): RegisterPasskeyHook;

/**
 * React hook for passkey authentication
 */
declare function useAuthenticatePasskey(config: ClientConfig): AuthenticatePasskeyHook;

/**
 * React hook for managing passkeys (list, delete)
 */
declare function useManagePasskeys(config: ClientConfig): ManagePasskeysHook;

export { useAuthenticatePasskey, useManagePasskeys, useRegisterPasskey };
