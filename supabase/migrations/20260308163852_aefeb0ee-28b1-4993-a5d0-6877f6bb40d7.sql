
ALTER TABLE public.audience_preferences 
  ADD COLUMN IF NOT EXISTS learner_role text,
  ADD COLUMN IF NOT EXISTS experience_level text;

CREATE OR REPLACE FUNCTION public.validate_experience_level()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.experience_level IS NOT NULL AND NEW.experience_level NOT IN ('new', 'mid', 'senior') THEN
    RAISE EXCEPTION 'Invalid experience_level: %', NEW.experience_level;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_audience_prefs_experience_level
  BEFORE INSERT OR UPDATE ON public.audience_preferences
  FOR EACH ROW EXECUTE FUNCTION public.validate_experience_level();
