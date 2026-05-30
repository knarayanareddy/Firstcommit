
-- Create a security definer function to check org admin status without recursion
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = _user_id AND org_id = _org_id
    AND role IN ('owner', 'admin')
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_org_admin FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_admin TO authenticated;

-- Drop the recursive policy
DROP POLICY "Org admins can manage members" ON public.org_members;

-- Recreate as separate non-recursive policies using the security definer function
CREATE POLICY "Org admins can update members"
ON public.org_members FOR UPDATE
USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can delete members"
ON public.org_members FOR DELETE
USING (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can insert members"
ON public.org_members FOR INSERT
WITH CHECK (is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can select members"
ON public.org_members FOR SELECT
USING (is_org_admin(auth.uid(), org_id));
