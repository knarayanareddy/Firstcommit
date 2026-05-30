# Cross-Repo Packs v1 QA

This document outlines the manual verification steps for the Cross-Repo Packs v1 feature.

## Test 1: Database Migration & Schema
**Objective**: Verify that the database schema is correctly updated.
1. Run the migration `supabase/migrations/20260412000000_cross_repo_packs.sql`.
2. Verify that `public.pack_sources` has a `short_slug` column.
3. Verify that the unique index `idx_pack_sources_pack_slug` exists.
4. Verify that `hybrid_search_v2` and `definition_search_v1` now return a `source_id` column.

## Test 2: Source Slugging and Retrieval
**Objective**: Verify that retrieval correctly prefixes paths with the source slug.
1. Identify a pack with multiple sources.
2. Assign different `short_slug` values to at least two sources (e.g., `api` and `web`).
3. Call the `retrieve-spans` Edge Function for that pack.
4. **Expected**: The `path` field in the returned spans should be prefixed with the slug (e.g., `api/src/main.ts` or `web/public/index.html`).
5. **Expected**: The `metadata` for each span should contain `source_id` and `source_slug`.

## Test 3: VS Code Citation Resolution
**Objective**: Verify that the VS Code extension resolves prefixed paths correctly.
1. In a VS Code workspace, ensure you are members of a pack with slugs configured.
2. Click a citation with a prefixed path (e.g., `[S1]` where `path` is `api/src/main.ts`).
3. **If no mapping exists**:
   - **Expected**: VS Code should show a QuickPick listing all open workspace folders.
   - Select a folder.
   - **Expected**: The mapping should be saved to `rocketboard.sourceMappings` in the workspace settings.
   - **Expected**: The file should open at the correct line.
4. **If a mapping already exists**:
   - **Expected**: The file should open immediately without prompting.

## Test 4: MCP Tool `list_pack_sources`
**Objective**: Verify that the MCP tool returns the expected source metadata.
1. Call the `list_pack_sources` MCP tool with a valid `pack_id`.
2. **Expected**: The tool returns a list of sources, including `source_id`, `short_slug`, `source_type`, and `source_uri`.
3. **Expected**: Authorizations are handled correctly (Learner+ access).

## Acceptance Checklist
- [ ] Multiple repos in one pack ingest without path collisions (verified via prefixed retrieval).
- [ ] Citations identify the source repo via the path prefix.
- [ ] VS Code extension prompts for and persists source mappings.
- [ ] MCP clients can list and interpret source identifiers.
