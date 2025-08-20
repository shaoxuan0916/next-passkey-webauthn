# Prisma + Redis Setup Guide

A complete guide for setting up passkey authentication using Prisma with PostgreSQL for credential storage and Redis for challenge storage.

## Overview

This setup provides a **passkey integration toolkit** for your existing application:

- **Prisma**: Type-safe database access with PostgreSQL for storing passkey credentials
- **Redis**: Fast, in-memory challenge storage with automatic TTL
- **Production Ready**: Scales across multiple nodes
- **Type Safe**: Full TypeScript support with Prisma schema

### What This Library Does

This library is **NOT** a complete authentication system like Clerk or Supabase Auth. Instead, it provides:

- **Passkey Registration**: Let users create passkeys on their devices
- **Passkey Authentication**: Verify user identity before sensitive actions
- **Action Protection**: Protect specific API routes, forms, or operations
- **Integration Ready**: Works with your existing auth system
- **Simple Configuration**: Single config file exports everything you need

### Use Cases

- **Protect API Routes**: Require passkey verification for POST/PATCH/DELETE operations
- **Secure Forms**: Verify identity before submitting sensitive data
- **Admin Actions**: Require passkey for administrative operations
- **Financial Operations**: Protect withdrawals, transfers, or account changes
- **Data Export**: Verify identity before downloading sensitive information

## 1. Database Setup

### Prisma Schema

Add the following models to your `prisma/schema.prisma` file:

```prisma
// This is your Prisma schema file,

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String    @id @default(cuid())
  email     String    @unique
  // Add other user fields as needed
  passkeys  Passkey[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Passkey {
  id                     String   @id @default(cuid())
  userId                 String
  credentialId           String   @unique
  publicKey              String
  counter                Int      @default(0)
  transports             String[] @default([])
  userName               String?
  userDisplayName        String?
  authenticatorAttachment String?
  deviceInfo             Json?    @default("{}")
  backupEligible         Boolean  @default(false)
  backupState            Boolean  @default(false)
  lastUsedAt             DateTime?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([credentialId])
}

model PasskeyChallenge {
  id        String   @id
  userId    String
  flow      String
  challenge String
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}
```

### Database Migration

After updating your schema, create and run the migration:

```bash
# Generate the migration
npx prisma migrate dev --name add-passkey-models

# Apply the migration
npx prisma generate
npx prisma db push
```

## 2. Install Dependencies

```bash
npm install next-passkey-webauthn @prisma/client redis
npm install -D @types/redis prisma
```

## 3. Server Configuration

Create your server configuration file:

```typescript
// lib/passkey-endpoints.ts
// Export client endpoints configuration
export const passkeyEndpoints = {
  registerStart: '/api/passkey/register/start',
  registerFinish: '/api/passkey/register/finish',
  authenticateStart: '/api/passkey/authenticate/start',
  authenticateFinish: '/api/passkey/authenticate/finish',
  deletePasskey: '/api/passkey/delete',
  listPasskeys: '/api/passkey/list'
}
```

```typescript
// lib/passkey-config.ts
import { PrismaClient } from '@prisma/client'
import { createClient as createRedisClient } from 'redis'
import { PrismaAdapter } from 'next-passkey-webauthn/adapters'
import { RedisStore } from 'next-passkey-webauthn/store'
import type { ServerOptions } from 'next-passkey-webauthn/types'

// Initialize Prisma client
const prisma = new PrismaClient()

export async function createPasskeyConfig(): Promise<ServerOptions> {
  // Initialize Redis client
  const redis = createRedisClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
  });

  // Connect to Redis
  await redis.connect();

  // Create adapter and store instances
  const passkeyAdapter = new PrismaAdapter(prisma);
  const challengeStore = new RedisStore(redis, 300); // 5 minutes TTL

  // Relying party configuration
  const rpConfig = {
    rpID: process.env.NEXT_PUBLIC_RP_ID || "localhost",
    rpName: process.env.NEXT_PUBLIC_RP_NAME || "Your App Name",
    expectedOrigin:
      process.env.NEXT_PUBLIC_EXPECTED_ORIGIN || "http://localhost:3000",
  };

  return {
    adapter: passkeyAdapter,
    store: challengeStore,
    rpConfig,
  };
}

// Export prisma instance for use in other parts of your app
export { prisma }
```

## 4. API Route Handlers

### Registration Start

```typescript
// app/api/passkey/register/start/route.ts
import { startRegistration } from 'next-passkey-webauthn/server'
import { createPasskeyConfig } from '@/lib/passkey-config'

export async function POST(request: Request) {
  try {
    const { userId, userName, userDisplayName } = await request.json();
    
    // Create config per request
    const config = await createPasskeyConfig()
    
    const result = await startRegistration(userId, config, {
      userName,
      userDisplayName,
    });
    
    return Response.json(result)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    )
  }
}
```

### Registration Finish

```typescript
// app/api/passkey/register/finish/route.ts
import { finishRegistration } from 'next-passkey-webauthn/server'
import { createPasskeyConfig } from '@/lib/passkey-config'

export async function POST(request: Request) {
  try {
     const {
      userId,
      userName,
      userDisplayName,
      credential,
      deviceInfo,
      managementOptions,
    } = await request.json();
    
    // Create config per request
    const config = await createPasskeyConfig()
    
     const result = await finishRegistration(userId, credential, config, {
      userName,
      userDisplayName,
      deviceInfo,
      managementOptions,
    });
    
    return Response.json(result)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    )
  }
}
```

### Authentication Start

```typescript
// app/api/passkey/authenticate/start/route.ts
import { startAuthentication } from 'next-passkey-webauthn/server'
import { createPasskeyConfig } from '@/lib/passkey-config'

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()
    
    // Create config per request
    const config = await createPasskeyConfig()
    
    const result = await startAuthentication(userId, config)
    
    return Response.json(result)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    )
  }
}
```

### Authentication Finish

```typescript
// app/api/passkey/authenticate/finish/route.ts
import { finishAuthentication } from 'next-passkey-webauthn/server'
import { createPasskeyConfig } from '@/lib/passkey-config'

export async function POST(request: Request) {
  try {
    const { userId, credential } = await request.json()
    
    // Create config per request
    const config = await createPasskeyConfig()
    
    const result = await finishAuthentication(userId, credential, config)
    
    return Response.json(result)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    )
  }
}
```

### Delete Passkey

```typescript
// app/api/passkey/delete/route.ts
import { deletePasskey } from 'next-passkey-webauthn/server'
import { createPasskeyConfig } from '@/lib/passkey-config'

export async function POST(request: Request) {
  try {
    const { userId, credentialId } = await request.json()
    
    // Create config per request
    const config = await createPasskeyConfig()
    
    await deletePasskey(userId, credentialId, config)
    
    return Response.json({ success: true })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    )
  }
}
```

### List Passkeys

```typescript
// app/api/passkey/list/route.ts
import { listUserPasskeys } from 'next-passkey-webauthn/server'
import { createPasskeyConfig } from '@/lib/passkey-config'

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()
    
    // Create config per request
    const config = await createPasskeyConfig()
    
    const passkeys = await listUserPasskeys(userId, config)
    
    return Response.json({ passkeys })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    )
  }
}
```

## 5. Client-Side Usage

### Complete Passkey Management Component

This component demonstrates how to integrate passkeys into your existing application to protect sensitive actions:

```typescript
// components/PasskeyManager.tsx
'use client'

import { useState, useEffect } from 'react'
import { 
  useRegisterPasskey, 
  useAuthenticatePasskey, 
  useManagePasskeys 
} from 'next-passkey-webauthn/client'
import type { StoredCredential } from 'next-passkey-webauthn/types'
import { passkeyEndpoints } from '@/lib/passkey-endpoints'

interface PasskeyManagerProps {
  userId: string
  userDisplayName?: string
  userName?: string
  onPasskeyVerified?: (credential: StoredCredential) => void
}

export function PasskeyManager({ 
  userId, 
  userDisplayName, 
  userName, 
  onPasskeyVerified 
}: PasskeyManagerProps) {
  const [passkeys, setPasskeys] = useState<StoredCredential[]>([])
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)

  // Passkey hooks
  const { register, loading: registerLoading, error: registerError } = useRegisterPasskey({
    endpoints: passkeyEndpoints
  })

  const { authenticate, loading: authLoading, error: authError } = useAuthenticatePasskey({
    endpoints: passkeyEndpoints
  })

  const { list, remove, loading: manageLoading, error: manageError } = useManagePasskeys({
    endpoints: passkeyEndpoints
  })

  // Load existing passkeys on mount
  useEffect(() => {
    loadPasskeys()
  }, [userId])

  const loadPasskeys = async () => {
    try {
      const userPasskeys = await list(userId)
      setPasskeys(userPasskeys)
    } catch (error) {
      console.error('Failed to load passkeys:', error)
    }
  }

  // Register a new passkey
  const handleRegister = async () => {
    try {
      const result = await register(userId, {
        userDisplayName,
        userName
      })
      
      if (result.verified) {
        alert('✅ Passkey registered successfully!')
        await loadPasskeys() // Refresh the list
        if (onPasskeyVerified && result.credential) {
          onPasskeyVerified(result.credential)
        }
      }
    } catch (error) {
      alert(`❌ Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Authenticate with existing passkey
  const handleAuthenticate = async () => {
    try {
      const result = await authenticate(userId)
      
      if (result.verified) {
        alert('✅ Authentication successful!')
        if (onPasskeyVerified && result.credential) {
          onPasskeyVerified(result.credential)
        }
        setShowAuthPrompt(false)
      }
    } catch (error) {
      alert(`❌ Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Delete a passkey
  const handleDeletePasskey = async (credentialId: string) => {
    try {
      await remove(userId, credentialId)
      alert('✅ Passkey deleted successfully!')
      await loadPasskeys() // Refresh the list
    } catch (error) {
      alert(`❌ Deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Show authentication prompt for sensitive actions
  const requirePasskeyAuth = () => {
    if (passkeys.length === 0) {
      alert('❌ No passkeys registered. Please register a passkey first.')
      return
    }
    setShowAuthPrompt(true)
  }

  return (
    <div className="space-y-6 p-6 border rounded-lg">
      <h3 className="text-lg font-semibold">Passkey Management</h3>
      
      {/* Error Display */}
      {(registerError || authError || manageError) && (
        <div className="p-3 bg-red-100 text-red-700 rounded">
          Error: {registerError || authError || manageError}
        </div>
      )}

      {/* Passkey Actions */}
      <div className="space-y-3">
        <button
          onClick={handleRegister}
          disabled={registerLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {registerLoading ? 'Creating...' : 'Register New Passkey'}
        </button>

        <button
          onClick={requirePasskeyAuth}
          disabled={passkeys.length === 0}
          className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50 ml-2"
        >
          Require Passkey Auth
        </button>
      </div>

      {/* Authentication Prompt */}
      {showAuthPrompt && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-yellow-800 mb-3">
            🔐 Please authenticate with your passkey to continue
          </p>
          <button
            onClick={handleAuthenticate}
            disabled={authLoading}
            className="px-4 py-2 bg-yellow-600 text-white rounded disabled:opacity-50"
          >
            {authLoading ? 'Authenticating...' : 'Authenticate with Passkey'}
          </button>
          <button
            onClick={() => setShowAuthPrompt(false)}
            className="px-4 py-2 bg-gray-500 text-white rounded ml-2"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Passkey List */}
      <div>
        <h4 className="font-medium mb-2">Your Passkeys ({passkeys.length})</h4>
        {passkeys.length === 0 ? (
          <p className="text-gray-500">No passkeys registered yet.</p>
        ) : (
          <div className="space-y-2">
            {passkeys.map((passkey) => (
              <div key={passkey.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">
                    {passkey.deviceInfo?.nickname || 
                     `${passkey.deviceInfo?.deviceType || 'Device'} ${passkey.deviceInfo?.browser || ''}`}
                  </p>
                  <p className="text-sm text-gray-500">
                    Created: {new Date(passkey.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleDeletePasskey(passkey.credentialId)}
                  disabled={manageLoading}
                  className="px-3 py-1 bg-red-500 text-white rounded text-sm disabled:opacity-50"
                >
                  {manageLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

```

### Usage Examples

#### 1. Protect Sensitive API Routes

```typescript
// components/WithdrawalForm.tsx
'use client'

import { useState } from 'react'
import { useAuthenticatePasskey } from 'next-passkey-webauthn/client'
import { passkeyEndpoints } from '@/lib/passkey-config'

export function WithdrawalForm({ userId }: { userId: string }) {
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  
  const { authenticate, loading: authLoading, error: authError } = useAuthenticatePasskey({
    endpoints: passkeyEndpoints
  })

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Step 1: Authenticate with passkey
      const authResult = await authenticate(userId)
      
      if (!authResult.verified || !authResult.credential) {
        alert('Passkey authentication failed')
        return
      }

      // Step 2: Call sensitive API with credential ID in header
      const response = await fetch('/api/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Passkey-Credential-Id': authResult.credential.credentialId,
          'X-Passkey-Verified': 'true'
        },
        body: JSON.stringify({ 
          amount: parseFloat(amount),
          userId 
        })
      })

      if (response.ok) {
        alert('Withdrawal successful!')
        setAmount('')
      } else {
        const error = await response.json()
        alert(`Withdrawal failed: ${error.message}`)
      }
    } catch (error) {
      console.error('Withdrawal failed:', error)
      alert('Withdrawal failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleWithdrawal} className="space-y-4">
      <h2>Withdrawal Request</h2>
      
      {authError && (
        <div className="p-3 bg-red-100 text-red-700 rounded">
          Authentication error: {authError}
        </div>
      )}

      <div>
        <label htmlFor="amount" className="block text-sm font-medium mb-2">
          Amount
        </label>
        <input
          id="amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Enter amount"
          required
          className="w-full border p-2 rounded"
        />
      </div>

      <button
        type="submit"
        disabled={loading || authLoading}
        className="w-full px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        {loading ? 'Processing...' : authLoading ? 'Authenticating...' : 'Withdraw (Requires Passkey)'}
      </button>
      
      <p className="text-sm text-gray-600">
        🔐 This action requires passkey authentication for security.
      </p>
    </form>
  )
}
```

## 6. Environment Variables

Add these to your `.env.local`:

```bash
# Database (PostgreSQL)
DATABASE_URL="postgresql://username:password@localhost:5432/your_database"

# Redis
REDIS_URL=redis://localhost:6379

# WebAuthn
NEXT_PUBLIC_RP_ID=localhost
NEXT_PUBLIC_RP_NAME=Your App Name
NEXT_PUBLIC_EXPECTED_ORIGIN=http://localhost:3000
```

## 7. Redis Setup (Development)

For local development, you can use Docker:

```bash
docker run -d -p 6379:6379 redis:alpine
```

## 8. Production Considerations

### Redis Configuration
- Use Redis Cluster for high availability
- Set appropriate memory limits and eviction policies
- Monitor Redis performance and memory usage

### Database Configuration
- Use a managed PostgreSQL service (e.g., AWS RDS, Google Cloud SQL, PlanetScale)
- Set up proper database connection pooling
- Monitor database performance and connection limits
- Implement database backups and disaster recovery

### Security
- Use HTTPS in production (required for WebAuthn)
- Set appropriate CORS policies
- Validate all user inputs
- Implement rate limiting
- Use environment variables for sensitive configuration
- Consider using connection string encryption for database URLs

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Check Redis server is running
   - Verify connection URL and credentials
   - Ensure Redis client is properly connected

2. **Database Connection Failed**
   - Check database server is running
   - Verify DATABASE_URL format and credentials
   - Ensure database exists and is accessible
   - Check firewall and network settings

3. **Prisma Migration Issues**
   - Run `npx prisma generate` after schema changes
   - Check if migrations are in sync with database
   - Verify database schema matches Prisma schema

4. **WebAuthn Not Supported**
   - Check browser compatibility
   - Ensure HTTPS in production
   - Verify domain configuration

## Next Steps

- Test the complete flow (registration → authentication → deletion)
- Implement user session management
- Consider implementing backup passkey strategies
- Set up database monitoring and alerting
- Configure automated database backups

## Server-Side Verification Pattern

When protecting sensitive API routes, verify the passkey credential on the server side:

```typescript
// app/api/withdraw/route.ts
import { NextRequest } from 'next/server'
import { createPasskeyConfig } from '@/lib/passkey-config'

export async function POST(request: NextRequest) {
  try {
    // Get passkey verification headers
    const credentialId = request.headers.get('X-Passkey-Credential-Id')
    const isVerified = request.headers.get('X-Passkey-Verified') === 'true'
    
    if (!credentialId || !isVerified) {
      return Response.json(
        { error: 'Passkey verification required' },
        { status: 401 }
      )
    }

    // Create config per request
    const config = await createPasskeyConfig()

    // Verify the credential exists and belongs to the user
    const credential = await config.adapter.findByCredentialId(credentialId)
    if (!credential) {
      return Response.json(
        { error: 'Invalid passkey credential' },
        { status: 401 }
      )
    }

    // Extract user ID from request body or verify against credential
    const { userId, amount } = await request.json()
    
    if (credential.userId !== userId) {
      return Response.json(
        { error: 'Credential mismatch' },
        { status: 403 }
      )
    }

    // Now proceed with the sensitive operation
    // ... withdrawal logic here ...

    return Response.json({ success: true, message: 'Withdrawal processed' })
  } catch (error) {
    return Response.json(
      { error: 'Withdrawal failed' },
      { status: 500 }
    )
  }
}
```

This pattern ensures that:
1. **Client authenticates** with passkey before calling sensitive API
2. **Server verifies** the credential ID in the request headers
3. **Server validates** the credential belongs to the requesting user
4. **Sensitive operation** only proceeds after verification