# Public npm Package Standards

## Scope

Apply this profile with `CODING_STANDARDS.md` and `PUBLIC_REPOSITORY.md` to a public npm package. Review the artifact consumers install, not only the source checkout.

Also apply `JAVASCRIPT.md` and `TYPESCRIPT.md` when those language layers are present, and `NODEJS.md` when the package claims a Node.js runtime target. This profile owns the published artifact, consumer compatibility, SemVer, package metadata, and release path; the companion profiles own language and runtime implementation behavior.

Only apply checks to formats, runtimes, bundlers, or platforms the package actually claims to support.

## Public API and SemVer

Inventory consumer-visible surfaces:

- root and subpath exports;
- ESM and CommonJS entry points;
- TypeScript declarations and generics;
- public functions, classes, errors, events, callbacks, defaults, and side effects;
- CLI commands, flags, exit codes, stdout, and stderr;
- configuration keys and environment variables.

For a change review:

- compare behavior and types with the intended base or previous published release;
- treat removed exports, blocked deep imports, changed defaults, stricter validation, altered errors, different async timing, narrower types, changed peer ranges, and raised runtime requirements as possible breaking changes;
- state the SemVer implication and the affected consumer path;
- require deprecation or migration guidance when an upgrade is not transparent;
- do not assume runtime compatibility proves TypeScript source compatibility.

## Package metadata and published contents

Review applicable `package.json` fields, including:

- `name`, `version`, `license`, `repository`, `bugs`, and `homepage`;
- `engines`, `packageManager`, and OS or CPU restrictions;
- `type`, `main`, `module`, `types`, `browser`, `bin`, and `exports`;
- `files`, `sideEffects`, `publishConfig`, workspaces, and lifecycle scripts;
- runtime, development, peer, optional, and bundled dependency classification.

Verify that:

- every declared entry point exists in the published artifact;
- runtime exports and type declarations describe the same API;
- required build output, declarations, source maps, README, and license are present when promised;
- credentials, local configuration, and unintended tests, fixtures, or large artifacts are absent;
- intentionally shipped fixtures, templates, examples, test utilities, or other non-runtime assets are documented, exported when appropriate, size-reviewed, and exercised from the packed artifact;
- conditional exports resolve correctly for every claimed module mode;
- adding or narrowing `exports` does not unintentionally block supported deep imports;
- dual ESM/CommonJS output does not create duplicate state, constructor identity failures, or incompatible default/named exports;
- `sideEffects` and tree-shaking claims match initialization behavior.

Inspect lifecycle scripts before running `npm pack --dry-run` because pack and prepare hooks can execute code or modify generated output. Run packaging checks only when they stay within the review's authorization and validation limits.

## Runtime compatibility claims

- Check the packed executable output against the supported runtimes, versions, and module modes the package claims, including relevant boundary versions.
- Treat syntax, built-in API, global, module-resolution, and dependency-engine mismatches as consumer compatibility defects.
- When the package claims a Node.js API or CLI target, apply `NODEJS.md` for stream, resource, filesystem, process, and network behavior.
- Keep `engines`, README support statements, release policy, and CI exact. Test the precise minimum version, not only its major-version alias, plus every actively supported Node.js LTS line inside the advertised range. A newly released major is not confirmed merely because an open-ended engine range accepts it.
- For a cross-platform CLI or tool, run consumer tests on Linux and Windows at minimum. Add macOS and other platforms when explicitly claimed or when path, process, filesystem, native-module, or launcher behavior differs there.
- Publish a Node.js support and end-of-life policy. Removing a runtime line, retaining an upstream-EOL line, or adding a newly released line is a deliberate compatibility and security decision that must agree with CI and release notes.
- Apply `JAVASCRIPT.md` for language-level async and runtime semantics rather than duplicating those rules here.

## Dependencies and supply chain

- A dependency imported by installed runtime code must not exist only in `devDependencies`.
- Peer dependency ranges should express actual compatibility without forcing unnecessary duplication or accepting untested majors.
- Optional and bundled dependencies need deliberate fallback and licensing behavior.
- Pin build, test, and release dependencies through the reviewed package-manager lockfile, including the expected registry source and integrity metadata. Do not build or publish with dependencies fetched from mutable Git refs, floating package tags, or undigested archive URLs.
- Audit install, prepare, prepack, and postinstall scripts; consumer-machine execution needs a clear reason.
- Assess advisories by reachable production behavior rather than raw `npm audit` counts.
- Configure reviewed dependency-update automation for npm manifests and lockfiles. It should surface direct and transitive updates on a predictable cadence, run the same consumer and compatibility gates as ordinary changes, and avoid merging major or security-sensitive changes without review.
- Define a vulnerability policy with a triage owner, supported release lines, reachability assessment, remediation targets, disclosure handling, and an owner plus expiry for every accepted exception. A green audit command or an unfiltered advisory count is not the policy.
- Prevent publish credentials from reaching untrusted pull-request code.
- Prefer npm trusted publishing through OIDC and registry-generated provenance over a long-lived automation token when the release environment supports it. Grant `id-token: write` only to the publishing job, restrict the trusted publisher to the intended repository and workflow, publish the exact tested artifact, and verify the resulting provenance from a clean consumer path. If a token remains necessary, scope, protect, rotate, and audit it as a documented fallback.

## Documentation and consumer experience

- Verify README install and quick-start examples against the packed package when practical, not only the source checkout.
- Document supported runtimes and versions, module formats, public entry points, inputs, outputs, errors, side effects, and cleanup obligations.
- Keep examples, JSDoc or TSDoc, declaration files, README, and runtime behavior synchronized.
- Give breaking or behavior-changing releases useful migration notes.
- Do not advertise browser, bundler, tree-shaking, TypeScript, or cross-platform support without a credible validation path.

## Tests and CI

Use applicable checks:

- focused regression tests for confirmed defects;
- package-consumer tests that install the generated tarball in a temporary project and import only supported entry points;
- type-level tests for documented TypeScript use and expected failures;
- the exact minimum and every actively supported Node.js LTS line inside the claimed range when Node.js support is claimed;
- ESM, CommonJS, subpath, CLI, browser, or bundler paths only when claimed;
- applicable behavioral tests required by the language and runtime profiles;
- clean lockfile install, lint, types, tests, build, documentation, and package validation in CI;
- Linux and Windows consumer lanes for cross-platform commands or tools, plus every additional operating system whose behavior is explicitly claimed.

Reject flaky timing assumptions, hidden network dependencies, order-dependent tests, and snapshots that conceal meaningful behavior changes.

## Release readiness

- Version, changelog, Git tag, release, npm dist-tag, and published contents should agree.
- Test the exact artifact intended for publication.
- Review `prepack`, `prepare`, and other lifecycle behavior for missing, duplicate, environment-dependent, or mutating builds.
- Confirm registry, access level, workspace selection, and publish configuration are intentional.
- Release failure should not leave unexplained version changes, generated files, tags, or partial public state.

## High-value validation

When safe and supported by existing tooling:

1. inspect `package.json` and the build/release scripts;
2. run the repository's focused test, type, lint, build, and docs gates;
3. inspect `npm pack --dry-run` output;
4. test the tarball from a clean temporary consumer;
5. exercise each claimed entry mode and relevant runtime boundary, including the minimum supported Node.js version when Node.js support is claimed;
6. confirm the worktree has no unexplained changes.

Report unperformed checks as residual risk, not as failures.
