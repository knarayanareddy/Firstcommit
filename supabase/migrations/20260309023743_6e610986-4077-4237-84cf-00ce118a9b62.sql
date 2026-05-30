
-- Drop the restrictive INSERT policies on packs
DROP POLICY IF EXISTS "Org admins can insert packs" ON public.packs;
DROP POLICY IF EXISTS "Org members can create packs" ON public.packs;

-- Recreate as a single PERMISSIVE policy
CREATE POLICY "Org members can create packs" ON public.packs
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_members.org_id = packs.org_id
      AND org_members.user_id = auth.uid()
  )
);
