# Database Setup

This guide covers setting up your database for storing passkey credentials with different adapters.

## Overview

next-passkey requires two types of storage:

1. **Credential Storage** - Permanent storage for passkey credentials
2. **Challenge Storage** - Temporary storage for WebAuthn challenges

## Credential Storage

### Prisma Setup (Recommended)

Prisma provides excellent TypeScript support and works with PostgreSQL, MySQL, and SQLite.

#### 1. Install Dependencies

```bash
npm install prisma @prisma/client
npm install -D prisma
```

#### 2. Add Model to Schema

Add this to your `schema.prisma` file:

```prisma
model Passkey {
  id              String   @id @default(cuid())
  userId          String   @map("user_id")
  credentialId    String   @unique @map("credential_id")
  publicKey       String   @map("public_key")
  counter         Int      @default(0)
  transports      String[]
  userName        String?  @map("user_name")
  userDisplayName String?  @map("user_display_name")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  // Optional: Link to your User model
  user User @relation(fields: [userId], references: [id])
  
  @@index([userId])
  @@map("passkeys")
}

// If you don't have a User model yet:
model User {
  id       String    @id @default(cuid())
  email    String    @unique
  name     String?
  passkeys Passkey[]
  
  @@map("users")
}
```

#### 3. Run Migration

```bash
npx prisma migrate dev --name add-passkeys
npx prisma generate
```

#### 4. Usage

```typescript
import { PrismaAdapter } from "next-passkey-webauthn/adapters";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const adapter = new PrismaAdapter(prisma);
```

### Supabase Setup

Supabase provides a hosted PostgreSQL database with excellent developer experience.

#### 1. Create Table

Run this SQL in your Supabase SQL editor:

```sql
-- Create passkeys table
CREATE TABLE passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  credential_id text UNIQUE NOT NULL,
  public_key text NOT NULL,
  counter integer DEFAULT 0,
  transports text[],
  user_name text,
  user_display_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_passkeys_user_id ON passkeys(user_id);
CREATE INDEX idx_passkeys_credential_id ON passkeys(credential_id);

-- Enable Row Level Security (recommended)
ALTER TABLE passkeys ENABLE ROW LEVEL SECURITY;

-- Example RLS policy (adjust based on your auth setup)
CREATE POLICY "Users can manage their own passkeys" ON passkeys
  FOR ALL USING (auth.uid()::text = user_id);
```

#### 2. Install Dependencies

```bash
npm install @supabase/supabase-js
```

#### 3. Usage

```typescript
import { SupabaseAdapter } from "next-passkey-webauthn/adapters";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for server-side
);

const adapter = new SupabaseAdapter(supabase);
```

### Custom Adapter

You can implement your own adapter by following the `PasskeyAdapter` interface:

```typescript
import { PasskeyAdapter, StoredCredential } from "next-passkey-webauthn/types";

class CustomAdapter implements PasskeyAdapter {
  async createPasskey(data: Omit<StoredCredential, "id" | "createdAt">): Promise<StoredCredential> {
    // Your implementation
  }
  
  async findByCredentialId(credentialId: string): Promise<StoredCredential | null> {
    // Your implementation
  }
  
  async listUserPasskeys(userId: string): Promise<StoredCredential[]> {
    // Your implementation
  }
  
  async updateCounter(id: string, counter: number): Promise<void> {
    // Your implementation
  }
  
  async deletePasskey(id: string): Promise<void> {
    // Your implementation
  }
}
```

## Challenge Storage

Challenges are temporary data used during WebAuthn flows. They must expire quickly (2-5 minutes).

### Memory Store (Development Only)

```typescript
import { MemoryStore } from "next-passkey-webauthn/store";

const store = new MemoryStore();
```

⚠️ **Not for production** - Data is lost on server restart and not shared between instances.

### Redis Store (Production Recommended)

Redis is perfect for temporary data with TTL support.

#### Setup

```bash
npm install redis
```

```typescript
import { RedisStore } from "next-passkey-webauthn/store";
import { createClient } from "redis";

const redis = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379"
});

await redis.connect();
const store = new RedisStore(redis);
```

#### Docker Redis (Development)

```yaml
# docker-compose.yml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

### Database Store

Use your existing database for challenge storage.

#### 1. Create Table

```sql
-- For PostgreSQL/MySQL
CREATE TABLE passkey_challenges (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  flow text NOT NULL,
  challenge text NOT NULL,
  expires_at timestamp with time zone NOT NULL
);

CREATE INDEX idx_passkey_challenges_expires_at ON passkey_challenges(expires_at);

-- For SQLite
CREATE TABLE passkey_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  flow TEXT NOT NULL,
  challenge TEXT NOT NULL,
  expires_at DATETIME NOT NULL
);

CREATE INDEX idx_passkey_challenges_expires_at ON passkey_challenges(expires_at);
```

#### 2. Usage

```typescript
import { DbStore } from "next-passkey-webauthn/store";

// With Prisma
const store = new DbStore(prisma);

// With any database client
const store = new DbStore({
  async query(sql, params) {
    // Return array of rows
    return await yourDb.query(sql, params);
  },
  async execute(sql, params) {
    // Execute without returning data
    await yourDb.execute(sql, params);
  }
});

// Initialize table (run once)
await store.initializeTable();
```

## Complete Configuration Examples

### Development Setup

```typescript
// lib/passkey-config.ts
import { PrismaAdapter } from "next-passkey-webauthn/adapters";
import { MemoryStore } from "next-passkey-webauthn/store";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const passkeyConfig = {
  adapter: new PrismaAdapter(prisma),
  store: new MemoryStore(),
  rpConfig: {
    rpID: "localhost",
    rpName: "Your App (Dev)",
    expectedOrigin: ["http://localhost:3000"],
  },
};
```

### Production Setup

```typescript
// lib/passkey-config.ts
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

### Supabase + Redis Setup

```typescript
// lib/passkey-config.ts
import { SupabaseAdapter } from "next-passkey-webauthn/adapters";
import { RedisStore } from "next-passkey-webauthn/store";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createRedisClient } from "redis";

const supabase = createSupabaseClient(
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
    rpName: "Your App",
    expectedOrigin: process.env.NODE_ENV === "production" 
      ? ["https://yourdomain.com"] 
      : ["http://localhost:3000"],
  },
};
```

## Environment Variables

Add these to your `.env.local` file:

```env
# Database (Prisma)
DATABASE_URL="postgresql://username:password@localhost:5432/database"

# Redis
REDIS_URL="redis://localhost:6379"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

## Migration Guide

### From Other WebAuthn Libraries

1. **Export existing credentials** from your current storage
2. **Map to StoredCredential format**:
   ```typescript
   {
     id: "new-uuid",
     userId: "user-id",
     credentialId: "base64url-credential-id",
     publicKey: "base64url-public-key",
     counter: 0,
     transports: ["internal"],
     createdAt: "2024-01-01T00:00:00.000Z"
   }
   ```
3. **Import using your chosen adapter**

### Schema Updates

If you need to modify the schema, create a new migration:

```bash
# Prisma
npx prisma migrate dev --name update-passkeys

# Supabase
# Run ALTER TABLE statements in SQL editor
```

## Performance Considerations

### Indexing

Ensure these indexes exist:
- `user_id` - For listing user passkeys
- `credential_id` - For credential lookups (should be unique)
- `expires_at` - For challenge cleanup (if using DbStore)

### Connection Pooling

For high-traffic applications:
- Use connection pooling for your database
- Use Redis clustering if needed
- Consider read replicas for credential lookups

### Cleanup Jobs

For DbStore, set up a cleanup job:

```typescript
// Cleanup expired challenges (run every 5 minutes)
setInterval(async () => {
  await store.cleanupExpired();
}, 5 * 60 * 1000);
```

## Troubleshooting

### Common Issues

1. **Migration Errors**: Ensure your database is running and accessible
2. **Redis Connection**: Check Redis is running and URL is correct
3. **Supabase RLS**: Ensure your RLS policies allow the operations
4. **Index Missing**: Add the required indexes for performance

### Debugging

Enable debug logging:

```typescript
// Add to your config
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

Check the logs for SQL queries and errors to diagnose issues.