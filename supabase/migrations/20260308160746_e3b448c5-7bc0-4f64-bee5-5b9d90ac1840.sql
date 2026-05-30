
CREATE TABLE public.generated_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE NOT NULL,
  paths_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pack members can read generated paths"
  ON public.generated_paths FOR SELECT TO authenticated
  USING (is_pack_member(auth.uid(), pack_id));

CREATE POLICY "Authors can insert generated paths"
  ON public.generated_paths FOR INSERT TO authenticated
  WITH CHECK (has_pack_access(auth.uid(), pack_id, 'author'::text));

CREATE POLICY "Authors can update generated paths"
  ON public.generated_paths FOR UPDATE TO authenticated
  USING (has_pack_access(auth.uid(), pack_id, 'author'::text));

CREATE POLICY "Admins can delete generated paths"
  ON public.generated_paths FOR DELETE TO authenticated
  USING (has_pack_access(auth.uid(), pack_id, 'admin'::text));

CREATE TABLE public.path_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE NOT NULL,
  path_type text NOT NULL,
  step_id text NOT NULL,
  is_checked boolean NOT NULL DEFAULT false,
  checked_at timestamptz,
  UNIQUE(user_id, pack_id, path_type, step_id)
);

CREATE OR REPLACE FUNCTION public.validate_path_progress_type()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.path_type NOT IN ('day1', 'week1') THEN
    RAISE EXCEPTION 'Invalid path_type: %', NEW.path_type;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_path_progress_type_trigger
  BEFORE INSERT OR UPDATE ON public.path_progress
  FOR EACH ROW EXECUTE FUNCTION public.validate_path_progress_type();

ALTER TABLE public.path_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own path progress"
  ON public.path_progress FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own path progress"
  ON public.path_progress FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own path progress"
  ON public.path_progress FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own path progress"
  ON public.path_progress FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
