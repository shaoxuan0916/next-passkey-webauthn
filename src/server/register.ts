import {
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type RegistrationResponseJSON,
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import {
  type AuthenticatorAttachment,
  type ChallengeRecord,
  ErrorCodes,
  type Flow,
  PasskeyError,
  type PasskeyDeviceInfo,
  type PasskeyManagementOptions,
  type RegistrationStartOptions,
  type ServerOptions,
  type StoredCredential,
} from "../types/index";

/**
 * Start passkey registration flow
 */
export async function startRegistration(
  userId: string,
  options: ServerOptions,
  registrationOptions?: RegistrationStartOptions & {
    deviceInfo?: PasskeyDeviceInfo;
    managementOptions?: PasskeyManagementOptions;
  }
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  try {
    // Get existing credentials to exclude from registration
    const existingCredentials = await options.adapter.listUserPasskeys(userId);

    // Check management constraints
    const managementOptions = registrationOptions?.managementOptions;
    if (
      managementOptions?.maxPasskeysPerUser &&
      existingCredentials.length >= managementOptions.maxPasskeysPerUser
    ) {
      throw new PasskeyError(
        `Maximum number of passkeys (${managementOptions.maxPasskeysPerUser}) reached for this user`,
        ErrorCodes.INVALID_INPUT
      );
    }

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
      timeout: registrationOptions?.timeout || 1000 * 60 * 5, // 5 minutes
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
    const expiresAt =
      Date.now() + (registrationOptions?.timeout || 1000 * 60 * 5); // 5 minutes
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
  registrationOptions?: RegistrationStartOptions & {
    deviceInfo?: PasskeyDeviceInfo;
    managementOptions?: PasskeyManagementOptions;
  }
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
        id: credentialId,
        publicKey: credentialPublicKey,
        counter,
        transports,
      },
      credentialBackedUp,
      credentialDeviceType,
    } = verification.registrationInfo;

    // Check if credential already exists
    const existingCredential = await options.adapter.findByCredentialId(
      credentialId
    );
    if (existingCredential) {
      throw new PasskeyError(
        "Credential already registered",
        ErrorCodes.INVALID_INPUT
      );
    }

    // Determine authenticator attachment using multiple signals
    let authenticatorAttachment: AuthenticatorAttachment;

    // Method 1: Check transports for "internal" (platform authenticators)
    const hasInternalTransport = transports?.includes("internal");

    // Method 2: Check device type
    const isSingleDevice = credentialDeviceType === "singleDevice";

    // Method 3: Check device info for known platform devices
    const deviceInfo = registrationOptions?.deviceInfo;
    const isPlatformDevice =
      deviceInfo &&
      ((deviceInfo.os === "macOS" && deviceInfo.deviceType === "Mac") ||
        (deviceInfo.os === "iOS" &&
          (deviceInfo.deviceType === "iPhone" ||
            deviceInfo.deviceType === "iPad")) ||
        (deviceInfo.os === "iPadOS" && deviceInfo.deviceType === "iPad") ||
        (deviceInfo.os === "Windows" &&
          deviceInfo.deviceType === "Windows PC"));

    // Determine attachment (prioritize transport, then device type, then device info)
    if (hasInternalTransport || isSingleDevice || isPlatformDevice) {
      authenticatorAttachment = "platform";
    } else {
      authenticatorAttachment = "cross-platform";
    }

    // Check for duplicate authenticators
    // Default: prevent duplicates for platform authenticators, allow for cross-platform
    const shouldPreventDuplicates =
      registrationOptions?.managementOptions?.preventDuplicateAuthenticators !==
        false && authenticatorAttachment === "platform";

    if (shouldPreventDuplicates) {
      const existingCredentials = await options.adapter.listUserPasskeys(
        userId
      );

      const isDuplicate = existingCredentials.some((existing) => {
        // For platform authenticators, check if same device type and OS
        if (
          existing.authenticatorAttachment === "platform" &&
          authenticatorAttachment === "platform"
        ) {
          // If we have device info for both, compare them
          if (existing.deviceInfo && registrationOptions?.deviceInfo) {
            return (
              existing.deviceInfo.deviceType ===
                registrationOptions.deviceInfo.deviceType &&
              existing.deviceInfo.os === registrationOptions.deviceInfo.os
            );
          }

          // If no device info available, assume it's a duplicate platform authenticator
          // This prevents multiple platform passkeys on the same device
          return true;
        }

        return false;
      });

      if (isDuplicate) {
        const deviceName =
          registrationOptions?.deviceInfo?.deviceType || "this device";
        throw new PasskeyError(
          `You already have a passkey on ${deviceName}. Each device can only have one passkey.`,
          ErrorCodes.INVALID_INPUT
        );
      }
    }

    // Store the credential with enhanced metadata
    const storedCredential = await options.adapter.createPasskey({
      userId,
      credentialId,
      publicKey: Buffer.from(credentialPublicKey).toString("base64url"),
      counter,
      transports,
      userName: registrationOptions?.userName,
      userDisplayName: registrationOptions?.userDisplayName,
      authenticatorAttachment,
      deviceInfo: registrationOptions?.deviceInfo,
      backupEligible: credentialBackedUp,
      backupState: credentialBackedUp,
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
