CREATE TABLE IF NOT EXISTS public.google_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.google_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own google tokens"
  ON public.google_oauth_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own google tokens"
  ON public.google_oauth_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);