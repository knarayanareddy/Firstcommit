ALTER TABLE public.audience_preferences 
  ADD COLUMN IF NOT EXISTS output_language text NOT NULL DEFAULT 'en';