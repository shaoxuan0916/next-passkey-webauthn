# Next-Passkey-Webauthn

A focused, minimal, and extensible **Passkey (WebAuthn)** SDK for Next.js applications.

## What is Next-Passkey-Webauthn?

This library provides a complete WebAuthn solution with:

- **Client-side**: React hooks that wrap `@simplewebauthn/browser`
- **Server-side**: Utilities that wrap `@simplewebauthn/server`
- **Persistence**: Pluggable adapters for credential storage (Prisma, Supabase)
- **Challenge Storage**: Flexible challenge stores (Redis, Database)
- **Type Safety**: Full TypeScript support

## Installation

```bash
npm install next-passkey-webauthn
```

## Quick Start

Choose your preferred setup:

### 🚀 Setup Guides

- **[Supabase + Redis](https://github.com/shaoxuan0916/next-passkey-webauthn/docs/supabase-redis-setup.md)** - **Recommended for production**
  - Supabase PostgreSQL for credential storage
  - Redis for fast challenge storage
  - Scales across multiple nodes

- **[Prisma + Redis](https://github.com/shaoxuan0916/next-passkey-webauthn/docs/prisma-redis-setup.md)**
  - Prisma ORM with PostgreSQL
  - Redis for challenge storage
  - Full type safety with Prisma

- **[Supabase + Database Store](https://github.com/shaoxuan0916/next-passkey-webauthn/docs/supabase-store-setup.md)**
  - All-in-one Supabase solution
  - PostgreSQL for both credentials and challenges
  - Simple deployment

- **[Prisma + Database Store](https://github.com/shaoxuan0916/next-passkey-webauthn/docs/prisma-store-setup.md)**
  - Prisma ORM with PostgreSQL
  - Database-backed challenge storage
  - No external dependencies

## Architecture Overview

The library follows a clean separation of concerns with three main layers:

**Client Side**: React hooks that handle user interactions, device detection, and API communication. Hooks like `useRegisterPasskey`, `useAuthenticatePasskey`, and `useManagePasskeys` provide a simple interface for components.

**Server Side**: WebAuthn handlers that manage the registration and authentication flows. Functions like `startRegistration`, `finishRegistration`, `startAuthentication`, and `finishAuthentication` handle the core WebAuthn logic and validation.

**Storage Layer**: Pluggable adapters and stores for data persistence. Adapters (Prisma, Supabase) handle credential storage, while challenge stores (Redis, Database) manage temporary challenge data during WebAuthn flows.

The architecture is designed to be modular - you can mix and match different adapters and stores based on your infrastructure needs.

## Key Features

### WebAuthn Support
- **Registration**: Create new passkeys with device detection
- **Authentication**: Secure login with existing passkeys
- **Management**: List, delete, and manage user passkeys
- **Multi-device**: Support for multiple authenticators per user

### Pluggable Architecture
- **Adapters**: Switch between Prisma, Supabase, or custom implementations
- **Stores**: Choose between Redis, Database, or other challenge storage
- **Configuration**: Flexible relying party and security settings

### Developer Experience
- **TypeScript First**: Complete type safety and IntelliSense
- **React Hooks**: Simple, declarative API for components
- **Error Handling**: Comprehensive error types and messages
- **Device Detection**: Automatic device and browser information

## Core Concepts

### Flow Types
- **Registration**: Creating new passkey credentials
- **Authentication**: Using existing passkeys to login

### Storage Layers
- **Credential Storage**: Persistent storage of passkey data via adapters
- **Challenge Storage**: Temporary storage during WebAuthn flows via stores

### Security Features
- **Challenge Verification**: Prevents replay attacks
- **Origin Validation**: Ensures requests come from trusted domains
- **Counter Management**: Tracks authenticator usage

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
- `SupabaseStore` - Supabase-based challenge storage

## Examples

Check out the setup guides for complete, working examples:

- [Supabase + Redis Setup](https://github.com/shaoxuan0916/next-passkey-webauthn/docs/supabase-redis-setup.md)
- [Prisma + Redis Setup](https://github.com/shaoxuan0916/next-passkey-webauthn/docs/prisma-redis-setup.md)
- [Supabase + Database Store Setup](https://github.com/shaoxuan0916/next-passkey-webauthn/docs/supabase-store-setup.md)
- [Prisma + Database Store Setup](https://github.com/shaoxuan0916/next-passkey-webauthn/docs/prisma-store-setup.md)
- [API Reference](https://github.com/shaoxuan0916/next-passkey-webauthn/docs/api-reference.md)

## Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/shaoxuan0916/next-passkey-webauthn/CONTRIBUTING.md) for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/shaoxuan0916/next-passkey-webauthn/issues)
- **Discussions**: [GitHub Discussions](https://github.com/shaoxuan0916/next-passkey-webauthn/discussions)
- **Documentation**: This docs folder

## License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/shaoxuan0916/next-passkey-webauthn/LICENSE) file for details.