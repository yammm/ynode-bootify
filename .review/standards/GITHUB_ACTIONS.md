# GitHub Actions Standards

## Scope

Apply this profile with `CODING_STANDARDS.md` to GitHub Actions workflows, reusable workflows, local and third-party actions, runner configuration, and automation that builds, tests, deploys, publishes, or administers a repository.

Treat workflow files as privileged production code. A short YAML file can execute repository content, use credentials, modify releases, publish packages, or reach internal systems. Review the event, ref, actor, token, runner, checked-out code, downloaded data, and target environment as one trust boundary.

Use `PUBLIC_REPOSITORY.md` when the repository is public. Public repositories need explicit fork-contribution and log-exposure analysis, but public status does not by itself require GitHub Actions, self-hosted runners, release attestations, or any particular workflow layout. Judge those features against the repository's actual claims and risks.

The repository and organization settings are part of the implementation. When they are unavailable, state which conclusions depend on default token permissions, fork policies, allowed-action policies, environment protections, runner groups, retention settings, or branch and tag rules.

## Events, refs, and trust boundaries

- Inventory every trigger, activity type, branch or tag filter, path filter, schedule, manual input, and workflow-call entry point. Confirm that each can start only the intended work and cannot silently skip a required check.
- Establish which workflow revision GitHub loads for the event and what `github.ref`, `github.sha`, event payload, actor, token, and secrets mean in that context. Do not assume all pull request, push, merge queue, `workflow_run`, and manual events execute the proposed commit in the same way.
- Treat pull request titles, bodies, branch names, labels, issue comments, changed paths, commit messages, workflow inputs, matrix values, artifacts, and checked-out fork content as untrusted when an outside actor can influence them.
- Use ordinary `pull_request` validation for untrusted contribution code when its restricted token and secret behavior fits the job. Keep the job useful without granting fork code access to repository or environment credentials.
- Treat `pull_request_target` as a privileged base-repository event. GitHub grants its `GITHUB_TOKEN` read/write repository permission by default, including for public-fork pull requests, unless workflow permissions or platform policy reduce it. Explicitly minimize `permissions`, and never check out, import, build, test, or execute pull-request-controlled code or configuration while any write token, secret, cache-write access, OIDC permission, or sensitive runner or network authority remains.
- Do not treat checking out the base revision as sufficient isolation if later steps download a pull request artifact, load pull request-controlled action metadata, evaluate configuration from the fork, or interpolate event data into executable source.
- Apply the same artifact and code-origin analysis to `workflow_run`, `issue_comment`, `repository_dispatch`, and other privilege-separated flows. A downstream privileged workflow must authenticate the producing run, repository, event, ref, conclusion, and artifact before consuming its output.
- Validate `workflow_dispatch` and `workflow_call` inputs as typed but untrusted values. Declared choice, boolean, or number types improve the interface; they do not authorize a ref, environment, command, path, package, or deployment.
- Keep schedules and automation identities resilient to inactivity, default- branch changes, disabled workflows, clock assumptions, and duplicate or delayed delivery where those behaviors affect correctness.
- Review path filters as optimization and selection logic, not as a security boundary. A required workflow that does not run may leave a check absent or pending depending on repository rules and event configuration.

## Token permissions and repository authority

- Set `permissions` explicitly at workflow or job scope. Grant the `GITHUB_TOKEN` only the read or write scopes required by that job; do not rely on repository defaults that can differ across organizations or change later.
- Prefer a conservative workflow default such as `permissions: {}` or read-only `contents`, then declare each write scope on the one job that owns that operation. A validation, setup, or matrix job must not inherit release authority merely because a later job publishes or deploys.
- Separate read-only validation from jobs that write contents, pull requests, checks, deployments, packages, pages, security results, or attestations. A broad workflow-level permission should not give every matrix leg and setup step release authority.
- Prefer `permissions: {}` for jobs that need no repository token. Remember that actions can access `github.token` even when it is not passed as an explicit input, subject to the job's permissions.
- Do not use `write-all` as a convenience. Explain every write scope and remove transient permissions such as `id-token: write` from jobs that do not request the corresponding credential.
- Treat GitHub App tokens, personal access tokens, deploy keys, cloud credentials, and package-registry tokens as separate principals. Scope their repository, organization, resource, operation, and lifetime independently of the `GITHUB_TOKEN`.
- Verify that branch and tag protections, rulesets, workflow approvals, and repository settings constrain what the token can actually change. Token scope alone does not establish release authorization.
- Account for fork and Dependabot token downgrades and secret withholding. A workflow should fail clearly or select a safe reduced path rather than appear to validate an operation it could not perform.
- Do not persist credentials in the checkout, Git configuration, remote URLs, package-manager configuration, or artifacts beyond the step that owns them. Set `persist-credentials: false` on checkout unless later steps intentionally perform authenticated Git operations with that credential. Document the narrow exception and remove the credential before executing less-trusted code.

## Secrets, environments, and OIDC

- Store sensitive values in the narrowest suitable secret store and grant them only to the jobs that require them. Repository variables, workflow inputs, build arguments, caches, artifacts, job summaries, and ordinary environment variables are not secret stores.
- Use protected GitHub environments for sensitive deployment or publication credentials when their branch or tag restrictions, reviewers, wait rules, and bypass policy provide a real authorization boundary.
- Confirm that the job actually names the intended environment. Merely defining an environment in repository settings does not protect a job that never references it, and an environment does not automatically serialize deployments.
- Prefer short-lived OIDC credentials over long-lived cloud secrets when the provider and deployment contract support them. Grant `id-token: write` only to the requesting job.
- Constrain the cloud trust policy by the expected issuer, audience, repository identity, workflow, ref or environment, and other stable claims supported by the provider. An unrestricted trust in the repository alone can authorize an unintended branch, workflow, or environment.
- Treat reusable-workflow identity and OIDC claims according to the exact caller/callee design. Validate the claims emitted by a real run rather than copying a policy from a different workflow shape.
- Assume secret redaction is incomplete. Derived, encoded, sliced, structured, or short values can escape masking, and a malicious tool can exfiltrate a secret without printing it directly.
- Keep secrets out of command-line arguments, generated files, process listings, debug traces, test snapshots, reports, and crash dumps. Masking a value in the log does not remove it from an uploaded artifact or external service.
- Rotate or revoke credentials after suspected exposure and verify downstream audit logs. Editing the workflow or deleting a run is not remediation by itself.

## Actions and reusable workflows

- Treat every action and reusable workflow as executable dependency code with the job's filesystem, network, token, and secret access. Review ownership, source, maintenance, permissions, inputs, transitive behavior, and update policy.
- Pin third-party actions and reusable workflows to a verified full-length commit SHA when immutable execution is required. Keep a human-readable release annotation and an automated, reviewed update path so security fixes do not remain frozen indefinitely.
- Verify that a pinned commit belongs to the intended upstream repository and release. A commit hash copied from an untrusted suggestion is not provenance.
- Treat tags and branches as mutable. A trusted publisher or Marketplace badge is useful context but does not make a mutable reference immutable.
- Review first-party actions stored in the repository at the exact revision the event loads. Changes to `action.yml`, JavaScript bundles, Dockerfiles, or composite steps are code changes, even if the calling workflow is unchanged.
- Do not execute a repository-local action from untrusted checked-out code in a privileged job. The `uses: ./path` syntax executes the files present in the workspace.
- Pass only required secrets to reusable workflows. Avoid `secrets: inherit` when an explicit interface can limit exposure, and verify permission behavior across every level of nested calls.
- Pin tool downloads and action-managed runtime versions according to the project's reproducibility and security contract. Verify checksums or signatures when the installer supports them.
- Never download and immediately execute mutable or unversioned tooling in a job that holds write permission, secrets, OIDC authority, or a publishing credential. Floating package invocations, mutable `latest` references, and network-piped installers allow different code to acquire the same authority without review.
- Install dependencies from the reviewed lockfile with the package manager's frozen or clean-install mode, then invoke the project-local binary. Do not let `npx`, `npm exec`, or an equivalent runner resolve and download a missing release tool in a privileged job. Isolate dependency installation and build work in an unprivileged job when the publishing job only needs the verified artifact.
- Keep generated or vendored action distributions synchronized with source and reviewable. Record their upstream source, immutable revision or digest, integrity evidence, generation or update command, and applicable license. Test the committed artifact actually executed by Actions, not only its TypeScript or other source.

## Expressions, commands, and injection

- Never interpolate untrusted GitHub expressions directly into `run` source, shell fragments, scripts, SQL, template languages, or command strings. The expression is substituted before the shell or interpreter parses the result.
- Pass untrusted values through a step environment variable or structured action input, then quote and validate them for the receiving program. Moving a value to `env` prevents source-code injection at the YAML layer; it does not make unsafe shell expansion, option injection, or path traversal safe.
- Declare the shell when behavior depends on Bash, PowerShell, Python, or another interpreter. Account for platform-specific defaults, quoting, error handling, pipelines, and encoding.
- Apply `SHELL.md`, `BATCH.md`, `POWERSHELL.md`, or the applicable language profile to each `run` block. YAML and expression safety do not replace the receiving command language's expansion, status, launcher, and stream rules.
- Make shell recipes fail at the operation that fails. Do not assume a pipeline, command substitution, or compound command propagates every error under the selected shell settings.
- Delimit command options from data and validate paths, refs, image names, package coordinates, and deployment targets. Quoting alone does not prevent a value beginning with `-` from becoming an option.
- Use environment files and workflow commands according to their escaping rules. Untrusted multiline output must not create additional outputs, environment entries, annotations, masks, or state records.
- Keep dynamic matrices bounded. Validate data used by `fromJSON`, generated matrices, runner labels, environments, and job names before it controls cost, privilege, or code selection.
- Avoid evaluating untrusted values with shell `eval`, language-level eval, template expansion, or ad hoc YAML generation.

## Caches and artifacts

- Treat caches as untrusted, mutable optimization data. Cache keys and branch scoping reduce collisions; they do not authenticate cached executables or make cache contents suitable for secrets.
- Never store credentials, signing material, repository tokens, private package configuration, or other sensitive data in a cache. Pull request workflows can often read caches associated with the base branch.
- Restrict cache writes to trusted, hardened flows where a poisoned cache could later execute in a more privileged job. Prefer restore-only behavior for low-trust events when writing cannot provide a safe benefit.
- Build keys from every input needed for compatibility and correctness, such as operating system, architecture, runtime, lockfile, compiler, and material flags. A fallback restore key must not mix incompatible or less-trusted data.
- Do not cache generated binaries or scripts and then execute them in a privileged job without an independent integrity or rebuild boundary.
- Treat downloaded artifacts as untrusted files, even when GitHub transferred them successfully. Authenticate the producing repository, workflow, run, event, ref, commit, and conclusion before privileged use.
- Validate artifact names, file layout, counts, sizes, archive behavior, and content hashes where they cross jobs or workflows. Prevent path confusion, overwrite of trusted files, and accidental selection of an artifact from the wrong matrix leg or rerun.
- Keep build outputs immutable between verification, attestation, signing, and publication. Rebuilding the same source in the release job produces a different subject unless the release design explicitly verifies equivalence.
- Set retention appropriate to diagnostic, privacy, legal, and release needs. Do not retain sensitive test data simply because the platform default allows it.

## Matrices, concurrency, and cancellation

- Ensure the matrix covers the declared runtime, operating-system, architecture, and dependency contract without creating unsupported claims from one passing representative job.
- Test exact compatibility boundaries, not only convenient major-version aliases. When a project advertises a minimum patch release, include that exact floor; include each maintained runtime line the project claims, and include real operating-system lanes for platform-sensitive or cross-platform tools. Narrow the published claim or document residual risk when a claimed boundary cannot be exercised.
- Bound matrix size and generated fan-out. A user-influenced matrix can consume runner capacity or spend unexpectedly even when each leg is individually safe.
- Define fail-fast and allowed-failure behavior deliberately. An experimental leg must not make required coverage appear green, and early cancellation must not skip required cleanup or evidence.
- Use repository-unique, normalized concurrency groups for operations that must not overlap. Group names are case-insensitive and shared across workflows, so include the workflow and actual isolation key without allowing untrusted text to collide with a privileged group.
- Choose queue behavior explicitly. Default `queue: single` retains only one pending run and replaces an older pending run; `queue: max` permits up to 100 pending runs and cannot be combined with `cancel-in-progress: true`.
- Decide whether cancellation is safe for tests, builds, migrations, deployments, and releases. FIFO is based on when work begins waiting, not dispatch order, so concurrency groups are not transactional deployment sequencing.
- Ensure cleanup and lease release run under cancellation and failure, subject to platform limits. Give external locks bounded expiry and recovery.
- Prevent parallel jobs from publishing the same tag, mutating one cache or environment, using a fixed port on a persistent runner, or overwriting a shared artifact name.

## Runners, job containers, and services

- Record the runner type, image or labels, operating system, architecture, installed-tool assumptions, and update policy. GitHub-hosted labels can move to newer images; a label is not an immutable machine snapshot.
- Treat self-hosted runners as sensitive infrastructure. Untrusted jobs can inspect persistent files, processes, networks, credentials, cloud metadata, hardware, and later jobs unless isolation is independently enforced.
- Do not route public fork code to a persistent self-hosted runner merely because the workflow token is read-only. Prefer an ephemeral, isolated runner with no sensitive network path when untrusted execution is required.
- Restrict runner groups and labels so a repository or user-controlled input cannot select a more privileged runner. Remove an ephemeral runner after one job and verify that disposal includes attached storage and credentials.
- Keep runner images patched and provenance-controlled. Inventory preinstalled tools used implicitly by workflows, or install declared versions explicitly.
- Treat job containers and service containers as dependencies. Pin and update their images according to the project contract, constrain credentials and networks, and verify health rather than relying on startup order.
- Avoid mounting the container runtime socket, host root, privileged devices, or broad host paths into jobs unless that authority is essential and isolated. Access to a Docker daemon is commonly host-equivalent authority.
- Bound service ports, names, storage, and teardown so parallel jobs and failed runs do not contaminate one another.

## Deployments, releases, and provenance

- Separate validation from authorization. Passing tests does not by itself authorize a deployment, version change, tag, release, package publication, or production credential use.
- Release only from an authenticated intended commit and ref under the repository's branch, tag, ruleset, and environment policy. Re-check identity at the publishing job rather than trusting a display name or earlier job.
- Use protected environments and narrowly scoped credentials for production and public publication where the project's risk warrants them. Prevent the person or workflow initiating a sensitive release from bypassing required review without an explicit emergency policy.
- Make publication idempotent or fail safely after partial success. Concurrent, repeated, rerun, and manually dispatched release jobs must not overwrite an unrelated version or leave tag, release, package, and notes inconsistent.
- Publish the artifact that was tested. Preserve hashes across build, review, signing, attestation, upload, and registry operations.
- Generate SBOMs, signatures, or artifact attestations when consumers or the release policy use them. An attestation establishes provenance claims; it does not prove that the source or artifact is vulnerability-free.
- Verify provenance and signatures in a clean consumer path when the repository tells users to rely on them. Generating evidence that nobody can validate is not an effective control.
- Keep version, changelog, tag, release notes, registry metadata, container digest, and published package aligned with the repository's release contract.

## Logs, summaries, and retention

- Keep job logs and summaries diagnostic without exposing secrets, private endpoints, personal data, signed URLs, authorization headers, or excessive event payloads.
- Disable command tracing and verbose client output around credentials. Review third-party tools for debug modes that dump environment variables or request headers.
- Give failures actionable context: operation, safe identifier, tool version, and preserved exit status. Do not hide a failed command behind an unconditional successful cleanup or summary step.
- Treat annotations, comments, badges, and generated reports as public or contributor-visible according to repository permissions. Sanitize untrusted text before producing Markdown or links.
- Set artifact, cache, log, and workflow-run retention deliberately where the repository handles sensitive fixtures, regulated data, or release evidence.
- Preserve auditability for deployments and releases. Deleting logs to conceal credentials is not a substitute for rotation and incident review.

## Tests and validation

- Parse and statically validate every workflow, local action, and reusable workflow with tools configured by the repository. Validate generated YAML as the generated artifact, not only its template.
- Exercise representative `push`, `pull_request`, fork pull request, `workflow_dispatch`, `workflow_call`, release, and deployment paths that the repository actually supports.
- Test trust boundaries with adversarial titles, branch names, inputs, multiline values, artifact names, changed files, and repository content.
- Confirm exact token scopes, secret availability, OIDC claims, environment approvals, runner routing, checked-out SHA, and cache access from real runs or authoritative platform evidence.
- Test cancellation, reruns, duplicate events, matrix failures, partial publication, unavailable services, and cleanup of external state.
- Validate public fork behavior without granting a test fork exceptional permissions that real contributors will not have.
- Verify releases from a clean consumer perspective: fetch the published artifact, validate its digest and provenance where claimed, and exercise its supported installation or startup path.
- Report workflow file revisions, event and run URLs or identifiers when safe, runner images, tool versions, commands, and outcomes. If organization or repository settings could not be inspected, report that residual risk.

## Primary references

- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [GitHub Actions events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)
- [GitHub Actions concurrency controls](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)
- [GitHub Actions secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
- [GitHub Actions dependency caching](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching)
- [GitHub Actions deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [GitHub Actions OpenID Connect reference](https://docs.github.com/en/actions/reference/security/oidc)
- [GitHub Actions artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations)
