# Firstcommit remediation plan

Companion: [REVIEW.md](./REVIEW.md)

## 1) Phased roadmap with entry/exit criteria

### Phase 0 — Baseline evidence and owner decisions
Entry: current sampled evidence only.

Exit:
- Owner records three decisions: whether `db-types-check.yml` should run in `Firstcommit`, how missing secrets should behave on protected branches, and whether any redactions are required under the existing publication authorization because the report would otherwise contain real secrets, PII/customer data, or operational exploit payloads.
- Historical run `36902600666` is preserved accurately as `deno-check` format failure, not generically as a failed security audit.
- The pinned baseline SHA remains the historical reference point for later fixed-revision verification.

### Phase 1 — Confirmed workflow corrections
Entry: Phase 0 decisions documented.

Exit:
- F-01 no longer routes PR body text through shell parsing.
- F-02 is coherent: reachable in `Firstcommit` or explicitly excluded.
- The current DB check is described as a narrow four-table sentinel, not as full schema drift proof.

### Phase 2 — Policy and operations hardening
Entry: Phase 1 changes ready for review.

Exit:
- Secret-backed workflows have deterministic protected-branch behavior.
- Install mode choices are justified per workflow.
- Workflow ownership, emergency disablement, and recovery steps are written down.
- Supabase/data backup and restore scope, custody, and drill requirements are written down or explicitly deferred by the owner.

### Phase 3 — Product acceptance and publication-safety handling
Entry: Phase 2 policies exist.

Exit:
- Workflow outcomes clearly distinguish skipped, misconfigured, policy-failed, and executed states.
- Product UI/accessibility acceptance criteria for the README-described surfaces are written down and either executed or explicitly deferred by the owner.
- Commissioned defensive documentation is treated as already authorized, but any public artifact has been screened for real secrets, PII/customer data, operational exploit payloads, and unauthorized deployment/settings actions.

### Phase 4 — Independent acceptance
Entry: Phases 1-3 complete and at least one revision containing the relevant fix set exists.

Exit:
- Separate verifier confirms negative controls, fixed-revision evidence, and owner-policy decisions.

## 2) Task list

### FC-T01 — Remove shell execution risk from the PR checklist reminder
- Linked finding: F-01 in [REVIEW.md](./REVIEW.md#3-findings-ledger)
- Prerequisites: confirm comment copy can remain; choose `github-script` or committed Node implementation.
- Observed path: `.github/workflows/pr-checklist-reminder.yml`
- Steps:
  1. Replace the shell body inspection with logic that reads `context.payload.pull_request.body ?? ''` as data.
  2. Emit only a boolean/string output such as `missing=true|false`.
  3. Keep the reminder behavior, but remove any route where raw PR text can affect shell parsing or output-file syntax.
- Expected deliverable: workflow with no raw PR body in executable shell context.
- Verification procedure: test bodies with quotes, newlines, backticks, `$()`, and normal checklist text; only presence/absence should change.
- DoD:
  - [ ] PR body is not interpreted as shell code.
  - [ ] Checklist detection still works.
  - [ ] Rollback guidance does not restore the old interpolation.

### FC-T02 — Resolve the DB type-check intent and scope
- Linked finding: F-02 in [REVIEW.md](./REVIEW.md#3-findings-ledger)
- Prerequisites: owner decision on whether the job should run here.
- Observed paths: `.github/workflows/db-types-check.yml`, `scripts/check_types_tables.ts`
- Steps:
  1. Remove/correct the repo guard if this job belongs in `Firstcommit`, or document the exclusion explicitly if it does not.
  2. Update naming/comments/docs so the current check is described as a four-table `types.ts` sentinel with `Row` marker checks.
  3. If broader coverage is wanted, track a separate real schema-drift gate rather than claiming the current sentinel already provides it.
- Expected deliverable: reachable-or-explicitly-excluded workflow, accurate scope labeling, and separate evidence for job reachability/intent versus sentinel behavior.
- Verification procedure: verify three things independently: (a) if enabled, `workflow_dispatch` or a qualifying PR in `Firstcommit` queues and runs the job; or (b) if excluded, the skip is explicitly documented as intentional; and (c) separately, the sentinel fails when one covered table or `Row` marker is removed. Do not treat any one of those as proof of the others.
- DoD:
  - [ ] The repo-guard outcome is explicit.
  - [ ] The current check is no longer overstated.
  - [ ] Job enqueue/run evidence or intentional-skip evidence exists separately from marker-test evidence.
  - [ ] Any broader-drift promise has its own task.

### FC-T03 — Triage the historical Edge Security Audit run correctly
- Linked finding: H-01 in [REVIEW.md](./REVIEW.md#3-findings-ledger)
- Prerequisites: access to the original run log.
- Observed path: `.github/workflows/edge-security.yml`; run `36902600666`
- Steps:
  1. Preserve the historical facts: the reviewed SHA’s workflow run failed because `deno-check` failed `Deno Format Check`; `Deno Type Check` was skipped; `audit-edge` passed.
  2. Inspect the original logs to identify the exact formatting or config cause.
  3. Once a later revision actually contains the relevant fix, verify that revision separately, keeping the pinned baseline SHA and the fixed revision as distinct evidence items.
- Expected deliverable: written historical root cause plus fixed-revision verification record.
- Verification procedure: reviewer can point to one artifact for the historical run and another for the later fix.
- DoD:
  - [ ] Historical attribution is accurate.
  - [ ] Root cause comes from logs, not guesswork.
  - [ ] The pinned baseline SHA is preserved as baseline evidence.
  - [ ] Fixed evidence is tied to the fixed revision.

### FC-T04 — Make live secret-backed workflows and install choices policy-driven
- Linked requirement: preventive hardening from [REVIEW.md](./REVIEW.md#4-five-discipline-assessment)
- Prerequisites: owner decision on protected branches, forks, and manual runs.
- Observed paths: `.github/workflows/mcp-smoke-test.yml`, `.github/workflows/rag-regression.yml`, `.github/workflows/prod-hardening.yml`, `package.json`
- Steps:
  1. Define whether missing secrets should skip or fail on protected branches and other contexts.
  2. Encode contributor-visible status messages so skip, misconfiguration, policy failure, and executed states are distinct.
  3. Document where `npm ci`, `npm install`, or fallback is acceptable and why.
- Expected deliverable: deterministic policy for live checks and install mode.
- Verification procedure: review workflow behavior with and without secrets and confirm install commands match their documented rationale.
- DoD:
  - [ ] Secret absence behavior is explicit.
  - [ ] Workflow states are distinguishable.
  - [ ] Install mode differences are documented.

### FC-T05 — Add control-plane operations, recovery, and disclosure guidance
- Linked findings: O-01 plus production blockers in [REVIEW.md](./REVIEW.md#5-production-blockers-and-owner-questions)
- Prerequisites: identify owners for Actions settings, secrets, and release gates.
- Proposed paths: repo process/ops docs path selected by owner
- Steps:
  1. Assign ownership for required checks, branch protection changes, repo secrets, Supabase admin access, and emergency workflow disablement.
  2. Document the incident path: capture evidence, disable/contain the affected workflow if necessary, restore a known-good **non-vulnerable** state, then re-enable only after evidence-backed correction.
  3. Record the commissioned-publication boundary from `PUBLICATION_AUTHORIZATION.md`: defensive documentation is already authorized, but real secrets, PII/customer data, operational exploit payloads, and deployment/settings actions remain out of scope and must be held/redacted.
- Expected deliverable: short operations runbook plus publication-safety note consistent with existing owner authorization.
- Verification procedure: independent reader can identify owners, recovery steps, and the publication boundary without guessing or inventing a fresh approval requirement.
- DoD:
  - [ ] Ownership is explicit.
  - [ ] Recovery steps do not revert to the unsafe F-01 pattern.
  - [ ] Publication handling reflects existing authorization rather than a new approval request.

### FC-T06 — Define and execute or explicitly defer a Supabase/data backup-restore drill
- Linked requirement: operations/data recovery gap from [REVIEW.md](./REVIEW.md#4-five-discipline-assessment)
- Prerequisites: owner-approved access to backup tooling and a non-production restore target, or an owner-approved deferral if those prerequisites are unavailable.
- Proposed paths: repo ops/runbook path selected by owner
- Steps:
  1. Define what is in scope for recovery evidence: Supabase Postgres data, auth-related records/artifacts, storage objects if applicable, secret/passphrase custody dependencies, and the acceptable non-production restore target.
  2. Write the backup and restore sequence, including who can run it, what snapshot/export is used, what credentials are needed, and what post-restore checks must succeed.
  3. Either execute the owner-approved non-production restore drill and record the observed outcome, or record an explicit owner-approved deferral that states why the drill could not yet be run and what blocks it.
- Expected deliverable: backup/restore runbook plus an observed drill record or explicit owner-approved deferral.
- Verification procedure: a reviewer can trace the recovery sequence, required access, and either the observed non-production restore evidence or the signed deferral record; no blanket recovery-readiness claim is allowed without the drill.
- DoD:
  - [ ] Backup/restore scope and ownership are explicit.
  - [ ] Required credentials/access dependencies are recorded.
  - [ ] Observed drill evidence exists, or an explicit owner-approved deferral exists.
  - [ ] Documentation does not imply recovery readiness without that evidence.

### FC-T07 — Define and execute or explicitly defer product UI/accessibility acceptance
- Linked requirement: UI/UX/accessibility gap from [REVIEW.md](./REVIEW.md#4-five-discipline-assessment)
- Prerequisites: owner-approved runnable environment and representative product flows, or an owner-approved deferral if those prerequisites are unavailable.
- Proposed paths: repo QA/acceptance path selected by owner
- Steps:
  1. Select the minimum product flows to evaluate from the README-described surfaces, such as one admin/owner flow, one author flow, and one learner flow, plus the extension flow if the owner wants it in scope.
  2. Define acceptance checks for keyboard navigation, visible focus, labels/instructions, error feedback, contrast/readability, and any flow-specific usability notes the owner requires.
  3. Either execute the owner-approved acceptance pass and record findings by flow/check, or record an explicit owner-approved deferral that states why runnable UI acceptance could not yet occur and what blocks it.
- Expected deliverable: product UI/accessibility acceptance checklist plus observed findings or explicit owner-approved deferral.
- Verification procedure: a reviewer can see which flows were tested, which checks passed/failed/deferred, and whether any unresolved issues block readiness; no blanket UI-readiness claim is allowed without that evidence.
- DoD:
  - [ ] In-scope flows and checks are explicit.
  - [ ] Observed findings exist, or an explicit owner-approved deferral exists.
  - [ ] Documentation distinguishes pass/fail/deferred outcomes.
  - [ ] Documentation does not imply product UI/accessibility readiness without evidence.

### FC-T08 — Independent acceptance on the fixed revision
- Linked requirement: final verification of F-01, F-02, H-01, and policy tasks
- Prerequisites: FC-T01 through FC-T07 complete and at least one revision containing the relevant fix set exists.
- Observed/proposed paths: final workflow files, docs updates, and acceptance notes
- Steps:
  1. Have a verifier other than the author review the final workflow/docs against [REVIEW.md](./REVIEW.md).
  2. Run negative controls: malicious PR body content must remain inert; job reachability/intent for `db-types-check` must be evidenced separately from the sentinel marker test; the four-table sentinel must fail on a covered-table break; if a broader drift gate exists, it must fail outside the original four-table scope; missing secrets must yield the intended status.
  3. Confirm historical evidence, fixed-revision evidence, and any owner-approved backup/UI deferrals are all preserved, explicitly labeled deferred when unresolved, and not conflated with readiness proof.
- Expected deliverable: independent acceptance record tied to the fixed revision.
- Verification procedure: acceptance requires failing negative controls, passing corrected behavior, and recorded owner-policy decisions.
- DoD:
  - [ ] Negative controls actually fail when behavior is broken.
  - [ ] Acceptance is tied to the fixed revision.
  - [ ] Historical and fixed evidence remain separate.
  - [ ] Any recovery readiness claim is backed by observed drill evidence.
  - [ ] Any product UI/accessibility readiness claim is backed by observed findings.
  - [ ] Any owner-approved backup/UI deferral remains recorded as deferred and is not treated as readiness proof.

## 3) Task dependency map

| Task | Depends on | Blocks |
|---|---|---|
| FC-T01 | Phase 0 policy awareness | Phase 1, FC-T08 |
| FC-T02 | Phase 0 repo-scope decision | Phase 1, FC-T08 |
| FC-T03 | Original run log | Historical baseline closure, FC-T08 |
| FC-T04 | Phase 0 secret-policy decisions | Phase 2, FC-T05, FC-T08 |
| FC-T05 | FC-T04 plus operational owner identification | Phase 2/3, FC-T06, FC-T07, FC-T08 |
| FC-T06 | FC-T05 plus owner-approved backup/restore access or owner-approved deferral | Phase 2/4, FC-T08 |
| FC-T07 | FC-T05 plus owner-approved runnable UI scope or owner-approved deferral | Phase 3/4, FC-T08 |
| FC-T08 | FC-T01 through FC-T07 and a fixed revision | Final acceptance |

## 4) Production acceptance checklist

- [ ] No untrusted PR content is interpreted as shell code.
- [ ] `db-types-check.yml` is either intentionally reachable in `Firstcommit` or intentionally excluded with explanation.
- [ ] Job enqueue/run evidence or intentional-skip evidence for `db-types-check.yml` exists separately from sentinel marker-test evidence.
- [ ] The current DB check is described according to its actual four-table scope.
- [ ] Run `36902600666` is documented accurately as a historical `deno-check` format failure.
- [ ] Secret-backed workflows have explicit protected-branch behavior.
- [ ] Install mode choices are documented per workflow.
- [ ] Workflow ownership and recovery steps are written down.
- [ ] Observed Supabase/data backup-restore evidence exists before any recovery-readiness claim is made; otherwise any owner-approved deferral is recorded as deferred.
- [ ] Observed product UI/accessibility evidence exists before any UI-readiness claim is made; otherwise any owner-approved deferral is recorded as deferred.
- [ ] Publication handling follows existing authorization and screens out sensitive/out-of-scope material.
- [ ] Independent acceptance includes negative controls and fixed-revision evidence.

## 5) Changes requiring owner approval

- Enabling or intentionally excluding `db-types-check.yml` for `Firstcommit`.
- Changing required-check behavior or protected-branch semantics for missing secrets.
- Reassigning release-control ownership or secret custody.
- Running backup/restore or UI acceptance where privileged access or protected environments require owner approval.

## 6) Rollback and release policy

- If FC-T01 causes issues, disable or contain the workflow while debugging; do **not** roll back by restoring raw PR-body interpolation.
- Preserve the original `36902600666` failure evidence even after fixes land.
- Release workflow changes only after one positive result on the fixed revision and at least one negative control showing the old unsafe or overstated behavior would be caught.
- Before publication, screen the document for real credentials, personal/customer data, active secrets, and operational exploit payloads; do not treat this documentation authorization as permission for deployment, settings changes, live exploitation, or other operational actions.
