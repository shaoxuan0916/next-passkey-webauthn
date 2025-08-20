/**
 * Client-side React hooks for passkey operations
 */

export { useRegisterPasskey } from "./useRegisterPasskey";
export { useAuthenticatePasskey } from "./useAuthenticatePasskey";
export { useManagePasskeys } from "./useManagePasskeys";

// Utilities for device detection and passkey metadata
export {
  detectDeviceInfo,
  generatePasskeyNickname,
  getPasskeyIcon,
  isSameAuthenticator,
} from "../utils/device-detection";
