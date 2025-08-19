# Getting Started

This guide will walk you through setting up next-passkey in your Next.js application from scratch.

## Prerequisites

- Next.js 13+ (App Router or Pages Router)
- TypeScript (recommended)
- A database (PostgreSQL, MySQL, or SQLite)
- Node.js 16+

## Installation

```bash
npm install next-passkey
```

## Step 1: Database Setup

Choose your database adapter and set up the schema:

### Option A: Prisma (Recommended)

1. **Install Prisma**:
```bash
npm install prisma @prisma/client
npm install -D prisma
```

2. **Add to your `schema.prisma`**:
```prisma
model Passkey {
  id           String   @id @default(cuid())
  userId       String   @map("user_id")
  credentialId String   @unique @map("credential_id")
  publicKey    String   @map("public_key")
  counter      Int      @default(0)
  transports   String[]
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@map("passkeys")
}
```

3. **Run migration**:
```bash
npx prisma migrate dev --name add-passkeys
npx prisma generate
```

### Option B: Supabase

1. **Install Supabase**:
```bash
npm install @supabase/supabase-js
```

2. **Run this SQL in Supabase SQL Editor**:
```sql
CREATE TABLE passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  credential_id text UNIQUE NOT NULL,
  public_key text NOT NULL,
  counter integer DEFAULT 0,
  transports text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_passkeys_user_id ON passkeys(user_id);
```

## Step 2: Challenge Storage Setup

Choose how to store temporary challenges:

### Option A: Memory Store (Development)
```typescript
import { MemoryStore } from "next-passkey-webauthn/store";
const store = new MemoryStore();
```

### Option B: Redis Store (Production)
```bash
npm install redis
```

```typescript
import { RedisStore } from "next-passkey-webauthn/store";
import { createClient } from "redis";

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();
const store = new RedisStore(redis);
```

### Option C: Database Store
```typescript
import { DbStore } from "next-passkey-webauthn/store";
const store = new DbStore(prisma); // or your database client
```

## Step 3: Configuration

Create your passkey configuration:

```typescript
// lib/passkey-config.ts
import { PrismaAdapter } from "next-passkey-webauthn/adapters";
import { MemoryStore } from "next-passkey-webauthn/store"; // Use RedisStore in production
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const passkeyConfig = {
  adapter: new PrismaAdapter(prisma),
  store: new MemoryStore(),
  rpConfig: {
    rpID: process.env.NODE_ENV === "production" ? "yourdomain.com" : "localhost",
    rpName: "Your App Name",
    expectedOrigin: process.env.NODE_ENV === "production" 
      ? ["https://yourdomain.com"] 
      : ["http://localhost:3000"],
  },
};
```

## Step 4: Create API Routes

### App Router (app/ directory)

Create these API route files:

**`app/api/passkey/register/start/route.ts`**:
```typescript
import { startRegistration } from "next-passkey-webauthn/server";
import { passkeyConfig } from "@/lib/passkey-config";

export async function POST(request: Request) {
  try {
    const { userId, ...options } = await request.json();
    const result = await startRegistration(userId, passkeyConfig, options);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
```

**`app/api/passkey/register/finish/route.ts`**:
```typescript
import { finishRegistration } from "next-passkey-webauthn/server";
import { passkeyConfig } from "@/lib/passkey-config";

export async function POST(request: Request) {
  try {
    const { userId, credential } = await request.json();
    const result = await finishRegistration(userId, credential, passkeyConfig);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
```

**`app/api/passkey/authenticate/start/route.ts`**:
```typescript
import { startAuthentication } from "next-passkey-webauthn/server";
import { passkeyConfig } from "@/lib/passkey-config";

export async function POST(request: Request) {
  try {
    const { userId, ...options } = await request.json();
    const result = await startAuthentication(userId, passkeyConfig, options);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
```

**`app/api/passkey/authenticate/finish/route.ts`**:
```typescript
import { finishAuthentication } from "next-passkey-webauthn/server";
import { passkeyConfig } from "@/lib/passkey-config";

export async function POST(request: Request) {
  try {
    const { userId, credential } = await request.json();
    const result = await finishAuthentication(userId, credential, passkeyConfig);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
```

**`app/api/passkey/list/route.ts`**:
```typescript
import { listUserPasskeys } from "next-passkey-webauthn/server";
import { passkeyConfig } from "@/lib/passkey-config";

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();
    const passkeys = await listUserPasskeys(userId, passkeyConfig);
    return Response.json(passkeys);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
```

**`app/api/passkey/delete/route.ts`**:
```typescript
import { deletePasskey } from "next-passkey-webauthn/server";
import { passkeyConfig } from "@/lib/passkey-config";

export async function POST(request: Request) {
  try {
    const { userId, credentialId } = await request.json();
    await deletePasskey(userId, credentialId, passkeyConfig);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
```

### Pages Router (pages/ directory)

For Pages Router, create similar API routes in the `pages/api/passkey/` directory.

## Step 5: Create React Components

Create a passkey authentication component:

```tsx
// components/PasskeyAuth.tsx
"use client";

import { useRegisterPasskey, useAuthenticatePasskey, useManagePasskeys } from "next-passkey-webauthn/client";
import { useState } from "react";

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
}

export function PasskeyAuth({ userId, userDisplayName }: Props) {
  const [message, setMessage] = useState("");
  
  const { register, loading: registerLoading, error: registerError } = useRegisterPasskey({ endpoints });
  const { authenticate, loading: authLoading, error: authError } = useAuthenticatePasskey({ endpoints });
  const { list, remove, loading: manageLoading } = useManagePasskeys({ endpoints });

  const handleRegister = async () => {
    try {
      setMessage("Creating passkey...");
      const result = await register(userId);
      
      if (result.verified) {
        setMessage("✅ Passkey registered successfully!");
      } else {
        setMessage("❌ Passkey registration failed");
      }
    } catch (error) {
      setMessage(`❌ Registration error: ${error.message}`);
    }
  };

  const handleAuthenticate = async () => {
    try {
      setMessage("Authenticating...");
      const result = await authenticate(userId);
      
      if (result.verified) {
        setMessage("✅ Authentication successful!");
      } else {
        setMessage("❌ Authentication failed");
      }
    } catch (error) {
      setMessage(`❌ Authentication error: ${error.message}`);
    }
  };

  const handleListPasskeys = async () => {
    try {
      const passkeys = await list(userId);
      setMessage(`Found ${passkeys.length} passkey(s)`);
      console.log("User passkeys:", passkeys);
    } catch (error) {
      setMessage(`❌ List error: ${error.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-x-2">
        <button
          onClick={handleRegister}
          disabled={registerLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {registerLoading ? "Registering..." : "Register Passkey"}
        </button>
        
        <button
          onClick={handleAuthenticate}
          disabled={authLoading}
          className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
        >
          {authLoading ? "Authenticating..." : "Sign In with Passkey"}
        </button>
        
        <button
          onClick={handleListPasskeys}
          disabled={manageLoading}
          className="px-4 py-2 bg-gray-500 text-white rounded disabled:opacity-50"
        >
          {manageLoading ? "Loading..." : "List Passkeys"}
        </button>
      </div>

      {message && (
        <div className="p-3 bg-gray-100 rounded">
          {message}
        </div>
      )}

      {(registerError || authError) && (
        <div className="p-3 bg-red-100 text-red-700 rounded">
          Error: {registerError || authError}
        </div>
      )}
    </div>
  );
}
```

## Step 6: Use in Your App

```tsx
// app/page.tsx or pages/index.tsx
import { PasskeyAuth } from "@/components/PasskeyAuth";

export default function Home() {
  // In a real app, get this from your authentication system
  const userId = "user-123";
  const userDisplayName = "John Doe";

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Passkey Demo</h1>
      <PasskeyAuth userId={userId} userDisplayName={userDisplayName} />
    </div>
  );
}
```

## Step 7: Environment Variables

Create a `.env.local` file:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/mydb"

# Redis (optional, for production)
REDIS_URL="redis://localhost:6379"

# Supabase (if using SupabaseAdapter)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

## Testing Your Setup

1. **Start your development server**:
```bash
npm run dev
```

2. **Open your browser** to `http://localhost:3000`

3. **Test the flow**:
   - Click "Register Passkey" - this should prompt for biometric/PIN
   - Click "Sign In with Passkey" - this should authenticate you
   - Click "List Passkeys" - this should show your registered passkeys

## Common Issues

### HTTPS Required
Passkeys require HTTPS in production. For local development, `localhost` is allowed over HTTP.

### Browser Support
Passkeys work in modern browsers. Check [caniuse.com](https://caniuse.com/webauthn) for current support.

### Database Connection
Ensure your database is running and the connection string is correct.

## Next Steps

- Read the [API Reference](./api-reference.md) for detailed function documentation
- Check the [Security Guide](./security.md) for production considerations
- See [Examples](./examples.md) for more complex implementations

## Need Help?

- Check the [FAQ](./faq.md)
- Review the [Troubleshooting](./troubleshooting.md) guide
- Open an issue on GitHub
