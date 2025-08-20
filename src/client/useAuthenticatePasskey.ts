import {
  type AuthenticationResponseJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  startAuthentication,
} from "@simplewebauthn/browser";
import { useCallback, useState } from "react";
import {
  type AuthenticatePasskeyHook,
  type AuthenticationStartOptions,
  type ClientConfig,
  ErrorCodes,
  PasskeyError,
  type StoredCredential,
} from "../types/index";

/**
 * React hook for passkey authentication
 */
export function useAuthenticatePasskey(
  config: ClientConfig
): AuthenticatePasskeyHook {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authenticate = useCallback(
    async (
      userId: string,
      options?: AuthenticationStartOptions
    ): Promise<{ verified: boolean; credential?: StoredCredential }> => {
      setLoading(true);
      setError(null);

      try {
        // Step 1: Start authentication flow
        const startResponse = await fetch(config.endpoints.authenticateStart, {
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
            errorData.error || "Failed to start authentication",
            ErrorCodes.INVALID_INPUT
          );
        }

        const requestOptions: PublicKeyCredentialRequestOptionsJSON =
          await startResponse.json();

        // Step 2: Get credential using WebAuthn browser API
        let credential: AuthenticationResponseJSON;
        try {
          credential = await startAuthentication({
            optionsJSON: requestOptions,
          });
        } catch (browserError) {
          // Handle common browser errors
          if (browserError instanceof Error) {
            if (browserError.name === "NotAllowedError") {
              throw new PasskeyError(
                "User cancelled authentication or operation timed out",
                ErrorCodes.VERIFICATION_FAILED,
                browserError
              );
            }
            if (browserError.name === "InvalidStateError") {
              throw new PasskeyError(
                "Authenticator is not available",
                ErrorCodes.CREDENTIAL_NOT_FOUND,
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
            "Failed to authenticate with passkey",
            ErrorCodes.VERIFICATION_FAILED,
            browserError
          );
        }

        // Step 3: Finish authentication flow
        const finishResponse = await fetch(
          config.endpoints.authenticateFinish,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({ userId, credential }),
          }
        );

        if (!finishResponse.ok) {
          const errorData = await finishResponse.json();
          throw new PasskeyError(
            errorData.error || "Failed to finish authentication",
            ErrorCodes.VERIFICATION_FAILED
          );
        }

        const result = await finishResponse.json();
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof PasskeyError ? err.message : "Authentication failed";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [config.endpoints]
  );

  return {
    authenticate,
    loading,
    error,
  };
}
