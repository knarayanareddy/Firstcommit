-- Add advanced learning preferences to audience_preferences
ALTER TABLE public.audience_preferences 
  ADD COLUMN IF NOT EXISTS learning_style text NOT NULL DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS framework_familiarity text,
  ADD COLUMN IF NOT EXISTS tone_preference text NOT NULL DEFAULT 'standard';

-- Update the view/policies if needed (RLS allows all column updates natively)
