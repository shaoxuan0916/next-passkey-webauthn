import type {
  PasskeyDeviceInfo,
  AuthenticatorAttachment,
} from "../types/index";

/**
 * Detect device information from user agent and other browser APIs
 * This runs on the client side to gather device context
 */
export function detectDeviceInfo(userAgent?: string): PasskeyDeviceInfo {
  if (typeof window === "undefined") {
    // Server-side, return minimal info
    return {};
  }

  const ua = userAgent || navigator.userAgent;
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
 * Generate a user-friendly name for a passkey based on device info
 */
export function generatePasskeyNickname(
  deviceInfo: PasskeyDeviceInfo,
  authenticatorAttachment?: AuthenticatorAttachment
): string {
  const { deviceType, os, browser } = deviceInfo;

  if (authenticatorAttachment === "platform") {
    // Platform authenticators (built-in)
    if (os === "iOS" || os === "iPadOS") {
      return deviceType === "iPad"
        ? "iPad Touch ID/Face ID"
        : "iPhone Touch ID/Face ID";
    } else if (os === "macOS") {
      return "Mac Touch ID";
    } else if (os === "Windows") {
      return "Windows Hello";
    } else if (os === "Android") {
      return "Android Biometric";
    }
  }

  // Cross-platform authenticators (external)
  if (authenticatorAttachment === "cross-platform") {
    return "Security Key";
  }

  // Fallback to device + browser
  if (deviceType && browser) {
    return `${deviceType} (${browser})`;
  } else if (deviceType) {
    return deviceType;
  } else if (os) {
    return `${os} Device`;
  }

  return "Unknown Device";
}

/**
 * Get a user-friendly icon/emoji for a passkey type
 */
export function getPasskeyIcon(credential: {
  authenticatorAttachment?: AuthenticatorAttachment;
  deviceInfo?: PasskeyDeviceInfo;
  transports?: string[];
}): string {
  const { authenticatorAttachment, deviceInfo, transports } = credential;

  // Platform authenticators
  if (authenticatorAttachment === "platform") {
    if (deviceInfo?.os === "iOS" || deviceInfo?.os === "iPadOS") {
      return "📱"; // iPhone/iPad
    } else if (deviceInfo?.os === "macOS") {
      return "💻"; // Mac
    } else if (deviceInfo?.os === "Windows") {
      return "🖥️"; // Windows PC
    } else if (deviceInfo?.os === "Android") {
      return "📱"; // Android
    }
  }

  // Cross-platform authenticators
  if (authenticatorAttachment === "cross-platform") {
    if (transports?.includes("usb")) {
      return "🔑"; // USB Security Key
    } else if (transports?.includes("nfc")) {
      return "📡"; // NFC Key
    } else if (transports?.includes("bluetooth")) {
      return "📶"; // Bluetooth Key
    }
    return "🔐"; // Generic security key
  }

  // Fallback
  return "🔒";
}

/**
 * Check if two passkeys are from the same authenticator
 * This helps prevent duplicate registrations from the same device
 */
export function isSameAuthenticator(
  credential1: {
    authenticatorAttachment?: AuthenticatorAttachment;
    deviceInfo?: PasskeyDeviceInfo;
    transports?: string[];
  },
  credential2: {
    authenticatorAttachment?: AuthenticatorAttachment;
    deviceInfo?: PasskeyDeviceInfo;
    transports?: string[];
  }
): boolean {
  // Different attachment types are definitely different authenticators
  if (
    credential1.authenticatorAttachment !== credential2.authenticatorAttachment
  ) {
    return false;
  }

  // For platform authenticators, compare device info
  if (credential1.authenticatorAttachment === "platform") {
    const device1 = credential1.deviceInfo;
    const device2 = credential2.deviceInfo;

    if (!device1 || !device2) return false;

    // Same device type and OS likely means same authenticator
    return (
      device1.deviceType === device2.deviceType && device1.os === device2.os
    );
  }

  // For cross-platform authenticators, it's harder to determine
  // We could compare transports, but multiple keys could have same transports
  return false;
}
