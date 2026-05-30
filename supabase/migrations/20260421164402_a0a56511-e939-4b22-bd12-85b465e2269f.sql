-- Add INSERT/UPDATE policies for google_oauth_tokens scoped to the owning user
CREATE POLICY "Users can insert their own google oauth tokens"
ON public.google_oauth_tokens
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own google oauth tokens"
ON public.google_oauth_tokens
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Restrict organizations SELECT to org members only
DROP POLICY IF EXISTS "Authenticated users can view organizations" ON public.organizations;
DROP POLICY IF EXISTS "Anyone authenticated can view organizations" ON public.organizations;
DROP POLICY IF EXISTS "All authenticated can view organizations" ON public.organizations;
DROP POLICY IF EXISTS "Authenticated can view organizations" ON public.organizations;
DROP POLICY IF EXISTS "Organizations are viewable by authenticated users" ON public.organizations;

CREATE POLICY "Members can view their organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.org_members om
    WHERE om.org_id = organizations.id
      AND om.user_id = auth.uid()
  )
);