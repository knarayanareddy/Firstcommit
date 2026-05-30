-- 02_rls_assertions_learner.sql
-- Run this as a user with the 'learner' role for the test pack.

-- 1. Check Policy Visibility
-- EXPECT: 0 rows returned
SELECT * FROM public.pack_lifecycle_policies WHERE pack_id = '{{PACK_ID}}';

-- 2. Check Audit Log Visibility
-- EXPECT: 0 rows returned
SELECT * FROM public.lifecycle_audit_events WHERE pack_id = '{{PACK_ID}}';

-- 3. Check Direct Delete Prevention
-- EXPECT: Permission denied or 0 rows deleted (due to RLS)
DELETE FROM public.knowledge_chunks WHERE pack_id = '{{PACK_ID}}';

-- 4. Check Direct Insertion into Audit Log
-- EXPECT: Permission denied (Service Role only)
INSERT INTO public.lifecycle_audit_events (pack_id, action, target_type)
VALUES ('{{PACK_ID}}', 'illegal_action', 'manual');
