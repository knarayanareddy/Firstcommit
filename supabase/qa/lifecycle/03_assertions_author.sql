-- 03_assertions_author.sql
-- Run this as a user with the 'author' or 'admin' role for the test pack.

-- 1. Check Policy Visibility
-- EXPECT: 1 row returned
SELECT * FROM public.pack_lifecycle_policies WHERE pack_id = '{{PACK_ID}}';

-- 2. Check Audit Log Visibility
-- EXPECT: At least 1 row returned (from seeding or other actions)
SELECT * FROM public.lifecycle_audit_events WHERE pack_id = '{{PACK_ID}}' ORDER BY created_at DESC;

-- 3. Check Update Rights
-- EXPECT: Success
UPDATE public.pack_lifecycle_policies 
SET retention_rag_metrics_days = 60 
WHERE pack_id = '{{PACK_ID}}';

-- 4. Check Deletion of Seeded Chunks
-- EXPECT: Row counts should match seeded values (5 for Source A, 5 for Source B)
SELECT count(*) FROM public.knowledge_chunks WHERE pack_id = '{{PACK_ID}}';
