import {
  ErrorCodes,
  PasskeyError
} from "./chunk-VXYRGCBZ.js";

// src/client/useRegisterPasskey.ts
import {
  startRegistration
} from "@simplewebauthn/browser";
import { useCallback, useState } from "react";
function useRegisterPasskey(config) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const register = useCallback(
    async (userId, options) => {
      setLoading(true);
      setError(null);
      try {
        const startResponse = await fetch(config.endpoints.registerStart, {
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
          body: JSON.stringify({ userId, credential })
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
    async (credentialId) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(config.endpoints.deletePasskey, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify({ credentialId })
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

export {
  useRegisterPasskey,
  useAuthenticatePasskey,
  useManagePasskeys
};
//# sourceMappingURL=chunk-2NKIVCIT.js.map