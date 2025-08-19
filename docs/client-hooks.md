# Client Hooks

This guide covers the React hooks provided by next-passkey for client-side passkey operations.

## Overview

next-passkey provides three main React hooks:

- **`useRegisterPasskey`** - Register new passkeys
- **`useAuthenticatePasskey`** - Authenticate with existing passkeys  
- **`useManagePasskeys`** - List and delete passkeys

All hooks handle loading states, error handling, and browser WebAuthn API integration automatically.

## Configuration

All hooks require a configuration object with API endpoints:

```typescript
const endpoints = {
  registerStart: "/api/passkey/register/start",
  registerFinish: "/api/passkey/register/finish",
  authenticateStart: "/api/passkey/authenticate/start",
  authenticateFinish: "/api/passkey/authenticate/finish",
  deletePasskey: "/api/passkey/delete",
  listPasskeys: "/api/passkey/list",
};
```

## useRegisterPasskey

### Basic Usage

```tsx
import { useRegisterPasskey } from "next-passkey-webauthn/client";

function RegisterButton({ userId }: { userId: string }) {
  const { register, loading, error } = useRegisterPasskey({ endpoints });

  const handleRegister = async () => {
    try {
      const result = await register(userId);
      if (result.verified) {
        console.log("Success!", result.credential);
      }
    } catch (err) {
      console.error("Failed:", err);
    }
  };

  return (
    <button onClick={handleRegister} disabled={loading}>
      {loading ? "Registering..." : "Register Passkey"}
    </button>
  );
}
```

### With Options

```tsx
const handleRegister = async () => {
  const result = await register(userId, {
    userDisplayName: "John Doe",
    userName: "john@example.com",
    timeout: 300000 // 5 minutes
  });
};
```

### Complete Component

```tsx
import { useRegisterPasskey } from "next-passkey-webauthn/client";
import { useState } from "react";

function PasskeyRegistration({ userId, userDisplayName }: {
  userId: string;
  userDisplayName: string;
}) {
  const [success, setSuccess] = useState(false);
  const { register, loading, error } = useRegisterPasskey({ endpoints });

  const handleRegister = async () => {
    try {
      const result = await register(userId, {
        userDisplayName,
        userName: userId,
      });

      if (result.verified) {
        setSuccess(true);
        // Optionally redirect or update UI
      }
    } catch (err) {
      // Error is already stored in the error state
      console.error("Registration failed:", err);
    }
  };

  if (success) {
    return (
      <div className="success-message">
        ✅ Passkey registered successfully!
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleRegister}
        disabled={loading}
        className="register-btn"
      >
        {loading ? "Creating passkey..." : "Register Passkey"}
      </button>
      
      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}
    </div>
  );
}
```

## useAuthenticatePasskey

### Basic Usage

```tsx
import { useAuthenticatePasskey } from "next-passkey-webauthn/client";

function LoginButton({ userId }: { userId: string }) {
  const { authenticate, loading, error } = useAuthenticatePasskey({ endpoints });

  const handleLogin = async () => {
    try {
      const result = await authenticate(userId);
      if (result.verified) {
        // Handle successful authentication
        window.location.href = "/dashboard";
      }
    } catch (err) {
      console.error("Authentication failed:", err);
    }
  };

  return (
    <button onClick={handleLogin} disabled={loading}>
      {loading ? "Signing in..." : "Sign in with Passkey"}
    </button>
  );
}
```

### With Options

```tsx
const handleLogin = async () => {
  const result = await authenticate(userId, {
    timeout: 180000, // 3 minutes
    userVerification: "required" // Require biometric/PIN
  });
};
```

### Complete Login Flow

```tsx
import { useAuthenticatePasskey } from "next-passkey-webauthn/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

function PasskeyLogin({ userId }: { userId: string }) {
  const router = useRouter();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const { authenticate, loading, error } = useAuthenticatePasskey({ endpoints });

  const handleLogin = async () => {
    setIsAuthenticating(true);
    
    try {
      const result = await authenticate(userId);

      if (result.verified) {
        // Create session or JWT token here
        await createUserSession(result.credential);
        router.push("/dashboard");
      } else {
        console.error("Authentication failed");
      }
    } catch (err) {
      console.error("Login error:", err);
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="login-container">
      <button
        onClick={handleLogin}
        disabled={loading || isAuthenticating}
        className="login-btn"
      >
        {loading || isAuthenticating ? (
          <span>🔐 Authenticating...</span>
        ) : (
          <span>🔑 Sign in with Passkey</span>
        )}
      </button>

      {error && (
        <div className="error-message">
          ❌ Authentication failed: {error}
        </div>
      )}
    </div>
  );
}
```

## useManagePasskeys

### Basic Usage

```tsx
import { useManagePasskeys } from "next-passkey-webauthn/client";
import { useEffect, useState } from "react";

function PasskeyManager({ userId }: { userId: string }) {
  const [passkeys, setPasskeys] = useState<StoredCredential[]>([]);
  const { list, remove, loading, error } = useManagePasskeys({ endpoints });

  useEffect(() => {
    loadPasskeys();
  }, [userId]);

  const loadPasskeys = async () => {
    try {
      const userPasskeys = await list(userId);
      setPasskeys(userPasskeys);
    } catch (err) {
      console.error("Failed to load passkeys:", err);
    }
  };

  const handleDelete = async (credentialId: string) => {
    if (confirm("Are you sure you want to delete this passkey?")) {
      try {
        await remove(credentialId);
        await loadPasskeys(); // Refresh the list
      } catch (err) {
        console.error("Failed to delete passkey:", err);
      }
    }
  };

  return (
    <div>
      <h3>Your Passkeys</h3>
      
      {loading && <p>Loading passkeys...</p>}
      {error && <p className="error">Error: {error}</p>}
      
      {passkeys.length === 0 ? (
        <p>No passkeys registered yet.</p>
      ) : (
        <div className="passkey-list">
          {passkeys.map((passkey) => (
            <div key={passkey.id} className="passkey-item">
              <div>
                <strong>Created:</strong> {new Date(passkey.createdAt).toLocaleDateString()}
              </div>
              <div>
                <strong>Last used:</strong> {passkey.updatedAt ? new Date(passkey.updatedAt).toLocaleDateString() : "Never"}
              </div>
              <button 
                onClick={() => handleDelete(passkey.credentialId)}
                className="delete-btn"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Advanced Management Component

```tsx
import { useManagePasskeys, useRegisterPasskey } from "next-passkey-webauthn/client";
import { useEffect, useState } from "react";
import type { StoredCredential } from "next-passkey-webauthn/types";

interface Props {
  userId: string;
  userDisplayName: string;
}

function AdvancedPasskeyManager({ userId, userDisplayName }: Props) {
  const [passkeys, setPasskeys] = useState<StoredCredential[]>([]);
  const [showRegister, setShowRegister] = useState(false);
  
  const { list, remove, loading: manageLoading, error: manageError } = useManagePasskeys({ endpoints });
  const { register, loading: registerLoading, error: registerError } = useRegisterPasskey({ endpoints });

  useEffect(() => {
    loadPasskeys();
  }, [userId]);

  const loadPasskeys = async () => {
    try {
      const userPasskeys = await list(userId);
      setPasskeys(userPasskeys);
    } catch (err) {
      console.error("Failed to load passkeys:", err);
    }
  };

  const handleRegister = async () => {
    try {
      const result = await register(userId, {
        userDisplayName,
        userName: userId,
      });

      if (result.verified) {
        setShowRegister(false);
        await loadPasskeys(); // Refresh the list
      }
    } catch (err) {
      console.error("Registration failed:", err);
    }
  };

  const handleDelete = async (credentialId: string, createdAt: string) => {
    const createdDate = new Date(createdAt).toLocaleDateString();
    
    if (confirm(`Delete passkey created on ${createdDate}?`)) {
      try {
        await remove(credentialId);
        await loadPasskeys();
      } catch (err) {
        console.error("Failed to delete passkey:", err);
      }
    }
  };

  const formatTransports = (transports?: string[]) => {
    if (!transports || transports.length === 0) return "Unknown";
    return transports.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(", ");
  };

  return (
    <div className="passkey-manager">
      <div className="header">
        <h3>Passkey Management</h3>
        <button
          onClick={() => setShowRegister(!showRegister)}
          className="add-btn"
        >
          {showRegister ? "Cancel" : "Add Passkey"}
        </button>
      </div>

      {showRegister && (
        <div className="register-section">
          <p>Add a new passkey to your account</p>
          <button
            onClick={handleRegister}
            disabled={registerLoading}
            className="register-btn"
          >
            {registerLoading ? "Creating..." : "Create Passkey"}
          </button>
          {registerError && (
            <div className="error">❌ {registerError}</div>
          )}
        </div>
      )}

      {manageLoading && <div className="loading">Loading passkeys...</div>}
      {manageError && <div className="error">❌ {manageError}</div>}

      {passkeys.length === 0 ? (
        <div className="empty-state">
          <p>No passkeys found. Add your first passkey to get started!</p>
        </div>
      ) : (
        <div className="passkey-grid">
          {passkeys.map((passkey, index) => (
            <div key={passkey.id} className="passkey-card">
              <div className="card-header">
                <h4>Passkey #{index + 1}</h4>
                <button
                  onClick={() => handleDelete(passkey.credentialId, passkey.createdAt)}
                  className="delete-btn"
                  title="Delete this passkey"
                >
                  🗑️
                </button>
              </div>
              
              <div className="card-details">
                <div className="detail">
                  <span className="label">Created:</span>
                  <span className="value">
                    {new Date(passkey.createdAt).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="detail">
                  <span className="label">Transport:</span>
                  <span className="value">
                    {formatTransports(passkey.transports)}
                  </span>
                </div>
                
                <div className="detail">
                  <span className="label">Uses:</span>
                  <span className="value">{passkey.counter}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Error Handling

### Common Error Types

The hooks automatically handle these browser errors and convert them to user-friendly messages:

- **NotAllowedError** - User cancelled or operation timed out
- **InvalidStateError** - Authenticator already registered or not available
- **NotSupportedError** - Passkeys not supported on this device/browser

### Custom Error Handling

```tsx
import { PasskeyError, ErrorCodes } from "next-passkey-webauthn/types";

const { register } = useRegisterPasskey({ endpoints });

const handleRegister = async () => {
  try {
    await register(userId);
  } catch (error) {
    if (error instanceof PasskeyError) {
      switch (error.code) {
        case ErrorCodes.CHALLENGE_EXPIRED:
          alert("Registration took too long. Please try again.");
          break;
        case ErrorCodes.CREDENTIAL_NOT_FOUND:
          alert("No passkeys found for this user.");
          break;
        default:
          alert(`Registration failed: ${error.message}`);
      }
    } else {
      alert("An unexpected error occurred.");
    }
  }
};
```

## Loading States

### Global Loading State

```tsx
function PasskeyActions({ userId }: { userId: string }) {
  const { register, loading: registerLoading } = useRegisterPasskey({ endpoints });
  const { authenticate, loading: authLoading } = useAuthenticatePasskey({ endpoints });
  
  const isLoading = registerLoading || authLoading;

  return (
    <div>
      {isLoading && <div className="global-loader">Processing...</div>}
      
      <button onClick={() => register(userId)} disabled={isLoading}>
        Register
      </button>
      <button onClick={() => authenticate(userId)} disabled={isLoading}>
        Authenticate
      </button>
    </div>
  );
}
```

### Individual Loading States

```tsx
function PasskeyButtons({ userId }: { userId: string }) {
  const { register, loading: registerLoading } = useRegisterPasskey({ endpoints });
  const { authenticate, loading: authLoading } = useAuthenticatePasskey({ endpoints });

  return (
    <div className="button-group">
      <button 
        onClick={() => register(userId)} 
        disabled={registerLoading}
        className={registerLoading ? "loading" : ""}
      >
        {registerLoading ? "🔄 Registering..." : "📝 Register"}
      </button>
      
      <button 
        onClick={() => authenticate(userId)} 
        disabled={authLoading}
        className={authLoading ? "loading" : ""}
      >
        {authLoading ? "🔄 Authenticating..." : "🔐 Sign In"}
      </button>
    </div>
  );
}
```

## Best Practices

### 1. User Feedback

Always provide clear feedback during WebAuthn operations:

```tsx
const [status, setStatus] = useState("");

const handleRegister = async () => {
  setStatus("Touch your authenticator...");
  
  try {
    await register(userId);
    setStatus("✅ Passkey created successfully!");
  } catch (error) {
    setStatus("❌ Registration failed. Please try again.");
  }
};
```

### 2. Graceful Degradation

Check for WebAuthn support before showing passkey options:

```tsx
import { useEffect, useState } from "react";

function PasskeyComponent() {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(
      typeof window !== "undefined" && 
      "credentials" in navigator &&
      "create" in navigator.credentials
    );
  }, []);

  if (!isSupported) {
    return (
      <div className="not-supported">
        Passkeys are not supported on this device.
        <a href="/login">Use traditional login instead</a>
      </div>
    );
  }

  return <PasskeyAuth userId={userId} />;
}
```

### 3. Retry Logic

Implement retry logic for failed operations:

```tsx
const [retryCount, setRetryCount] = useState(0);
const maxRetries = 3;

const handleAuthenticateWithRetry = async () => {
  try {
    await authenticate(userId);
    setRetryCount(0); // Reset on success
  } catch (error) {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      setTimeout(() => handleAuthenticateWithRetry(), 1000);
    } else {
      // Max retries reached
      alert("Authentication failed after multiple attempts.");
    }
  }
};
```

### 4. Session Integration

Integrate with your session management:

```tsx
import { useSession } from "your-session-library";

function PasskeyAuth() {
  const { setSession } = useSession();
  const { authenticate } = useAuthenticatePasskey({ endpoints });

  const handleLogin = async () => {
    try {
      const result = await authenticate(userId);
      
      if (result.verified) {
        // Create session with credential info
        await setSession({
          userId: result.credential.userId,
          credentialId: result.credential.credentialId,
          authenticatedAt: new Date().toISOString(),
        });
        
        // Redirect to protected area
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  return <button onClick={handleLogin}>Sign In</button>;
}
```

## TypeScript Support

All hooks are fully typed. Import types for better development experience:

```tsx
import type { 
  StoredCredential, 
  RegistrationStartOptions,
  AuthenticationStartOptions 
} from "next-passkey-webauthn/types";

interface Props {
  userId: string;
  onSuccess: (credential: StoredCredential) => void;
  registrationOptions?: RegistrationStartOptions;
}

function TypedPasskeyAuth({ userId, onSuccess, registrationOptions }: Props) {
  // TypeScript will provide full autocompletion and type checking
  const { register } = useRegisterPasskey({ endpoints });

  const handleRegister = async () => {
    const result = await register(userId, registrationOptions);
    if (result.verified && result.credential) {
      onSuccess(result.credential);
    }
  };

  return <button onClick={handleRegister}>Register</button>;
}
```
