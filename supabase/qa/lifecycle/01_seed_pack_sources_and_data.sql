-- 01_seed_pack_sources_and_data.sql
-- Seed test data for lifecycle verification. Replace placeholders.

-- 1. Create Pack Sources for Source A and B
INSERT INTO public.pack_sources (id, pack_id, type, status, config)
VALUES 
  ('{{SOURCE_A_ID}}', '{{PACK_ID}}', 'url', 'synced', '{"url": "https://example.com/source_a", "title": "Source A"}'::jsonb),
  ('{{SOURCE_B_ID}}', '{{PACK_ID}}', 'url', 'synced', '{"url": "https://example.com/source_b", "title": "Source B"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 2. Seed Knowledge Chunks for Source A (5 chunks)
INSERT INTO public.knowledge_chunks (pack_id, source_id, path, content, line_start, line_end, content_hash)
SELECT 
  '{{PACK_ID}}', 
  '{{SOURCE_A_ID}}', 
  'src/source_a_' || i || '.ts', 
  'Content for chunk ' || i || ' in Source A', 
  i * 10, 
  i * 10 + 5,
  md5('Source A' || i)
FROM generate_series(1, 5) AS i
ON CONFLICT DO NOTHING;

-- 3. Seed Knowledge Chunks for Source B (5 chunks)
INSERT INTO public.knowledge_chunks (pack_id, source_id, path, content, line_start, line_end, content_hash)
SELECT 
  '{{PACK_ID}}', 
  '{{SOURCE_B_ID}}', 
  'src/source_b_' || i || '.ts', 
  'Content for chunk ' || i || ' in Source B', 
  i * 10, 
  i * 10 + 5,
  md5('Source B' || i)
FROM generate_series(1, 5) AS i
ON CONFLICT DO NOTHING;

-- 4. Seed Ingestion Jobs
INSERT INTO public.ingestion_jobs (id, pack_id, source_id, started_at, status)
VALUES 
  (gen_random_uuid(), '{{PACK_ID}}', '{{SOURCE_A_ID}}', now() - interval '1 hour', 'completed'),
  (gen_random_uuid(), '{{PACK_ID}}', '{{SOURCE_B_ID}}', now() - interval '2 hours', 'completed');

-- 5. Seed RAG Metrics (Backdated 120 days)
INSERT INTO public.rag_metrics (pack_id, created_at, org_id, user_id, query, task_type, request_id, citations_found, grounding_score, attempts, total_latency_ms)
SELECT 
  '{{PACK_ID}}',
  now() - interval '120 days',
  (SELECT organization_id FROM packs WHERE id = '{{PACK_ID}}'),
  '{{AUTHOR_USER_ID}}',
  'Mock query for testing retention',
  'chat',
  gen_random_uuid(),
  3,
  0.95,
  1,
  1500
FROM generate_series(1, 10) AS i;

-- 6. Ensure default Lifecycle Policy exists
INSERT INTO public.pack_lifecycle_policies (pack_id, retention_rag_metrics_days, retention_ingestion_jobs_days, legal_hold)
VALUES ('{{PACK_ID}}', 90, 90, false)
ON CONFLICT (pack_id) DO NOTHING;
