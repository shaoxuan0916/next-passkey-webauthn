# Next-Passkey Documentation

Welcome to the Next-Passkey-Webauthn documentation! This package provides a focused, minimal, and extensible **Passkey (WebAuthn)** SDK for Next.js applications.

## What is Next-Passkey-Webauthn?

Next-Passkey-Webauthn is a comprehensive WebAuthn solution that provides:

- **Client-side**: Lightweight React hooks that wrap `@simplewebauthn/browser`
- **Server-side**: Small utilities/handlers that wrap `@simplewebauthn/server`
- **Persistence**: Pluggable adapters for credential storage (Prisma/Postgres, Supabase)
- **Challenge Storage**: Flexible challenge stores (Redis, Database, in-memory)
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Quick Start

Choose your preferred setup from the guides below:

### 🚀 Setup Guides

- **[Supabase + Redis](./docs/supabase-redis-setup.md)** - **Recommended for production**
  - Supabase PostgreSQL for credential storage
  - Redis for fast challenge storage
  - Scales across multiple nodes

- **[Prisma + Redis](./docs/prisma-redis-setup.md)** - **Coming soon**
  - Prisma ORM with PostgreSQL
  - Redis for challenge storage
  - Full type safety with Prisma

- **[Supabase + Supabase Store](./docs/supabase-store-setup.md)** - **Coming soon**
  - All-in-one Supabase solution
  - PostgreSQL for both credentials and challenges
  - Simple deployment

- **[Prisma + Database Store](./docs/prisma-db-setup.md)** - **Coming soon**
  - Prisma ORM with PostgreSQL
  - Database-backed challenge storage
  - No external dependencies

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client Side   │    │   Server Side   │    │   Storage       │
│                 │    │                 │    │                 │
│ React Hooks     │◄──►│ WebAuthn        │◄──►│ Adapters        │
│ Device Detection│    │ Handlers        │    │ Challenge       │
│ Error Handling  │    │ Validation      │    │ Stores          │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Key Features

### 🔐 WebAuthn Support
- **Registration**: Create new passkeys with device detection
- **Authentication**: Secure login with existing passkeys
- **Management**: List, delete, and manage user passkeys
- **Multi-device**: Support for multiple authenticators per user

### 🏗️ Pluggable Architecture
- **Adapters**: Switch between Prisma, Supabase, or custom implementations
- **Stores**: Choose between Redis, Database, or other challenge storage
- **Configuration**: Flexible relying party and security settings

### 🎯 Developer Experience
- **TypeScript First**: Complete type safety and IntelliSense
- **React Hooks**: Simple, declarative API for components
- **Error Handling**: Comprehensive error types and messages
- **Device Detection**: Automatic device and browser information

## Core Concepts

### Flow Types
- **Registration**: Creating new passkey credentials
- **Authentication**: Using existing passkeys to login

### Storage Layers
- **Credential Storage**: Persistent storage of passkey data
- **Challenge Storage**: Temporary storage during WebAuthn flows

### Security Features
- **Challenge Verification**: Prevents replay attacks
- **Origin Validation**: Ensures requests come from trusted domains
- **Counter Management**: Tracks authenticator usage

## Installation

```bash
npm install next-passkey-webauthn
```

## API Reference

### Server Functions
- `startRegistration()` - Begin passkey registration
- `finishRegistration()` - Complete passkey registration
- `startAuthentication()` - Begin passkey authentication
- `finishAuthentication()` - Complete passkey authentication
- `deletePasskey()` - Remove a passkey
- `listUserPasskeys()` - Get user's passkeys

### Client Hooks
- `useRegisterPasskey()` - Passkey registration
- `useAuthenticatePasskey()` - Passkey authentication
- `useManagePasskeys()` - Passkey management

### Adapters
- `SupabaseAdapter` - Supabase PostgreSQL integration
- `PrismaAdapter` - Prisma ORM integration

### Challenge Stores
- `RedisStore` - Redis-based challenge storage
- `DbStore` - Database-based challenge storage

## Examples

Check out the setup guides for complete, working examples:

- [Supabase + Redis Setup](./docs/supabase-redis-setup.md)
- More guides coming soon...

## Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/shaoxuan0916/next-passkey-webauthn/issues)
- **Discussions**: [GitHub Discussions](https://github.com/shaoxuan0916/next-passkey-webauthn/discussions)
- **Documentation**: This docs folder

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
