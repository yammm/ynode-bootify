# Reconcile Independent Code Reviews

## Objective

Produce one evidence-checked review from two or more independent reports. Reviewer agreement is not proof, and a unique finding is not automatically wrong. The repository, its contracts, and reproducible behavior are the sources of truth.

## Inputs

- Review target: `{{TARGET}}`
- Comparison base: `{{BASE}}`
- Intended behavior: `{{INTENT}}`
- Project profile: `{{PROJECT_PROFILE}}`
- Applicable standards: `{{STANDARDS_FILES}}`
- Reviewer reports: `{{REPORTS_OR_PATHS}}`
- Validation limits: `{{VALIDATION_LIMITS}}`

Follow the authorization boundary and finding threshold in `DEEP_DIVE_REVIEW.md`. This is review-only; do not implement fixes.

## Reconciliation method

1. Read the actual target, project profile, applicable standards, and reviewer reports.
2. Convert each report into individual candidate findings.
3. Group candidates by root cause, not wording or reviewer.
4. Verify every candidate against the smallest relevant code path, contract, history, and test. Do not accept a finding by vote.
5. Reject candidates that lack a concrete location, reachable failure or cost, or applicable standard.
6. Re-grade severity and confidence independently. Preserve a higher severity only when the demonstrated impact supports it.
7. Identify material review areas that neither report covered.
8. Run the smallest allowed checks needed to resolve disagreements or high-impact uncertainty.

## Required output

### 1. Reconciled verdict

State `Release blocker`, `Changes required`, `Ready with non-blocking follow-ups`, `No actionable findings`, or `Review incomplete — insufficient evidence`. Include final finding counts by severity.

### 2. Verified findings

Use the finding format from `DEEP_DIVE_REVIEW.md`. Add:

- Source reports: which reviewers raised the candidate;
- Reconciliation note: what evidence confirmed the final classification.

### 3. Rejected or downgraded candidates

For each material candidate, give its original source and one concise reason:

- not supported by the code;
- not reachable under the documented contract;
- duplicate of another root cause;
- preference rather than defect;
- pre-existing and outside the requested scope;
- valid concern with lower demonstrated impact;
- still unverified.

Do not spend space on trivial phrasing differences.

### 4. Remaining disagreements and unknowns

State what evidence is missing and the smallest check that would resolve it.

### 5. Combined coverage and validation

Report which areas were reviewed, which checks were run during reconciliation, and the residual blind spots. Never combine two incomplete reviews into a claim of exhaustive coverage.
