# next-passkey-webauthn

A focused, minimal, and extensible **Passkey (WebAuthn)** SDK for Next.js applications.

[![npm version](https://badge.fury.io/js/next-passkey-webauthn.svg)](https://badge.fury.io/js/next-passkey-webauthn)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ Features

- 🔐 **Complete WebAuthn Implementation** - Registration and authentication flows
- 🧩 **Pluggable Architecture** - Swap storage adapters and challenge stores  
- ⚡ **Ready-to-use React Hooks** - Simple client-side integration
- 🛡️ **Type Safe** - Full TypeScript support with IntelliSense
- 🏗️ **Framework Agnostic Server** - Works with any Next.js API setup
- 📦 **Multiple Storage Options** - Prisma, Supabase, Redis, or custom adapters
- 🚀 **Production Ready** - Comprehensive error handling and security

## 🚀 Quick Start

### Installation

```bash
npm install next-passkey-webauthn
```

### Basic Setup

#### 1. Configure Server

```typescript
// lib/passkey-config.ts
import { PrismaAdapter } from "next-passkey-webauthn/adapters";
import { MemoryStore } from "next-passkey-webauthn/store";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const passkeyConfig = {
  adapter: new PrismaAdapter(prisma),
  store: new MemoryStore(), // Use RedisStore in production
  rpConfig: {
    rpID: "localhost", // your domain
    rpName: "Your App",
    expectedOrigin: ["http://localhost:3000"], // your origin
  },
};
```

#### 2. Create API Routes

```typescript
// app/api/passkey/register/start/route.ts
import { startRegistration } from "next-passkey-webauthn/server";
import { passkeyConfig } from "@/lib/passkey-config";

export async function POST(request: Request) {
  const { userId } = await request.json();
  
  try {
    const options = await startRegistration(userId, passkeyConfig);
    return Response.json(options);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
```

#### 3. Use React Hooks

```tsx
// components/PasskeyAuth.tsx
import { useRegisterPasskey, useAuthenticatePasskey } from "next-passkey-webauthn/client";

const endpoints = {
  registerStart: "/api/passkey/register/start",
  registerFinish: "/api/passkey/register/finish",
  authenticateStart: "/api/passkey/authenticate/start", 
  authenticateFinish: "/api/passkey/authenticate/finish",
  deletePasskey: "/api/passkey/delete",
  listPasskeys: "/api/passkey/list",
};

export function PasskeyAuth({ userId }: { userId: string }) {
  const { register, loading: registerLoading } = useRegisterPasskey({ endpoints });
  const { authenticate, loading: authLoading } = useAuthenticatePasskey({ endpoints });

  const handleRegister = async () => {
    try {
      const result = await register(userId);
      if (result.verified) {
        console.log("Passkey registered!", result.credential);
      }
    } catch (error) {
      console.error("Registration failed:", error);
    }
  };

  const handleAuthenticate = async () => {
    try {
      const result = await authenticate(userId);
      if (result.verified) {
        console.log("Authentication successful!", result.credential);
      }
    } catch (error) {
      console.error("Authentication failed:", error);
    }
  };

  return (
    <div>
      <button onClick={handleRegister} disabled={registerLoading}>
        {registerLoading ? "Registering..." : "Register Passkey"}
      </button>
      
      <button onClick={handleAuthenticate} disabled={authLoading}>
        {authLoading ? "Authenticating..." : "Sign In with Passkey"}
      </button>
    </div>
  );
}
```

## 📚 Documentation

- **[Getting Started](./docs/getting-started.md)** - Complete setup guide
- **[Database Setup](./docs/database-setup.md)** - Prisma, Supabase schemas
- **[API Reference](./docs/api-reference.md)** - Complete function documentation
- **[Client Hooks](./docs/client-hooks.md)** - React hooks guide
- **[Examples](./docs/examples.md)** - Complete integration examples
- **[Security Guide](./docs/security.md)** - Production security considerations

## 🏗️ Architecture

### Import Structure

```typescript
// Server-side functions
import { startRegistration, finishRegistration } from "next-passkey-webauthn/server";

// Client-side hooks  
import { useRegisterPasskey, useAuthenticatePasskey } from "next-passkey-webauthn/client";

// Storage adapters
import { PrismaAdapter, SupabaseAdapter } from "next-passkey-webauthn/adapters";

// Challenge stores
import { MemoryStore, RedisStore, DbStore } from "next-passkey-webauthn/store";

// Types
import type { StoredCredential, PasskeyAdapter } from "next-passkey-webauthn/types";
```

### Core Components

#### **Credential Storage (Required)**
Choose one adapter for storing passkey credentials:
- **PrismaAdapter** - PostgreSQL, MySQL, SQLite via Prisma ORM
- **SupabaseAdapter** - PostgreSQL via Supabase  
- **Custom** - Implement `PasskeyAdapter` interface

#### **Challenge Storage (Required)**
Choose one store for temporary challenge storage:
- **MemoryStore** - In-memory (development only)
- **RedisStore** - Redis with TTL (production recommended)
- **DbStore** - Database table (production alternative)

## 🔧 Configuration

### Environment Variables

```env
# Database (if using PrismaAdapter)
DATABASE_URL="postgresql://..."

# Redis (if using RedisStore)
REDIS_URL="redis://localhost:6379"

# Supabase (if using SupabaseAdapter)
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

### Production Configuration

```typescript
// lib/passkey-config.ts (Production)
import { PrismaAdapter } from "next-passkey-webauthn/adapters";
import { RedisStore } from "next-passkey-webauthn/store";
import { PrismaClient } from "@prisma/client";
import { createClient } from "redis";

const prisma = new PrismaClient();
const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

export const passkeyConfig = {
  adapter: new PrismaAdapter(prisma),
  store: new RedisStore(redis),
  rpConfig: {
    rpID: "yourdomain.com",
    rpName: "Your App",
    expectedOrigin: ["https://yourdomain.com"],
  },
};
```

## 🛡️ Security Features

- ✅ **Origin Validation** - Prevents cross-origin attacks
- ✅ **RP ID Validation** - Domain verification
- ✅ **Challenge TTL** - Short-lived challenges (5 minutes default)
- ✅ **Counter Protection** - Anti-replay protection
- ✅ **User Verification** - Optional biometric/PIN checks
- ✅ **Base64URL Encoding** - Proper binary data handling

## 🔄 API Overview

### Server Functions

```typescript
// Registration flow
const options = await startRegistration(userId, serverConfig);
const result = await finishRegistration(userId, credential, serverConfig);

// Authentication flow  
const options = await startAuthentication(userId, serverConfig);
const result = await finishAuthentication(userId, credential, serverConfig);

// Management
const passkeys = await listUserPasskeys(userId, serverConfig);
await deletePasskey(userId, credentialId, serverConfig);
```

### Client Hooks

```typescript
// Registration
const { register, loading, error } = useRegisterPasskey({ endpoints });
const result = await register(userId);

// Authentication
const { authenticate, loading, error } = useAuthenticatePasskey({ endpoints });
const result = await authenticate(userId);

// Management
const { list, remove, loading, error } = useManagePasskeys({ endpoints });
const passkeys = await list(userId);
await remove(credentialId);
```

## 🎯 Examples

### Complete Next.js App Router Setup

See [examples/nextjs-app-router](./docs/examples.md#nextjs-app-router) for a complete working example with:
- Database setup (Prisma + PostgreSQL)
- All API routes
- React components
- TypeScript configuration

### Pages Router Setup

See [examples/nextjs-pages-router](./docs/examples.md#nextjs-pages-router) for Pages Router implementation.

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](./CONTRIBUTING.md) for details.

## 📄 License

MIT © [shaoxuan0916](https://github.com/shaoxuan0916)

## 🙏 Acknowledgments

Built on top of the excellent [@simplewebauthn](https://github.com/MasterKale/SimpleWebAuthn) library.

---

**Need help?** Check the [documentation](./docs/) or [open an issue](https://github.com/shaoxuan0916/next-passkey-webauthn/issues).
