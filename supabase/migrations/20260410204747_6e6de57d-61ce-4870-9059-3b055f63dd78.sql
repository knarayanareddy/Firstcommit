-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can read remediations" ON public.module_remediations;
DROP POLICY IF EXISTS "Authenticated users can update remediations" ON public.module_remediations;
DROP POLICY IF EXISTS "Service role can insert remediations" ON public.module_remediations;

-- SELECT: Only pack authors can read remediations for their packs
CREATE POLICY "Pack authors can read remediations"
ON public.module_remediations
FOR SELECT TO authenticated
USING (
  public.has_pack_access(auth.uid(), pack_id, 'author')
);

-- UPDATE: Only pack authors can accept/reject remediations
CREATE POLICY "Pack authors can update remediations"
ON public.module_remediations
FOR UPDATE TO authenticated
USING (
  public.has_pack_access(auth.uid(), pack_id, 'author')
)
WITH CHECK (
  public.has_pack_access(auth.uid(), pack_id, 'author')
);

-- INSERT: Only service_role (backend functions) can create remediations
CREATE POLICY "Service role can insert remediations"
ON public.module_remediations
FOR INSERT TO service_role
WITH CHECK (true);