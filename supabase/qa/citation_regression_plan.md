# QA Regression Plan: Citation Stability & Evidence UX

## Overview
This document outlines the regression testing strategy to ensure citation badges reliably load evidence previews and modals, supporting both UUID (primary key) and TEXT (stable chunk_id) identifiers.

## 1. Manual Regression Checklist

### Prerequisites
-   Local Supabase running: `supabase start`
-   Migrations applied: `supabase db reset`
-   Frontend running: `npm run dev`

### Test Case 1: Standard Citation Flow
1.  **Action**: Open a module chat and ask a question that yields results from the knowledge base.
2.  **Verify (Badge)**: Citation badge `[S1]` appears in the response.
3.  **Verify (Hover)**: Hover over `[S1]`. The preview tooltip should show code/text content immediately (no infinite spinner).
4.  **Verify (Modal)**: Click `[S1]`. The evidence modal should open, showing the full file content with line highlighting.
5.  **Verify (Original Link)**: Click "View Original" in the modal; it should open the source provider (e.g., GitHub, Notion) if a source link is available.

### Test Case 2: Multi-Source Path Normalization
1.  **Action**: In a cross-repo Pack, ask a question that returns results from multiple sources.
2.  **Verify**: The evidence modal title/breadcrumbs should be prefixed with the source slug (e.g., `rocketboard/src/main.ts`).

## 2. Hardening & Security Checks

### Test Case 3: Performance & Contract Integrity
1.  **Action**: Perform a search in a pack where the updated `retrieve-spans` is deployed.
2.  **Verify**: Inspect the network response from `retrieve-spans`.
3.  **Assert**: 
    - `chunk_ref` is present and matches either `stable_chunk_id` or `chunk_pk`.
    - `chunk_pk` is a valid UUID.
    - `stable_chunk_id` is either TEXT (e.g., "C00001") or `null`.
    - `chunk_id` (legacy) matches `stable_chunk_id` (never contains a UUID).
    - `metadata.resolve_query_ran` must be `false` (assuming SQL RPC returns ID/SourceID).

### Test Case 4: Security (Edge-Only Enforcement)
1.  **Action**: Attempt to call `hybrid_search_v2` directly from the browser console using the Supabase client:
    ```javascript
    const { data, error } = await supabase.rpc('hybrid_search_v2', { ... });
    ```
2.  **Verify**: The request should fail.
3.  **Assert**: `error.code` should be `42501` (Insufficient Privilege) or `403 Forbidden`.

## 3. Negative & Edge Cases

### Case 5: UUID Identifier Fallback
*Note: This simulates the scenario where a search RPC returns a row UUID but no stable chunk_id.*
1.  **Setup**: Force a UUID into the UI by intercepting the `retrieve-spans` network response (set `stable_chunk_id: null` and `chunk_ref: <uuid>`).
2.  **Action**: Click the badge.
3.  **Verify**: The UI should correctly resolve the UUID via `chunk_pk` or the `chunk_ref` union and load content successfully.
4.  **Assert**: `metadata.resolve_query_ran` must be `true` in the `retrieve-spans` response for this case.

### Case 7: Backward Compatibility (Legacy Chat)
1.  **Setup**: Manually edit a `chat_messages.metadata` row to contain only `chunk_id` as a UUID in the `source_map`.
2.  **Action**: Open the chat in the UI.
3.  **Verify**: The `CitationBadge` should correctly normalize the legacy `chunk_id` into a `chunk_ref` and load evidence.
4.  **Assert**: Content loads correctly without console errors regarding missing `chunk_ref`.

### Case 6: Missing Content Graceful Failure
1.  **Action**: Click a citation badge where the underlying chunk has been deleted or is inaccessible.
2.  **Verify**: The UI should show a clear "Content missing" or "Error loading evidence" message instead of a permanent loading spinner.

## 3. Automated Testing

### Unit Testing
A unit test has been added to verify the `isUuidLike` regex used for identifer switching.

**Test File**: `src/hooks/useEvidenceSpanContent.test.ts` (or equivalent)
**Test Command**: `npm test src/hooks/useEvidenceSpanContent.test.ts`

### E2E Smoke Flow (Playwright/Cypress)
If E2E tooling is enabled, add the following flow:
```javascript
test('citation modal loads content', async ({ page }) => {
  await page.goto('/pack/test-pack/chat');
  await page.fill('textarea', 'how do I setup auth?');
  await page.keyboard.press('Enter');
  
  // Wait for citation and click
  const badge = page.locator('button:has-text("[S1]")').first();
  await badge.click();
  
  // Assert modal content
  await expect(page.locator('role=dialog')).toBeVisible();
  await expect(page.locator('pre code')).not.toBeEmpty();
});
```

---
**Last Updated**: 2026-03-26
**Owner**: RocketBoard QA Team
