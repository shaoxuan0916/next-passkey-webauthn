import { PublicKeyCredentialCreationOptionsJSON, RegistrationResponseJSON, PublicKeyCredentialRequestOptionsJSON, AuthenticationResponseJSON } from '@simplewebauthn/server';
import { ServerOptions, RegistrationStartOptions, StoredCredential, AuthenticationStartOptions } from '../types/index.cjs';

/**
 * Start passkey registration flow
 */
declare function startRegistration(userId: string, options: ServerOptions, registrationOptions?: RegistrationStartOptions): Promise<PublicKeyCredentialCreationOptionsJSON>;
/**
 * Complete passkey registration flow
 */
declare function finishRegistration(userId: string, credential: RegistrationResponseJSON, options: ServerOptions, registrationOptions?: RegistrationStartOptions): Promise<{
    verified: boolean;
    credential?: StoredCredential;
}>;

/**
 * Start passkey authentication flow
 */
declare function startAuthentication(userId: string, options: ServerOptions, authOptions?: AuthenticationStartOptions): Promise<PublicKeyCredentialRequestOptionsJSON>;
/**
 * Complete passkey authentication flow
 */
declare function finishAuthentication(userId: string, credential: AuthenticationResponseJSON, options: ServerOptions): Promise<{
    verified: boolean;
    credential?: StoredCredential;
}>;

/**
 * Delete a specific passkey credential
 */
declare function deletePasskey(userId: string, credentialId: string, options: ServerOptions): Promise<void>;
/**
 * List all passkey credentials for a user
 */
declare function listUserPasskeys(userId: string, options: ServerOptions): Promise<StoredCredential[]>;

export { deletePasskey, finishAuthentication, finishRegistration, listUserPasskeys, startAuthentication, startRegistration };
