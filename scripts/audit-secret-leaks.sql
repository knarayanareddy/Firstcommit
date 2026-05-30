-- scripts/audit-secret-leaks.sql
-- 
-- Verification script to ensure that no secrets have leaked into knowledge_chunks
-- with is_redacted = false.
--
-- This script uses common secret patterns to scan the content column.
-- Run this in the Supabase SQL Editor.

WITH secret_leaks AS (
  SELECT 
    id,
    pack_id,
    source_id,
    path,
    content,
    is_redacted,
    CASE
      WHEN content ~ 'AKIA[0-9A-Z]{16}' THEN 'AWS Access Key'
      WHEN content ~ 'gh[pousr]_[A-Za-z0-9_]{36,}' THEN 'GitHub Token'
      WHEN content ~ 'sk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,}' THEN 'OpenAI Key'
      WHEN content ~ 'xox[bpas]-[A-Za-z0-9-]{10,}' THEN 'Slack Token'
      WHEN content ~ 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' THEN 'Possible Supabase Service Role'
      WHEN content ~ '(?:postgres|mysql|mongodb|redis|amqp):\/\/[^\s''"}{]+' THEN 'Database URL'
      ELSE NULL
    END as leaked_pattern_type
  FROM knowledge_chunks
  WHERE is_redacted = false -- We only care about chunks marked "safe"
)
SELECT * 
FROM secret_leaks 
WHERE leaked_pattern_type IS NOT NULL
ORDER BY pack_id;

-- Summary query
SELECT 
  leaked_pattern_type,
  COUNT(*) as leak_count
FROM (
  SELECT 
    CASE
      WHEN content ~ 'AKIA[0-9A-Z]{16}' THEN 'AWS Access Key'
      WHEN content ~ 'gh[pousr]_[A-Za-z0-9_]{36,}' THEN 'GitHub Token'
      WHEN content ~ 'sk-[A-Za-z0-9]{20,}T3BlbkFJ[A-Za-z0-9]{20,}' THEN 'OpenAI Key'
      WHEN content ~ 'xox[bpas]-[A-Za-z0-9-]{10,}' THEN 'Slack Token'
      WHEN content ~ 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' THEN 'Possible Supabase Service Role'
      WHEN content ~ '(?:postgres|mysql|mongodb|redis|amqp):\/\/[^\s''"}{]+' THEN 'Database URL'
      ELSE 'Other'
    END as leaked_pattern_type
  FROM knowledge_chunks
  WHERE is_redacted = false
) s
WHERE leaked_pattern_type != 'Other' -- Should be zero results
GROUP BY leaked_pattern_type;
