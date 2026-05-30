-- Migration: Roadmap & Structured Playlists (30-60-90 Day)
-- Status: Implementation of Phase 1

-- 1. Create Playlists table
CREATE TABLE IF NOT EXISTS public.playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  phase text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  owner_user_id uuid REFERENCES auth.users(id),
  owner_display_name text,
  default_start_offset_days integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT playlists_phase_check CHECK (phase IN ('day_1_30', 'day_31_60', 'day_61_90'))
);

-- 2. Create Playlist Items table
CREATE TABLE IF NOT EXISTS public.playlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  description text,
  required boolean NOT NULL DEFAULT true,
  item_type text NOT NULL,
  module_id uuid REFERENCES public.generated_modules(id) ON DELETE SET NULL,
  module_key text,
  section_id text,
  quiz_id uuid, -- Optional if separate from modules
  milestone_id uuid REFERENCES public.onboarding_milestones(id) ON DELETE SET NULL,
  url text,
  due_offset_days integer,
  unlock_offset_days integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT playlist_items_type_check CHECK (item_type IN ('module', 'section', 'quiz', 'milestone', 'task', 'link'))
);

-- 3. Create Item Dependencies table
CREATE TABLE IF NOT EXISTS public.playlist_item_dependencies (
  item_id uuid NOT NULL REFERENCES public.playlist_items(id) ON DELETE CASCADE,
  depends_on_item_id uuid NOT NULL REFERENCES public.playlist_items(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, depends_on_item_id),
  CONSTRAINT no_self_dependency CHECK (item_id <> depends_on_item_id)
);

-- 4. Create Playlist Assignments table
CREATE TABLE IF NOT EXISTS public.playlist_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  learner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES auth.users(id),
  owner_user_id uuid REFERENCES auth.users(id), -- Override playlist owner
  start_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignment_status_check CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  UNIQUE(playlist_id, learner_user_id)
);

-- 5. Create Item Progress table
CREATE TABLE IF NOT EXISTS public.playlist_item_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.playlist_assignments(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.playlist_items(id) ON DELETE CASCADE,
  learner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'available',
  started_at timestamptz,
  completed_at timestamptz,
  last_event_at timestamptz NOT NULL DEFAULT now(),
  note text,
  UNIQUE(assignment_id, item_id),
  CONSTRAINT progress_status_check CHECK (status IN ('blocked', 'available', 'in_progress', 'done', 'skipped'))
);

-- 6. Enable RLS
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_item_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_item_progress ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies

-- Playlists & Items: Read access for pack members
CREATE POLICY "Pack members can view playlists" ON public.playlists
  FOR SELECT USING (public.is_pack_member(auth.uid(), pack_id));

CREATE POLICY "Pack members can view playlist items" ON public.playlist_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.playlists p 
    WHERE p.id = playlist_id AND public.is_pack_member(auth.uid(), p.pack_id)
  ));

CREATE POLICY "Pack members can view dependencies" ON public.playlist_item_dependencies
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.playlist_items pi
    JOIN public.playlists p ON pi.playlist_id = p.id
    WHERE pi.id = item_id AND public.is_pack_member(auth.uid(), p.pack_id)
  ));

-- Authors: Full management for playlists & items
CREATE POLICY "Authors can manage playlists" ON public.playlists
  FOR ALL USING (public.has_pack_access(auth.uid(), pack_id, 'author'));

CREATE POLICY "Authors can manage playlist items" ON public.playlist_items
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.playlists p 
    WHERE p.id = playlist_id AND public.has_pack_access(auth.uid(), p.pack_id, 'author')
  ));

CREATE POLICY "Authors can manage dependencies" ON public.playlist_item_dependencies
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.playlist_items pi
    JOIN public.playlists p ON pi.playlist_id = p.id
    WHERE pi.id = item_id AND public.has_pack_access(auth.uid(), p.pack_id, 'author')
  ));

-- Assignments: Learners view own; Authors manage all
CREATE POLICY "Learners can view own assignments" ON public.playlist_assignments
  FOR SELECT USING (auth.uid() = learner_user_id);

CREATE POLICY "Authors can manage assignments" ON public.playlist_assignments
  FOR ALL USING (public.has_pack_access(auth.uid(), pack_id, 'author'));

-- Progress: Learners view/update own; Authors view all
CREATE POLICY "Learners can manage own progress" ON public.playlist_item_progress
  FOR ALL USING (auth.uid() = learner_user_id)
  WITH CHECK (auth.uid() = learner_user_id);

CREATE POLICY "Authors can view all progress" ON public.playlist_item_progress
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.playlist_assignments pa
    WHERE pa.id = assignment_id AND public.has_pack_access(auth.uid(), pa.pack_id, 'author')
  ));

-- 8. Updated At Triggers
CREATE TRIGGER trg_playlists_updated_at BEFORE UPDATE ON public.playlists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_playlist_items_updated_at BEFORE UPDATE ON public.playlist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_playlist_assignments_updated_at BEFORE UPDATE ON public.playlist_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Computed View for Item State
CREATE OR REPLACE VIEW public.view_playlist_item_state AS
SELECT 
  pa.id as assignment_id,
  pa.learner_user_id,
  pi.id as item_id,
  pi.playlist_id,
  pi.title,
  pi.item_type,
  pi.module_id,
  pi.section_id,
  pa.start_date + pi.due_offset_days as computed_due_date,
  pa.start_date + pi.unlock_offset_days as computed_unlock_date,
  pip.status as current_status,
  EXISTS (
    SELECT 1 FROM public.playlist_item_dependencies pid
    JOIN public.playlist_item_progress prev_pip ON pid.depends_on_item_id = prev_pip.item_id
    WHERE pid.item_id = pi.id 
    AND prev_pip.assignment_id = pa.id
    AND prev_pip.status <> 'done'
  ) as is_blocked_by_dependency
FROM public.playlist_assignments pa
JOIN public.playlist_items pi ON pa.playlist_id = pi.playlist_id
LEFT JOIN public.playlist_item_progress pip ON pip.assignment_id = pa.id AND pip.item_id = pi.id;
