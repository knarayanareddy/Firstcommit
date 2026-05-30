# Manual Retention & Legal Hold Verification

Follow these steps to verify the `lifecycle-retention-job` Edge Function.

## 1. Dry Run Verification
1. Open the **Data Lifecycle** settings page: `/packs/{{PACK_ID}}/settings/lifecycle`.
2. Ensure **AI Metrics Retention** is set to 90 days.
3. Call the retention job in dry-run mode (using a manual trigger or script):
   ```bash
   curl -X POST https://<project-ref>.supabase.co/functions/v1/lifecycle-retention-job \
     -H "Authorization: Bearer <CRON_AUTH_TOKEN>" \
     -d '{"pack_id": "{{PACK_ID}}", "dry_run": true}'
   ```
4. **Expect**: The response should report that it *would* delete 10 `rag_metrics` rows (seeded at 120 days old).
5. **Audit Check**: Verify an audit event was written with `parameters: { "dry_run": true }`.

## 2. Execute Retention
1. Trigger the retention job in execution mode:
   ```bash
   curl -X POST https://<project-ref>.supabase.co/functions/v1/lifecycle-retention-job \
     -H "Authorization: Bearer <CRON_AUTH_TOKEN>" \
     -d '{"pack_id": "{{PACK_ID}}", "dry_run": false}'
   ```
2. **Expect**: The response should confirm the deletion of 10 rows.
3. **Database Check**:
   ```sql
   -- Expect: 0
   SELECT count(*) FROM rag_metrics WHERE pack_id = '{{PACK_ID}}' AND created_at < now() - interval '90 days';
   ```

## 3. Legal Hold Verification
1. Enable **Legal Hold** in the Lifecycle Settings UI.
2. Re-seed test data if needed.
3. Run the retention job again (execute mode).
4. **Expect**: The response should show 0 rows deleted.
5. **Audit Check**: Verify a `retention_cleanup` event was logged with `parameters: { "legal_hold": true }`.
