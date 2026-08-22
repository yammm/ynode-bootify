# Contributing

Welcome! We appreciate your help in improving this plugin.

## Development

### Getting Started

Before contributing, please securely install the local Git hooks which enforce commit message formatting and other standards:

```bash
./scripts/setup-hooks
```

### Windows Users

If you are developing on a Windows machine, please run the dedicated batch script:

```cmd
.\scripts\setup-hooks.cmd
```

### Development Commands

```bash
# Check formatting without modifying files
npm run format:check

# Run ESLint
npm run lint

# Run the standard test suite
npm test

# Check the public TypeScript declarations
npm run test:types

# Generate JSDoc documentation
npm run docs
```

## Release Process

This package uses [`@mikinho/autover`](https://github.com/yammm/ynode-autover) for automated versioning and changelog generation.

To release a new version seamlessly:

1. Make your code changes in a branch.
2. Open a Pull Request against `main`.
3. Add the **`autover-apply`** label to the Pull Request.
4. Merge the Pull Request.

Upon merge, the GitHub Action runner bumps the package version when the required label is present, regenerates `CHANGELOG.md`, and commits changed release metadata directly to `main`. Automatic tag creation is currently disabled by the workflow configuration.

> **Note:** Direct commits to `main` do not receive an automatic version bump, although the workflow may still refresh the changelog.
