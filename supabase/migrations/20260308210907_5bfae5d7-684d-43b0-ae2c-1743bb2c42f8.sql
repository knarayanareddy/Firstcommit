
-- Create pending_invites table for email-based invitations
CREATE TABLE public.pending_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  email text NOT NULL,
  access_level text NOT NULL DEFAULT 'learner',
  invited_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE(pack_id, email)
);

-- Enable RLS
ALTER TABLE public.pending_invites ENABLE ROW LEVEL SECURITY;

-- Validation trigger for access_level
CREATE OR REPLACE FUNCTION public.validate_pending_invite_access_level()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.access_level NOT IN ('owner', 'admin', 'author', 'learner', 'read_only') THEN
    RAISE EXCEPTION 'Invalid access_level: %', NEW.access_level;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_pending_invite_access_level
  BEFORE INSERT OR UPDATE ON public.pending_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_pending_invite_access_level();

-- RLS policies: pack admins can manage invites
CREATE POLICY "Pack admins can read invites"
  ON public.pending_invites FOR SELECT
  TO authenticated
  USING (has_pack_access(auth.uid(), pack_id, 'admin'));

CREATE POLICY "Pack admins can insert invites"
  ON public.pending_invites FOR INSERT
  TO authenticated
  WITH CHECK (has_pack_access(auth.uid(), pack_id, 'admin'));

CREATE POLICY "Pack admins can update invites"
  ON public.pending_invites FOR UPDATE
  TO authenticated
  USING (has_pack_access(auth.uid(), pack_id, 'admin'));

CREATE POLICY "Pack admins can delete invites"
  ON public.pending_invites FOR DELETE
  TO authenticated
  USING (has_pack_access(auth.uid(), pack_id, 'admin'));

-- Also allow inserting orgs (currently blocked by RLS)
CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow org owners to update
CREATE POLICY "Org admins can update organizations"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_members.org_id = organizations.id
    AND org_members.user_id = auth.uid()
    AND org_members.role IN ('owner', 'admin')
  ));

-- Allow org members to insert org_members (for self-enrollment during onboarding)
CREATE POLICY "Authenticated users can insert own org membership"
  ON public.org_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Allow authenticated users to insert own pack membership (for auto-accept invites)
CREATE POLICY "Users can insert own pack membership"
  ON public.pack_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Allow authenticated users to create packs if they are org members
CREATE POLICY "Org members can create packs"
  ON public.packs FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_members.org_id = packs.org_id
    AND org_members.user_id = auth.uid()
  ));

-- Function to accept pending invites for a user by email
CREATE OR REPLACE FUNCTION public.accept_pending_invites(_user_id uuid, _email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invite RECORD;
  accepted_count integer := 0;
BEGIN
  FOR invite IN
    SELECT * FROM public.pending_invites
    WHERE email = _email AND accepted_at IS NULL
  LOOP
    -- Check if already a member
    IF NOT EXISTS (
      SELECT 1 FROM public.pack_members
      WHERE user_id = _user_id AND pack_id = invite.pack_id
    ) THEN
      INSERT INTO public.pack_members (user_id, pack_id, access_level)
      VALUES (_user_id, invite.pack_id, invite.access_level);
    END IF;
    
    UPDATE public.pending_invites
    SET accepted_at = now()
    WHERE id = invite.id;
    
    accepted_count := accepted_count + 1;
  END LOOP;
  
  RETURN accepted_count;
END;
$$;
