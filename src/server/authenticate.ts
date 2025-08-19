import {
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialRequestOptionsJSON,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import {
  type AuthenticationStartOptions,
  type ChallengeRecord,
  ErrorCodes,
  type Flow,
  PasskeyError,
  type ServerOptions,
  type StoredCredential,
} from "../types/index.js";

/**
 * Start passkey authentication flow
 */
export async function startAuthentication(
  userId: string,
  options: ServerOptions,
  authOptions?: AuthenticationStartOptions
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  try {
    // Get user's credentials
    const userCredentials = await options.adapter.listUserPasskeys(userId);

    if (userCredentials.length === 0) {
      throw new PasskeyError(
        "No passkeys found for user",
        ErrorCodes.CREDENTIAL_NOT_FOUND
      );
    }

    // Prepare credentials for authentication
    const allowCredentials = userCredentials.map((cred) => ({
      id: cred.credentialId,
      type: "public-key" as const,
      transports: cred.transports as AuthenticatorTransportFuture[],
    }));

    // Generate authentication options
    const authenticationOpts = await generateAuthenticationOptions({
      rpID: options.rpConfig.rpID,
      timeout: authOptions?.timeout || 300000, // 5 minutes
      allowCredentials,
      userVerification: authOptions?.userVerification || "preferred",
    });

    // Store challenge
    const expiresAt = Date.now() + (authOptions?.timeout || 300000);
    const challengeRecord: ChallengeRecord = {
      id: `${userId}:authentication`,
      userId,
      flow: "authentication" as Flow,
      challenge: authenticationOpts.challenge,
      expiresAt,
    };

    await options.store.set(challengeRecord);

    return authenticationOpts;
  } catch (error) {
    if (error instanceof PasskeyError) {
      throw error;
    }
    throw new PasskeyError(
      "Failed to start authentication",
      ErrorCodes.STORAGE_ERROR,
      error
    );
  }
}

/**
 * Complete passkey authentication flow
 */
export async function finishAuthentication(
  userId: string,
  credential: AuthenticationResponseJSON,
  options: ServerOptions
): Promise<{ verified: boolean; credential?: StoredCredential }> {
  try {
    // Retrieve challenge
    const challengeRecord = await options.store.get(userId, "authentication");
    if (!challengeRecord) {
      throw new PasskeyError(
        "Challenge not found or expired",
        ErrorCodes.CHALLENGE_NOT_FOUND
      );
    }

    // Check if challenge is expired
    if (Date.now() > challengeRecord.expiresAt) {
      await options.store.delete(userId, "authentication");
      throw new PasskeyError("Challenge expired", ErrorCodes.CHALLENGE_EXPIRED);
    }

    // Find the credential being used
    const credentialIdString = credential.id;
    const storedCredential = await options.adapter.findByCredentialId(
      credentialIdString
    );

    if (!storedCredential) {
      await options.store.delete(userId, "authentication");
      throw new PasskeyError(
        "Credential not found",
        ErrorCodes.CREDENTIAL_NOT_FOUND
      );
    }

    // Verify the credential belongs to the user
    if (storedCredential.userId !== userId) {
      await options.store.delete(userId, "authentication");
      throw new PasskeyError(
        "Credential does not belong to user",
        ErrorCodes.VERIFICATION_FAILED
      );
    }

    // Prepare authenticator data for verification
    const authenticator = {
      id: storedCredential.credentialId,
      publicKey: Buffer.from(storedCredential.publicKey, "base64url"),
      counter: storedCredential.counter,
      transports: storedCredential.transports as AuthenticatorTransportFuture[],
    };

    // Verify the authentication response
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: options.rpConfig.expectedOrigin,
      expectedRPID: options.rpConfig.rpID,
      credential: authenticator,
      requireUserVerification: false,
    });

    // Clean up challenge immediately after verification
    await options.store.delete(userId, "authentication");

    if (!verification.verified) {
      throw new PasskeyError(
        "Authentication verification failed",
        ErrorCodes.VERIFICATION_FAILED,
        verification
      );
    }

    // Update the counter if verification succeeded
    const newCounter = verification.authenticationInfo.newCounter;
    if (newCounter > storedCredential.counter) {
      await options.adapter.updateCounter(storedCredential.id, newCounter);
      storedCredential.counter = newCounter;
    }

    return {
      verified: true,
      credential: storedCredential,
    };
  } catch (error) {
    // Clean up challenge on any error
    try {
      await options.store.delete(userId, "authentication");
    } catch {
      // Ignore cleanup errors
    }

    if (error instanceof PasskeyError) {
      throw error;
    }
    throw new PasskeyError(
      "Failed to finish authentication",
      ErrorCodes.VERIFICATION_FAILED,
      error
    );
  }
}
