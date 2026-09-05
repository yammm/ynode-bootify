# Windows Command Script Standards

## Scope

Apply this profile with `CODING_STANDARDS.md` to repository-authored Windows Command Processor scripts, legacy batch programs under review, and `cmd.exe` fragments embedded in CI, installers, Makefiles, package scripts, or launchers.

`BATCH.md` is the profile category name. It does not endorse the `.bat` suffix. Use `.cmd` for every new or renamed repository-authored command script. Do not create new `.bat` files under any circumstances. Review an existing `.bat` file under this profile, but do not rename a published or externally invoked path without a compatibility and caller-migration plan.

Treat command scripts as production code. A short launcher can select the wrong runtime, corrupt arguments, expose a secret, delete an unintended path, or hide a failed build as easily as a larger program.

The repository's declared Windows versions, `cmd.exe` behavior, command extensions, invocation method, executable lookup rules, code page, utilities, and compatibility promises are authoritative. Combine this profile with `CLI.md` for a command-line interface and `APPLICATION_SECURITY.md` for a deliberate application-security deep dive. Use `POWERSHELL.md` for PowerShell code and `SHELL.md` for Unix command-shell code; their filename and shebang rules do not apply to `.cmd` files.

## Runtime and invocation contract

- Declare the supported Windows client and server versions, architectures, and whether the script runs under the inbox `%SystemRoot%\System32\cmd.exe` or a separately controlled compatible processor. Acceptance by one interactive prompt does not prove the deployed contract.
- Record whether command extensions and delayed expansion are enabled. Start a normal script with `setlocal EnableExtensions DisableDelayedExpansion` unless a documented compatibility requirement demands another state. Clear an inherited real variable named `ERRORLEVEL` inside that localized scope so it cannot shadow `cmd.exe`'s dynamic status value.
- Do not depend on a user's command prompt configuration, AutoRun registry commands, `doskey` macros, current directory, inherited code page, or altered `PATHEXT`, `PATH`, `COMSPEC`, `DIRCMD`, or `COPYCMD` values without validating that dependency.
- When automation launches a new command processor, use a trusted processor path and `/d` when AutoRun behavior is not part of the contract. Select `/e` and `/v` deliberately. Treat a caller-controlled environment as untrusted across a privilege or integrity boundary.
- Distinguish direct script invocation, invocation from another `.cmd` file, `cmd.exe /c`, a package-manager wrapper, a task scheduler, a service, and a CI runner. They can differ in quoting, current directory, environment, console attachment, cancellation, and returned status.
- Prefer PowerShell, Python, or a native program when the work requires robust structured data, complex argument fidelity, Unicode-heavy processing, substantial control flow, concurrency, remoting, or security-sensitive input handling. Keep `.cmd` as a thin launcher or bounded Windows-native task when that is the clearer interface.

## Filenames, startup, and script identity

- Use the `.cmd` suffix for Windows Command Processor source. Never use `.bat` for a new script, generated wrapper, test fixture intended as an executable, or documented command path.
- Do not ship both `name.bat` and `name.cmd`. Explicitly invoke an internal script by its full `.cmd` path so `PATHEXT`, current-directory, or legacy-file lookup cannot select a different implementation. The normal default extension order searches `.BAT` before `.CMD`; validate any environment that changes that order.
- Do not make a `.cmd` file extensionless. Windows command resolution uses file extensions and `PATHEXT`; an extensionless public command name may resolve to an on-disk `name.cmd`, but the source file remains `.cmd`.
- A `.cmd` file has no Unix shebang contract. Do not add `#!`; `cmd.exe` does not use it to select an interpreter. Start ordinary scripts with `@echo off` to suppress ordinary command echo, then establish localized processor state. This does not protect arguments, child command lines, explicit output, process metadata, or caller and CI logs from exposing secrets.
- Use `rem` for comments. Do not use `::` pseudo-labels as a general comment syntax; labels participate in parsing and can behave unexpectedly inside parenthesized blocks, redirection, and other compound constructs.
- Give the file an operation-oriented name. Treat a documented filename, extensionless `PATHEXT` invocation, installation path, and wrapper behavior as public contracts that need migration when changed.
- Use `%~f0` for the executing script path and `%~dp0` for its directory when behavior must be relative to the script rather than the caller's current directory. Do not derive script identity from `%CD%`.
- Declare and enforce source encoding and line endings. For broad `cmd.exe` compatibility, keep executable source and literals ASCII-only, store them as UTF-8 without a BOM, and use CRLF. A BOM must not become part of the first command. If non-ASCII literals are unavoidable, define the exact source and console code-page contract and restore changed console state, or use PowerShell. Do not assume an editor, console font, and child utility decode the same bytes identically.
- Keep a final newline. Test the committed bytes and the installed or generated wrapper, not only text pasted into an interactive prompt.

## Parameters, expansion, and quoting

- In `cmd.exe` source, single quotation marks are ordinary characters, not string or argument delimiters. Use double quotation marks where the receiving command grammar uses them to preserve one argument, while remembering that quoting does not turn hostile text into safe command source.
- Treat `%0` through `%9`, `%*`, environment variables, and `for` variables as parser substitutions, not a lossless argument-vector API. State which empty, quoted, special-character, Unicode, and long arguments are supported.
- A `.cmd` file must not be the first parser or validation boundary for arbitrary hostile text. Constrain the accepted grammar before invoking `cmd.exe`, or use a safer structured boundary implemented by PowerShell or a native process API. Do not attempt to sanitize arbitrary metacharacters after they have entered `%1` through `%9` or `%*`.
- Quote every path and value at the receiving command's boundary, but do not claim that double quotes neutralize arbitrary command text. Embedded quotes, percent signs, exclamation marks, carets, ampersands, pipes, parentheses, and redirection characters can still alter one of `cmd.exe`'s parsing passes.
- Use parameter modifiers such as `%~1`, `%~f1`, and `%~dp1` only when removing quotes or normalizing a path is intended. `%~1` does not preserve the caller's original token and is not validation.
- Reject missing, empty, repeated, conflicting, unsupported, or ambiguous option-like operands before mutation. Disambiguate valid option-like data according to the declared receiver grammar. Do not let `%1` disappear into syntax such as `if %1==value` when the argument is empty or contains metacharacters.
- Never use `call`, `for /f`, `cmd.exe /c`, or percent re-expansion as a way to evaluate untrusted data. Each additional parse can turn previously inert characters into command source.
- Avoid assembling one command string from data. Prefer fixed command source with individually validated arguments. When exact arbitrary argument boundaries matter, hand the operation to PowerShell or a native launcher.
- Do not use `%*` to forward arbitrary arguments and assume fidelity. Test the actual caller, target program, embedded quotes, empty values, trailing backslashes, and metacharacters; Windows native programs can also apply different command-line decoding rules.
- Keep the expanded command line and inherited environment within the supported `cmd.exe` limits. Use response files, stdin, a structured file, PowerShell, or a native launcher instead of silently truncating a large argument set.
- Use `--` only when the receiving program defines it. Windows inbox commands do not share one universal end-of-options convention.

## Variables, scopes, and delayed expansion

- Use `set "name=value"` so delimiter quotes are not stored and accidental trailing spaces do not become part of the value. Treat environment-variable names as case-insensitive.
- Localize script changes with `setlocal` before setting variables, `PATH`, code-page assumptions, or processor options. Remember that `setlocal` itself changes `ERRORLEVEL`; capture a prior status before invoking it.
- Keep delayed expansion disabled while reading or expanding untrusted or arbitrary text. With delayed expansion enabled, exclamation marks can be interpreted or removed and data can become syntax.
- Enable delayed expansion only for the smallest reviewed scope whose data contract makes `!` safe, then disable it before accepting arbitrary values. Test transfers across `setlocal` and `endlocal`; common one-line transfer idioms rely on parse timing and are unsafe for unconstrained text.
- Remember that `%name%` substitutions in a parenthesized block normally occur when the block is parsed, before commands in the block update the value. Restructure the control flow instead of applying unexplained double expansion or delayed expansion to everything.
- Initialize variables before `set /p`. An empty read can leave a previous value unchanged. Keep prompts off machine-readable output and reject interactive input when stdin is not an approved console.
- Do not use environment variables as a typed data store. Parse and validate booleans, integers, paths, lists, and enumerations explicitly, and account for per-variable and process-environment size limits.
- Do not overwrite inherited variables such as `PATH`, `TEMP`, `TMP`, `SystemRoot`, or `COMSPEC` for convenient scratch state. Use names scoped to the project and operation.

## Control flow, subroutines, and status

- Check the documented exit contract of each external program and built-in command immediately after the operation. Not every command sets a useful status, and some successful tools use nonzero informational codes.
- Capture `%ERRORLEVEL%` before another command, `setlocal`, `echo`, cleanup step, or expansion context can replace or stale it. Inside a parsed block, do not assume `%ERRORLEVEL%` reflects a command earlier in that block.
- Remember that `if errorlevel N` means greater than or equal to `N`. Test thresholds in descending order or compare a safely captured numeric status when exact equality is required.
- End an entry-point script with a deliberate `exit /b <status>` so it returns from the current script context instead of closing a caller's command processor. Validate that the status is numeric and within the documented consumer contract.
- Never use bare `exit` in a `.cmd` file. It can terminate the command processor that invoked or called the script rather than returning from the script.
- Invoke another `.cmd` file with `call` when the parent must resume afterward. Treat `call` as another parse boundary and do not pass attacker-controlled command text through it.
- Implement subroutines as fixed `call :label` targets with explicit parameters and terminate them with `exit /b` or a reviewed `goto :eof`. Do not dispatch to a label constructed from untrusted input.
- Prevent accidental fall-through into subroutine bodies. Keep labels unique, control paths shallow, and cleanup centralized enough that each exit is reviewable.
- Do not read `ERRORLEVEL` through a caller-supplied environment variable named `ERRORLEVEL` without understanding dynamic-variable shadowing. Sanitize the environment at a sensitive launcher boundary or use a more capable runtime.
- Treat `command1 && command2 || fallback` as a chain, not a general `if/else`: `fallback` also runs when `command2` fails. Use explicit control flow when the distinction matters.

## Pipelines, redirection, and text

- Treat each pipe as an additional command-processor and buffering boundary. Do not expect variable, directory, or environment changes made on one side of a pipeline to be visible afterward.
- Do not infer whole-pipeline success from the status of the final command. Capture or otherwise verify every stage whose failure would invalidate the result; use PowerShell or a purpose-built program for nontrivial pipelines.
- Review redirection order. `>file 2>&1` and `2>&1 >file` connect handles differently. Quote destination paths and do not let an untrusted value add a redirection or select an unauthorized file.
- Send diagnostics to standard error and contract output to standard output. Keep command echoing disabled. Do not mix progress, prompts, or banners into machine-consumed output.
- Do not use `echo` as a lossless arbitrary-data serializer. Special text, empty strings, `echo` state, encoding, and redirection can change the result. Use a Unicode- and format-aware tool for JSON, CSV, XML, or exact text.
- Treat `for /f` as a command-language parser, not a general line reader. Its default tokenization, blank-line handling, end-of-line marker, quoting, and child-command execution must all be selected and tested deliberately.
- Do not parse localized human output from `dir`, `net`, `sc`, `wmic`, or another administration tool when a stable API or structured PowerShell command exists. Locale, version, and formatting are part of that fragile contract.
- Specify the encoding when a downstream utility offers an encoding option. `cmd.exe /a`, `/u`, console code pages, redirected output, and child-program encodings are not one universal text setting.

## Paths, files, and temporary resources

- Quote paths and use fixed roots. Validate that a path is nonempty, fully resolved as required, within the authorized tree, and not a root before deletion, overwrite, permission changes, or recursive traversal.
- Prefer `%~dp0` plus an explicit relative path over changing the process-wide current directory. If a temporary directory change is clearer, pair a successful `pushd` with `popd` on every normal and error path.
- Account for drive-relative paths, UNC paths, reserved device names, alternate data streams, case-insensitive comparison, reparse points, junctions, symlinks, trailing dots or spaces, and path-length limits where relevant.
- Do not treat `if exist` as authorization or a race-free guarantee. Validate the target, perform the operation, and handle its actual failure.
- Create temporary resources beneath an approved directory with collision-resistant names and exclusive creation. `%RANDOM%`, a timestamp, or a predictable process identifier alone is not safe in an attacker-writable location.
- Record which files, directories, mappings, and locks the script created. Cleanup must remove only owned resources and must not widen scope when a variable is missing or partially initialized.
- Write important artifacts to a same-volume temporary file, validate them, and replace the destination using an operation whose atomicity and sharing behavior are documented. A redirected overwrite is not a transactional update.
- Do not rely on wildcard output ordering. Define sorting and duplicate behavior when generated output or a release artifact must be deterministic.

## Subprocesses, lifecycle, and cleanup

- Resolve security-sensitive executables by a trusted absolute path. Ordinary `cmd.exe` command lookup can consult the current directory, `PATH`, `PATHEXT`, and inherited environment in ways that allow shadowing. File associations are a separate `start` or shell-execution boundary.
- Use `where` only as diagnostic evidence of lookup. It does not authenticate an executable or freeze the target against replacement.
- Avoid `start` unless a separate process or association is the intended API. Its first quoted argument can be interpreted as a window title, GUI waiting behavior differs, and detached work needs explicit ownership. When used, provide the empty title deliberately and test `/wait` and returned status.
- Wait for owned child work, capture its status, and terminate or clean it up according to a bounded policy. Do not report success while a detached child still owns the operation.
- Design one explicit cleanup path and preserve the original failure status through it. Guard each cleanup action so one failure does not skip the rest, and elevate cleanup failure only under documented policy.
- `cmd.exe` has no universal `finally` or reliable termination trap. Window closure, process termination, service shutdown, and some console-control paths can skip script cleanup. Avoid designs whose integrity depends solely on a final label being reached.
- Restore caller-visible current directory, drive mappings, code page, console state, and other changed host state where the invocation model can expose it. Prefer not to mutate global or persistent state in the first place.
- Make retries and repeated invocation idempotent, or provide an operation ID, checkpoint, conflict rule, rollback, or documented recovery path.

## Security, destructive actions, and secrets

- Treat arguments, environment variables, current directory, filenames, registry values, network paths, command output, and downloaded content as untrusted until validated for their exact receiving context.
- Do not expose arbitrary hostile arguments directly to a `.cmd` entry point. Constrain their grammar in a trusted caller before `cmd.exe` parses them, or move the interface to PowerShell or a native process API with a structured argument boundary.
- Never pass untrusted text to `cmd.exe /c`, `call`, `for /f` command mode, `set /a`, a dynamically constructed parenthesized block, or another evaluator. Quoting alone is not a command-injection boundary.
- Validate option-like input and metacharacters before invoking a child. Use an allowlist when a value selects a command, switch, service, registry path, account, host, or deployment target.
- Keep secrets out of arguments, echoed commands, environment dumps, temporary filenames, and logs. Environment variables are inherited by child processes and are not a general secret store.
- Do not enable delayed expansion while handling a secret that can contain `!`. Do not print a masked or truncated secret whose remaining shape is still sensitive.
- Scope `del`, `erase`, `rd`, `rmdir`, `copy`, `move`, registry changes, service changes, and permission operations to a resolved target. Reject empty, wildcard-expanded, root, system, parent, or cross-share targets that exceed authorization.
- Noninteractive execution must never infer consent. Give force and quiet switches narrow meanings; they must not bypass authentication, authorization, target validation, or integrity checks.
- Do not request elevation for the whole script when only one bounded operation requires it. Split privileged work behind a narrow, authenticated interface and revalidate all inputs after the privilege transition.
- Use PowerShell with an appropriate security model, a native API, or a managed deployment system for credentials, remoting, ACL-heavy work, signing, or other privileged automation that `cmd.exe` cannot express safely and clearly.

## Portability and maintainability

- Keep the script small enough that its parsing and failure behavior remain locally reviewable. Move substantial algorithms or data transformation into a typed language instead of building a framework from labels and expansion tricks.
- Prefer one command per logical line and shallow parenthesized blocks. Explain unavoidable parse-timing techniques next to the invariant that makes them safe.
- Avoid long caret-continued commands. A trailing space after `^`, an editor rewrite, or another parsing layer can change continuation and escaping.
- Avoid obsolete DOS-era assumptions, 8.3 short names, fixed drive letters, `wmic`, and tools not present on every supported Windows image unless the project explicitly provisions and tests them.
- Use stable Windows APIs or PowerShell cmdlets rather than parsing UI text, localized messages, registry implementation details, or undocumented command output.
- Keep generated `.cmd` wrappers reproducible and inspect them in validation. The generator and committed or packaged output must agree on quoting, encoding, line endings, and exit propagation.
- Document required utilities, privileges, side effects, configuration, interactive behavior, exit statuses, and examples. State when a task has deliberately outgrown `.cmd` and where its implementation now lives.
- A `.cmd` compatibility launcher for PowerShell must select the declared `pwsh.exe` or `powershell.exe`, use a reviewed `-File` invocation, and preserve its status. Do not place substantial PowerShell source in a quoted `-Command` string or add `-ExecutionPolicy Bypass` as a routine compatibility switch.
- Do not silence a linter or test because the script is “only Windows glue.” Use repository-configured checks and focused executable tests as the acceptance contract.

## Tests and validation

Run the repository's configured checks and exercise the actual `.cmd` entry point on every claimed Windows and command-processor boundary. Applicable cases include:

- the committed `.cmd` suffix, absence of new `.bat` files, CRLF and encoding policy, final newline, and generated-wrapper consistency;
- direct invocation, extensionless `PATHEXT` lookup, invocation by `call`, and controlled `cmd.exe /d /e:on /v:off /c` execution where supported;
- the minimum and representative Windows client and server versions, x64 and Arm64 where claimed, interactive consoles, CI runners, schedulers, services, and package-manager launchers;
- command extensions on and off when compatibility is claimed, delayed expansion state, AutoRun disabled, a clean environment, hostile `PATH` and `PATHEXT`, and a current directory unrelated to the script;
- missing, empty, quoted-empty, spaced, option-like, Unicode, long, and hostile arguments containing `%`, `!`, `^`, `&`, `|`, `<`, `>`, `(`, `)`, and quotes;
- exact status propagation for success, usage error, child failure, pipeline failure, cleanup failure, partial progress, cancellation, and interruption;
- paths with spaces, non-ASCII text, UNC roots, different drives, reparse points, read-only targets, collisions, long paths, and denied access;
- stdout and stderr separately redirected, merged in both orders, closed or failing destinations, code-page boundaries, and machine-output cleanliness;
- repeated and concurrent invocation, existing partial state, predictable-name attacks, cleanup after each failure point, and refusal of dangerous roots;
- executable shadowing, injected environment variables, secret canaries, noninteractive refusal, least-privilege execution, and the exact installed artifact.

Report the Windows build, command line, environment, invocation host, code page, filesystem context, and exact observed status. Pasting individual commands into an interactive prompt does not validate block parsing, parameter expansion, `CALL`, localization, startup state, or the script's returned status.

## Primary references

- [Microsoft `cmd` command reference](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/cmd)
- [Microsoft `call` command reference](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/call)
- [Microsoft `setlocal` command reference](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/setlocal)
- [Microsoft `if` command reference](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/if)
- [Microsoft `exit` command reference](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/exit)
- [Microsoft `for` command reference](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/for)
- [Microsoft `pushd` command reference](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/pushd)
- [Microsoft `start` command reference](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/start)
- [Microsoft `where` command reference](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/where)
- [Microsoft `path` command and extension lookup](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/path)
- [Microsoft Windows Commands overview](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/windows-commands)
- [Microsoft warning for untrusted batch arguments](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.core/about/about_quoting_rules)
- [Command Prompt command-line length limit](https://learn.microsoft.com/en-us/troubleshoot/windows-client/shell-experience/command-line-string-limitation)
- [Windows console code pages](https://learn.microsoft.com/en-us/windows/console/console-code-pages)
- [Command Prompt standard-stream redirection](https://learn.microsoft.com/en-us/troubleshoot/developer/visualstudio/cpp/language-compilers/redirecting-error-command-prompt)
