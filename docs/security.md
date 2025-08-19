# Security Guide

This guide covers security considerations and best practices for using next-passkey in production.

## WebAuthn Security Fundamentals

### How Passkeys Work

Passkeys use public-key cryptography:

1. **Registration**: Device creates a key pair, stores private key securely, sends public key to server
2. **Authentication**: Device signs a challenge with private key, server verifies with public key
3. **Private keys never leave the device** - unlike passwords, they can't be intercepted or stolen

### Security Benefits

- **Phishing Resistant** - Cryptographic origin binding prevents use on wrong sites
- **No Shared Secrets** - Server only stores public keys, not sensitive credentials
- **Replay Attack Protection** - Each authentication uses unique signatures and counters
- **Device Bound** - Private keys are tied to specific authenticators/devices

## Production Security Checklist

### ✅ Essential Requirements

#### 1. HTTPS Everywhere
```typescript
// ❌ Never use HTTP in production
rpConfig: {
  rpID: "localhost", // Only for development
  expectedOrigin: ["http://localhost:3000"]
}

// ✅ Always use HTTPS in production
rpConfig: {
  rpID: "yourdomain.com",
  expectedOrigin: ["https://yourdomain.com"]
}
```

#### 2. Correct Domain Configuration
```typescript
// ✅ Match your actual domain exactly
rpConfig: {
  rpID: "yourdomain.com", // Must match your domain
  rpName: "Your App Name",
  expectedOrigin: [
    "https://yourdomain.com",
    "https://www.yourdomain.com" // Include www if used
  ]
}
```

#### 3. Secure Challenge Storage
```typescript
// ❌ Never use MemoryStore in production
const store = new MemoryStore(); // Development only!

// ✅ Use Redis or Database store
const store = new RedisStore(redis, 300); // 5-minute TTL
// or
const store = new DbStore(db);
```

#### 4. Short Challenge TTL
```typescript
// ✅ Keep challenges short-lived
const registrationOptions = {
  timeout: 300000 // 5 minutes maximum
};

// ✅ Configure store TTL
const store = new RedisStore(redis, 300); // 5 minutes in seconds
```

### 🔒 Advanced Security

#### 1. User Verification Requirements
```typescript
// For sensitive operations, require user verification
const authOptions = {
  userVerification: "required" // Forces biometric/PIN
};

await startAuthentication(userId, serverConfig, authOptions);
```

#### 2. Authenticator Attachment
```typescript
// Prefer platform authenticators for better UX
const registrationOptions = await generateRegistrationOptions({
  // ... other options
  authenticatorSelection: {
    authenticatorAttachment: "platform", // Built-in authenticators
    residentKey: "preferred",
    userVerification: "preferred"
  }
});
```

#### 3. Rate Limiting
```typescript
// Implement rate limiting on API routes
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: "Too many attempts, please try again later"
});

// Apply to passkey endpoints
export async function POST(request: Request) {
  // Apply rate limiting logic
  const result = await startRegistration(userId, config);
  return Response.json(result);
}
```

## Database Security

### Credential Storage

#### 1. Proper Indexing
```sql
-- Required indexes for security and performance
CREATE INDEX idx_passkeys_user_id ON passkeys(user_id);
CREATE UNIQUE INDEX idx_passkeys_credential_id ON passkeys(credential_id);
```

#### 2. Data Encryption at Rest
```typescript
// Ensure your database encrypts data at rest
// Most cloud providers (AWS RDS, Google Cloud SQL, etc.) support this
```

#### 3. Row Level Security (RLS)
```sql
-- Supabase/PostgreSQL RLS example
ALTER TABLE passkeys ENABLE ROW LEVEL SECURITY;

-- Users can only access their own passkeys
CREATE POLICY "Users own passkeys" ON passkeys
  FOR ALL USING (auth.uid()::text = user_id);
```

### Challenge Storage Security

#### 1. Redis Security
```typescript
// Use Redis AUTH and TLS
const redis = createClient({
  url: "rediss://username:password@host:port", // Use rediss:// for TLS
  socket: {
    tls: true,
    rejectUnauthorized: true
  }
});
```

#### 2. Database Challenge Cleanup
```typescript
// Regularly clean up expired challenges
setInterval(async () => {
  await store.cleanupExpired();
}, 5 * 60 * 1000); // Every 5 minutes
```

## API Security

### Input Validation

#### 1. Validate All Inputs
```typescript
import { z } from "zod";

const registrationSchema = z.object({
  userId: z.string().min(1).max(255),
  userDisplayName: z.string().max(255).optional(),
  timeout: z.number().min(30000).max(600000).optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, ...options } = registrationSchema.parse(body);
    
    const result = await startRegistration(userId, config, options);
    return Response.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }
    throw error;
  }
}
```

#### 2. Sanitize User IDs
```typescript
// Ensure user IDs are properly formatted
function sanitizeUserId(userId: string): string {
  // Remove any potentially dangerous characters
  return userId.replace(/[^a-zA-Z0-9@._-]/g, '');
}

// Validate user exists and belongs to current session
async function validateUserAccess(userId: string, sessionUserId: string) {
  if (userId !== sessionUserId) {
    throw new Error("Unauthorized access");
  }
}
```

### Error Handling

#### 1. Don't Leak Sensitive Information
```typescript
// ❌ Don't expose internal errors
catch (error) {
  return Response.json({ error: error.message }, { status: 500 });
}

// ✅ Use generic error messages
catch (error) {
  console.error("Internal error:", error); // Log internally
  return Response.json({ error: "Authentication failed" }, { status: 400 });
}
```

#### 2. Structured Error Responses
```typescript
// ✅ Consistent error format
function createErrorResponse(message: string, code?: string) {
  return Response.json({
    error: message,
    code: code || "UNKNOWN_ERROR",
    timestamp: new Date().toISOString()
  }, { status: 400 });
}
```

## Session Management

### Integration with Authentication

#### 1. Secure Session Creation
```typescript
// After successful passkey authentication
const result = await finishAuthentication(userId, credential, config);

if (result.verified) {
  // Create secure session
  const session = await createSecureSession({
    userId: result.credential.userId,
    credentialId: result.credential.credentialId,
    authenticatedAt: new Date().toISOString(),
    authMethod: "passkey"
  });
  
  // Set secure cookie
  cookies().set("session", session.token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 24 * 60 * 60 // 24 hours
  });
}
```

#### 2. Session Validation
```typescript
// Validate sessions on protected routes
async function validateSession(request: Request) {
  const sessionToken = request.headers.get("authorization")?.replace("Bearer ", "");
  
  if (!sessionToken) {
    throw new Error("No session token");
  }
  
  const session = await verifySessionToken(sessionToken);
  if (!session || session.expiresAt < new Date()) {
    throw new Error("Invalid or expired session");
  }
  
  return session;
}
```

### Multi-Factor Authentication

#### 1. Step-Up Authentication
```typescript
// Require additional verification for sensitive operations
async function requireStepUpAuth(userId: string) {
  // Force fresh passkey authentication for sensitive operations
  const authOptions = {
    userVerification: "required",
    timeout: 120000 // 2 minutes for sensitive ops
  };
  
  return await startAuthentication(userId, config, authOptions);
}
```

## Monitoring and Logging

### Security Event Logging

#### 1. Log Important Events
```typescript
// Log all authentication attempts
function logSecurityEvent(event: string, userId: string, details?: any) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event,
    userId,
    ip: request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
    details
  }));
}

// Usage
await logSecurityEvent("passkey_registration_start", userId);
await logSecurityEvent("passkey_auth_success", userId, { credentialId });
await logSecurityEvent("passkey_auth_failure", userId, { reason: error.code });
```

#### 2. Monitor Suspicious Activity
```typescript
// Track failed attempts
const failedAttempts = new Map<string, number>();

function checkRateLimit(userId: string): boolean {
  const attempts = failedAttempts.get(userId) || 0;
  if (attempts >= 5) {
    logSecurityEvent("rate_limit_exceeded", userId);
    return false;
  }
  return true;
}

function recordFailedAttempt(userId: string) {
  const current = failedAttempts.get(userId) || 0;
  failedAttempts.set(userId, current + 1);
  
  // Reset after 15 minutes
  setTimeout(() => {
    failedAttempts.delete(userId);
  }, 15 * 60 * 1000);
}
```

### Health Monitoring

#### 1. Monitor Challenge Store Health
```typescript
// Monitor Redis/Database connectivity
async function healthCheck() {
  try {
    // Test challenge store
    await store.set({
      id: "health-check",
      userId: "system",
      flow: "registration",
      challenge: "test",
      expiresAt: Date.now() + 60000
    });
    
    await store.delete("system", "registration");
    return { status: "healthy" };
  } catch (error) {
    return { status: "unhealthy", error: error.message };
  }
}
```

## Incident Response

### Security Incident Procedures

#### 1. Credential Compromise Response
```typescript
// If a user reports credential compromise
async function revokeUserPasskeys(userId: string) {
  try {
    // List all user passkeys
    const passkeys = await listUserPasskeys(userId, config);
    
    // Delete all passkeys
    for (const passkey of passkeys) {
      await deletePasskey(userId, passkey.credentialId, config);
    }
    
    // Log the incident
    logSecurityEvent("all_passkeys_revoked", userId, {
      reason: "security_incident",
      count: passkeys.length
    });
    
    // Invalidate all sessions for this user
    await invalidateAllUserSessions(userId);
    
  } catch (error) {
    logSecurityEvent("passkey_revocation_failed", userId, { error: error.message });
    throw error;
  }
}
```

#### 2. System-Wide Security Response
```typescript
// Emergency procedures for system-wide issues
async function emergencyLockdown() {
  // Temporarily disable new registrations
  process.env.PASSKEY_REGISTRATION_DISABLED = "true";
  
  // Increase challenge TTL restrictions
  process.env.PASSKEY_MAX_TTL = "120000"; // 2 minutes
  
  // Log the lockdown
  logSecurityEvent("emergency_lockdown", "system");
}
```

## Compliance Considerations

### GDPR/Privacy

#### 1. Data Minimization
```typescript
// Only store necessary data
type StoredCredential = {
  id: string;
  userId: string; // Link to user, don't duplicate user data
  credentialId: string; // Required for WebAuthn
  publicKey: string; // Required for WebAuthn
  counter: number; // Required for security
  transports?: string[]; // Optional, improves UX
  createdAt: string; // For auditing
  // Don't store: device info, location, etc.
};
```

#### 2. Data Deletion
```typescript
// Implement right to be forgotten
async function deleteAllUserData(userId: string) {
  // Delete all passkeys
  const passkeys = await listUserPasskeys(userId, config);
  for (const passkey of passkeys) {
    await deletePasskey(userId, passkey.credentialId, config);
  }
  
  // Clean up any remaining challenges
  await store.delete(userId, "registration");
  await store.delete(userId, "authentication");
  
  logSecurityEvent("user_data_deleted", userId);
}
```

### SOC 2 / Security Audits

#### 1. Audit Trail
```typescript
// Maintain comprehensive audit logs
interface AuditEvent {
  timestamp: string;
  eventType: string;
  userId: string;
  credentialId?: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  errorCode?: string;
}

function createAuditEvent(data: Partial<AuditEvent>): AuditEvent {
  return {
    timestamp: new Date().toISOString(),
    eventType: data.eventType!,
    userId: data.userId!,
    credentialId: data.credentialId,
    ipAddress: data.ipAddress!,
    userAgent: data.userAgent!,
    success: data.success!,
    errorCode: data.errorCode
  };
}
```

## Security Testing

### Penetration Testing Checklist

- [ ] Test HTTPS enforcement
- [ ] Verify origin validation
- [ ] Test challenge replay attacks
- [ ] Verify rate limiting
- [ ] Test input validation
- [ ] Check for information disclosure
- [ ] Verify session management
- [ ] Test error handling

### Automated Security Testing

```typescript
// Example security test
describe("Passkey Security", () => {
  test("rejects requests from wrong origin", async () => {
    const response = await fetch("/api/passkey/register/start", {
      method: "POST",
      headers: {
        "Origin": "https://evil-site.com",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ userId: "test" })
    });
    
    expect(response.status).toBe(400);
  });
  
  test("enforces challenge TTL", async () => {
    // Start registration
    const startResponse = await startRegistration("test-user", config);
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    // Try to finish with expired challenge
    const finishResponse = await finishRegistration("test-user", mockCredential, config);
    expect(finishResponse.verified).toBe(false);
  });
});
```

## Summary

Security is paramount when implementing passkey authentication. Follow these guidelines:

1. **Always use HTTPS in production**
2. **Configure domains correctly**
3. **Use secure challenge storage**
4. **Implement proper rate limiting**
5. **Validate all inputs**
6. **Monitor and log security events**
7. **Have incident response procedures**
8. **Regular security testing**

Remember: Passkeys are inherently more secure than passwords, but proper implementation is crucial to maintain that security advantage.
