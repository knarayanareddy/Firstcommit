# Trust Console: Rollup Aggregates & Scheduling

To ensure the Trust & Quality Console remains fast and cost-effective as data volumes grow, we use **daily rollup tables**. These tables store pre-computed aggregates of RAG metrics, ingestion jobs, and content health.

## Rollup Tables
- `pack_quality_daily`: Aggregates for grounding pass rates, latency, and citations.
- `pack_ingestion_daily`: Aggregates for ingestion job successes and chunk volumes.
- `pack_content_health_daily`: Aggregates for user feedback, ratings, and remediations.

## Aggregation Logic
The rollup logic is encapsulated in the `rollup-trust-metrics` Edge Function. This function:
1. Calls optimized SQL RPCs (`rollup_quality_aggregates`, etc.) to perform grouped inserts/updates.
2. Is idempotent: it re-computes the entire day's aggregate from raw source tables.
3. Scopes data by `pack_id` for multi-tenant security.

## Scheduling (Cron)
We recommend scheduling this function to run **daily** and **hourly** to keep the dashboard current.

### 1. Daily Full Sync (Yesterday's Data)
Runs at 02:00 UTC to finalize yesterday's metrics.
- **Schedule**: `0 2 * * *`
- **Method**: POST
- **URL**: `https://<project-ref>.supabase.co/functions/v1/rollup-trust-metrics`
- **Headers**: `Authorization: Bearer <service_role_key>`
- **Body**: `{}` (Defaults to yesterday + today)

### 2. Hourly Freshness (Today's Data)
Runs every hour to update the current day's charts.
- **Schedule**: `0 * * * *`
- **Method**: POST
- **URL**: `https://<project-ref>.supabase.co/functions/v1/rollup-trust-metrics`
- **Headers**: `Authorization: Bearer <service_role_key>`
- **Body**: `{}`

## Manual Trigger
You can manually trigger a rollup for a specific date range if data needs to be backfilled:
```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/rollup-trust-metrics" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "Content-Type: application/json" \
  -d '{"day_from": "2026-01-01", "day_to": "2026-03-19"}'
```

## Security
- Rollup tables use strict RLS scoping access to **Pack Authors & Admins**.
- The Edge Function requires the **Service Role Key** or a dedicated `CRON_AUTH_TOKEN` for invocation.
