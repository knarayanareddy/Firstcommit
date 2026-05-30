# Data Lifecycle Controls (Minimal v1)

RocketBoard provides safe and auditable data lifecycle management for enterprise compliance.

## 1. Per-Source Purge

Authors can perform a "Purge" on any connected source (e.g., a specific Slack channel or Confluence space) to remove all derived artifacts.

### The Purge Flow
1. **Dry Run**: Computes the number of knowledge chunks and ingestion jobs that will be affected.
2. **Execute**: Atomically deletes all derived artifacts from the database. Requires typing "PURGE" as confirmation.

### Invariants
- **Scoped Deletion**: Only affects row for the specific `pack_id` and `source_id`.
- **RBAC**: Requires `author` or `admin` pack role.
- **Audit**: Every action is logged in `lifecycle_audit_events`.

## 2. Retention Policies

Retention policies control how long operational data is kept.

| Data Type | Default | Table Scoped |
|-----------|---------|--------------|
| AI Metrics | 90 days | `rag_metrics` |
| Ingestion Jobs | 90 days | `ingestion_jobs` |

### Scheduled Cleanup
A daily cron job (`lifecycle-retention-job`) enforces these windows.

### Legal Hold
- **Column**: `legal_hold` in `pack_lifecycle_policies`.
- **V1 Behavior**: The cleanup job skips packs with `legal_hold=true` and logs an audit event noting the skip.
- **Enforcement**: Future versions will block manual purges as well.

## 3. Operationalization

### Manual Retention Trigger
```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/lifecycle-retention-job \
  -H "Authorization: Bearer <CRON_AUTH_TOKEN>" \
  -d '{"dry_run": false}'
```

### Audit Log Query
Audit logs are visible in the **Data Lifecycle** settings page or can be queried directly:
```sql
SELECT * FROM lifecycle_audit_events WHERE pack_id = '...' ORDER BY created_at DESC LIMIT 10;
```
