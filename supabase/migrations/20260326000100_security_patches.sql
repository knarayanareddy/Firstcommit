-- Security Patch: Secure module_remediations table
-- Drops all overly permissive policies and enforces strict RLS based on pack membership.

-- 1. Disable and Re-enable RLS to ensure a clean state
ALTER TABLE public.module_remediations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_remediations ENABLE ROW LEVEL SECURITY;

-- 2. Drop all known permissive or legacy policies
DROP POLICY IF EXISTS "Authenticated users can read remediations" ON public.module_remediations;
DROP POLICY IF EXISTS "Service role can insert remediations" ON public.module_remediations;
DROP POLICY IF EXISTS "Authenticated users can update remediations" ON public.module_remediations;
DROP POLICY IF EXISTS "Enable full access for authors to remediations" ON public.module_remediations;
DROP POLICY IF EXISTS "Authors can manage remediations" ON public.module_remediations;

-- 3. Ensure pack_id is NOT NULL and indexed
-- Note: We use a subquery to try and fill pack_id for orphaned rows if possible, 
-- but in this system module_key is unique per pack so we can join generated_modules.
UPDATE public.module_remediations
SET pack_id = (
    SELECT gm.pack_id 
    FROM public.generated_modules gm 
    WHERE gm.module_key = module_remediations.module_key 
    LIMIT 1
)
WHERE pack_id IS NULL;

-- Remove any rows that still don't have a pack_id (or keep them but they will be inaccessible via RLS)
-- DELETE FROM public.module_remediations WHERE pack_id IS NULL;

-- Ensure pack_id is indexed
CREATE INDEX IF NOT EXISTS idx_module_remediations_pack_id ON public.module_remediations(pack_id);

-- Only set NOT NULL if all rows are backfilled.
-- Orphans are handled in the later 20260423 harden migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.module_remediations WHERE pack_id IS NULL) THEN
    RAISE NOTICE 'module_remediations contains NULL pack_id; skipping NOT NULL constraint in this patch';
  ELSE
    ALTER TABLE public.module_remediations ALTER COLUMN pack_id SET NOT NULL;
  END IF;
END $$;

-- 4. Create the restrictive policy
-- Only users with 'author' level access or higher to the pack can manage remediations.
CREATE POLICY "Authors can manage remediations"
  ON public.module_remediations FOR ALL
  TO authenticated
  USING (public.has_pack_access(auth.uid(), pack_id, 'author'))
  WITH CHECK (public.has_pack_access(auth.uid(), pack_id, 'author'));

-- 5. Revoke public access to ensure only authenticated users/service_role can interact
REVOKE ALL ON public.module_remediations FROM public;
GRANT ALL ON public.module_remediations TO authenticated;
GRANT ALL ON public.module_remediations TO service_role;
