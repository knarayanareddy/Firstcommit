-- Harden module_remediations RLS and add pack_id for better isolation
-- 1. Add pack_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'module_remediations' AND column_name = 'pack_id') THEN
        ALTER TABLE public.module_remediations ADD COLUMN pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Backfill pack_id from generated_modules
UPDATE public.module_remediations mr
SET pack_id = gm.pack_id
FROM public.generated_modules gm
WHERE mr.module_key = gm.module_key
AND mr.pack_id IS NULL;

-- 3. Drop all existing policies to ensure a clean slate
DO $$ 
DECLARE 
    pol record;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'module_remediations' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.module_remediations', pol.policyname);
    END LOOP;
END $$;

-- 4. Create single strict policy for authors
-- This policy covers SELECT, INSERT, UPDATE, and DELETE (FOR ALL)
CREATE POLICY "Authors can manage remediations"
  ON public.module_remediations FOR ALL
  TO authenticated
  USING (public.has_pack_access(auth.uid(), pack_id, 'author'))
  WITH CHECK (public.has_pack_access(auth.uid(), pack_id, 'author'));

-- 5. Enable RLS (just in case)
ALTER TABLE public.module_remediations ENABLE ROW LEVEL SECURITY;

-- 6. Add index for performance
CREATE INDEX IF NOT EXISTS idx_module_remediations_pack_id ON public.module_remediations(pack_id);
