# Manual Purge Logic Verification

Follow these steps to verify the `purge-source` Edge Function logic.

## 1. Dry Run Verification
1. Open the **Data Lifecycle** settings page: `/packs/{{PACK_ID}}/settings/lifecycle`.
2. Find **Source A** in the "Per-Source Purge" list.
3. Click **Dry Run**.
4. **Expect**: A toast notification showing 5 knowledge chunks and 1 ingestion job found.

## 2. Execute Purge (Source A)
1. In the same list, click **Purge** for **Source A**.
2. Type `PURGE` in the confirmation prompt.
3. **Expect**: Success message showing rows deleted.
4. **Database Check**:
   ```sql
   -- Expect: 0
   SELECT count(*) FROM knowledge_chunks WHERE source_id = '{{SOURCE_A_ID}}';
   -- Expect: 5
   SELECT count(*) FROM knowledge_chunks WHERE source_id = '{{SOURCE_B_ID}}';
   ```

## 3. Idempotency Check
1. Click **Purge** for **Source A** again.
2. Type `PURGE` to confirm.
3. **Expect**: Success message showing 0 rows deleted.
4. **Database Check**:
   ```sql
   -- Expect: 3 rows (Dry Run A, Purge A, Purge A again)
   SELECT * FROM lifecycle_audit_events 
   WHERE pack_id = '{{PACK_ID}}' AND target_id = '{{SOURCE_A_ID}}';
   ```

## 4. Verification of Reset
1. Check the `pack_sources` table.
2. **Expect**: `last_synced_at` is NULL for Source A.
   ```sql
   SELECT id, last_synced_at FROM pack_sources WHERE id = '{{SOURCE_A_ID}}';
   ```
