# TypeScript Standards

## Scope

Apply this profile to TypeScript application code, libraries, declarations, tests, and repository tooling. Use it alongside `JAVASCRIPT.md`; TypeScript does not replace JavaScript runtime correctness, async lifecycle, security, or platform standards.

Use a stricter checked-in project policy when one exists.

## Compiler strictness

- Enable `strict` for new projects and keep it enabled once adopted.
- Consider `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `useUnknownInCatchVariables`, and `noFallthroughCasesInSwitch` where the supported toolchain permits them.
- Type-check every production build. Do not publish or deploy output produced from known type errors.
- Do not weaken repository-wide compiler settings for one unsafe dependency or legacy module. Isolate the exception behind a typed adapter, declaration shim, or scoped migration.
- Treat `skipLibCheck` as a dependency compatibility tradeoff, not proof that declarations are valid.
- Keep application, test, build-script, and declaration configurations explicit. Files must not escape type checking accidentally through broad exclusions or a mismatched build configuration.

For an existing non-strict project, improve strictness incrementally without presenting the remaining unchecked surface as type-safe.

## Trust boundaries and runtime validation

Static types disappear at runtime. Treat values from JSON, HTTP, storage, environment variables, command-line arguments, databases, IPC, plugins, and untyped dependencies as untrusted until validated.

- Receive untrusted values as `unknown`, validate them at the boundary, then convert them into a domain type.
- Use a runtime schema, parser, or complete type guard when structure matters. A type assertion is not validation.
- Keep runtime rules and TypeScript types derived from the same source when practical; otherwise test that they remain aligned.
- Do not spread, destructure, or pass unvalidated objects into trusted domain code.
- Model parsing as a possible failure. A generic function that accepts arbitrary input and promises caller-selected `T` without validation is unsound.

## `unknown`, `any`, and assertions

- Prefer `unknown` when a type is not yet established.
- Avoid explicit and inferred `any`. Contain unavoidable third-party `any` in the smallest adapter and return a verified type.
- Do not use `Record<string, any>`, `Object`, `{}`, or `Function` as substitutes for an unknown or explicit shape.
- Treat `as`, non-null assertions, and custom type predicates as claims that require a demonstrable invariant.
- Avoid double assertions such as `value as unknown as T`. If an interoperability boundary genuinely requires one, isolate and document it and add a focused test.
- Prefer `satisfies` when checking conformance while preserving useful inferred types.
- Use `@ts-expect-error` rather than `@ts-ignore` for a deliberate expected error. Explain why it is expected and remove it when the reason expires.

## Narrowing and domain models

- Narrow with validated properties, discriminants, built-in checks, or complete guards before use.
- Do not use truthiness when `0`, `false`, or an empty string is valid.
- Represent mutually exclusive states with discriminated unions instead of optional-field bags that permit impossible combinations.
- Make switches over closed unions exhaustive so a new variant produces a type error until required behavior is handled.
- Distinguish missing, `undefined`, and `null` when they have different contractual meanings.
- Capture or copy values when mutation, callbacks, or asynchronous work could invalidate an earlier narrowing.
- Use `readonly` when immutability is part of ownership or the public contract, not merely as decoration.

A custom type guard must verify every property its predicate claims. An incomplete guard is more dangerous than an ordinary boolean because it misleads all downstream code.

## Generics and advanced types

- Use a generic when it expresses a real relationship among inputs, callbacks, stored state, and outputs.
- Avoid caller-selected return types implemented by assertion.
- Give type parameters meaningful constraints and defaults. Do not default a public generic to `any`.
- Prefer inference at call sites; require explicit type arguments only when they communicate information the compiler cannot infer safely.
- Use overloads or discriminated input/output unions when runtime behavior changes by mode. Test every public branch.
- Keep conditional, recursive, and mapped types understandable and bounded. Replace clever type machinery when it creates misleading errors, excessive compiler work, or an API consumers cannot reasonably use.
- Do not add a generic merely to conceal a concrete dependency or avoid defining the domain model.

## Public APIs and declarations

Exported values and types are versioned contracts.

- Give exported functions and public class methods intentional parameter and return types so refactoring does not silently alter declarations.
- Review emitted declaration files, not only editor inference.
- Keep runtime exports, type exports, documentation, and package entry points aligned.
- Do not expose private, unnameable, or dependency-internal types through the public declaration surface.
- When a public type depends on another package, ensure consumers can resolve a compatible declared dependency.
- Treat narrowed inputs, widened outputs, changed generic defaults or constraints, reordered overloads, removed union members, and new required properties as possible breaking changes.
- Avoid ambient globals, module augmentation, and declaration merging unless they are an intentional, documented integration contract.
- Do not claim TypeScript support when the published artifact contains stale, missing, or unresolvable declarations.

For published packages, use `PUBLIC_NPM_PACKAGE.md` to verify that packed entry points resolve to the intended declarations across claimed module and consumer modes.

## Tests and validation

Use the repository's configured toolchain as the authority. Applicable gates include:

- a clean `tsc --noEmit` check or equivalent build that fails on type errors;
- lint, runtime tests, build, documentation, and package validation;
- declaration generation from a clean checkout;
- inspection of emitted `.d.ts` files for sound, intentional public types;
- positive type tests for documented use and negative tests using `@ts-expect-error`;
- representative and boundary TypeScript compiler versions for any explicitly supported version range.

For published libraries, delegate packed entry-point resolution and clean consumer fixtures to `PUBLIC_NPM_PACKAGE.md`. Delegate runtime, module-loader, and platform matrices to the applicable runtime and packaging profiles.

Type checking does not replace runtime tests. Add runtime coverage for parsing, errors, async behavior, cleanup, and behavior the type system cannot prove.

Repository TypeScript helpers, generators, migrations, validators, and build scripts carry the same strictness, documentation, error-handling, and testing expectations as application code.

## Primary references

- [TypeScript narrowing and discriminated unions](https://www.typescriptlang.org/docs/handbook/2/narrowing)
- [TypeScript module compiler options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options)
- [TypeScript declaration files](https://www.typescriptlang.org/docs/handbook/declaration-files/introduction)
