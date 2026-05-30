-- MANUAL RUNBOOK — schedule recurring jobs (Trust rollups, retention, staleness).
-- NOT an auto-migration: pg_cron / pg_net may be unavailable in some environments and
-- would break `supabase db reset`. Run intentionally on an env that has them.
--
-- Prereqs:
--   create extension if not exists pg_cron;
--   create extension if not exists pg_net;
--   -- store these once (service-role only):
--   -- alter database postgres set app.functions_base_url = 'https://<ref>.functions.supabase.co';
--   -- alter database postgres set app.internal_secret = '<ROCKETBOARD_INTERNAL_SECRET>';

select cron.schedule('rollup-pack-quality-daily', '5 0 * * *', $$
  select net.http_post(
    url := current_setting('app.functions_base_url') || '/rollup-pack-quality-daily',
    headers := jsonb_build_object('Content-Type','application/json',
                                  'X-Rocketboard-Internal', current_setting('app.internal_secret')),
    body := '{}'::jsonb);
$$);

select cron.schedule('lifecycle-retention-hourly', '0 * * * *', $$
  select net.http_post(
    url := current_setting('app.functions_base_url') || '/lifecycle-retention-job',
    headers := jsonb_build_object('Content-Type','application/json',
                                  'X-Rocketboard-Internal', current_setting('app.internal_secret')),
    body := '{}'::jsonb);
$$);

select cron.schedule('process-staleness-queue-5min', '*/5 * * * *', $$
  select net.http_post(
    url := current_setting('app.functions_base_url') || '/process-staleness-queue',
    headers := jsonb_build_object('Content-Type','application/json',
                                  'X-Rocketboard-Internal', current_setting('app.internal_secret')),
    body := '{}'::jsonb);
$$);

-- Inspect: select * from cron.job;   Unschedule: select cron.unschedule('<name>');
