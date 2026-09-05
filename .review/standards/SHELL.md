# Unix Shell Standards

## Scope

Apply this profile with `CODING_STANDARDS.md` to POSIX `sh`, Bash, zsh, and other Unix-family command-shell programs; sourced shell libraries; command fragments in CI and packaging; and Unix shell code embedded in Makefiles, container definitions, deployment tools, or application launchers.

Treat shell as production code. A short maintenance command can delete data, publish an artifact, expose a secret, or leave partial state as easily as a larger application. Brevity and infrequent execution do not lower the quality bar.

The repository's declared shell dialect, implementation and minimum version, operating systems, utility set, invocation method, and portability claims are authoritative. Apply `MAKEFILE.md` to make recipe behavior and `CLI.md` when the script exposes a command-line interface.

This profile does not govern Windows `cmd.exe` or PowerShell source. Apply `BATCH.md` to `.cmd`, legacy `.bat`, or embedded Command Processor code and `POWERSHELL.md` to PowerShell scripts, modules, or fragments. Their filename, launcher, and shebang contracts are different.

## Dialect and runtime contract

- Identify whether each file is POSIX `sh`, Bash, zsh, or another exact Unix command shell. Do not infer the dialect from syntax that happens to work in the reviewer's interactive shell.
- A POSIX `sh` contract is a language and utility contract, not a promise that `/bin/sh` is Bash. Test with the actual `sh` implementations and POSIX edition the project supports.
- For Bash or zsh, record the minimum version. Arrays, associative arrays, conditionals, expansion flags, options, builtins, glob behavior, and signal handling differ across shells and versions.
- Do not mix `[[ ... ]]`, arrays, brace expansion, process substitution, here-strings, Bash-specific parameter expansions, zsh expansion flags, or implementation-only options into a POSIX script.
- Invoking Bash or zsh as `sh`, enabling a POSIX-emulation mode, or changing shell options can alter parsing and runtime behavior. Treat the invocation name and option state as part of the contract.
- Distinguish the shell language from external utilities. Portable shell syntax does not make GNU-only `sed`, BSD-only `stat`, nonstandard `readlink` options, or an assumed `mktemp` interface portable.
- Keep noninteractive execution independent of aliases, interactive startup files, prompts, terminal job control, and a developer's private shell options.
- Declare locale, `PATH`, `IFS`, `umask`, working-directory, and environment assumptions where they affect parsing, lookup, permissions, or output.

## Filenames, shebangs, and executable identity

- Prefer extensionless filenames for executable shell scripts. The command name should communicate the operation, not the implementation language. Retain an extension only when a repository convention, external tool, compatibility contract, or deliberately non-executable sourced-library convention requires one.
- Treat a published or widely invoked command pathname as an interface. Do not rename an existing `.sh` command merely to satisfy the preference without a compatibility path and caller migration.
- Every directly executable shell script must start at byte zero with `#!` and the interpreter required by its declared dialect. No byte-order mark, blank line, comment, or license header may precede the shebang.
- Use a declared `sh` interpreter only for code that honors the supported POSIX `sh` contract. Use the declared Bash, zsh, or other interpreter for code that requires that shell. Never use a generic shebang and rely on a caller's interactive shell to supply extensions.
- Prefer a PATH-resolving shebang such as `#!/usr/bin/env sh` or `#!/usr/bin/env bash` for portable, directly executable scripts when `/usr/bin/env` exists on every supported system and the caller's `PATH` is a trusted selection boundary. The security exception takes precedence: use a guaranteed absolute interpreter path or controlled launcher for privileged or otherwise security-sensitive scripts when a lower-trust caller can influence `PATH` or interpreter identity must be fixed. A selected executable name does not prove its version, so enforce the minimum shell version through deployment controls or an early actionable check.
- Do not place shell options or multiple conceptual arguments in a shebang unless every supported operating system's launcher defines the exact parsing. Keep the complete interpreter line within the smallest supported launcher's byte limit and test it directly; some kernels truncate excess bytes. `env -S` is a platform and version dependency, not a universal escape hatch. Set required shell options in reviewed code when practical.
- Commit the executable mode for an executable script. Use LF line endings so a carriage return cannot become part of the interpreter token, and retain a final newline.
- Test the file through its actual extensionless entry path, such as `./command`. Running `sh command` or `bash command` bypasses the shebang, executable mode, and interpreter-selection contract and is not a sufficient entry-point test.
- Ensure linters, formatters, repository discovery, packaging, and editor rules recognize extensionless files by their shebang or an explicit file list.

## Parameters, expansion, and quoting

- Shell quote forms are semantic, not interchangeable visual styles. Use single quotes for wholly literal text and double quotes when parameter, command, or arithmetic expansion is intended; do not replace the safer literal form only to satisfy the cross-language double-quote preference. Use dialect-specific forms such as ANSI-C quoting only when the declared shell and required escape semantics justify them.
- Quote parameter and command substitutions by default. Leave an expansion unquoted only when the required word splitting or pathname expansion is explicit, locally evident, and tested with empty and hostile values.
- Use `"$@"` to preserve the caller's argument boundaries. Do not substitute `"$*"`, unquoted `$@`, or a scalar assembled from arguments when exact boundaries matter.
- Distinguish unset from set-but-empty values. Choose `${name-word}` versus `${name:-word}`, and the assignment or error variants, according to the actual contract. Account for `nounset` behavior in every expansion path.
- Use braces where they disambiguate a parameter name or operation. Do not add visual noise that hides the expansion being performed.
- Treat command substitution as a text transformation: it removes trailing newline bytes and shell variables cannot preserve NUL bytes. Do not use it to transport arbitrary binary data or records whose trailing newlines matter.
- Do not store a command plus arguments in one string. Use a function, direct invocation, or a dialect-supported array so arguments remain data rather than reparsed shell source.
- Never use `eval`, `source`, `.` on a generated path, or `sh -c` to interpret untrusted or partially trusted data. A quoting pass does not make arbitrary shell source safe.
- Treat arithmetic input as syntax in shells where parameter values can be recursively interpreted as expressions. Validate the allowed numeric form before arithmetic evaluation when input is untrusted.
- Use `printf` for predictable formatted output. Do not rely on `echo` behavior for backslashes, leading options, or portable suppression of the newline.
- Understand which layer consumes each dollar sign, backslash, quote, glob, and newline when shell is embedded in make, YAML, JSON, SSH, or another shell. Escaping that is correct for one parser may expose syntax to the next.

## Globs, records, and pathnames

- Treat unmatched-glob behavior as part of the dialect and option contract. Bash, zsh, and POSIX shells do not all preserve, remove, or reject an unmatched pattern the same way.
- Do not parse `ls` output. Use direct globs for deliberately constrained names or a tool and record separator that can represent the supported pathname set.
- Avoid `for item in $(command)` and line-oriented `read` loops for arbitrary pathnames. Word splitting, backslashes, whitespace, glob characters, and missing final newlines can corrupt record boundaries.
- Use NUL-delimited producer and consumer options when both declared utilities support them and arbitrary non-NUL pathname bytes are in scope. Otherwise document and validate the narrower filename contract.
- Pass `--` before operands that may start with `-` when the exact utility supports it. For a pathname in the current directory, a `./` prefix can also disambiguate an option-like name.
- Quote redirection targets and validate derived output paths before opening them. Redirection happens before a command runs and can truncate a file even when the eventual command would fail.
- Account for symbolic links, hard links, mount points, case sensitivity, normalization, and time-of-check/time-of-use changes when a path crosses a trust or destructive boundary.

## Arrays and structured arguments

- POSIX shell has no array type. Do not emulate arbitrary argument arrays with delimiter-separated strings when values can contain that delimiter.
- In Bash, use indexed arrays for argument vectors and expand them with `"${args[@]}"`. Use associative arrays only when the minimum Bash version and iteration-order expectations are explicit.
- Do not copy Bash array assumptions into zsh. Index origins, splitting, subscript behavior, expansion flags, and option-dependent compatibility are different; use the zsh contract and tests.
- Keep data structures simple. When safe representation requires nested structures, binary records, extensive escaping, or a parser implemented in shell, use a language with an appropriate data model.

## Exit status, pipelines, and failure propagation

- Return zero only for the documented successful outcome. Preserve or map a failing command's status deliberately, and capture `$?` immediately before another command overwrites it.
- Do not treat `set -e` as complete error handling. Its effect depends on pipelines, `if`, `while`, `until`, negation, AND-OR lists, functions, subshells, command substitutions, and the exact shell.
- Check expected failures explicitly at the decision point. A command used as a predicate is clearer and more reliable than hoping `errexit` classifies it correctly.
- Treat `ERR` traps as dialect-specific diagnostics, not a universal exception mechanism. Their inheritance and suppression rules do not cover every failed command.
- Review `set -u` against optional parameters, empty arrays, indirect expansions, and cleanup paths. Strict options are useful only when code remains correct under their real semantics.
- Know which pipeline statuses are observable. Without active `pipefail` semantics, an early stage can fail while the pipeline reports the last command's success. POSIX.1-2024 defines `pipefail`, but earlier standards and deployed shells may not; declare and test the actual implementation.
- Do not assume each pipeline component mutates the parent shell. Components can run in subshell environments, so a loop fed by a pipeline may lose assignments after the pipeline completes.
- Preserve producer failures when consumers exit early. Decide whether a broken pipe is expected short-circuiting or an incomplete result rather than suppressing every nonzero pipeline status.
- Group compound operations so partial success cannot be published as full success. Avoid an unconditional final command whose zero status masks an earlier failure.

## Traps, temporary resources, and signals

- Install cleanup before creating the resource it owns. At handler entry, capture the incoming status before another command overwrites it. Make cleanup idempotent, quote every path, and guard its individual operations so `errexit` or one cleanup failure cannot skip the rest. Return the incoming status unless documented policy deliberately elevates a cleanup failure.
- Remember that a later `trap` for the same condition replaces the earlier one. Centralize or compose cleanup rather than silently dropping prior handlers.
- Handle `EXIT` for ordinary completion and error cleanup, and handle the supported termination signals when child processes or partial state need active coordination. Do not assume an `EXIT` trap runs after every possible kill, crash, power loss, or forced process termination.
- A successful `exec` replaces the shell without running its `EXIT` cleanup. Release owned resources before replacement or explicitly transfer their ownership to the new process. Do not assume a trap covers work performed in a replaced process or an independently created subshell environment.
- A signal trap is executed according to the shell's safe-point behavior, not as an arbitrary asynchronous application callback. Test signals while the script is waiting on both foreground and background work.
- After cleanup for a termination signal, preserve the command's documented cancellation semantics. Do not convert interruption to success or leave the caller unable to distinguish it from an ordinary application error.
- Create temporary files and directories with a race-resistant facility available on every supported system, restrictive permissions, and a location appropriate to the data. Do not predict a name in a shared directory.
- Validate that a temporary path is nonempty and inside the intended owned directory before recursive cleanup. Quote it and avoid a glob that can widen when a variable is empty or malformed.
- Prefer atomic replacement from a temporary file in the destination directory when an interrupted write must not appear complete. Flush or synchronize the file and directory when the declared durability contract requires it; atomic visibility, metadata preservation, and crash or power-loss durability are separate guarantees.
- Restore terminal modes and any caller-visible working directory, mask, lock, mount, or other process or host state on every supported exit path.

## Subprocesses, concurrency, and lifecycle

- Track every background process identifier that the script owns. Wait for all required work, collect each status, and define whether one failure cancels siblings or allows them to finish.
- Bound concurrency and input queues. A loop that backgrounds every item can exhaust processes, file descriptors, memory, network connections, or a downstream service.
- Propagate cancellation to owned children and wait for their termination. Do not assume signaling the immediate child reaches grandchildren, pipelines, remote commands, or detached process groups on every platform.
- Avoid fixed temporary names, ports, lock files, and output paths shared by concurrent invocations. Give each invocation isolated state or use a locking primitive whose filesystem and failure semantics are understood.
- Make locks recoverable after crashes without allowing two owners. A file's mere existence, a recorded PID, or advisory locking can have platform and namespace limitations that need explicit handling.
- Do not launch work that can outlive the script unless ownership, logging, failure reporting, cancellation, and later cleanup are transferred to a declared supervisor.
- Use timeouts only with defined termination and cleanup semantics. Killing a wrapper while leaving its operation active is not a successful timeout.
- Do not compute elapsed time or deadlines from a wall-clock utility that can jump. Use a declared monotonic-capable utility or supervising runtime, and move the logic out of shell when no portable supported primitive can satisfy the timing contract.

## Input, injection, destructive safety, and secrets

- Treat arguments, environment variables, standard input, configuration, filenames, repository contents, command output, and remote responses as untrusted until the applicable boundary validates them.
- Prefer fixed commands with separately quoted arguments. Do not concatenate user-controlled values into commands, remote-shell strings, regular expressions, format strings, or interpreter input.
- For destructive work, resolve the exact target, require an expected ownership or sentinel condition, reject empty and broad paths, and keep the operation beneath the authorized root. Never recursively remove a path built from an unchecked variable or wildcard.
- Make retries, partial progress, and reruns safe. A failure halfway through a migration, publish, permission change, or batch deletion needs idempotency, rollback, or an explicit recovery procedure.
- Do not download and execute code in one pipeline. Fetch to isolated storage, authenticate or verify it according to repository policy, inspect the result where required, and execute only after successful verification.
- Keep secrets out of command-line arguments, exported environments sent to less-trusted children, xtrace output, diagnostics, temporary files, process listings, shell history, and CI logs.
- Do not enable `set -x` around secret handling. If tracing is required, disable it before the secret can be expanded and restore it only after all secret values leave the traceable command path.
- Apply least privilege to filesystem, network, installation, signing, and deployment operations. Do not run an entire script as root because one narrow operation requires authorization.

## Portability and maintainability

- Prefer shell only when the operation is naturally command orchestration and the required quoting, state, and failure behavior remain reviewable. Move to a language with structured data and stronger libraries before shell becomes a fragile parser or application framework.
- Use shell functions to name repeated operations and isolate policy. Keep mutation, output, and exit-status contracts clear; shell has no enforced local scope in the portable language.
- Resolve the script's own location only when resources are intentionally relative to the installation. Invocation through symlinks and sourcing can make `$0`-based discovery ambiguous; define the supported behavior rather than copying a nonportable `readlink -f` recipe.
- Check every external option against the supported GNU, BSD, BusyBox, macOS, or other implementation. Similar utility names do not imply compatible flags, regular expressions, output, or in-place editing.
- Keep comments focused on dialect constraints, invariants, failure behavior, and non-obvious quoting. Do not let a comment claim portability that the configured checks do not exercise.
- Use narrow, explained ShellCheck directives. A file-wide exclusion or unreviewed generated suppression can hide a real quoting, source, or dialect defect.
- Let the configured formatter own layout. Configure shfmt with the declared dialect explicitly when shebang discovery or extensionless filenames might otherwise select the wrong parser.

## Tests and validation

Use the repository's configured commands as the authority. Applicable evidence includes:

- syntax checks with every claimed shell implementation and minimum version;
- ShellCheck with the declared dialect and sourced-file resolution, including justified directives and configured optional checks;
- shfmt or the configured formatter in check mode with the intended dialect;
- direct extensionless invocation that verifies first-byte shebang placement, executable mode, LF line endings, interpreter selection, and a final newline;
- success, expected negative results, unexpected dependency failure, malformed input, empty values, unset values, option-like operands, whitespace, glob characters, and the supported pathname boundary;
- pipeline failures at every stage, commands in conditional contexts, command substitutions, subshells, strict-option behavior, and exact exit statuses;
- `INT`, `TERM`, and other claimed signals while foreground and background work is active, verifying child termination, status, and cleanup;
- repeated and concurrent invocations, bounded-work tests, lock contention, fixed-resource collision checks, and interrupted temporary-file writes;
- TTY, redirected, piped, closed-input, minimal-environment, altered-locale, read-only, and noninteractive execution where supported;
- each claimed operating system, shell implementation, external utility set, and container or CI image rather than one developer workstation;
- destructive-operation tests against isolated sentinels proving neighboring, parent, source, and intentionally protected files remain untouched;
- secret canaries proving arguments, xtrace, diagnostics, process listings, temporary artifacts, and logs do not expose protected values.

Report exact shell and utility versions, environment assumptions, invocations, signals, and outcomes. A syntax pass does not prove expansion, cleanup, portability, or failure behavior. A run through `bash file` does not prove the file's direct executable contract.

## Primary references

- [POSIX.1-2024 Shell Command Language](https://pubs.opengroup.org/onlinepubs/9799919799/utilities/V3_chap02.html)
- [POSIX.1-2024 `sh`](https://pubs.opengroup.org/onlinepubs/9799919799/utilities/sh.html)
- [POSIX.1-2024 `exec` functions](https://pubs.opengroup.org/onlinepubs/9799919799/functions/exec.html)
- [Linux `execve(2)`](https://man7.org/linux/man-pages/man2/execve.2.html)
- [GNU Coreutils `env`](https://www.gnu.org/software/coreutils/manual/html_node/env-invocation.html)
- [Bash Reference Manual](https://www.gnu.org/software/bash/manual/bash.html)
- [The Z Shell Manual](https://zsh.sourceforge.io/Doc/Release/)
- [ShellCheck manual](https://github.com/koalaman/shellcheck/blob/master/shellcheck.1.md)
- [shfmt manual](https://github.com/mvdan/sh/blob/master/cmd/shfmt/shfmt.1.scd)
