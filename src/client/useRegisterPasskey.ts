import {
  type PublicKeyCredentialCreationOptionsJSON,
  type RegistrationResponseJSON,
  startRegistration,
} from "@simplewebauthn/browser";
import { useCallback, useState } from "react";
import {
  type ClientConfig,
  ErrorCodes,
  PasskeyError,
  type RegisterPasskeyHook,
  type RegistrationStartOptions,
  type StoredCredential,
} from "../types/index.js";

/**
 * React hook for passkey registration
 */
export function useRegisterPasskey(config: ClientConfig): RegisterPasskeyHook {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = useCallback(
    async (
      userId: string,
      options?: RegistrationStartOptions
    ): Promise<{ verified: boolean; credential?: StoredCredential }> => {
      setLoading(true);
      setError(null);

      try {
        // Step 1: Start registration flow
        const startResponse = await fetch(config.endpoints.registerStart, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ userId, ...options }),
        });

        if (!startResponse.ok) {
          const errorData = await startResponse.json();
          throw new PasskeyError(
            errorData.error || "Failed to start registration",
            ErrorCodes.INVALID_INPUT
          );
        }

        const creationOptions: PublicKeyCredentialCreationOptionsJSON =
          await startResponse.json();

        // Step 2: Create credential using WebAuthn browser API
        let credential: RegistrationResponseJSON;
        try {
          credential = await startRegistration({
            optionsJSON: creationOptions,
          });
        } catch (browserError) {
          // Handle common browser errors
          if (browserError instanceof Error) {
            if (browserError.name === "NotAllowedError") {
              throw new PasskeyError(
                "User cancelled passkey creation or operation timed out",
                ErrorCodes.VERIFICATION_FAILED,
                browserError
              );
            }
            if (browserError.name === "InvalidStateError") {
              throw new PasskeyError(
                "Authenticator is already registered",
                ErrorCodes.INVALID_INPUT,
                browserError
              );
            }
            if (browserError.name === "NotSupportedError") {
              throw new PasskeyError(
                "Passkeys are not supported on this device/browser",
                ErrorCodes.INVALID_INPUT,
                browserError
              );
            }
          }
          throw new PasskeyError(
            "Failed to create passkey",
            ErrorCodes.VERIFICATION_FAILED,
            browserError
          );
        }

        // Step 3: Finish registration flow
        const finishResponse = await fetch(config.endpoints.registerFinish, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ userId, credential }),
        });

        if (!finishResponse.ok) {
          const errorData = await finishResponse.json();
          throw new PasskeyError(
            errorData.error || "Failed to finish registration",
            ErrorCodes.VERIFICATION_FAILED
          );
        }

        const result = await finishResponse.json();
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof PasskeyError ? err.message : "Registration failed";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [config.endpoints]
  );

  return {
    register,
    loading,
    error,
  };
}
