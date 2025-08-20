import {
  ErrorCodes,
  PasskeyError,
  type ServerOptions,
  type StoredCredential,
} from "../types/index";

/**
 * Delete a specific passkey credential
 */
export async function deletePasskey(
  userId: string,
  credentialId: string,
  options: ServerOptions
): Promise<void> {
  try {
    // Find the credential to verify ownership
    const credential = await options.adapter.findByCredentialId(credentialId);

    if (!credential) {
      throw new PasskeyError(
        "Credential not found",
        ErrorCodes.CREDENTIAL_NOT_FOUND
      );
    }

    if (credential.userId !== userId) {
      throw new PasskeyError(
        "Credential does not belong to user",
        ErrorCodes.VERIFICATION_FAILED
      );
    }

    // Delete the credential
    await options.adapter.deletePasskey(credential.id);
  } catch (error) {
    if (error instanceof PasskeyError) {
      throw error;
    }
    throw new PasskeyError(
      "Failed to delete passkey",
      ErrorCodes.STORAGE_ERROR,
      error
    );
  }
}

/**
 * List all passkey credentials for a user
 */
export async function listUserPasskeys(
  userId: string,
  options: ServerOptions
): Promise<StoredCredential[]> {
  try {
    return await options.adapter.listUserPasskeys(userId);
  } catch (error) {
    if (error instanceof PasskeyError) {
      throw error;
    }
    throw new PasskeyError(
      "Failed to list passkeys",
      ErrorCodes.STORAGE_ERROR,
      error
    );
  }
}
