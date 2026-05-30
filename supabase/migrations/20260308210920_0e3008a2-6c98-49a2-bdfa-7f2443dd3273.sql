
-- Drop the overly-permissive org creation policy and replace with a stricter one
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

-- Only allow creating orgs if user doesn't already own one (prevents spam)
CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_members.user_id = auth.uid()
      AND org_members.role = 'owner'
    )
  );
