# Troubleshooting

Common issues and solutions when using next-passkey.

## Installation Issues

### Package Not Found

**Error:**
```
Module not found: Can't resolve 'next-passkey'
```

**Solutions:**
1. Ensure the package is installed:
   ```bash
   npm install next-passkey
   ```

2. Check your import paths:
   ```typescript
   // ✅ Correct
   import { startRegistration } from "next-passkey-webauthn/server";
   import { useRegisterPasskey } from "next-passkey-webauthn/client";
   
   // ❌ Incorrect
   import { startRegistration } from "next-passkey-webauthn";
   ```

### TypeScript Errors

**Error:**
```
Cannot find module 'next-passkey-webauthn/server' or its corresponding type declarations
```

**Solutions:**
1. Ensure TypeScript can find the types:
   ```bash
   npm install --save-dev @types/node
   ```

2. Check your `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "moduleResolution": "bundler", // or "node"
       "esModuleInterop": true,
       "allowSyntheticDefaultImports": true
     }
   }
   ```

## Database Issues

### Prisma Connection Errors

**Error:**
```
PrismaClientInitializationError: Can't reach database server
```

**Solutions:**
1. Check your database URL:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/database"
   ```

2. Ensure the database is running:
   ```bash
   # For PostgreSQL
   brew services start postgresql
   
   # For Docker
   docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password postgres
   ```

3. Test the connection:
   ```bash
   npx prisma db push
   ```

### Migration Issues

**Error:**
```
Migration failed: Table 'passkeys' already exists
```

**Solutions:**
1. Reset the database (development only):
   ```bash
   npx prisma migrate reset
   ```

2. Or create a new migration:
   ```bash
   npx prisma migrate dev --name fix-passkeys
   ```

### Supabase Connection Issues

**Error:**
```
Invalid API key or insufficient permissions
```

**Solutions:**
1. Check your environment variables:
   ```env
   NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
   SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```

2. Ensure you're using the **service role key** for server-side operations, not the anon key.

3. Check Row Level Security (RLS) policies:
   ```sql
   -- Disable RLS for testing (not recommended for production)
   ALTER TABLE passkeys DISABLE ROW LEVEL SECURITY;
   ```

## WebAuthn Browser Issues

### "Not Allowed" Error

**Error:**
```
NotAllowedError: The operation either timed out or was not allowed
```

**Common Causes:**
1. **User cancelled the operation**
2. **Operation timed out**
3. **Invalid origin**
4. **HTTPS required**

**Solutions:**
1. Check your RP configuration:
   ```typescript
   rpConfig: {
     rpID: "localhost", // Must match your domain
     expectedOrigin: ["http://localhost:3000"] // Must match your URL
   }
   ```

2. Ensure HTTPS in production:
   ```typescript
   rpConfig: {
     rpID: "yourdomain.com",
     expectedOrigin: ["https://yourdomain.com"]
   }
   ```

3. Increase timeout:
   ```typescript
   const options = await register(userId, {
     timeout: 300000 // 5 minutes
   });
   ```

### "Invalid State" Error

**Error:**
```
InvalidStateError: An attempt was made to use an object that is not, or is no longer, usable
```

**Common Causes:**
1. **Authenticator already registered**
2. **No authenticator available**

**Solutions:**
1. Check if passkey already exists:
   ```typescript
   const existingPasskeys = await listUserPasskeys(userId, config);
   if (existingPasskeys.length > 0) {
     console.log("User already has passkeys");
   }
   ```

2. Handle the error gracefully:
   ```typescript
   try {
     await register(userId);
   } catch (error) {
     if (error.name === "InvalidStateError") {
       alert("This authenticator is already registered or not available");
     }
   }
   ```

### "Not Supported" Error

**Error:**
```
NotSupportedError: The authenticator does not support the requested operation
```

**Solutions:**
1. Check browser support:
   ```typescript
   const isSupported = typeof window !== "undefined" && 
     "credentials" in navigator && 
     "create" in navigator.credentials;
   
   if (!isSupported) {
     console.log("WebAuthn not supported");
   }
   ```

2. Provide fallback authentication:
   ```tsx
   {isSupported ? (
     <PasskeyAuth userId={userId} />
   ) : (
     <TraditionalLogin />
   )}
   ```

## Server-Side Issues

### Challenge Not Found

**Error:**
```
PasskeyError: Challenge not found or expired
```

**Common Causes:**
1. **Challenge expired**
2. **Challenge store not working**
3. **Race condition**

**Solutions:**
1. Check challenge store configuration:
   ```typescript
   // Ensure store is properly initialized
   const store = new RedisStore(redis);
   
   // Test store connectivity
   await store.set({
     id: "test",
     userId: "test",
     flow: "registration",
     challenge: "test",
     expiresAt: Date.now() + 60000
   });
   ```

2. Increase challenge TTL:
   ```typescript
   const options = await startRegistration(userId, config, {
     timeout: 300000 // 5 minutes
   });
   ```

3. Check Redis connectivity:
   ```bash
   redis-cli ping
   ```

### Verification Failed

**Error:**
```
PasskeyError: Registration verification failed
```

**Common Causes:**
1. **Origin mismatch**
2. **RP ID mismatch**
3. **Invalid challenge**

**Solutions:**
1. Verify RP configuration matches your domain exactly:
   ```typescript
   rpConfig: {
     rpID: "localhost", // Must match window.location.hostname
     expectedOrigin: ["http://localhost:3000"] // Must match window.location.origin
   }
   ```

2. Check browser console for detailed errors.

3. Enable debug logging:
   ```typescript
   // Add logging to your API routes
   console.log("Expected origin:", config.rpConfig.expectedOrigin);
   console.log("Actual origin:", request.headers.get("origin"));
   ```

## Redis Issues

### Connection Refused

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solutions:**
1. Start Redis server:
   ```bash
   # macOS with Homebrew
   brew services start redis
   
   # Ubuntu/Debian
   sudo systemctl start redis-server
   
   # Docker
   docker run -d -p 6379:6379 redis:7-alpine
   ```

2. Check Redis URL:
   ```env
   REDIS_URL="redis://localhost:6379"
   ```

3. Test Redis connection:
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

### Authentication Failed

**Error:**
```
Error: AUTH failed
```

**Solutions:**
1. Check Redis password:
   ```env
   REDIS_URL="redis://username:password@localhost:6379"
   ```

2. Or configure Redis without password (development only):
   ```bash
   # In redis.conf
   # requirepass your-password
   ```

## React Hook Issues

### Hook Not Working

**Error:**
```
Error: Invalid hook call
```

**Solutions:**
1. Ensure you're using hooks inside React components:
   ```tsx
   // ✅ Correct - inside component
   function MyComponent() {
     const { register } = useRegisterPasskey({ endpoints });
     return <button onClick={() => register("user")}>Register</button>;
   }
   
   // ❌ Incorrect - outside component
   const { register } = useRegisterPasskey({ endpoints });
   ```

2. Check React version:
   ```bash
   npm ls react
   # Should be 16.8.0 or higher for hooks
   ```

### Endpoints Not Working

**Error:**
```
TypeError: Failed to fetch
```

**Solutions:**
1. Check API route paths:
   ```typescript
   const endpoints = {
     registerStart: "/api/passkey/register/start", // Must match your route
     registerFinish: "/api/passkey/register/finish",
     // ...
   };
   ```

2. Verify API routes are working:
   ```bash
   curl -X POST http://localhost:3000/api/passkey/register/start \
     -H "Content-Type: application/json" \
     -d '{"userId":"test"}'
   ```

3. Check CORS settings (if using different domains):
   ```typescript
   // In your API route
   export async function POST(request: Request) {
     // Add CORS headers if needed
     const response = Response.json(result);
     response.headers.set("Access-Control-Allow-Origin", "*");
     return response;
   }
   ```

## Build Issues

### Module Resolution

**Error:**
```
Module not found: Can't resolve 'next-passkey-webauthn/server'
```

**Solutions:**
1. Check your Next.js version (13+ recommended):
   ```bash
   npm ls next
   ```

2. Update your `next.config.js`:
   ```javascript
   /** @type {import('next').NextConfig} */
   const nextConfig = {
     experimental: {
       serverComponentsExternalPackages: ['next-passkey']
     }
   };
   
   module.exports = nextConfig;
   ```

3. Try clearing build cache:
   ```bash
   rm -rf .next
   npm run build
   ```

### TypeScript Build Errors

**Error:**
```
Type error: Cannot find module 'next-passkey-webauthn/types'
```

**Solutions:**
1. Ensure proper TypeScript configuration:
   ```json
   {
     "compilerOptions": {
       "moduleResolution": "bundler",
       "allowSyntheticDefaultImports": true,
       "esModuleInterop": true
     }
   }
   ```

2. Clear TypeScript cache:
   ```bash
   rm -rf .next
   rm -rf node_modules/.cache
   npm run build
   ```

## Production Issues

### HTTPS Errors

**Error:**
```
NotAllowedError: WebAuthn requires secure context
```

**Solutions:**
1. Ensure HTTPS is properly configured:
   ```typescript
   rpConfig: {
     rpID: "yourdomain.com", // No protocol
     expectedOrigin: ["https://yourdomain.com"] // Include https://
   }
   ```

2. Check SSL certificate:
   ```bash
   curl -I https://yourdomain.com
   ```

3. Verify HTTPS redirect is working.

### Environment Variable Issues

**Error:**
```
Error: rpID is required
```

**Solutions:**
1. Check environment variables are set:
   ```bash
   echo $DATABASE_URL
   echo $REDIS_URL
   ```

2. Verify `.env.local` vs `.env.production`:
   ```env
   # .env.production
   DATABASE_URL="production-db-url"
   REDIS_URL="production-redis-url"
   ```

3. Check deployment platform environment variables (Vercel, Netlify, etc.).

## Performance Issues

### Slow Registration/Authentication

**Common Causes:**
1. **Slow database queries**
2. **Redis latency**
3. **Network issues**

**Solutions:**
1. Add database indexes:
   ```sql
   CREATE INDEX idx_passkeys_user_id ON passkeys(user_id);
   CREATE INDEX idx_passkeys_credential_id ON passkeys(credential_id);
   ```

2. Monitor query performance:
   ```typescript
   // Add timing logs
   const start = Date.now();
   const result = await startRegistration(userId, config);
   console.log(`Registration took ${Date.now() - start}ms`);
   ```

3. Use connection pooling:
   ```typescript
   const prisma = new PrismaClient({
     datasources: {
       db: {
         url: process.env.DATABASE_URL + "?connection_limit=20"
       }
     }
   });
   ```

## Debug Mode

### Enable Detailed Logging

Add debug logging to troubleshoot issues:

```typescript
// lib/debug.ts
export const DEBUG = process.env.NODE_ENV === "development";

export function debugLog(message: string, data?: any) {
  if (DEBUG) {
    console.log(`[next-passkey] ${message}`, data);
  }
}

// Usage in API routes
import { debugLog } from "@/lib/debug";

export async function POST(request: Request) {
  const body = await request.json();
  debugLog("Registration start request", body);
  
  try {
    const result = await startRegistration(userId, config);
    debugLog("Registration start success", result);
    return Response.json(result);
  } catch (error) {
    debugLog("Registration start error", error);
    throw error;
  }
}
```

### Browser DevTools

1. **Open DevTools** (F12)
2. **Check Console** for JavaScript errors
3. **Network Tab** to see API requests/responses
4. **Application Tab** to check localStorage/cookies

### Test with Simple Setup

Create a minimal test to isolate issues:

```typescript
// test-passkey.js
import { MemoryStore } from "next-passkey-webauthn/store";

async function test() {
  const store = new MemoryStore();
  
  await store.set({
    id: "test",
    userId: "test",
    flow: "registration",
    challenge: "test-challenge",
    expiresAt: Date.now() + 60000
  });
  
  const result = await store.get("test", "registration");
  console.log("Store test:", result ? "PASS" : "FAIL");
}

test().catch(console.error);
```

## Getting Help

If you're still having issues:

1. **Check the GitHub Issues** for similar problems
2. **Create a minimal reproduction** of the issue
3. **Include relevant logs** and error messages
4. **Specify your environment** (Next.js version, Node.js version, browser, etc.)

### Useful Information to Include

- Next.js version
- Node.js version
- Browser and version
- Operating system
- Database type and version
- Full error message with stack trace
- Minimal code reproduction
