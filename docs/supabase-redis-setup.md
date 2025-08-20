# Supabase + Redis Setup Guide

A complete guide for setting up passkey authentication using Supabase PostgreSQL for credential storage and Redis for challenge storage.

## Overview

This setup provides a **passkey integration toolkit** for your existing application:

- **Supabase**: Managed PostgreSQL database for storing passkey credentials
- **Redis**: Fast, in-memory challenge storage with automatic TTL
- **Production Ready**: Scales across multiple nodes
- **Type Safe**: Full TypeScript support

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

Create the `passkeys` table in your Supabase PostgreSQL database:

```sql
-- Create the passkeys table
CREATE TABLE passkeys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  credential_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  counter INTEGER DEFAULT 0,
  transports TEXT[] DEFAULT '{}',
  user_name TEXT,
  user_display_name TEXT,
  authenticator_attachment TEXT,
  device_info JSONB DEFAULT '{}',
  backup_eligible BOOLEAN DEFAULT false,
  backup_state BOOLEAN DEFAULT false,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_passkeys_user_id ON passkeys(user_id);
CREATE INDEX idx_passkeys_credential_id ON passkeys(credential_id);

-- Enable Row Level Security (RLS)
ALTER TABLE passkeys ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for passkey security
-- Policy: Users can only access their own passkeys (covers SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Users can manage their own passkeys" ON passkeys
  FOR ALL USING (auth.uid()::text = user_id);

-- Policy: Service role can access all passkeys (for server operations)
CREATE POLICY "Service role access" ON passkeys
  FOR ALL USING (auth.role() = 'service_role');
```

## 2. Install Dependencies

```bash
npm install next-passkey-webauthn @supabase/supabase-js redis
npm install -D @types/redis
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
import { createClient } from '@supabase/supabase-js'
import { createClient as createRedisClient } from 'redis'
import { SupabaseAdapter } from 'next-passkey-webauthn/adapters'
import { RedisStore } from 'next-passkey-webauthn/store'
import type { ServerOptions } from 'next-passkey-webauthn/types'

export async function createPasskeyConfig(): Promise<ServerOptions> {
  // Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Initialize Redis client
  const redis = createRedisClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
  });

  // Connect to Redis
  await redis.connect();

  // Create adapter and store instances
  const passkeyAdapter = new SupabaseAdapter(supabase, "passkeys");
  const challengeStore = new RedisStore(redis, 300);

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

#### 2. Protect Admin Actions

```typescript
// components/AdminPanel.tsx
'use client'

import { useState } from 'react'
import { useAuthenticatePasskey } from 'next-passkey-webauthn/client'
import { passkeyEndpoints } from '@/lib/passkey-config'

export function AdminPanel({ userId }: { userId: string }) {
  const [adminAction, setAdminAction] = useState('')
  const [loading, setLoading] = useState(false)
  
  const { authenticate, loading: authLoading, error: authError } = useAuthenticatePasskey({
    endpoints: passkeyEndpoints
  })

  const performAdminAction = async (action: string) => {
    setLoading(true)

    try {
      // Step 1: Authenticate with passkey
      const authResult = await authenticate(userId)
      
      if (!authResult.verified || !authResult.credential) {
        alert('Admin authentication failed')
        return
      }

      // Step 2: Perform admin action with credential verification
      const response = await fetch('/api/admin/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Passkey-Credential-Id': authResult.credential.credentialId,
          'X-Passkey-Verified': 'true',
          'X-Admin-Action': action
        },
        body: JSON.stringify({ 
          action,
          userId,
          timestamp: new Date().toISOString()
        })
      })

      if (response.ok) {
        alert(`Admin action "${action}" completed successfully!`)
        setAdminAction('')
      } else {
        const error = await response.json()
        alert(`Admin action failed: ${error.message}`)
      }
    } catch (error) {
      console.error('Admin action failed:', error)
      alert('Admin action failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2>Admin Panel</h2>
      <p className="text-gray-600">
        All admin actions require passkey authentication for security.
      </p>
      
      {authError && (
        <div className="p-3 bg-red-100 text-red-700 rounded">
          Authentication error: {authError}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label htmlFor="adminAction" className="block text-sm font-medium mb-2">
            Admin Action
          </label>
          <input
            id="adminAction"
            type="text"
            value={adminAction}
            onChange={(e) => setAdminAction(e.target.value)}
            placeholder="Enter admin action (e.g., 'delete_user', 'update_settings')"
            className="w-full border p-2 rounded"
          />
        </div>

        <button
          onClick={() => performAdminAction(adminAction)}
          disabled={!adminAction.trim() || loading || authLoading}
          className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50"
        >
          {loading ? 'Processing...' : authLoading ? 'Authenticating...' : 'Execute Admin Action'}
        </button>
      </div>

      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <h3 className="font-medium text-yellow-800 mb-2">Available Actions</h3>
        <ul className="text-sm text-yellow-700 space-y-1">
          <li>• <code>delete_user</code> - Remove user account</li>
          <li>• <code>update_settings</code> - Modify system settings</li>
          <li>• <code>export_data</code> - Export user data</li>
          <li>• <code>system_maintenance</code> - Trigger maintenance mode</li>
        </ul>
      </div>
    </div>
  )
}
```

#### 3. Protect Form Submissions

```typescript
// components/SensitiveForm.tsx
'use client'

import { useState } from 'react'
import { useAuthenticatePasskey } from 'next-passkey-webauthn/client'
import { passkeyEndpoints } from '@/lib/passkey-config'

export function SensitiveForm({ userId }: { userId: string }) {
  const [formData, setFormData] = useState({
    personalInfo: '',
    financialData: '',
    confidentialNotes: ''
  })
  const [loading, setLoading] = useState(false)
  
  const { authenticate, loading: authLoading, error: authError } = useAuthenticatePasskey({
    endpoints: passkeyEndpoints
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Step 1: Authenticate with passkey
      const authResult = await authenticate(userId)
      
      if (!authResult.verified || !authResult.credential) {
        alert('Passkey authentication failed')
        return
      }

      // Step 2: Submit form with credential verification
      const response = await fetch('/api/sensitive-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Passkey-Credential-Id': authResult.credential.credentialId,
          'X-Passkey-Verified': 'true'
        },
        body: JSON.stringify({ 
          ...formData,
          userId,
          submittedAt: new Date().toISOString()
        })
      })
      
      if (response.ok) {
        alert('Sensitive form submitted successfully!')
        setFormData({ personalInfo: '', financialData: '', confidentialNotes: '' })
      } else {
        const error = await response.json()
        alert(`Form submission failed: ${error.message}`)
      }
    } catch (error) {
      console.error('Form submission failed:', error)
      alert('Form submission failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2>Sensitive Information Form</h2>
      
      {authError && (
        <div className="p-3 bg-red-100 text-red-700 rounded">
          Authentication error: {authError}
        </div>
      )}

      <div>
        <label htmlFor="personalInfo" className="block text-sm font-medium mb-2">
          Personal Information
        </label>
        <textarea
          id="personalInfo"
          value={formData.personalInfo}
          onChange={(e) => setFormData({ ...formData, personalInfo: e.target.value })}
          placeholder="Enter personal information"
          rows={3}
          className="w-full border p-2 rounded"
        />
      </div>

      <div>
        <label htmlFor="financialData" className="block text-sm font-medium mb-2">
          Financial Data
        </label>
        <input
          id="financialData"
          type="text"
          value={formData.financialData}
          onChange={(e) => setFormData({ ...formData, financialData: e.target.value })}
          placeholder="Enter financial information"
          className="w-full border p-2 rounded"
        />
      </div>

      <div>
        <label htmlFor="confidentialNotes" className="block text-sm font-medium mb-2">
          Confidential Notes
        </label>
        <textarea
          id="confidentialNotes"
          value={formData.confidentialNotes}
          onChange={(e) => setFormData({ ...formData, confidentialNotes: e.target.value })}
          placeholder="Enter confidential notes"
          rows={4}
          className="w-full border p-2 rounded"
        />
      </div>

      <button
        type="submit"
        disabled={loading || authLoading}
        className="w-full px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        {loading ? 'Submitting...' : authLoading ? 'Authenticating...' : 'Submit Sensitive Data (Requires Passkey)'}
      </button>
      
      <p className="text-sm text-gray-600">
        🔐 This form contains sensitive information and requires passkey authentication.
      </p>
    </form>
  )
}
```

## 6. Environment Variables

Add these to your `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

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

### Supabase Configuration
- Enable Row Level Security (RLS) for production
- Set up proper user policies
- Monitor database performance and connection limits

### Security
- Use HTTPS in production (required for WebAuthn)
- Set appropriate CORS policies
- Validate all user inputs
- Implement rate limiting

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Check Redis server is running
   - Verify connection URL and credentials
   - Ensure Redis client is properly connected

2. **Supabase Permission Denied**
   - Check service role key permissions
   - Verify table exists and RLS policies
   - Ensure proper database schema

3. **WebAuthn Not Supported**
   - Check browser compatibility
   - Ensure HTTPS in production
   - Verify domain configuration



## Next Steps

- Test the complete flow (registration → authentication → deletion)
- Implement user session management
- Consider implementing backup passkey strategies

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
