
-- 1. Create org_members table
CREATE TABLE public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- Validation trigger for org role
CREATE OR REPLACE FUNCTION public.validate_org_member_role()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.role NOT IN ('owner', 'admin', 'member') THEN
    RAISE EXCEPTION 'Invalid org member role: %', NEW.role;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_org_member_role
  BEFORE INSERT OR UPDATE ON public.org_members
  FOR EACH ROW EXECUTE FUNCTION public.validate_org_member_role();

-- RLS for org_members
CREATE POLICY "Users can view their own org memberships"
  ON public.org_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Org admins can manage members"
  ON public.org_members FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_members.org_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin')
    )
  );

-- 2. Update pack_members: rename 'role' to 'access_level' with new values
ALTER TABLE public.pack_members RENAME COLUMN role TO access_level;

-- Update existing default values
ALTER TABLE public.pack_members ALTER COLUMN access_level SET DEFAULT 'learner';

-- Update existing rows from 'learner' (already correct) but just ensure consistency
UPDATE public.pack_members SET access_level = 'learner' WHERE access_level NOT IN ('owner', 'admin', 'author', 'learner', 'read_only');

-- Validation trigger for pack access_level
CREATE OR REPLACE FUNCTION public.validate_pack_access_level()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.access_level NOT IN ('owner', 'admin', 'author', 'learner', 'read_only') THEN
    RAISE EXCEPTION 'Invalid pack access_level: %', NEW.access_level;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_pack_access_level
  BEFORE INSERT OR UPDATE ON public.pack_members
  FOR EACH ROW EXECUTE FUNCTION public.validate_pack_access_level();

-- 3. Security definer functions for RBAC checks
CREATE OR REPLACE FUNCTION public.get_pack_access_level(_user_id uuid, _pack_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT access_level FROM public.pack_members
  WHERE user_id = _user_id AND pack_id = _pack_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.has_pack_access(_user_id uuid, _pack_id uuid, _min_level text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pack_members
    WHERE user_id = _user_id AND pack_id = _pack_id
    AND CASE _min_level
      WHEN 'read_only' THEN access_level IN ('read_only', 'learner', 'author', 'admin', 'owner')
      WHEN 'learner' THEN access_level IN ('learner', 'author', 'admin', 'owner')
      WHEN 'author' THEN access_level IN ('author', 'admin', 'owner')
      WHEN 'admin' THEN access_level IN ('admin', 'owner')
      WHEN 'owner' THEN access_level = 'owner'
      ELSE false
    END
  )
$$;

CREATE OR REPLACE FUNCTION public.get_org_role(_user_id uuid, _org_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT role FROM public.org_members
  WHERE user_id = _user_id AND org_id = _org_id
  LIMIT 1
$$;

-- 4. Update RLS policies on existing tables

-- Pack members: allow admins/owners to manage
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.pack_members;
CREATE POLICY "Users can view pack memberships they belong to"
  ON public.pack_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_pack_access(auth.uid(), pack_id, 'admin')
  );

CREATE POLICY "Pack admins can insert members"
  ON public.pack_members FOR INSERT TO authenticated
  WITH CHECK (public.has_pack_access(auth.uid(), pack_id, 'admin'));

CREATE POLICY "Pack admins can update members"
  ON public.pack_members FOR UPDATE TO authenticated
  USING (public.has_pack_access(auth.uid(), pack_id, 'admin'));

CREATE POLICY "Pack admins can delete members"
  ON public.pack_members FOR DELETE TO authenticated
  USING (public.has_pack_access(auth.uid(), pack_id, 'admin'));

-- Packs: writable by owner/admin
CREATE POLICY "Pack admins can update packs"
  ON public.packs FOR UPDATE TO authenticated
  USING (public.has_pack_access(auth.uid(), id, 'admin'));

CREATE POLICY "Org admins can insert packs"
  ON public.packs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = packs.org_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Pack tracks/sources: writable by author+
CREATE POLICY "Authors can insert pack tracks"
  ON public.pack_tracks FOR INSERT TO authenticated
  WITH CHECK (public.has_pack_access(auth.uid(), pack_id, 'author'));

CREATE POLICY "Authors can update pack tracks"
  ON public.pack_tracks FOR UPDATE TO authenticated
  USING (public.has_pack_access(auth.uid(), pack_id, 'author'));

CREATE POLICY "Authors can delete pack tracks"
  ON public.pack_tracks FOR DELETE TO authenticated
  USING (public.has_pack_access(auth.uid(), pack_id, 'author'));

CREATE POLICY "Authors can insert pack sources"
  ON public.pack_sources FOR INSERT TO authenticated
  WITH CHECK (public.has_pack_access(auth.uid(), pack_id, 'author'));

CREATE POLICY "Authors can update pack sources"
  ON public.pack_sources FOR UPDATE TO authenticated
  USING (public.has_pack_access(auth.uid(), pack_id, 'author'));

CREATE POLICY "Authors can delete pack sources"
  ON public.pack_sources FOR DELETE TO authenticated
  USING (public.has_pack_access(auth.uid(), pack_id, 'author'));

-- Index for org_members
CREATE INDEX idx_org_members_user ON public.org_members(user_id);
CREATE INDEX idx_org_members_org ON public.org_members(org_id);
