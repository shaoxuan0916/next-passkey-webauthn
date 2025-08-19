import {
  ErrorCodes,
  PasskeyError
} from "./chunk-VXYRGCBZ.js";

// src/server/register.ts
import {
  generateRegistrationOptions,
  verifyRegistrationResponse
} from "@simplewebauthn/server";
async function startRegistration(userId, options, registrationOptions) {
  try {
    const existingCredentials = await options.adapter.listUserPasskeys(userId);
    const excludeCredentials = existingCredentials.map((cred) => ({
      id: cred.credentialId,
      type: "public-key",
      transports: cred.transports
    }));
    const registrationOpts = await generateRegistrationOptions({
      rpName: options.rpConfig.rpName,
      rpID: options.rpConfig.rpID,
      userID: Buffer.from(userId, "utf-8"),
      userName: registrationOptions?.userName || userId,
      userDisplayName: registrationOptions?.userDisplayName || userId,
      timeout: registrationOptions?.timeout || 3e5,
      // 5 minutes
      attestationType: "none",
      excludeCredentials,
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred",
        authenticatorAttachment: "platform"
      },
      supportedAlgorithmIDs: [-7, -257]
      // ES256, RS256
    });
    const expiresAt = Date.now() + (registrationOptions?.timeout || 3e5);
    const challengeRecord = {
      id: `${userId}:registration`,
      userId,
      flow: "registration",
      challenge: registrationOpts.challenge,
      expiresAt
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
async function finishRegistration(userId, credential, options, registrationOptions) {
  try {
    const challengeRecord = await options.store.get(userId, "registration");
    if (!challengeRecord) {
      throw new PasskeyError(
        "Challenge not found or expired",
        ErrorCodes.CHALLENGE_NOT_FOUND
      );
    }
    if (Date.now() > challengeRecord.expiresAt) {
      await options.store.delete(userId, "registration");
      throw new PasskeyError("Challenge expired", ErrorCodes.CHALLENGE_EXPIRED);
    }
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: options.rpConfig.expectedOrigin,
      expectedRPID: options.rpConfig.rpID,
      requireUserVerification: false
    });
    await options.store.delete(userId, "registration");
    if (!verification.verified || !verification.registrationInfo) {
      throw new PasskeyError(
        "Registration verification failed",
        ErrorCodes.VERIFICATION_FAILED,
        verification
      );
    }
    const {
      credential: {
        id: credentialID,
        publicKey: credentialPublicKey,
        counter,
        transports
      }
    } = verification.registrationInfo;
    const credentialIdString = Buffer.from(credentialID).toString("base64url");
    const existingCredential = await options.adapter.findByCredentialId(
      credentialIdString
    );
    if (existingCredential) {
      throw new PasskeyError(
        "Credential already registered",
        ErrorCodes.INVALID_INPUT
      );
    }
    const storedCredential = await options.adapter.createPasskey({
      userId,
      credentialId: credentialID,
      publicKey: Buffer.from(credentialPublicKey).toString("base64url"),
      counter,
      transports,
      userName: registrationOptions?.userName,
      userDisplayName: registrationOptions?.userDisplayName
    });
    return {
      verified: true,
      credential: storedCredential
    };
  } catch (error) {
    try {
      await options.store.delete(userId, "registration");
    } catch {
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

// src/server/authenticate.ts
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from "@simplewebauthn/server";
async function startAuthentication(userId, options, authOptions) {
  try {
    const userCredentials = await options.adapter.listUserPasskeys(userId);
    if (userCredentials.length === 0) {
      throw new PasskeyError(
        "No passkeys found for user",
        ErrorCodes.CREDENTIAL_NOT_FOUND
      );
    }
    const allowCredentials = userCredentials.map((cred) => ({
      id: cred.credentialId,
      type: "public-key",
      transports: cred.transports
    }));
    const authenticationOpts = await generateAuthenticationOptions({
      rpID: options.rpConfig.rpID,
      timeout: authOptions?.timeout || 3e5,
      // 5 minutes
      allowCredentials,
      userVerification: authOptions?.userVerification || "preferred"
    });
    const expiresAt = Date.now() + (authOptions?.timeout || 3e5);
    const challengeRecord = {
      id: `${userId}:authentication`,
      userId,
      flow: "authentication",
      challenge: authenticationOpts.challenge,
      expiresAt
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
async function finishAuthentication(userId, credential, options) {
  try {
    const challengeRecord = await options.store.get(userId, "authentication");
    if (!challengeRecord) {
      throw new PasskeyError(
        "Challenge not found or expired",
        ErrorCodes.CHALLENGE_NOT_FOUND
      );
    }
    if (Date.now() > challengeRecord.expiresAt) {
      await options.store.delete(userId, "authentication");
      throw new PasskeyError("Challenge expired", ErrorCodes.CHALLENGE_EXPIRED);
    }
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
    if (storedCredential.userId !== userId) {
      await options.store.delete(userId, "authentication");
      throw new PasskeyError(
        "Credential does not belong to user",
        ErrorCodes.VERIFICATION_FAILED
      );
    }
    const authenticator = {
      id: storedCredential.credentialId,
      publicKey: Buffer.from(storedCredential.publicKey, "base64url"),
      counter: storedCredential.counter,
      transports: storedCredential.transports
    };
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challengeRecord.challenge,
      expectedOrigin: options.rpConfig.expectedOrigin,
      expectedRPID: options.rpConfig.rpID,
      credential: authenticator,
      requireUserVerification: false
    });
    await options.store.delete(userId, "authentication");
    if (!verification.verified) {
      throw new PasskeyError(
        "Authentication verification failed",
        ErrorCodes.VERIFICATION_FAILED,
        verification
      );
    }
    const newCounter = verification.authenticationInfo.newCounter;
    if (newCounter > storedCredential.counter) {
      await options.adapter.updateCounter(storedCredential.id, newCounter);
      storedCredential.counter = newCounter;
    }
    return {
      verified: true,
      credential: storedCredential
    };
  } catch (error) {
    try {
      await options.store.delete(userId, "authentication");
    } catch {
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

// src/server/delete.ts
async function deletePasskey(userId, credentialId, options) {
  try {
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
async function listUserPasskeys(userId, options) {
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

export {
  startRegistration,
  finishRegistration,
  startAuthentication,
  finishAuthentication,
  deletePasskey,
  listUserPasskeys
};
//# sourceMappingURL=chunk-QTCO4ZDK.js.map