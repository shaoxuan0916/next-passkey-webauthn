import { ClientConfig, RegisterPasskeyHook, AuthenticatePasskeyHook, ManagePasskeysHook, PasskeyDeviceInfo, AuthenticatorAttachment } from '../types/index.cjs';

/**
 * React hook for passkey registration
 */
declare function useRegisterPasskey(config: ClientConfig): RegisterPasskeyHook;

/**
 * React hook for passkey authentication
 */
declare function useAuthenticatePasskey(config: ClientConfig): AuthenticatePasskeyHook;

/**
 * React hook for managing passkeys (list, remove)
 */
declare function useManagePasskeys(config: ClientConfig): ManagePasskeysHook;

/**
 * Detect device information from user agent and other browser APIs
 * This runs on the client side to gather device context
 */
declare function detectDeviceInfo(userAgent?: string): PasskeyDeviceInfo;
/**
 * Generate a user-friendly name for a passkey based on device info
 */
declare function generatePasskeyNickname(deviceInfo: PasskeyDeviceInfo, authenticatorAttachment?: AuthenticatorAttachment): string;
/**
 * Get a user-friendly icon/emoji for a passkey type
 */
declare function getPasskeyIcon(credential: {
    authenticatorAttachment?: AuthenticatorAttachment;
    deviceInfo?: PasskeyDeviceInfo;
    transports?: string[];
}): string;
/**
 * Check if two passkeys are from the same authenticator
 * This helps prevent duplicate registrations from the same device
 */
declare function isSameAuthenticator(credential1: {
    authenticatorAttachment?: AuthenticatorAttachment;
    deviceInfo?: PasskeyDeviceInfo;
    transports?: string[];
}, credential2: {
    authenticatorAttachment?: AuthenticatorAttachment;
    deviceInfo?: PasskeyDeviceInfo;
    transports?: string[];
}): boolean;

export { detectDeviceInfo, generatePasskeyNickname, getPasskeyIcon, isSameAuthenticator, useAuthenticatePasskey, useManagePasskeys, useRegisterPasskey };
