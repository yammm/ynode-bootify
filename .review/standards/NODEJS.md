# Node.js Runtime Standards

## Scope

Apply this profile to Node.js services, command-line tools, workers, build tools, repository automation, and server-side libraries.

Use it with `CODING_STANDARDS.md` and `JAVASCRIPT.md`. Add `TYPESCRIPT.md` for TypeScript source and `PUBLIC_NPM_PACKAGE.md` only for a published npm package. Packaging, exported artifact, SemVer, and registry-release rules belong in the npm profile.

Use stricter checked-in project rules when present.

## Runtime contract and compatibility

- Treat `package.json#engines`, version files, toolchain configuration, containers, CI matrices, and documentation as one runtime contract. Report conflicts rather than guessing which source is authoritative.
- Validate executable output, not only source, against the declared deployment or consumer contract. Test a pinned service on its deployed Node.js versions; test a ranged library on boundary and representative versions.
- Put packed consumer matrices for public libraries in `PUBLIC_NPM_PACKAGE.md`; this profile owns Node.js runtime behavior.
- Check syntax, built-in APIs, global Web APIs, module loading, runtime flags, dependency engine requirements, and native-addon constraints against claimed support.
- Use the `node:` prefix for every Node.js built-in import.
- For a source-controlled JavaScript file invoked directly on Unix-like systems, prefer `#!/usr/bin/env node` when `/usr/bin/env` is supported and the caller's `PATH` is a trusted interpreter-selection boundary. Use a guaranteed absolute interpreter or controlled launcher for privileged or otherwise security-sensitive execution when a lower-trust caller can influence `PATH` or interpreter identity must be fixed. Keep generated package-manager launchers under their generator's installation contract.
- Prefer supported built-in Web APIs, including `fetch`, `Request`, `Response`, `Headers`, `FormData`, `URL`, `URLSearchParams`, Web streams, `AbortController`, and `AbortSignal`, before adding a dependency that duplicates them. Do not violate the declared runtime or behavioral contract to remove a proven compatibility dependency.
- Use `globalThis` when the global object is genuinely required; do not use the Node.js `global` alias.
- Keep `package.json#type`, file extensions, generated output, and `import`/`require` usage aligned. When ESM and CommonJS interoperate intentionally, test the actual Node.js loader behavior, export shape, and path-resolution assumptions.
- Do not use experimental, deprecated, undocumented, or internal Node.js APIs without an explicit compatibility policy and validation path.
- Treat a raised Node.js requirement as a deliberate deployment or consumer compatibility change.
- Do not substitute "latest Node.js passed" for testing the declared range.
- Define which Node.js release lines are actively supported and how upstream end-of-life changes that policy. Test the exact minimum patch version and each supported LTS line inside the claim; do not use a major-version alias as evidence for a higher minimum floor.
- Treat a new Node.js major as unverified until its runtime, dependency, native addon, and packed-consumer paths pass. If an open-ended `engines` range admits versions beyond the tested policy, document that distinction or narrow the range.

## Event loop and concurrency

- Use synchronous filesystem operations only during bounded initial bootstrap before the application accepts or begins its primary work. Use asynchronous filesystem APIs for the primary work and all subsequent runtime operations; an isolated script is not a general exception. Prefer extensionless Shell or Python entry scripts for one-off repository automation and apply their profiles.
- Keep request, event, and message-processing paths free of synchronous crypto, compression, subprocess, and other blocking work.
- Look for CPU-heavy loops, vulnerable regular expressions, unbounded microtask chains, recursive `process.nextTick()` use, and large serialization work that can starve the event loop.
- Account for worker-pool saturation from filesystem, DNS, crypto, compression, or native-addon work even when the API is asynchronous.
- Bound concurrent work, queue depth, response buffering, and fan-out according to a real capacity limit.
- Make ordering and shared-state assumptions explicit when callbacks, promises, timers, events, workers, or processes interact.
- Use worker threads or processes only when isolation or measured CPU-bound work justifies lifecycle and communication cost.
- Once measurement or a credible input bound shows CPU-heavy work would materially block the event loop, move it to a bounded worker pool or background job. Do not leave PDF parsing, image processing, large transforms, or equivalent work on a request or message-processing loop.

## Asynchronous errors and cancellation

- Return or await every promise. Deliberately detached work needs ownership, error reporting, cancellation, and shutdown behavior.
- Do not use async callbacks with APIs that ignore returned promises, including many event emitters, without an intentional adapter.
- Ensure callback-style APIs complete exactly once and preserve original error causes when translated.
- Every `EventEmitter` that can emit `error` needs an owner and an error path. Remove temporary listeners on completion, cancellation, and failure.
- Propagate `AbortSignal` through long-running I/O when the caller owns the operation. Define whether cancellation rejects, returns partial work, or completes cleanup first.
- On supported runtimes, prefer `AbortSignal.timeout()` to an unowned manual timeout timer. Preserve and propagate the caller's signal as well when both a caller cancellation and an operation deadline apply.
- For outbound HTTP, uploads, and long-running jobs, define deliberate deadlines, raw and decoded payload limits, bounded retry behavior, and the terminal partial-failure contract at the owning boundary.
- Treat unhandled rejections and uncaught exceptions as fatal programming failures. Every executable application entrypoint must install final `unhandledRejection` and `uncaughtException` handlers that emit one sanitized, structured fatal log and invoke the same bounded graceful-shutdown coordinator. Libraries must not install process-global handlers, and handlers must never make an unknown state appear safe to continue.

## Streams and backpressure

- Stream large files, uploads, downloads, database exports, and other payloads within a defined memory budget instead of materializing the complete payload in memory. Define the threshold from the deployment and concurrency contract.
- Prefer `stream.pipeline()`, `stream.finished()`, or async iteration when they make error propagation and cleanup reliable.
- Respect writable backpressure. Do not continue writing after `write()` returns `false` without waiting for the appropriate drain signal.
- Avoid collecting an unbounded stream into a string, array, or `Buffer`. Limit raw and decompressed content.
- Handle source, transform, destination, abort, and premature-close failures. Tear down the whole pipeline when one stage fails.
- Verify adapters between Node streams and Web streams preserve cancellation, backpressure, errors, and ownership.
- Test slow consumers, early disconnects, truncated input, and size limits.

## Resource ownership

- Give every timer, listener, stream, socket, server, file handle, watcher, child process, worker, and connection pool a clear owner.
- Release resources on success, failure, timeout, cancellation, and shutdown. Use `finally` or an equivalent lifecycle boundary where appropriate.
- Avoid timers or listeners that unintentionally keep the process alive. Use `unref()` only when abandoning work at process exit is contractually safe.
- Do not reuse mutable singleton state across requests unless concurrency, reset, and test-isolation behavior are intentional.
- Investigate leaked handles, increasing listener counts, and reconnect loops rather than hiding warnings.

## Signals and graceful shutdown

- Handle `SIGTERM` and `SIGINT` where the platform supports them through one idempotent shutdown coordinator.
- Stop accepting new work, mark the instance unready when applicable, drain in-flight work within a documented deadline, close owned resources, and preserve a meaningful exit status.
- Account for repeated signals and shutdown during partial startup.
- Avoid routine `process.exit()` calls that can discard buffered output or interrupt cleanup. Prefer `process.exitCode` and closing owned handles; force termination only after a bounded deadline.
- Ensure child processes and workers terminate or are deliberately handed off. Account for supported operating-system process-tree behavior.
- Do not claim graceful shutdown without a test covering real signal delivery and in-flight work.

## Filesystem, paths, and temporary data

- Use `node:path`, URL-aware helpers, and `fileURLToPath()` as appropriate. Do not assume the current working directory is the module or project directory.
- Specify encodings for text and preserve binary data as buffers.
- Validate user-influenced paths against the allowed root. Account for absolute paths, traversal, symlinks, and time-of-check/time-of-use races.
- Use `mkdtemp()` or an equivalent unique temporary location, restrictive permissions for sensitive data, and cleanup after success and failure.
- When atomic replacement is required, write a same-filesystem temporary file and rename it; document actual durability and cross-platform guarantees.
- Explicitly close `FileHandle` instances. Do not rely on garbage collection or process exit.
- Do not use synchronous filesystem operations after the bounded bootstrap exception defined above.

## Child processes and workers

- Prefer `spawn()` or `execFile()` with an argument array and `shell: false`. Never construct a shell command from untrusted input.
- Consume, redirect, or explicitly ignore child stdout and stderr so full pipes cannot deadlock the process.
- Bound captured output and define timeout, abort, exit-code, signal, and partial-output behavior.
- Distinguish `error`, `exit`, and `close` events; creation failure is not the same as a nonzero child exit.
- Propagate cancellation and shutdown to descendants. Do not assume killing the direct child terminates its process tree on every platform.
- Bound worker pools and queues. Define initialization, message validation, recovery, termination, and ownership of transferred or shared memory.
- Do not move ordinary asynchronous I/O into workers without evidence that it improves the workload.

## Configuration and environment

- Read and validate configuration at an explicit application boundary, then expose an immutable configuration object.
- Distinguish missing, empty, malformed, and defaulted values. Environment variables are strings; parse booleans, numbers, durations, URLs, and lists explicitly.
- Document precedence and validate required configuration before accepting work.
- Libraries must not silently load `.env` files or mutate `process.env`.
- Avoid passing the complete parent environment to less-trusted child processes; construct the required environment deliberately.
- Keep secrets out of defaults, errors, logs, snapshots, diagnostics, and child arguments visible in process listings.
- Do not overload `NODE_ENV` as a collection of unrelated feature flags.

## HTTP and network behavior

- Accept or generate a request or trace identifier at the request boundary, validate and bound externally supplied values, propagate the identifier through asynchronous and outbound work, and include it in structured logs.
- Configure bounded connection, TLS, header, body, response, idle, and overall-operation timeouts appropriate to the protocol and workload.
- Propagate cancellation through outbound requests and release or consume response bodies so connections can be reused safely.
- Limit headers and bodies before expensive parsing and after decompression.
- Use `URL` and protocol-aware clients instead of concatenating URLs.
- Restrict protocols, destinations, ports, redirects, and resolved addresses when requests can be influenced by untrusted input. SSRF protection is a connection-time control, not only a string check.
- Keep TLS verification enabled. A custom trust store or bypass needs a narrow, documented deployment reason.
- Retry only operations that are safe or idempotent. Bound attempts and elapsed time, use backoff with jitter, and preserve the final cause.
- Own and close servers, clients, agents, sockets, and pools during shutdown.
- Define behavior for disconnects, partial messages, malformed input, upstream failure, and responses that exceed limits.

## Node.js-specific security

- Avoid `eval()`, dynamic code generation, and `node:vm` for untrusted code; `vm` is not a security boundary.
- Do not derive module paths, subprocess commands, or filesystem targets directly from untrusted values.
- Prevent prototype pollution when merging untrusted keys.
- Use `Buffer.alloc()` for data that might be exposed. Use `allocUnsafe()` only when every byte is overwritten before observation.
- Use established cryptographic primitives. Do not invent encryption, token, or password-storage schemes.
- Treat the Node.js permission model, containers, and process isolation as defense in depth, not substitutes for authorization and input validation.

## Tests and validation

- Use the repository's configured runner, package manager, lockfile, scripts, and CI as the authority.
- Make unexpected warnings, leaked handles, background failures, and unhandled rejections fail tests when supported.
- Test concurrency, cancellation, timeouts, slow streams, disconnects, resource cleanup, and dependency failure where relevant.
- Test shutdown and subprocess behavior with real child processes rather than calling signal handlers as ordinary functions.
- Bind test servers to loopback and ephemeral ports. Avoid fixed ports, sleeps, hidden network access, and developer-machine state.
- Use isolated temporary directories and restore changed environment variables, globals, clocks, module caches, and process listeners.
- Run focused tests, lint or types, build, runtime smoke tests, and the Node.js versions required by the declared deployment or consumer contract.
- For substantial JavaScript implementations, add incremental implementation type checking with JSDoc-aware `checkJs` or an equivalent configured checker. Record the checked scope and excluded legacy boundaries, expand coverage as modules change, and keep the gate in CI; this does not require converting the project to TypeScript.
- Test cross-platform command, path, subprocess, signal, and launcher behavior on the actual supported operating systems. A cross-platform CLI needs Linux and Windows lanes at minimum, plus macOS or other platforms when claimed or behaviorally distinct.
- Report exact commands, runtime versions, and outcomes. An untested version or platform is residual risk, not a pass.

Public artifact inspection and clean-consumer installation belong to `PUBLIC_NPM_PACKAGE.md`.

## Primary references

- [Node.js event loop and worker pool](https://nodejs.org/learn/asynchronous-work/dont-block-the-event-loop)
- [Node.js streams](https://nodejs.org/api/stream.html)
- [Node.js filesystem](https://nodejs.org/api/fs.html)
- [Node.js process](https://nodejs.org/api/process.html)
