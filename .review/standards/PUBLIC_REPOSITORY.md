# Public Repository Standards

## Scope

Apply this profile to code intended for public use or inspection. Public quality is not cosmetic polish: consumers need accurate contracts, safe defaults, repeatable releases, and enough context to use the project correctly.

Do not turn optional community amenities into defects unless the repository claims them or their absence creates a concrete security, legal, or support risk.

## Consumer trust

- The repository's stated purpose, supported status, and maturity must match the actual implementation.
- Public examples, badges, generated documentation, release notes, and package metadata must not make stale or misleading claims.
- Remove secrets, internal hostnames, private paths, personal data, debug dumps, and placeholder content from tracked and published artifacts.
- Errors and logs exposed to consumers should be actionable without leaking sensitive internals.

## Public contracts and compatibility

- Inventory consumer-visible APIs, configuration, commands, file formats, and integrations before judging compatibility.
- Document supported runtimes, platforms, dependency ranges, and known limitations.
- Use the project's versioning policy consistently. Give breaking changes migration guidance and an appropriate release boundary.
- Keep deprecations usable long enough for the supported audience to migrate.
- Do not advertise compatibility that CI, tests, or a reproducible check does not exercise.
- State which exact runtime boundaries and operating systems are actively tested, how newly released versions become supported, and when upstream-EOL versions stop receiving fixes. Do not let an open-ended version constraint imply unverified future compatibility.

## Documentation and examples

- The README should let a new consumer understand the purpose, install the project, complete a minimal successful use, and find deeper documentation.
- Document inputs, outputs, errors, side effects, security-sensitive behavior, and cleanup responsibilities where consumers need them.
- Examples must use current, supported APIs and safe practices.
- License identifiers and files must agree. Document material third-party obligations where applicable.
- Changelog and migration notes should describe consumer-visible effects, not only internal implementation.

## Security and disclosure

- Publish a root `SECURITY.md`, or an equally discoverable linked policy, with a private vulnerability-reporting path, supported versions, expected response process, coordinated-disclosure guidance, and any safe-harbor language the project adopts. Do not direct undisclosed vulnerabilities into a public issue tracker.
- Document supported versions for security fixes when multiple release lines are maintained.
- Keep repository and automation permissions least-privileged.
- Prevent untrusted contributions from accessing publish credentials or other secrets.
- Review third-party automation, dependencies, and install hooks as code that can affect maintainers or consumers.

## Repository and release hygiene

- CI should verify the same build, tests, types, lint, documentation, and packaging paths relied on for release.
- Releases should be reproducible from a clean checkout with documented tooling.
- Version, tag, release notes, published artifact, and supported-branch claims should agree.
- Generated artifacts and vendored code should have clear provenance and update paths. Record the upstream source and immutable revision or digest, integrity evidence where available, applicable license, and reproducible refresh procedure; do not treat a copied file or mutable tag as provenance.
- Development-only files, fixtures, credentials, and large accidental artifacts should not ship to consumers.

## Review posture

- Prioritize issues that affect users, contributors, security, compatibility, or maintainability.
- Treat public presentation as evidence of a contract, not an invitation to report aesthetic preferences.
- State residual risk when release infrastructure or published artifacts are not available for inspection.
- It is acceptable to report no public-repository finding when the inspected surfaces are coherent and the remaining gaps are non-material.
