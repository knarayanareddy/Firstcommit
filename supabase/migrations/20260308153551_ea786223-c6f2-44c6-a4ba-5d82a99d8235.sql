
-- 1. Organizations table
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 2. Packs table
CREATE TABLE public.packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  language_mode text NOT NULL DEFAULT 'english',
  pack_version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.packs ENABLE ROW LEVEL SECURITY;

-- Use a validation trigger instead of CHECK for language_mode
CREATE OR REPLACE FUNCTION public.validate_pack_language_mode()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.language_mode NOT IN ('english', 'multilingual') THEN
    RAISE EXCEPTION 'Invalid language_mode: %', NEW.language_mode;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_pack_language_mode
  BEFORE INSERT OR UPDATE ON public.packs
  FOR EACH ROW EXECUTE FUNCTION public.validate_pack_language_mode();

-- 3. Pack tracks table
CREATE TABLE public.pack_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  track_key text NOT NULL,
  title text NOT NULL,
  description text,
  UNIQUE(pack_id, track_key)
);
ALTER TABLE public.pack_tracks ENABLE ROW LEVEL SECURITY;

-- 4. Pack sources table
CREATE TABLE public.pack_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_uri text NOT NULL,
  label text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pack_sources ENABLE ROW LEVEL SECURITY;

-- Validation trigger for source_type
CREATE OR REPLACE FUNCTION public.validate_pack_source_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.source_type NOT IN ('github_repo', 'document', 'url') THEN
    RAISE EXCEPTION 'Invalid source_type: %', NEW.source_type;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_pack_source_type
  BEFORE INSERT OR UPDATE ON public.pack_sources
  FOR EACH ROW EXECUTE FUNCTION public.validate_pack_source_type();

-- 5. Pack members table (for RLS access control)
CREATE TABLE public.pack_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'learner',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(pack_id, user_id)
);
ALTER TABLE public.pack_members ENABLE ROW LEVEL SECURITY;

-- 6. Add pack_id to existing user-data tables (nullable for backward compat, will be set for new data)
ALTER TABLE public.user_progress ADD COLUMN pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE;
ALTER TABLE public.quiz_scores ADD COLUMN pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE;
ALTER TABLE public.learner_notes ADD COLUMN pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE;
ALTER TABLE public.chat_messages ADD COLUMN pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE;
ALTER TABLE public.learner_state ADD COLUMN pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE;
ALTER TABLE public.audience_preferences ADD COLUMN pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE;

-- 7. Indexes
CREATE INDEX idx_user_progress_pack ON public.user_progress(pack_id, user_id);
CREATE INDEX idx_quiz_scores_pack ON public.quiz_scores(pack_id, user_id);
CREATE INDEX idx_learner_notes_pack ON public.learner_notes(pack_id, user_id);
CREATE INDEX idx_chat_messages_pack ON public.chat_messages(pack_id, user_id);
CREATE INDEX idx_learner_state_pack ON public.learner_state(pack_id, user_id);
CREATE INDEX idx_audience_preferences_pack ON public.audience_preferences(pack_id, user_id);
CREATE INDEX idx_pack_members_user ON public.pack_members(user_id);

-- 8. Security definer function to check pack membership
CREATE OR REPLACE FUNCTION public.is_pack_member(_user_id uuid, _pack_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pack_members
    WHERE user_id = _user_id AND pack_id = _pack_id
  )
$$;

-- 9. RLS policies for new tables

-- Organizations: readable by any authenticated user for now
CREATE POLICY "Authenticated users can view organizations"
  ON public.organizations FOR SELECT TO authenticated USING (true);

-- Packs: readable by members
CREATE POLICY "Members can view packs"
  ON public.packs FOR SELECT TO authenticated
  USING (public.is_pack_member(auth.uid(), id));

-- Pack tracks: readable by pack members
CREATE POLICY "Members can view pack tracks"
  ON public.pack_tracks FOR SELECT TO authenticated
  USING (public.is_pack_member(auth.uid(), pack_id));

-- Pack sources: readable by pack members
CREATE POLICY "Members can view pack sources"
  ON public.pack_sources FOR SELECT TO authenticated
  USING (public.is_pack_member(auth.uid(), pack_id));

-- Pack members: users can see their own memberships
CREATE POLICY "Users can view their own memberships"
  ON public.pack_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 10. Seed a default org and pack
INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Org', 'default');

INSERT INTO public.packs (id, org_id, title, description)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'RocketBoard Onboarding', 'The default onboarding pack with all starter modules.');

-- 11. Seed default tracks for the default pack
INSERT INTO public.pack_tracks (pack_id, track_key, title) VALUES
  ('00000000-0000-0000-0000-000000000002', 'frontend', 'Frontend'),
  ('00000000-0000-0000-0000-000000000002', 'backend', 'Backend'),
  ('00000000-0000-0000-0000-000000000002', 'infra', 'Infrastructure'),
  ('00000000-0000-0000-0000-000000000002', 'cross-repo', 'Cross-Repo');
