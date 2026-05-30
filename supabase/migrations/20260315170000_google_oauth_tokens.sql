-- Store Google OAuth tokens per user for Google Drive connector
CREATE TABLE IF NOT EXISTS public.google_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz NOT NULL,
  scope text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.google_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Users can read their own token row (to check connected state)
CREATE POLICY "Users can read own google oauth token"
  ON public.google_oauth_tokens FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own token (disconnect)
CREATE POLICY "Users can delete own google oauth token"
  ON public.google_oauth_tokens FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Service role handles inserts/updates from edge functions
