-- Migration: Fix Remediation pack_id and enforce NOT NULL
-- This migration ensures all remediation drafts are visible under pack-scoped RLS.

-- 1. Ensure pack_id column exists (Safety check, previously added in security migrations)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'module_remediations' AND column_name = 'pack_id') THEN
        ALTER TABLE public.module_remediations ADD COLUMN pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Deterministic Backfill
-- We use DISTINCT ON to pick exactly one pack_id per module_key (the most recently updated one)
-- to avoid non-determinism if a key exists in multiple packs.
UPDATE public.module_remediations mr
SET pack_id = subquery.pack_id
FROM (
    SELECT DISTINCT ON (module_key) module_key, pack_id
    FROM public.generated_modules
    ORDER BY module_key, updated_at DESC
) AS subquery
WHERE mr.module_key = subquery.module_key
  AND mr.pack_id IS NULL;

-- 3. Handle Orphans
-- Instead of failing the migration, we mark records that can't be linked.
-- This keeps them in the DB for audit/cleanup but prevents RLS failures on standard queries.
UPDATE public.module_remediations
SET status = 'orphaned'
WHERE pack_id IS NULL
  AND status != 'orphaned';

-- 4. Enforce Data Integrity (Conditional)
-- We only set NOT NULL if we successfully backfilled everything.
-- This prevents the migration from hard-failing in prod until orphans are manually cleaned/deleted.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.module_remediations WHERE pack_id IS NULL) THEN
        RAISE NOTICE 'module_remediations contains orphaned rows (pack_id is NULL). Skipping NOT NULL constraint.';
    ELSE
        ALTER TABLE public.module_remediations ALTER COLUMN pack_id SET NOT NULL;
    END IF;
END $$;

-- 5. Optimized Index
CREATE INDEX IF NOT EXISTS idx_module_remediations_pack_id ON public.module_remediations(pack_id);


