# Firstcommit review

Companion: [REMEDIATION_PLAN.md](./REMEDIATION_PLAN.md)

## 1) Scope and verdict

- Repository: `Firstcommit`
- Pinned SHA: `e47af94db32020b3d24d4ac77f6e614560f8bea5`
- Stage: implemented product repo with a React/Vite frontend, Supabase/Deno backend surfaces, CI workflows, a RAG eval harness, and a VS Code extension surface.[7][8][12]
- Sampled evidence: selected README/manifests, six workflow files, `PUBLICATION_AUTHORIZATION.md`, snapshot metadata, and two read-only GitHub metadata fetches for `scripts/check_types_tables.ts` and Actions run `36902600666`.[1]-[13]
- Uninspected boundaries: `src/**`, `supabase/functions/**`, `supabase/migrations/**`, SQL/RLS policies, deployment settings, backups/restores, repo settings, and Actions logs beyond narrow jobs metadata.
- Runtime NOT RUN: no install, build, test, workflow, deploy, or database command execution.

Verdict: the repo is substantive, but the hardening and acceptance story remains incomplete in the sampled evidence. The evidence supports: (1) a real PR-workflow shell-injection hazard with bounded but nontrivial exposure, (2) a DB-type workflow that is unreachable in this repo and would still only be a narrow four-table sentinel if enabled, (3) a historical workflow failure that needs accurate attribution, and (4) commissioned defensive documentation is already authorized for this repo, but real secrets, PII/customer data, operational exploit payloads, and deployment/settings actions remain outside that authorization boundary.[1]-[7][13]

## 2) Architecture and product boundary

Visible boundary from sampled evidence:

- README describes a React frontend talking to Supabase Auth and Deno edge functions, with PostgreSQL/pgvector/pgcrypto behind it.[7]
- README claims roles for admins, authors, and learners, and advertises `_shared: authz`, SSRF controls, BYOK encryption, RLS, and telemetry, but those implementations were not inspected.[7]
- `package.json` exposes build, test, lint, edge-audit, credential-check, and internal-auth scripts.[8]
- `vscode-extension/package.json` shows a separate extension surface with token and pack-selection commands.[12]
- GitHub Actions is part of the release-control plane, not just CI convenience.[1][2][6][9][10][11]

This is therefore a sampled control-plane review, not a whole-app audit.

## 3) Findings ledger

### F-01 — PR body text reaches a shell in a write-capable PR workflow
- Severity: high
- Status: confirmed static
- File: `.github/workflows/pr-checklist-reminder.yml:3-43` ([1])
- Pinned URL: <https://github.com/knarayanareddy/Firstcommit/blob/e47af94db32020b3d24d4ac77f6e614560f8bea5/.github/workflows/pr-checklist-reminder.yml#L3-L43>
- Quote: `types: [opened, edited]`; `paths:` `supabase/functions/**`, `supabase/migrations/**`, `vscode-extension/**`, `docs/mcp/**`; `permissions:` `pull-requests: write`; `BODY="${{ github.event.pull_request.body }}"`.[1]

Why it matters: PR body text is expanded before shell parsing, so crafted body content can alter the `run:` script. The real exposure boundary is narrower than a blanket RCE claim: this job only triggers on two PR events, four path filters, requests `pull-requests: write`, and has no checkout step.[1] That supports a workflow-shell hazard, but not a proven claim of secret theft or broad privilege reach; fork token behavior, same-repo PRs, and repo settings were not inspected.

Recommended correction: do the checklist test in `actions/github-script` or committed Node code that reads PR body text as data and emits only a boolean output. Do not move raw multiline body text through `GITHUB_OUTPUT`/`GITHUB_ENV` unsafely. If rollback is needed, disable or contain the workflow rather than restoring the unsafe interpolation.

### F-02 — The DB type job is unreachable here and its current check is only a narrow sentinel
- Severity: medium
- Status: confirmed static
- Files: `.github/workflows/db-types-check.yml:2-36` ([2]); `scripts/check_types_tables.ts:15-64` ([3])
- Pinned URLs: <https://github.com/knarayanareddy/Firstcommit/blob/e47af94db32020b3d24d4ac77f6e614560f8bea5/.github/workflows/db-types-check.yml#L2-L36>, <https://github.com/knarayanareddy/Firstcommit/blob/e47af94db32020b3d24d4ac77f6e614560f8bea5/scripts/check_types_tables.ts#L15-L64>
- Quote: `if: github.repository == 'knarayanareddy/rocketboard-ai-guide'`; `const requiredTables = [`; `'module_remediations',`; `if (!tableSection.includes('Row: {'))`.[2][3]

Why it matters: the workflow is skipped in `Firstcommit` because the repo guard names another repo.[2] If enabled, the current script would only check for four named tables and a `Row` marker in `types.ts`.[3] That is useful as a staleness/remediation sentinel, but it is not whole-schema drift proof.

Recommended correction: get an owner decision on whether the job should run in `Firstcommit`. Then either fix/remove the guard or document the exclusion explicitly. Separately, label the current check according to its real coverage and add a broader drift test only if the owner wants that guarantee.

### H-01 — The pinned run failed historically because `deno-check` failed formatting, while `audit-edge` passed
- Severity: low
- Status: historical CI
- Sources: `snapshot.json:875-895` ([4]); `.github/workflows/edge-security.yml:53-67` ([6]); read-only jobs metadata for run `36902600666` ([5])
- Pinned URLs: <https://github.com/knarayanareddy/Firstcommit/actions/runs/36902600666>, <https://github.com/knarayanareddy/Firstcommit/blob/e47af94db32020b3d24d4ac77f6e614560f8bea5/.github/workflows/edge-security.yml#L53-L67>
- Quote: snapshot metadata records `"conclusion": "failure"` for run `36902600666`; workflow lines define `Deno Format Check` and `Deno Type Check`; jobs metadata shows `deno-check` failed at `Deno Format Check`, `Deno Type Check` was skipped, and `audit-edge` succeeded.[4][5][6]

Why it matters: the historical failure belongs to the reviewed SHA, but the failing path was narrower than the old draft claimed. The exact formatting cause remains unknown because logs were not inspected.

Recommended correction: inspect the original logs, document the historical root cause, and verify any fix on the revision that contains the fix. Do not claim a rerun of the old SHA proves later code is fixed.

### O-01 — Defensive documentation is already commissioned; sensitive material remains out of scope
- Severity: low
- Status: owner authorization boundary
- Sources: `snapshot.json:2-12` ([4]); `README.md:169-173` ([7]); `PUBLICATION_AUTHORIZATION.md:3-9` ([13])
- Pinned URLs: <https://github.com/knarayanareddy/Firstcommit/blob/e47af94db32020b3d24d4ac77f6e614560f8bea5/README.md#L169-L173>
- Quote: `PUBLICATION_AUTHORIZATION.md` says the owner granted `explicit authorization for defensive review/remediation documentation PRs`, but `not authorization for application changes, exploitation, live tests, contacting third parties, deployments, merges or settings changes`; it also says to `hold/redact genuinely sensitive material` and not invent a new approval.[13]

Why it matters: for this commissioned documentation campaign, no fresh per-finding consent is required for the current non-exploitative report.[13] The remaining boundary is content sensitivity, not approval freshness: this review should not include real credentials, personal/customer data, active secrets, operational exploit payloads, or claims that deployment/settings actions were authorized. The README/private-language mismatch still deserves cleanup, but it does not revoke the existing documentation authorization.[4][7][13]

## 4) Five-discipline assessment

- **Correctness/code review:** one confirmed unsafe data-to-shell path and one unreachable workflow show the hardening layer is not yet accurately represented.[1][2]
- **Automation/testing:** coverage exists across audits, smoke tests, regression tests, build/typecheck, and dependency audit, but secret-backed jobs can skip and install mode is inconsistent (`npm install` vs `npm ci || npm install`).[9][10][11]
- **DevOps/operations:** release-control machinery exists, but deployment platform, required checks, workflow ownership, Supabase backup/restore drill evidence, and secret rotation/recovery custody were not verified.
- **OWASP/security:** F-01 is confirmed. README claims SSRF controls, BYOK encryption, internal-call auth, and RLS, but auth/authz code, secret storage, and SQL policy enforcement were not inspected.[7]
- **UI/UX/accessibility:** frontend and VS Code surfaces exist, but no UI source/runtime was sampled. Contributor/operator workflow messaging is only one UX slice; product accessibility/usability acceptance for the admin/author/learner surfaces remains unverified.[7][9][10][12]

Important unknowns not resolved by this sample: authn/authz correctness, secret custody and recovery, whole-schema drift detection, data-retention behavior, and backup/restore readiness.

## 5) Production blockers and owner questions

- Should `db-types-check.yml` run in `Firstcommit`, or is the current exclusion intentional?[2]
- Is the four-table `check:types` sentinel enough, or is a real schema/type-drift gate required?[2][3]
- Who owns Actions settings, required checks, secret rotation, and emergency workflow disablement?
- On protected branches, should missing secrets skip or fail `mcp-smoke-test` and `rag-regression`?[9][10]
- What is the owner-approved backup/restore path for Supabase data and auth artifacts, and has any non-production restore drill been observed?
- Which product flows and accessibility checks must pass before anyone claims UI readiness for the admin/author/learner surfaces described in the README?[7]
- Has the commissioned report been screened for real credentials, personal/customer data, active secrets, and operational exploit payloads before publication, as required by `PUBLICATION_AUTHORIZATION.md`?[13]

## 6) Evidence inventory and limitations

Numbered sources used:

1. `.github/workflows/pr-checklist-reminder.yml:3-43` — <https://github.com/knarayanareddy/Firstcommit/blob/e47af94db32020b3d24d4ac77f6e614560f8bea5/.github/workflows/pr-checklist-reminder.yml#L3-L43>
2. `.github/workflows/db-types-check.yml:2-36` — <https://github.com/knarayanareddy/Firstcommit/blob/e47af94db32020b3d24d4ac77f6e614560f8bea5/.github/workflows/db-types-check.yml#L2-L36>
3. `scripts/check_types_tables.ts:15-64` — read-only GitHub fetch at pinned SHA; canonical URL: <https://github.com/knarayanareddy/Firstcommit/blob/e47af94db32020b3d24d4ac77f6e614560f8bea5/scripts/check_types_tables.ts#L15-L64>
4. `snapshot.json:2-12,875-895`
5. Read-only GitHub Actions jobs metadata for run `36902600666`
6. `.github/workflows/edge-security.yml:12-18,44-67` — <https://github.com/knarayanareddy/Firstcommit/blob/e47af94db32020b3d24d4ac77f6e614560f8bea5/.github/workflows/edge-security.yml#L12-L67>
7. `README.md:17-30,34-84,169-173`
8. `package.json:6-24,26-115`
9. `.github/workflows/mcp-smoke-test.yml:12-72`
10. `.github/workflows/rag-regression.yml:15-86`
11. `.github/workflows/prod-hardening.yml:7-51`
12. `vscode-extension/package.json:13-105`
13. `PUBLICATION_AUTHORIZATION.md:3-9`

Limitations: no application source or runtime verification; no workflow logs beyond narrow metadata; no installs/tests/builds/deploys; no repository settings or branch protections inspected.
