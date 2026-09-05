# Repository Agent Instructions

## Shared project context

For code changes and code reviews:

1. Read `.review/PROJECT_PROFILE.md`.
2. Read `.review/standards/CODING_STANDARDS.md`.
3. Read only the additional standards profiles listed as applicable in the project profile.
4. Discover and follow more specific checked-in instructions for the files in scope. During a review, list the exact instruction paths that were applied.

The project profile and configured repository tooling override portable defaults when they deliberately differ.

## Code reviews

When asked for a deep-dive review, read and follow `.review/prompts/DEEP_DIVE_REVIEW.md`. A review request authorizes inspection and non-destructive validation, not edits or fixes.

Use evidence-based, severity-ranked findings. Do not manufacture findings to fill categories, present design preferences as bugs, or propose patterns without a demonstrated problem.

Keep feature-roadmap ideas separate and include them only when requested.

## Project-specific review rules

Keep repository-wide, non-obvious invariants in `.review/PROJECT_PROFILE.md`. Put component-specific rules in the nearest scoped instruction file. Each rule should identify the invariant, risk, scope, and safe path.

Keep deterministic formatting and syntax checks in automated tooling.
