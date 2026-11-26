# Contributing to Next Passkey WebAuthn

## Development setup

From the repository root, install the locked dependencies and build the SDK. The SDK requires Node.js 20 or later. The Next.js reference app requires Node.js 20.9 or later and a local PostgreSQL instance.

```sh
npm ci
npm run build
```

The build generates `dist/`. The reference app links to this checkout, so rebuild the SDK after changing it.

## Project layout

| Path | Responsibility |
| --- | --- |
| `src/server.ts` | WebAuthn verification and credential lifecycle |
| `src/next.ts` | Next.js App Router handler and app session hooks |
| `src/postgres.ts`, `migrations/` | PostgreSQL store and schema |
| `src/browser.ts`, `src/react.tsx` | Browser client and React controls |
| `src/types.ts` | Shared account and credential types |
| `examples/next-basic/` | Local integration example and end-to-end tests |

## Checks before a pull request

From the repository root, run the SDK type check and build.

```sh
npm exec -- tsc --noEmit
npm run build
```

From `examples/next-basic`, run `npm ci`, `npm run typecheck`, and `npm run build`. For changes to the passkey flow, use a fresh test database and run the PostgreSQL and Chromium suite. [Test setup](examples/next-basic/README.md#smoke-test)

Keep pull requests focused. Explain user-visible changes and how you verified them. Update the quickstart and reference app when an integration contract changes. [Quickstart](docs/quickstart.md) · [Roadmap](docs/roadmap.md) · [Issue tracker](https://github.com/shaoxuan0916/next-passkey-webauthn/issues)

## Release process

1. Match the package and lockfile versions and document upgrade requirements.
2. From a clean checkout, run `npm ci` and `npm pack`. Inspect the archive for the built exports, quickstart, migration, and license. Install it in a separate project and verify the published entry points resolve.
3. Push the release source before publishing so links in the package docs resolve. The maintainer publishes the verified archive with the `latest` tag and checks the registry result.
4. Tag the release commit and create a GitHub release using the corresponding file in `docs/releases/`.

For 0.3.0, run the following after publishing the archive and confirming `npm view next-passkey-webauthn dist-tags.latest` reports `0.3.0`.

```sh
npm deprecate 'next-passkey-webauthn@0.1.x || 0.2.x' \
  'This version is unsupported. Upgrade to next-passkey-webauthn 0.3.0 or later. Follow the upgrade guide to re-enroll existing passkeys. https://github.com/shaoxuan0916/next-passkey-webauthn/blob/main/docs/quickstart.md#upgrading-from-01x-or-02x'
npm view 'next-passkey-webauthn@0.1.x || 0.2.x' version deprecated
```
