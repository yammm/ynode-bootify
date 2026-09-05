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

Release metadata is prepared locally and publication is performed by the tag-only GitHub Actions workflow using npm trusted publishing.

1. Start from a clean, synchronized `main` branch.
2. Run `npm run release:patch`, `npm run release:minor`, or `npm run release:major`.
3. Review the generated changelog, signed commit, and signed `vX.Y.Z` tag.
4. Push both together with `git push --follow-tags`.

The helper runs every publication gate after setting the clean SemVer, stages only `package.json`, `package-lock.json`, and `CHANGELOG.md`, signs and signs off the release commit, and creates a signed tag. It never pushes or publishes. The release workflow verifies the signed tag, version, changelog, main-branch ancestry, and exact packed artifact before publishing with OIDC and registry provenance.

Configure the npm trusted publisher for this repository and `.github/workflows/release.yml`. Do not add a long-lived npm token.
