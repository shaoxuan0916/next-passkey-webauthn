import {
  type PublicKeyCredentialCreationOptionsJSON,
  type RegistrationResponseJSON,
  startRegistration,
} from "@simplewebauthn/browser";
import { useCallback, useState } from "react";
import {
  type ClientConfig,
  ErrorCodes,
  type PasskeyDeviceInfo,
  type PasskeyManagementOptions,
  PasskeyError,
  type RegisterPasskeyHook,
  type RegistrationStartOptions,
  type StoredCredential,
} from "../types/index";

/**
 * Detect device information from user agent and browser APIs
 */
function detectDeviceInfo(): PasskeyDeviceInfo {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {};
  }

  const ua = navigator.userAgent;
  const deviceInfo: PasskeyDeviceInfo = {};

  // Detect OS
  if (/iPhone|iPad|iPod/i.test(ua)) {
    deviceInfo.os = /iPad/i.test(ua) ? "iPadOS" : "iOS";
    deviceInfo.deviceType = /iPad/i.test(ua) ? "iPad" : "iPhone";
  } else if (/Mac/i.test(ua) && !/iPhone|iPad|iPod/i.test(ua)) {
    deviceInfo.os = "macOS";
    deviceInfo.deviceType = "Mac";
  } else if (/Windows/i.test(ua)) {
    deviceInfo.os = "Windows";
    deviceInfo.deviceType = "Windows PC";
  } else if (/Android/i.test(ua)) {
    deviceInfo.os = "Android";
    deviceInfo.deviceType = "Android Device";
  } else if (/Linux/i.test(ua)) {
    deviceInfo.os = "Linux";
    deviceInfo.deviceType = "Linux PC";
  }

  // Detect browser
  if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) {
    deviceInfo.browser = "Chrome";
  } else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) {
    deviceInfo.browser = "Safari";
  } else if (/Firefox/i.test(ua)) {
    deviceInfo.browser = "Firefox";
  } else if (/Edge/i.test(ua)) {
    deviceInfo.browser = "Edge";
  }

  return deviceInfo;
}

/**
 * React hook for passkey registration
 */
export function useRegisterPasskey(config: ClientConfig): RegisterPasskeyHook {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = useCallback(
    async (
      userId: string,
      options?: RegistrationStartOptions & {
        managementOptions?: PasskeyManagementOptions;
        nickname?: string;
      }
    ): Promise<{ verified: boolean; credential?: StoredCredential }> => {
      setLoading(true);
      setError(null);

      try {
        // Detect device information
        const deviceInfo = detectDeviceInfo();
        if (options?.nickname) {
          deviceInfo.nickname = options.nickname;
        }

        // Step 1: Start registration flow with device info
        const startResponse = await fetch(config.endpoints.registerStart, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            userId,
            ...options,
            deviceInfo,
          }),
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

        // Step 3: Finish registration flow with device info
        const finishResponse = await fetch(config.endpoints.registerFinish, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            userId,
            credential,
            deviceInfo,
            managementOptions: options?.managementOptions,
          }),
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
