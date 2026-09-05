# JavaScript Standards

## Scope

Apply this profile with `CODING_STANDARDS.md` to JavaScript in any supported runtime, including applications, libraries, workers, tests, and repository tooling.

This profile covers ECMAScript semantics and APIs. Combine it with other profiles only when they apply:

- `TYPESCRIPT.md` for TypeScript source and declaration contracts;
- `NODEJS.md` for Node.js runtime, process, filesystem, stream, and network behavior;
- `PUBLIC_NPM_PACKAGE.md` for package metadata, published artifacts, SemVer, and registry releases.

The repository's configured syntax level, module system, formatter, linter, documentation generator, and supported runtimes remain authoritative.

## Language semantics

- Use `const` unless reassignment is required and `let` when it is. Do not write `var` in new or maintained source. An unavoidable generated-output or isolated legacy-target compatibility constraint must be documented and fixed at its source or contained at that boundary.
- Use double quotes for string literals when the delimiter is a stylistic choice. Use template literals for deliberate interpolation or multiline content, not as a substitute quote style, and preserve another form only where generated syntax or a verified embedding boundary requires it. Let the configured formatter and linter enforce this house style.
- Use `===` and `!==`; do not use loose equality. Spell out intentional `null`-or-`undefined` checks rather than relying on `value == null`.
- Do not rely on implicit coercion unless the conversion is intentional and clear at the call site.
- Distinguish missing properties, `undefined`, `null`, and other falsy values when they have different contract meanings.
- Use `??` for a fallback when `false`, `0`, or an empty string is valid. Use `||` only when every falsy value should trigger the fallback.
- Prefer optional chaining to repetitive `&&` property guards when absence is permitted; do not let it hide a violated invariant.
- Use destructuring to select known fields, express defaults, and avoid repetitive property access when it improves clarity. Validate external data before destructuring it, and remember that defaults apply to `undefined`, not `null`.
- Use explicit numeric checks such as `Number.isNaN`, `Number.isFinite`, and safe-integer checks where special values or coercion matter.
- Supply a comparator when the intended sort order is not the default string order. Remember that `sort()` and other mutating collection methods change their receiver.
- Treat object spread, array spread, and common clone patterns as shallow operations. Trace nested aliasing when isolation matters.
- Prefer supported standard primitives such as `URL`, `URLSearchParams`, `Intl`, and `structuredClone()` to handwritten parsing, formatting, or JSON cloning. Verify that each primitive preserves the contract's values, prototypes, and compatibility requirements.
- Preserve receiver semantics when passing methods as callbacks; do not assume `this` remains bound.
- Make intentional switch fallthrough, assignment in conditions, and similarly non-obvious control flow explicit.

## Mutation and state

- Prefer pure functions and immutable transformations. When mutation is the deliberate contract, make it obvious in the API and function name.
- Do not mutate caller-owned objects, arrays, prototypes, or globals unless mutation is an explicit contract.
- Do not expose mutable internal collections or cached values when callers could violate invariants through a retained reference.
- Give module-level state clear ownership, reset behavior, and concurrency semantics.
- Avoid prototype mutation and monkey-patching outside a deliberately scoped compatibility layer.
- Avoid global state and direct use of runtime-specific global aliases such as `window` or Node.js `global`. When access to the global object is genuinely required, use `globalThis` and keep any singleton narrowly owned and lifecycle-aware.
- When copying is required, choose a method that preserves the values and prototypes the contract needs; serialization is not a general-purpose clone.

## Modules and dependency boundaries

- Prefer ECMAScript modules for new code when every supported runtime and consumer supports them. Preserve CommonJS only for an established project or compatibility contract, and test intentional interoperability. Follow the repository's import and export conventions consistently.
- Keep imports and exports explicit. Export the smallest supported surface.
- Keep module top levels side-effect free outside application entrypoints. This includes I/O, network calls, timers, global handlers, registration, and shared-state mutation; ordinary modules should declare and export behavior without executing the application. An entrypoint may perform deliberate, documented bootstrap after validating its configuration.
- Avoid circular imports. When one is unavoidable, verify initialization order, live bindings, and access-before-initialization behavior.
- Treat top-level `await` as an observable module-loading decision. Use it only when supported targets and dependent initialization behavior are verified.
- Keep runtime-dependent globals and APIs behind an explicit boundary so portable logic stays testable.
- Do not derive dynamic imports or module identifiers directly from untrusted input; map allowed values to known modules.

## Asynchronous behavior

- Prefer `async`/`await` for multi-step asynchronous control flow over long `.then()`/`.catch()` chains. Use direct promise composition when it is materially clearer.
- Await or return every promise.
- Never pass an `async` callback to `forEach`. Use `for...of` and `await` for sequential work or `await Promise.all(items.map(...))` for parallel work. Apply the same completion rule to `filter` and other synchronous iterators, which do not await returned promises.
- Do not use an `async` Promise constructor executor. Return or compose the existing promise.
- Choose `Promise.all`, `Promise.allSettled`, sequential execution, or bounded concurrency according to required failure and ordering semantics. A rejected `Promise.all` does not cancel work already started.
- Keep synchronous throws and promise rejections consistent with the documented API.
- Deliberately detached work must be visibly marked and needs explicit ownership, error reporting, cancellation, and shutdown behavior.
- When cancellation is supported, propagate the signal through every participating layer and define its observable result.
- Account for reentrancy and microtask ordering when callbacks can change state before awaited work resumes.
- Remove listeners, subscriptions, observers, and timers on every terminal path.
- A callback API must define whether invocation is synchronous or asynchronous, once or repeated; do not vary timing by code path unexpectedly.

## Data and API behavior

- Validate and normalize external object shapes before destructuring or property access in trusted domain code, including HTTP input, browser storage, third-party APIs, and cross-context messages.
- Encode or sanitize user-controlled and user-facing values for the exact output context. Never interpolate raw values into HTML strings or template markup; use the repository's context-aware renderer, escaping primitive, or reviewed sanitizer. HTML, attributes, URLs, CSS, JavaScript, logs, and shell commands are different sinks and must not share one assumed-universal escaper.
- Prefer an options object once an API would otherwise require more than three positional parameters, or earlier when booleans, units, or optional values would make a call ambiguous.
- Preserve distinctions among omitted, explicitly undefined, nullable, empty, and falsy fields during transformation.
- Do not use an ordinary object as an unrestricted dictionary for untrusted keys. Allowlist keys or use a representation without inherited-key collisions.
- Prefer `Map` for dynamic keyed collections and `Set` for membership. Use ordinary objects for fixed record-like data and JSON-shaped contracts.
- Use own-property checks when inherited properties must not satisfy a contract.
- Account for JSON's handling of `undefined`, sparse arrays, non-finite numbers, `BigInt`, dates, maps, sets, symbols, and cyclic references before treating serialization as lossless.
- Define ownership and mutation of objects returned from APIs or emitted in events.

## Errors

- Throw `Error` instances or deliberate subclasses, not strings or arbitrary values.
- Preserve an original failure through `cause` or equivalent structured context when translating it.
- Keep public error classes, codes, and rejection behavior stable when callers are expected to branch on them.
- Do not convert an unexpected failure to `undefined`, `null`, or an empty collection unless that value is the documented result.
- Catch at the layer that can add context, retry safely, translate a boundary, or recover; otherwise allow the error to propagate.

## JSDoc

- Document every exported function and public method, plus internal code whose invariants, lifecycle, or failure behavior are not clear from implementation.
- Keep `@param`, `@returns`, `@throws`, callback, and promise documentation aligned with runtime behavior.
- Distinguish optional, nullable, and defaulted values. Document units, mutation, ownership, side effects, callback timing, and cleanup obligations where relevant.
- Prefer named `@typedef` and `@callback` declarations for reused or complex shapes when supported by the configured tools.
- Use only syntax accepted by the repository's JSDoc parser, documentation generator, and JavaScript type checker. Do not assume TypeScript-flavored inline syntax is accepted.
- Keep examples executable or covered by documentation checks.

## Tests

Add focused coverage for applicable JavaScript-specific risks:

- omitted, `undefined`, `null`, falsy, malformed, and boundary values;
- coercion, numeric edge cases, ordering, mutation, and shared references;
- inherited or hostile object keys at external boundaries;
- synchronous throws versus asynchronous rejection;
- promise aggregation, ordering, cancellation, reentrancy, and cleanup;
- module initialization, import side effects, and circular dependencies;
- serialization round trips and intentionally lossy transformations;
- callback invocation count and observable timing;
- fuzz, property, round-trip, and independent differential behavior for a handwritten parser, codec, serializer, or protocol implementation.

Use fake clocks only when they preserve the behavior under test. Control both timers and promise microtasks deliberately; do not replace an ordering assertion with arbitrary sleeps.

## Validation

Use the repository's configured commands as the authority. Run applicable:

- formatter and JavaScript linter checks;
- configured JavaScript type analysis, including JSDoc checking when enabled;
- focused tests followed by the required broader suite;
- module import, build, or transpilation checks for claimed targets;
- documentation generation for changed JSDoc or public APIs;
- runtime-specific checks from the applicable companion profile.

Do not introduce a parallel lint, type, module, or build configuration merely to review a change. Report every unrun or unsupported gate as residual risk.

For maintained JavaScript that does not yet have repository-wide static checking, adopt the repository-compatible JSDoc-aware checker incrementally, such as `checkJs` or scoped `// @ts-check`. Start with public and external-data boundaries, fix or narrowly explain suppressions, and ratchet the checked surface instead of waiting for a wholesale TypeScript conversion.

## Primary references

- [MDN JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [MDN using promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises)
