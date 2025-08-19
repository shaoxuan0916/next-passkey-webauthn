# Examples

Complete integration examples for different Next.js setups and use cases.

## Next.js App Router Example

Complete working example with App Router, Prisma, and TypeScript.

### Project Structure

```
my-passkey-app/
├── app/
│   ├── api/passkey/
│   │   ├── authenticate/
│   │   │   ├── start/route.ts
│   │   │   └── finish/route.ts
│   │   ├── register/
│   │   │   ├── start/route.ts
│   │   │   └── finish/route.ts
│   │   ├── delete/route.ts
│   │   └── list/route.ts
│   ├── dashboard/page.tsx
│   ├── login/page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── PasskeyAuth.tsx
│   └── PasskeyManager.tsx
├── lib/
│   ├── passkey-config.ts
│   └── auth.ts
├── prisma/
│   └── schema.prisma
└── package.json
```

### 1. Database Setup

**`prisma/schema.prisma`**:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id       String    @id @default(cuid())
  email    String    @unique
  name     String?
  passkeys Passkey[]
  
  @@map("users")
}

model Passkey {
  id           String   @id @default(cuid())
  userId       String   @map("user_id")
  credentialId String   @unique @map("credential_id")
  publicKey    String   @map("public_key")
  counter      Int      @default(0)
  transports   String[]
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@map("passkeys")
}
```

### 2. Configuration

**`lib/passkey-config.ts`**:
```typescript
import { PrismaAdapter } from "next-passkey-webauthn/adapters";
import { RedisStore } from "next-passkey-webauthn/store";
import { PrismaClient } from "@prisma/client";
import { createClient } from "redis";

const prisma = new PrismaClient();

// Initialize Redis in production
let store;
if (process.env.REDIS_URL) {
  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();
  store = new RedisStore(redis);
} else {
  // Use memory store in development
  const { MemoryStore } = await import("next-passkey-webauthn/store");
  store = new MemoryStore();
}

export const passkeyConfig = {
  adapter: new PrismaAdapter(prisma),
  store,
  rpConfig: {
    rpID: process.env.NODE_ENV === "production" ? "yourdomain.com" : "localhost",
    rpName: "My Passkey App",
    expectedOrigin: process.env.NODE_ENV === "production" 
      ? ["https://yourdomain.com"] 
      : ["http://localhost:3000"],
  },
};
```

### 3. API Routes

**`app/api/passkey/register/start/route.ts`**:
```typescript
import { startRegistration } from "next-passkey-webauthn/server";
import { passkeyConfig } from "@/lib/passkey-config";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { userId, ...options } = await request.json();
    
    if (!userId) {
      return Response.json({ error: "User ID is required" }, { status: 400 });
    }

    const result = await startRegistration(userId, passkeyConfig, options);
    return Response.json(result);
  } catch (error) {
    console.error("Registration start error:", error);
    return Response.json(
      { error: error.message || "Registration failed" }, 
      { status: 400 }
    );
  }
}
```

**`app/api/passkey/register/finish/route.ts`**:
```typescript
import { finishRegistration } from "next-passkey-webauthn/server";
import { passkeyConfig } from "@/lib/passkey-config";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { userId, credential } = await request.json();
    
    if (!userId || !credential) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const result = await finishRegistration(userId, credential, passkeyConfig);
    return Response.json(result);
  } catch (error) {
    console.error("Registration finish error:", error);
    return Response.json(
      { error: error.message || "Registration failed" }, 
      { status: 400 }
    );
  }
}
```

**`app/api/passkey/authenticate/start/route.ts`**:
```typescript
import { startAuthentication } from "next-passkey-webauthn/server";
import { passkeyConfig } from "@/lib/passkey-config";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { userId, ...options } = await request.json();
    
    if (!userId) {
      return Response.json({ error: "User ID is required" }, { status: 400 });
    }

    const result = await startAuthentication(userId, passkeyConfig, options);
    return Response.json(result);
  } catch (error) {
    console.error("Authentication start error:", error);
    return Response.json(
      { error: error.message || "Authentication failed" }, 
      { status: 400 }
    );
  }
}
```

**`app/api/passkey/authenticate/finish/route.ts`**:
```typescript
import { finishAuthentication } from "next-passkey-webauthn/server";
import { passkeyConfig } from "@/lib/passkey-config";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { userId, credential } = await request.json();
    
    if (!userId || !credential) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const result = await finishAuthentication(userId, credential, passkeyConfig);
    
    if (result.verified) {
      // Here you would typically create a session or JWT
      // For this example, we'll just return the result
      return Response.json({
        ...result,
        sessionToken: "your-jwt-token-here" // Replace with actual JWT
      });
    }
    
    return Response.json(result);
  } catch (error) {
    console.error("Authentication finish error:", error);
    return Response.json(
      { error: error.message || "Authentication failed" }, 
      { status: 400 }
    );
  }
}
```

**`app/api/passkey/list/route.ts`**:
```typescript
import { listUserPasskeys } from "next-passkey-webauthn/server";
import { passkeyConfig } from "@/lib/passkey-config";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    
    if (!userId) {
      return Response.json({ error: "User ID is required" }, { status: 400 });
    }

    const passkeys = await listUserPasskeys(userId, passkeyConfig);
    return Response.json(passkeys);
  } catch (error) {
    console.error("List passkeys error:", error);
    return Response.json(
      { error: error.message || "Failed to list passkeys" }, 
      { status: 400 }
    );
  }
}
```

**`app/api/passkey/delete/route.ts`**:
```typescript
import { deletePasskey } from "next-passkey-webauthn/server";
import { passkeyConfig } from "@/lib/passkey-config";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { userId, credentialId } = await request.json();
    
    if (!userId || !credentialId) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    await deletePasskey(userId, credentialId, passkeyConfig);
    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete passkey error:", error);
    return Response.json(
      { error: error.message || "Failed to delete passkey" }, 
      { status: 400 }
    );
  }
}
```

### 4. Components

**`components/PasskeyAuth.tsx`**:
```tsx
"use client";

import { useRegisterPasskey, useAuthenticatePasskey } from "next-passkey-webauthn/client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const endpoints = {
  registerStart: "/api/passkey/register/start",
  registerFinish: "/api/passkey/register/finish",
  authenticateStart: "/api/passkey/authenticate/start",
  authenticateFinish: "/api/passkey/authenticate/finish",
  deletePasskey: "/api/passkey/delete",
  listPasskeys: "/api/passkey/list",
};

interface Props {
  userId: string;
  userDisplayName?: string;
  mode: "register" | "login";
}

export function PasskeyAuth({ userId, userDisplayName, mode }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  
  const { register, loading: registerLoading, error: registerError } = useRegisterPasskey({ endpoints });
  const { authenticate, loading: authLoading, error: authError } = useAuthenticatePasskey({ endpoints });

  const handleRegister = async () => {
    try {
      setMessage("Creating your passkey...");
      const result = await register(userId, {
        userDisplayName,
        userName: userId,
      });
      
      if (result.verified) {
        setMessage("✅ Passkey registered successfully!");
        setTimeout(() => router.push("/dashboard"), 1500);
      }
    } catch (error) {
      setMessage(`❌ Registration failed: ${error.message}`);
    }
  };

  const handleAuthenticate = async () => {
    try {
      setMessage("Authenticating...");
      const result = await authenticate(userId);
      
      if (result.verified) {
        setMessage("✅ Authentication successful!");
        // Store session token if returned from API
        if ('sessionToken' in result) {
          localStorage.setItem('sessionToken', result.sessionToken);
        }
        setTimeout(() => router.push("/dashboard"), 1500);
      }
    } catch (error) {
      setMessage(`❌ Authentication failed: ${error.message}`);
    }
  };

  const isLoading = registerLoading || authLoading;
  const error = registerError || authError;

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-center">
        {mode === "register" ? "Register Passkey" : "Sign In"}
      </h2>
      
      <div className="space-y-4">
        {mode === "register" ? (
          <button
            onClick={handleRegister}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {registerLoading ? "Creating Passkey..." : "🔐 Create Passkey"}
          </button>
        ) : (
          <button
            onClick={handleAuthenticate}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {authLoading ? "Signing In..." : "🔑 Sign In with Passkey"}
          </button>
        )}

        {message && (
          <div className={`p-3 rounded-lg text-center ${
            message.includes("✅") 
              ? "bg-green-100 text-green-800" 
              : message.includes("❌")
              ? "bg-red-100 text-red-800"
              : "bg-blue-100 text-blue-800"
          }`}>
            {message}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-100 text-red-800 rounded-lg">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
    </div>
  );
}
```

**`components/PasskeyManager.tsx`**:
```tsx
"use client";

import { useManagePasskeys, useRegisterPasskey } from "next-passkey-webauthn/client";
import { useEffect, useState } from "react";
import type { StoredCredential } from "next-passkey-webauthn/types";

const endpoints = {
  registerStart: "/api/passkey/register/start",
  registerFinish: "/api/passkey/register/finish",
  authenticateStart: "/api/passkey/authenticate/start",
  authenticateFinish: "/api/passkey/authenticate/finish",
  deletePasskey: "/api/passkey/delete",
  listPasskeys: "/api/passkey/list",
};

interface Props {
  userId: string;
  userDisplayName: string;
}

export function PasskeyManager({ userId, userDisplayName }: Props) {
  const [passkeys, setPasskeys] = useState<StoredCredential[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  
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

  const handleAddPasskey = async () => {
    try {
      const result = await register(userId, {
        userDisplayName,
        userName: userId,
      });

      if (result.verified) {
        setShowAddForm(false);
        await loadPasskeys();
      }
    } catch (err) {
      console.error("Failed to add passkey:", err);
    }
  };

  const handleDeletePasskey = async (credentialId: string, createdAt: string) => {
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
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Passkey Management</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {showAddForm ? "Cancel" : "Add Passkey"}
        </button>
      </div>

      {showAddForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium mb-3">Add New Passkey</h3>
          <p className="text-gray-600 mb-4">
            Create a new passkey for this account. You'll be prompted to use your authenticator.
          </p>
          <button
            onClick={handleAddPasskey}
            disabled={registerLoading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {registerLoading ? "Creating..." : "Create Passkey"}
          </button>
          {registerError && (
            <div className="mt-3 p-3 bg-red-100 text-red-800 rounded-lg">
              ❌ {registerError}
            </div>
          )}
        </div>
      )}

      {manageLoading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading passkeys...</p>
        </div>
      )}

      {manageError && (
        <div className="p-4 bg-red-100 text-red-800 rounded-lg mb-6">
          ❌ Error loading passkeys: {manageError}
        </div>
      )}

      {!manageLoading && passkeys.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="text-6xl mb-4">🔐</div>
          <h3 className="text-xl font-medium mb-2">No Passkeys Yet</h3>
          <p className="text-gray-600 mb-4">
            Add your first passkey to enable secure, passwordless authentication.
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add Your First Passkey
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {passkeys.map((passkey, index) => (
            <div key={passkey.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-medium">Passkey #{index + 1}</h3>
                <button
                  onClick={() => handleDeletePasskey(passkey.credentialId, passkey.createdAt)}
                  className="text-red-600 hover:text-red-800 text-sm"
                  title="Delete this passkey"
                >
                  🗑️ Delete
                </button>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Created:</span>{" "}
                  {new Date(passkey.createdAt).toLocaleDateString()}
                </div>
                <div>
                  <span className="font-medium">Transport:</span>{" "}
                  {formatTransports(passkey.transports)}
                </div>
                <div>
                  <span className="font-medium">Uses:</span>{" "}
                  {passkey.counter}
                </div>
                {passkey.updatedAt && (
                  <div>
                    <span className="font-medium">Last used:</span>{" "}
                    {new Date(passkey.updatedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 5. Pages

**`app/page.tsx`**:
```tsx
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold text-center mb-8">
          🔐 Passkey Demo
        </h1>
        
        <div className="space-y-4">
          <Link
            href="/login"
            className="block w-full py-3 px-4 bg-blue-600 text-white text-center rounded-lg font-medium hover:bg-blue-700"
          >
            Sign In
          </Link>
          
          <Link
            href="/register"
            className="block w-full py-3 px-4 bg-green-600 text-white text-center rounded-lg font-medium hover:bg-green-700"
          >
            Register New Account
          </Link>
        </div>
        
        <div className="mt-8 text-sm text-gray-600 text-center">
          <p>This demo uses WebAuthn passkeys for authentication.</p>
          <p className="mt-1">No passwords required! 🎉</p>
        </div>
      </div>
    </div>
  );
}
```

**`app/login/page.tsx`**:
```tsx
import { PasskeyAuth } from "@/components/PasskeyAuth";

export default function LoginPage() {
  // In a real app, you'd get the userId from a form or previous step
  const userId = "demo-user@example.com";

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <PasskeyAuth 
        userId={userId}
        userDisplayName="Demo User"
        mode="login"
      />
    </div>
  );
}
```

**`app/dashboard/page.tsx`**:
```tsx
import { PasskeyManager } from "@/components/PasskeyManager";

export default function DashboardPage() {
  // In a real app, get this from your session/auth system
  const userId = "demo-user@example.com";
  const userDisplayName = "Demo User";

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Manage your passkeys below.</p>
        </div>
        
        <PasskeyManager 
          userId={userId} 
          userDisplayName={userDisplayName}
        />
      </div>
    </div>
  );
}
```

### 6. Environment Variables

**`.env.local`**:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/passkey_demo"

# Redis (optional, for production)
REDIS_URL="redis://localhost:6379"

# Next.js
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 7. Package.json

```json
{
  "name": "nextjs-passkey-example",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate"
  },
  "dependencies": {
    "next": "14.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "next-passkey-webauthn/": "^0.1.0",
    "@prisma/client": "^5.0.0",
    "redis": "^4.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "autoprefixer": "^10.0.0",
    "eslint": "^8.0.0",
    "eslint-config-next": "14.0.0",
    "postcss": "^8.0.0",
    "prisma": "^5.0.0",
    "tailwindcss": "^3.0.0",
    "typescript": "^5.0.0"
  }
}
```

## Supabase Example

### Database Setup

```sql
-- Create users table
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create passkeys table
CREATE TABLE passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id text UNIQUE NOT NULL,
  public_key text NOT NULL,
  counter integer DEFAULT 0,
  transports text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_passkeys_user_id ON passkeys(user_id);
CREATE INDEX idx_passkeys_credential_id ON passkeys(credential_id);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE passkeys ENABLE ROW LEVEL SECURITY;

-- RLS policies (adjust based on your auth setup)
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can manage own passkeys" ON passkeys
  FOR ALL USING (auth.uid()::text = user_id::text);
```

### Configuration

```typescript
// lib/passkey-config.ts
import { SupabaseAdapter } from "next-passkey-webauthn/adapters";
import { RedisStore } from "next-passkey-webauthn/store";
import { createClient } from "@supabase/supabase-js";
import { createClient as createRedisClient } from "redis";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = createRedisClient({ url: process.env.REDIS_URL });
await redis.connect();

export const passkeyConfig = {
  adapter: new SupabaseAdapter(supabase),
  store: new RedisStore(redis),
  rpConfig: {
    rpID: process.env.NODE_ENV === "production" ? "yourdomain.com" : "localhost",
    rpName: "Supabase Passkey App",
    expectedOrigin: process.env.NODE_ENV === "production" 
      ? ["https://yourdomain.com"] 
      : ["http://localhost:3000"],
  },
};
```

## Pages Router Example

For Pages Router, the API routes go in `pages/api/passkey/` instead of `app/api/passkey/`:

**`pages/api/passkey/register/start.ts`**:
```typescript
import { startRegistration } from "next-passkey-webauthn/server";
import { passkeyConfig } from "@/lib/passkey-config";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId, ...options } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const result = await startRegistration(userId, passkeyConfig, options);
    res.json(result);
  } catch (error) {
    console.error("Registration start error:", error);
    res.status(400).json({ error: error.message || "Registration failed" });
  }
}
```

## Testing Your Setup

### 1. Start Development Server

```bash
npm run dev
```

### 2. Test Registration Flow

1. Navigate to `/register`
2. Click "Create Passkey"
3. Complete biometric/PIN verification
4. Verify success message

### 3. Test Authentication Flow

1. Navigate to `/login`
2. Click "Sign In with Passkey"
3. Complete biometric/PIN verification
4. Verify redirect to dashboard

### 4. Test Management

1. Navigate to `/dashboard`
2. View your registered passkeys
3. Add additional passkeys
4. Delete existing passkeys

## Production Deployment

### 1. Environment Variables

Set these in your production environment:

```env
DATABASE_URL="your-production-db-url"
REDIS_URL="your-production-redis-url"
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### 2. Update Configuration

```typescript
// Update rpConfig for production
rpConfig: {
  rpID: "yourdomain.com", // Your actual domain
  rpName: "Your App",
  expectedOrigin: ["https://yourdomain.com"], // Your actual origin
}
```

### 3. HTTPS Required

Ensure your production site uses HTTPS - passkeys require secure contexts.

### 4. Database Migrations

Run database migrations in production:

```bash
# Prisma
npx prisma migrate deploy

# Or for Supabase, run the SQL scripts in your dashboard
```

This completes the comprehensive examples for integrating next-passkey into your Next.js applications!
