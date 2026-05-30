
-- Task 3: Team Directory & Who Owns What

CREATE TABLE public.team_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  role_title text,
  slack_handle text,
  github_handle text,
  avatar_url text,
  bio text,
  areas_of_expertise text[] DEFAULT '{}',
  services_owned text[] DEFAULT '{}',
  is_auto_detected boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pack members can read team members" ON public.team_members FOR SELECT USING (is_pack_member(auth.uid(), pack_id));
CREATE POLICY "Authors can insert team members" ON public.team_members FOR INSERT WITH CHECK (has_pack_access(auth.uid(), pack_id, 'author'));
CREATE POLICY "Authors can update team members" ON public.team_members FOR UPDATE USING (has_pack_access(auth.uid(), pack_id, 'author'));
CREATE POLICY "Authors can delete team members" ON public.team_members FOR DELETE USING (has_pack_access(auth.uid(), pack_id, 'author'));

CREATE TABLE public.meeting_checklist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  suggested_topics text[] DEFAULT '{}',
  time_estimate_minutes integer DEFAULT 30,
  priority text NOT NULL DEFAULT 'medium',
  track_key text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pack members can read meeting checklist" ON public.meeting_checklist FOR SELECT USING (is_pack_member(auth.uid(), pack_id));
CREATE POLICY "Authors can insert meeting checklist" ON public.meeting_checklist FOR INSERT WITH CHECK (has_pack_access(auth.uid(), pack_id, 'author'));
CREATE POLICY "Authors can update meeting checklist" ON public.meeting_checklist FOR UPDATE USING (has_pack_access(auth.uid(), pack_id, 'author'));
CREATE POLICY "Authors can delete meeting checklist" ON public.meeting_checklist FOR DELETE USING (has_pack_access(auth.uid(), pack_id, 'author'));

-- Validation trigger for priority
CREATE OR REPLACE FUNCTION public.validate_meeting_priority()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.priority NOT IN ('low', 'medium', 'high') THEN
    RAISE EXCEPTION 'Invalid meeting priority: %', NEW.priority;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_meeting_priority
  BEFORE INSERT OR UPDATE ON public.meeting_checklist
  FOR EACH ROW EXECUTE FUNCTION public.validate_meeting_priority();

CREATE TABLE public.meeting_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  is_met boolean NOT NULL DEFAULT false,
  met_at timestamp with time zone,
  notes text,
  UNIQUE(user_id, pack_id, team_member_id)
);

ALTER TABLE public.meeting_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own meeting progress" ON public.meeting_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
