
-- Cohorts table
CREATE TABLE public.cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  start_date date,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pack members can read cohorts"
  ON public.cohorts FOR SELECT
  USING (is_pack_member(auth.uid(), pack_id));

CREATE POLICY "Admins can insert cohorts"
  ON public.cohorts FOR INSERT
  WITH CHECK (has_pack_access(auth.uid(), pack_id, 'admin'));

CREATE POLICY "Admins can update cohorts"
  ON public.cohorts FOR UPDATE
  USING (has_pack_access(auth.uid(), pack_id, 'admin'));

CREATE POLICY "Admins can delete cohorts"
  ON public.cohorts FOR DELETE
  USING (has_pack_access(auth.uid(), pack_id, 'admin'));

-- Cohort members table
CREATE TABLE public.cohort_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid REFERENCES public.cohorts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(cohort_id, user_id)
);

ALTER TABLE public.cohort_members ENABLE ROW LEVEL SECURITY;

-- Security definer to check cohort membership without recursion
CREATE OR REPLACE FUNCTION public.is_cohort_member(_user_id uuid, _cohort_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cohort_members
    WHERE user_id = _user_id AND cohort_id = _cohort_id
  )
$$;

-- Security definer to get pack_id from cohort
CREATE OR REPLACE FUNCTION public.get_cohort_pack_id(_cohort_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pack_id FROM public.cohorts WHERE id = _cohort_id LIMIT 1
$$;

CREATE POLICY "Cohort members and pack admins can read"
  ON public.cohort_members FOR SELECT
  USING (
    is_cohort_member(auth.uid(), cohort_id)
    OR has_pack_access(auth.uid(), get_cohort_pack_id(cohort_id), 'admin')
  );

CREATE POLICY "Admins can insert cohort members"
  ON public.cohort_members FOR INSERT
  WITH CHECK (has_pack_access(auth.uid(), get_cohort_pack_id(cohort_id), 'admin'));

CREATE POLICY "Admins can delete cohort members"
  ON public.cohort_members FOR DELETE
  USING (has_pack_access(auth.uid(), get_cohort_pack_id(cohort_id), 'admin'));

-- Discussion threads table
CREATE TABLE public.discussion_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE NOT NULL,
  module_key text,
  section_id text,
  author_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  thread_type text DEFAULT 'discussion',
  is_pinned boolean DEFAULT false,
  is_resolved boolean DEFAULT false,
  upvote_count integer DEFAULT 0,
  reply_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.discussion_threads ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_discussion_threads_pack_module ON public.discussion_threads(pack_id, module_key, created_at DESC);

-- Validation trigger for thread_type
CREATE OR REPLACE FUNCTION public.validate_thread_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.thread_type NOT IN ('discussion', 'question', 'tip', 'issue') THEN
    RAISE EXCEPTION 'Invalid thread_type: %', NEW.thread_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_thread_type
  BEFORE INSERT OR UPDATE ON public.discussion_threads
  FOR EACH ROW EXECUTE FUNCTION public.validate_thread_type();

CREATE POLICY "Pack members can read threads"
  ON public.discussion_threads FOR SELECT
  USING (is_pack_member(auth.uid(), pack_id));

CREATE POLICY "Pack members can insert threads"
  ON public.discussion_threads FOR INSERT
  WITH CHECK (auth.uid() = author_id AND is_pack_member(auth.uid(), pack_id));

CREATE POLICY "Authors can update own threads"
  ON public.discussion_threads FOR UPDATE
  USING (auth.uid() = author_id OR has_pack_access(auth.uid(), pack_id, 'author'));

CREATE POLICY "Authors can delete own threads"
  ON public.discussion_threads FOR DELETE
  USING (auth.uid() = author_id OR has_pack_access(auth.uid(), pack_id, 'admin'));

-- Discussion replies table
CREATE TABLE public.discussion_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES public.discussion_threads(id) ON DELETE CASCADE NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL,
  is_accepted_answer boolean DEFAULT false,
  upvote_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.discussion_replies ENABLE ROW LEVEL SECURITY;

-- Security definer to get pack_id from thread
CREATE OR REPLACE FUNCTION public.get_thread_pack_id(_thread_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pack_id FROM public.discussion_threads WHERE id = _thread_id LIMIT 1
$$;

CREATE POLICY "Pack members can read replies"
  ON public.discussion_replies FOR SELECT
  USING (is_pack_member(auth.uid(), get_thread_pack_id(thread_id)));

CREATE POLICY "Pack members can insert replies"
  ON public.discussion_replies FOR INSERT
  WITH CHECK (auth.uid() = author_id AND is_pack_member(auth.uid(), get_thread_pack_id(thread_id)));

CREATE POLICY "Authors can update own replies"
  ON public.discussion_replies FOR UPDATE
  USING (auth.uid() = author_id OR has_pack_access(auth.uid(), get_thread_pack_id(thread_id), 'author'));

CREATE POLICY "Authors can delete own replies"
  ON public.discussion_replies FOR DELETE
  USING (auth.uid() = author_id OR has_pack_access(auth.uid(), get_thread_pack_id(thread_id), 'admin'));

-- Discussion upvotes table
CREATE TABLE public.discussion_upvotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

ALTER TABLE public.discussion_upvotes ENABLE ROW LEVEL SECURITY;

-- Validation trigger for target_type
CREATE OR REPLACE FUNCTION public.validate_upvote_target_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.target_type NOT IN ('thread', 'reply') THEN
    RAISE EXCEPTION 'Invalid upvote target_type: %', NEW.target_type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_upvote_target_type
  BEFORE INSERT OR UPDATE ON public.discussion_upvotes
  FOR EACH ROW EXECUTE FUNCTION public.validate_upvote_target_type();

CREATE POLICY "Users manage own upvotes"
  ON public.discussion_upvotes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Peer visibility preferences table
CREATE TABLE public.peer_visibility_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE NOT NULL,
  show_my_progress boolean DEFAULT true,
  show_my_activity boolean DEFAULT true,
  allow_direct_messages boolean DEFAULT true,
  UNIQUE(user_id, pack_id)
);

ALTER TABLE public.peer_visibility_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own visibility prefs"
  ON public.peer_visibility_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime for discussions
ALTER PUBLICATION supabase_realtime ADD TABLE public.discussion_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.discussion_replies;
