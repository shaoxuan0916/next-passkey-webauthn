# Contributing to Next-Passkey-Webauthn

We welcome contributions! This guide will help you get started.

## Development Setup

1. **Fork and clone** the repository
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Build the project**:
   ```bash
   npm run build
   ```
## Project Structure

src/
├── adapters/ # Database adapters (Prisma, Supabase)
├── client/ # React hooks and client-side logic
├── server/ # Server-side WebAuthn handlers
├── store/ # Challenge storage implementations
├── types/ # Shared TypeScript interfaces
└── utils/ # Utility functions

## Development Workflow

1. **Create a feature branch** from `main`
2. **Make your changes** following the existing patterns
3. **Add tests** for new functionality
4. **Update documentation** if needed
5. **Run the build** to ensure everything compiles
6. **Submit a pull request**

## Code Standards

- **TypeScript**: Use strict typing, avoid `any`
- **Formatting**: Follow existing code style and patterns
- **Architecture**: Keep concerns separated (client/server/storage)
- **Error Handling**: Provide clear, actionable error messages
- **Documentation**: Add JSDoc comments for public APIs

## Testing

- **Unit tests**: Test individual functions and components
- **Integration tests**: Test adapter and store implementations
- **Type checking**: Ensure TypeScript compilation passes
- **Build verification**: Confirm the package builds correctly

## Pull Request Guidelines

- **Clear description** of what the PR accomplishes
- **Reference issues** if fixing bugs or adding features
- **Keep changes focused** - one logical change per PR
- **Update documentation** for any API changes
- **Test thoroughly** before submitting

## Getting Help

- **Issues**: Check existing issues before creating new ones
- **Discussions**: Use GitHub Discussions for questions
- **Code Review**: All PRs require review before merging

## Release Process

- **Version bump**: Use semantic versioning
- **Changelog**: Document breaking changes and new features
- **Publish**: Maintainer handles npm publishing

## Questions?

Feel free to open an issue or discussion if you need help getting started!