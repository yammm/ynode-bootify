# Core Coding Standards

## Scope

These are cross-project defaults for production code and repository tooling. They supplement the target repository's checked-in rules; they do not override a deliberate project contract, configured tool, or language-specific standard.

Apply a rule only where it is relevant. A review finding still needs concrete evidence, impact, and a proportionate remedy.

## Priority

Use this order when standards compete:

1. Correctness, security, privacy, and data integrity.
2. Public contracts and backward compatibility.
3. Reliability, operability, and resource safety.
4. Simplicity, clarity, and maintainability.
5. Performance supported by an actual workload.
6. Local consistency and subjective preference.

## Correctness and data integrity

- Make state transitions and invariants explicit enough to verify.
- Handle empty, missing, malformed, boundary, and unusually large inputs at the boundaries where they can occur.
- Avoid silent data loss, partial writes presented as success, ambiguous units, lossy conversions, and time-zone or locale assumptions.
- For filesystem-backed state that must not expose a partial replacement, write and validate a temporary file in the destination directory, flush data and metadata when the durability contract requires it, then use the platform's verified atomic-replacement primitive. Define recovery separately; atomic visibility does not by itself guarantee persistence after a crash or power loss.
- Preserve idempotency where operations may be retried.
- Do not hide a contract violation behind a fallback that makes incorrect state look valid.
- Use deterministic behavior and error handling when nondeterminism is not part of the contract.

## Interfaces and compatibility

- Treat exported functions, types, events, configuration, CLI behavior, stored data, wire formats, documented defaults, and observable timing as contracts.
- Prefer additive, backward-compatible evolution. When a breaking change is intentional, document the migration and apply the repository's versioning policy.
- Keep implementation, types or schemas, examples, and public documentation in agreement.
- Validate untrusted input at the system boundary. Do not duplicate defensive checks inside code whose invariants are already guaranteed.
- Make error semantics stable enough for callers to handle deliberately.

## Async, concurrency, and resource lifecycle

- Await or deliberately detach asynchronous work; detached work needs explicit ownership and error handling.
- Account for cancellation, timeouts, retries, duplicate delivery, ordering, and partial failure when the surrounding system permits them.
- Avoid races, stale reads, double completion, unhandled rejection, unsafe shared state, and check-then-act gaps.
- Release timers, listeners, subscriptions, streams, files, sockets, child processes, locks, and temporary resources on both success and failure.
- Respect backpressure and bounded concurrency where work or input can grow.
- Measure elapsed time, durations, deadlines, timeouts, and backoff with a monotonic clock that is not affected by wall-clock adjustments. Use an appropriately timezone-aware wall clock, normally UTC, for event timestamps and externally meaningful instants.

## Errors, logging, and observability

- Errors should preserve the useful cause and enough context to diagnose the failure without exposing secrets or personal data.
- Do not swallow errors unless the contract explicitly permits it and the fallback is observable.
- Logs and metrics should help distinguish user error, dependency failure, programming defects, and expected control flow.
- Avoid duplicate logging at multiple layers and avoid noisy logs on hot paths.
- Never log credentials, tokens, private keys, session material, or unnecessary user data.

## Security and privacy

- Identify trust boundaries before recommending controls.
- Use safe platform primitives instead of constructing commands, paths, queries, markup, or protocols by string concatenation with untrusted data.
- Apply least privilege to filesystem, network, workflow, and external-service access.
- Keep secrets out of source, examples, fixtures, generated artifacts, error messages, and logs.
- Minimize collection and retention of sensitive data; document unavoidable handling.
- Assess dependencies and advisories by reachability and production impact, not raw counts alone.

## Architecture and dependencies

- Keep responsibilities, ownership, and dependency direction clear.
- Treat security, privacy, logging, observability, and auditability as design inputs and acceptance criteria, not features to bolt on after implementation.
- Prefer the smallest design that satisfies current requirements and credible extension points.
- For behavior-rich systems, prefer domain-oriented modeling and domain-driven boundaries over organizing the design around MVC controllers and views. Do not impose DDD ceremony on a trivial utility or simple CRUD surface whose domain does not justify it.
- Introduce an abstraction when it removes repeated policy, establishes a real boundary, makes substitution necessary, or materially improves testing.
- Do not introduce Dependency Injection, Factory, Observer, a service layer, or another named pattern for a one-off operation or hypothetical future need.
- Avoid circular dependencies, hidden global state, and cross-layer reach-through.
- Keep side effects obvious and concentrate filesystem, database, network, process, and other mutable I/O at explicit edges around a testable domain core.
- Isolate external systems and volatile details behind narrow contracts when that reduces coupling or failure spread.
- Every new dependency should earn its runtime, security, maintenance, and compatibility cost.

## Algorithms and performance

- Choose algorithms and data structures appropriate to expected input sizes and access patterns.
- Avoid unbounded work, accidental quadratic behavior, repeated serialization, N+1 I/O, unnecessary full-data buffering, and avoidable work on hot paths.
- Prefer clear code over speculative micro-optimization.
- Support material performance claims with a benchmark, profile, complexity argument, or production evidence.
- Preserve correctness and observability under load; faster incorrect behavior is not an improvement.

## Consistency and readability

- Follow the established naming, module, error, async, and test patterns in the relevant area unless they cause a demonstrated problem.
- Names should reveal domain meaning, units, ownership, and boolean intent.
- Keep functions and modules cohesive, focused on one responsibility, and easy to understand and test. Split them when distinct domains, side-effect boundaries, or change ownership are coupled; do not use an arbitrary line count as a substitute for that design judgment.
- Prefer guard clauses, early returns, and early `continue` statements when they reduce nesting without obscuring required cleanup or control flow.
- Do not put `else` or `else if` after a branch that always transfers control with `return`, `break`, `continue`, `throw`, or a language-appropriate `goto`; unindent the remaining path.
- Extract a non-trivial, reused, or domain-significant loop condition into a named predicate function. Keep an obvious one-expression condition inline.
- In languages that provide both prefix and postfix increment or decrement, prefer `++x` to `x++` and `--x` to `x--` when the prior value is not consumed and the change preserves semantics.
- Prefer double quotes wherever quote choice is purely stylistic. When quote forms change grammar, type, interpolation, expansion, escaping safety, or identifier meaning, use the language-required or safer form instead; the applicable language profile owns those semantic exceptions.
- Replace magic values with named constants or types when the value encodes policy, a protocol, or a non-obvious unit.
- Prefer explicit data models over loosely structured maps when shape and invariants matter.
- Remove dead code, debug output, stale compatibility branches, and misleading TODOs when their removal is in scope and safe.
- Let configured formatters and linters own mechanical style.

## Documentation

- Document public behavior, inputs, outputs, errors, side effects, lifecycle, compatibility, and important limitations.
- Comments should explain intent, invariant, risk, or non-obvious tradeoff rather than restate syntax.
- Update or remove stale comments in the same change that invalidates them.
- Keep examples executable or otherwise verifiable against the supported API.
- Document deliberate exceptions close to the rule they override.

## Tests

- Test observable behavior and contracts rather than private implementation details.
- Every new behavior should have automated coverage, and every bug fix should have a focused regression test. When useful automation is genuinely impractical, explain why and identify the manual or alternative evidence.
- Cover meaningful success, boundary, invalid-input, dependency-failure, concurrency, cancellation, cleanup, and compatibility paths as applicable.
- Keep tests deterministic, isolated, and independent of execution order.
- Avoid sleeps, hidden network access, over-broad snapshots, and mocks that merely restate the implementation.
- Exercise handwritten parsers, codecs, serializers, and protocol implementations with fuzz or property-based tests where practical. Add round-trip invariants and differential tests against an independent reference implementation when those comparisons can reveal defects rather than merely duplicate the same algorithm.
- Treat coverage as evidence, not a quota. Name important untested contracts instead of celebrating a percentage.

## Repository tooling and generated code

- Helpers, generators, validators, migrations, and one-off scripts are production code. They require the same clarity, safety, typing, documentation, error behavior, and focused tests as application code.
- Generated files must identify their source and regeneration path when the repository convention allows it.
- Edit the source of generated output, not the output alone.
- Generation and validation should be reproducible and should not leave unexplained worktree changes.
- Prefer existing repository tooling over ad hoc replacement scripts.

## Validation

- Encode repeatable mechanical rules in the repository's formatter, linter, type checker, tests, or CI rather than relying on reviewer memory alone.
- In a legacy or dynamically typed codebase, introduce static checking in bounded modules or domain slices, type the external boundaries first, and ratchet coverage so new unchecked islands are not added. Do not make a whole-repository conversion a prerequisite for useful incremental checking.
- Use the most relevant configured checks for the changed behavior: targeted tests, type checks, lint, build, documentation generation, packaging, and a minimal smoke test.
- Run focused checks first. Run broader suites when the change crosses boundaries or the project requires them.
- Report commands and outcomes exactly. A check that was not run did not pass.
- If a required gate cannot run, explain why and name the next-best check.
