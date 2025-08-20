import { useCallback, useState } from "react";
import {
  type ClientConfig,
  ErrorCodes,
  type ManagePasskeysHook,
  PasskeyError,
  type StoredCredential,
} from "../types/index";

/**
 * React hook for managing passkeys (list, remove)
 */
export function useManagePasskeys(config: ClientConfig): ManagePasskeysHook {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = useCallback(
    async (userId: string): Promise<StoredCredential[]> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(config.endpoints.listPasskeys, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ userId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new PasskeyError(
            errorData.error || "Failed to list passkeys",
            ErrorCodes.STORAGE_ERROR
          );
        }

        const passkeys: StoredCredential[] = await response.json();
        return passkeys;
      } catch (err) {
        const errorMessage =
          err instanceof PasskeyError ? err.message : "Failed to list passkeys";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [config.endpoints]
  );

  const remove = useCallback(
    async (userId: string, credentialId: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(config.endpoints.deletePasskey, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ userId, credentialId }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new PasskeyError(
            errorData.error || "Failed to delete passkey",
            ErrorCodes.STORAGE_ERROR
          );
        }
      } catch (err) {
        const errorMessage =
          err instanceof PasskeyError
            ? err.message
            : "Failed to delete passkey";
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
    error,
  };
}
