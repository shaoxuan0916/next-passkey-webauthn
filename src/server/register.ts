import {
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type RegistrationResponseJSON,
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import {
  type ChallengeRecord,
  ErrorCodes,
  type Flow,
  PasskeyError,
  type RegistrationStartOptions,
  type ServerOptions,
  type StoredCredential,
} from "../types/index.js";

/**
 * Start passkey registration flow
 */
export async function startRegistration(
  userId: string,
  options: ServerOptions,
  registrationOptions?: RegistrationStartOptions
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  try {
    // Get existing credentials to exclude from registration
    const existingCredentials = await options.adapter.listUserPasskeys(userId);
    const excludeCredentials = existingCredentials.map((cred) => ({
      id: cred.credentialId,
      type: "public-key" as const,
      transports: cred.transports as AuthenticatorTransportFuture[],
    }));

    // Generate registration options
    const registrationOpts = await generateRegistrationOptions({
      rpName: options.rpConfig.rpName,
      rpID: options.rpConfig.rpID,
      userID: Buffer.from(userId, "utf-8"),
      userName: registrationOptions?.userName || userId,
      userDisplayName: registrationOptions?.userDisplayName || userId,
      timeout: registrationOptions?.timeout || 300000, // 5 minutes
      attestationType: "none",
      excludeCredentials: excludeCredentials,
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
        authenticatorAttachment: "platform",
      },
      supportedAlgorithmIDs: [-7, -257], // ES256, RS256
    });

    // Store challenge
    const expiresAt = Date.now() + (registrationOptions?.timeout || 300000);
    const challengeRecord: ChallengeRecord = {
      id: `${userId}:registration`,
      userId,
      flow: "registration" as Flow,
      challenge: registrationOpts.challenge,
      expiresAt,
    };

    await options.store.set(challengeRecord);

    return registrationOpts;
  } catch (error) {
    if (error instanceof PasskeyError) {
      throw error;
    }
    throw new PasskeyError(
      "Failed to start registration",
      ErrorCodes.STORAGE_ERROR,
      error
    );
  }
}

/**
 * Complete passkey registration flow
 */
export async function finishRegistration(
  userId: string,
  credential: RegistrationResponseJSON,
  options: ServerOptions,
  registrationOptions?: RegistrationStartOptions
): Promise<{ verified: boolean; credential?: StoredCredential }> {
  try {
    // Retrieve challenge
    const challengeRecord = await options.store.get(userId, "registration");
    if (!challengeRecord) {
      throw new PasskeyError(
        "Challenge not found or expired",
        ErrorCodes.CHALLENGE_NOT_FOUND
      );
    }

    // Check if challenge is expired
    if (Date.now() > challengeRecord.expiresAt) {
      await options.store.delete(userId, "registration");
      throw new PasskeyError("Challenge expired", ErrorCodes.CHALLENGE_EXPIRED);
    }

    // Verify the registration response
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: options.rpConfig.expectedOrigin,
      expectedRPID: options.rpConfig.rpID,
      requireUserVerification: false,
    });

    // Clean up challenge immediately after verification
    await options.store.delete(userId, "registration");

    if (!verification.verified || !verification.registrationInfo) {
      throw new PasskeyError(
        "Registration verification failed",
        ErrorCodes.VERIFICATION_FAILED,
        verification
      );
    }

    // Extract credential information
    const {
      credential: {
        id: credentialID,
        publicKey: credentialPublicKey,
        counter,
        transports,
      },
    } = verification.registrationInfo;

    // Convert credential ID to base64url string
    const credentialIdString = Buffer.from(credentialID).toString("base64url");

    // Check if credential already exists
    const existingCredential = await options.adapter.findByCredentialId(
      credentialIdString
    );
    if (existingCredential) {
      throw new PasskeyError(
        "Credential already registered",
        ErrorCodes.INVALID_INPUT
      );
    }

    // Store the credential
    const storedCredential = await options.adapter.createPasskey({
      userId,
      credentialId: credentialID,
      publicKey: Buffer.from(credentialPublicKey).toString("base64url"),
      counter,
      transports,
      userName: registrationOptions?.userName,
      userDisplayName: registrationOptions?.userDisplayName,
    });

    return {
      verified: true,
      credential: storedCredential,
    };
  } catch (error) {
    // Clean up challenge on any error
    try {
      await options.store.delete(userId, "registration");
    } catch {
      // Ignore cleanup errors
    }
    if (error instanceof PasskeyError) {
      throw error;
    }
    throw new PasskeyError(
      "Failed to finish registration",
      ErrorCodes.VERIFICATION_FAILED,
      error
    );
  }
}
