# GitHub PR Write-back v1 QA

This document outlines the manual verification steps for the GitHub PR Write-back v1 feature.

## Test 1: Database Migration
**Objective**: Verify that the `change_proposals` table is correctly created.
1. Run `supabase migration up`.
2. Check that the `change_proposals` table exists with all required columns.
3. Verify that RLS is enabled and policies for `Pack members can view` and `Authors can manage` are present.

## Test 2: UI Access & Visibility
**Objective**: Verify the new Proposals page is accessible and responsive.
1. Navigate to `/packs/[packId]/admin/proposals`.
2. Verify the page renders with the "Change Proposals" header and the "Authoring Mode" badge (if you are an author).
3. Verify that an empty state is shown if no proposals exist.

## Test 3: Proposal Review & Approval
**Objective**: Verify the author can review and approve a draft proposal.
1. Manually insert a draft proposal into the DB (simulating AI generation):
   ```sql
   INSERT INTO change_proposals (pack_id, source_id, title, description, proposal_type, patch_unified, files, status, created_by)
   VALUES ('[pack-id]', '[source-id]', 'Update README', 'Fixing typos', 'doc', 
   '--- README.md\n+++ README.md\n@@ -1,1 +1,1 @@\n-# RocketBoard\n+# RocketBoard v2', 
   '[{"path": "README.md", "action": "modify"}]', 'draft', '[user-id]');
   ```
2. Refresh the Proposals page.
3. Verify the proposal card appears with a syntax-highlighted diff.
4. Click **Approve Proposal**.
5. Verify toast success and that status changes to "Approved".
6. Verify `approved_by` and `approved_at` are populated in the DB.

## Test 4: GitHub PR Creation (End-to-End)
**Objective**: Verify the PR is successfully created on GitHub.
1. Ensure the `pack_sources` entry has valid GitHub App credentials in Vault.
2. On the approved proposal card, click **Create GitHub PR**.
3. Verify the loading state (spinner).
4. Verify toast success: "GitHub Pull Request created successfully!".
5. Check that the button changes to **View PR on GitHub**.
6. Click the link and verify it opens the correct PR on the GitHub website.
7. Verify the PR contains the expected file changes.
8. Verify a `lifecycle_audit_events` row was created with type `proposal_pr_created`.

## Test 5: Error Handling (SSRF & Conflicts)
**Objective**: Verify security and robust conflict handling.
1. Attempt to create a proposal with a malformed source URI and verify the Edge Function rejects it (SSRF protection).
2. Attempt to open a PR for a proposal whose base file has changed (force a conflict) and verify the "Failed to apply patch" error is shown.
