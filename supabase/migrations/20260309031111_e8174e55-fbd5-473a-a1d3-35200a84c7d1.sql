
-- Task 5: 30-60-90 Day Onboarding Plan

CREATE TABLE public.onboarding_milestones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  phase text NOT NULL DEFAULT 'week_1',
  target_type text NOT NULL DEFAULT 'custom',
  target_value jsonb DEFAULT '{}',
  is_required boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_milestones ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.validate_milestone_phase()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.phase NOT IN ('day_1', 'week_1', 'week_2', 'month_1', 'month_2', 'month_3') THEN
    RAISE EXCEPTION 'Invalid milestone phase: %', NEW.phase;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_milestone_phase
  BEFORE INSERT OR UPDATE ON public.onboarding_milestones
  FOR EACH ROW EXECUTE FUNCTION public.validate_milestone_phase();

CREATE OR REPLACE FUNCTION public.validate_milestone_target_type()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.target_type NOT IN ('module_completion', 'quiz_score', 'path_completion', 'meeting', 'custom') THEN
    RAISE EXCEPTION 'Invalid milestone target_type: %', NEW.target_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_milestone_target_type
  BEFORE INSERT OR UPDATE ON public.onboarding_milestones
  FOR EACH ROW EXECUTE FUNCTION public.validate_milestone_target_type();

CREATE POLICY "Pack members can read milestones" ON public.onboarding_milestones FOR SELECT USING (is_pack_member(auth.uid(), pack_id));
CREATE POLICY "Admins can insert milestones" ON public.onboarding_milestones FOR INSERT WITH CHECK (has_pack_access(auth.uid(), pack_id, 'admin'));
CREATE POLICY "Admins can update milestones" ON public.onboarding_milestones FOR UPDATE USING (has_pack_access(auth.uid(), pack_id, 'admin'));
CREATE POLICY "Admins can delete milestones" ON public.onboarding_milestones FOR DELETE USING (has_pack_access(auth.uid(), pack_id, 'admin'));

CREATE TABLE public.learner_milestone_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  milestone_id uuid NOT NULL REFERENCES public.onboarding_milestones(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamp with time zone,
  UNIQUE(user_id, pack_id, milestone_id)
);

ALTER TABLE public.learner_milestone_progress ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.validate_milestone_status()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'in_progress', 'completed', 'overdue') THEN
    RAISE EXCEPTION 'Invalid milestone status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_milestone_status
  BEFORE INSERT OR UPDATE ON public.learner_milestone_progress
  FOR EACH ROW EXECUTE FUNCTION public.validate_milestone_status();

CREATE POLICY "Users manage own milestone progress" ON public.learner_milestone_progress FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can read all milestone progress" ON public.learner_milestone_progress FOR SELECT USING (has_pack_access(auth.uid(), pack_id, 'admin'));

CREATE TABLE public.onboarding_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_completion_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, pack_id)
);

ALTER TABLE public.onboarding_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own schedule" ON public.onboarding_schedule FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own schedule" ON public.onboarding_schedule FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own schedule" ON public.onboarding_schedule FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all schedules" ON public.onboarding_schedule FOR SELECT USING (has_pack_access(auth.uid(), pack_id, 'admin'));
CREATE POLICY "Admins can manage schedules" ON public.onboarding_schedule FOR ALL USING (has_pack_access(auth.uid(), pack_id, 'admin')) WITH CHECK (has_pack_access(auth.uid(), pack_id, 'admin'));
