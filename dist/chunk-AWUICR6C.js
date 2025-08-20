import {
  ErrorCodes,
  PasskeyError
} from "./chunk-HWVRT2MF.js";

// src/client/useRegisterPasskey.ts
import {
  startRegistration
} from "@simplewebauthn/browser";
import { useCallback, useState } from "react";
function detectDeviceInfo() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {};
  }
  const ua = navigator.userAgent;
  const deviceInfo = {};
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
function useRegisterPasskey(config) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const register = useCallback(
    async (userId, options) => {
      setLoading(true);
      setError(null);
      try {
        const deviceInfo = detectDeviceInfo();
        if (options?.nickname) {
          deviceInfo.nickname = options.nickname;
        }
        const startResponse = await fetch(config.endpoints.registerStart, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({
            userId,
            ...options,
            deviceInfo
          })
        });
        if (!startResponse.ok) {
          const errorData = await startResponse.json();
          throw new PasskeyError(
            errorData.error || "Failed to start registration",
            ErrorCodes.INVALID_INPUT
          );
        }
        const creationOptions = await startResponse.json();
        let credential;
        try {
          credential = await startRegistration({
            optionsJSON: creationOptions
          });
        } catch (browserError) {
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
        const finishResponse = await fetch(config.endpoints.registerFinish, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({
            userId,
            credential,
            deviceInfo,
            managementOptions: options?.managementOptions
          })
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
        const errorMessage = err instanceof PasskeyError ? err.message : "Registration failed";
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
    error
  };
}

// src/client/useAuthenticatePasskey.ts
import {
  startAuthentication
} from "@simplewebauthn/browser";
import { useCallback as useCallback2, useState as useState2 } from "react";
function useAuthenticatePasskey(config) {
  const [loading, setLoading] = useState2(false);
  const [error, setError] = useState2(null);
  const authenticate = useCallback2(
    async (userId, options) => {
      setLoading(true);
      setError(null);
      try {
        const startResponse = await fetch(config.endpoints.authenticateStart, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({ userId, ...options })
        });
        if (!startResponse.ok) {
          const errorData = await startResponse.json();
          throw new PasskeyError(
            errorData.error || "Failed to start authentication",
            ErrorCodes.INVALID_INPUT
          );
        }
        const requestOptions = await startResponse.json();
        let credential;
        try {
          credential = await startAuthentication({
            optionsJSON: requestOptions
          });
        } catch (browserError) {
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
        const finishResponse = await fetch(
          config.endpoints.authenticateFinish,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            credentials: "include",
            body: JSON.stringify({ userId, credential })
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
        const errorMessage = err instanceof PasskeyError ? err.message : "Authentication failed";
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
    error
  };
}

// src/client/useManagePasskeys.ts
import { useCallback as useCallback3, useState as useState3 } from "react";
function useManagePasskeys(config) {
  const [loading, setLoading] = useState3(false);
  const [error, setError] = useState3(null);
  const list = useCallback3(
    async (userId) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(config.endpoints.listPasskeys, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({ userId })
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new PasskeyError(
            errorData.error || "Failed to list passkeys",
            ErrorCodes.STORAGE_ERROR
          );
        }
        const passkeys = await response.json();
        return passkeys;
      } catch (err) {
        const errorMessage = err instanceof PasskeyError ? err.message : "Failed to list passkeys";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [config.endpoints]
  );
  const remove = useCallback3(
    async (userId, credentialId) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(config.endpoints.deletePasskey, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({ userId, credentialId })
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new PasskeyError(
            errorData.error || "Failed to delete passkey",
            ErrorCodes.STORAGE_ERROR
          );
        }
      } catch (err) {
        const errorMessage = err instanceof PasskeyError ? err.message : "Failed to delete passkey";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [config.endpoints]
  );
  return {
    list,
    remove,
    loading,
    error
  };
}

// src/utils/device-detection.ts
function detectDeviceInfo2(userAgent) {
  if (typeof window === "undefined") {
    return {};
  }
  const ua = userAgent || navigator.userAgent;
  const deviceInfo = {};
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
function generatePasskeyNickname(deviceInfo, authenticatorAttachment) {
  const { deviceType, os, browser } = deviceInfo;
  if (authenticatorAttachment === "platform") {
    if (os === "iOS" || os === "iPadOS") {
      return deviceType === "iPad" ? "iPad Touch ID/Face ID" : "iPhone Touch ID/Face ID";
    } else if (os === "macOS") {
      return "Mac Touch ID";
    } else if (os === "Windows") {
      return "Windows Hello";
    } else if (os === "Android") {
      return "Android Biometric";
    }
  }
  if (authenticatorAttachment === "cross-platform") {
    return "Security Key";
  }
  if (deviceType && browser) {
    return `${deviceType} (${browser})`;
  } else if (deviceType) {
    return deviceType;
  } else if (os) {
    return `${os} Device`;
  }
  return "Unknown Device";
}
function getPasskeyIcon(credential) {
  const { authenticatorAttachment, deviceInfo, transports } = credential;
  if (authenticatorAttachment === "platform") {
    if (deviceInfo?.os === "iOS" || deviceInfo?.os === "iPadOS") {
      return "\u{1F4F1}";
    } else if (deviceInfo?.os === "macOS") {
      return "\u{1F4BB}";
    } else if (deviceInfo?.os === "Windows") {
      return "\u{1F5A5}\uFE0F";
    } else if (deviceInfo?.os === "Android") {
      return "\u{1F4F1}";
    }
  }
  if (authenticatorAttachment === "cross-platform") {
    if (transports?.includes("usb")) {
      return "\u{1F511}";
    } else if (transports?.includes("nfc")) {
      return "\u{1F4E1}";
    } else if (transports?.includes("bluetooth")) {
      return "\u{1F4F6}";
    }
    return "\u{1F510}";
  }
  return "\u{1F512}";
}
function isSameAuthenticator(credential1, credential2) {
  if (credential1.authenticatorAttachment !== credential2.authenticatorAttachment) {
    return false;
  }
  if (credential1.authenticatorAttachment === "platform") {
    const device1 = credential1.deviceInfo;
    const device2 = credential2.deviceInfo;
    if (!device1 || !device2) return false;
    return device1.deviceType === device2.deviceType && device1.os === device2.os;
  }
  return false;
}

export {
  useRegisterPasskey,
  useAuthenticatePasskey,
  useManagePasskeys,
  detectDeviceInfo2 as detectDeviceInfo,
  generatePasskeyNickname,
  getPasskeyIcon,
  isSameAuthenticator
};
//# sourceMappingURL=chunk-AWUICR6C.js.map