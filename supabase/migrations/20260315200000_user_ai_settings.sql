-- ─────────────────────────────────────────────────────────────────────────────
-- BYOK: user_ai_settings
-- Stores per-user BYOK provider configuration + encrypted API keys.
-- Keys are encrypted using pgcrypto AES-256 (pgp_sym_encrypt).
-- The passphrase is stored as a Supabase secret (BYOK_ENCRYPTION_PASSPHRASE).
-- Keys are NEVER returned to the browser — only masked previews.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable pgcrypto for symmetric encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── TABLE ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_ai_settings (
  user_id     uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- byok_config stores provider config; api keys stored as pgp_sym_encrypt blobs
  byok_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_user_ai_settings_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_ai_settings_updated_at ON public.user_ai_settings;
CREATE TRIGGER trg_user_ai_settings_updated_at
  BEFORE UPDATE ON public.user_ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_user_ai_settings_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_ai_settings ENABLE ROW LEVEL SECURITY;

-- Users can read their own row
CREATE POLICY "users_select_own_ai_settings"
  ON public.user_ai_settings FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own row
CREATE POLICY "users_insert_own_ai_settings"
  ON public.user_ai_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own row
CREATE POLICY "users_update_own_ai_settings"
  ON public.user_ai_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own row
CREATE POLICY "users_delete_own_ai_settings"
  ON public.user_ai_settings FOR DELETE
  USING (auth.uid() = user_id);

-- ─── RPC: save_provider_key ───────────────────────────────────────────────────
-- Called from the edge function (service role) after the frontend validates a key.
-- Encrypts the raw key with pgp_sym_encrypt before storing.
CREATE OR REPLACE FUNCTION public.save_byok_key(
  _provider   text,
  _api_key    text,
  _model      text,
  _status     text DEFAULT 'valid'
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  _passphrase text;
  _encrypted  text;
  _patch      jsonb;
BEGIN
  -- pgcrypto passphrase stored in Supabase secrets as BYOK_ENCRYPTION_PASSPHRASE
  -- Falls back to a static salt if not configured (dev/CI only)
  -- SECURITY (P0): fail closed. No insecure fallback passphrase.
  _passphrase := current_setting('app.byok_encryption_passphrase', true);
  IF _passphrase IS NULL OR length(_passphrase) < 16 THEN
    RAISE EXCEPTION 'BYOK encryption passphrase not configured (app.byok_encryption_passphrase); refusing insecure operation'
      USING ERRCODE = '28000';
  END IF;

  _encrypted := encode(pgp_sym_encrypt(_api_key, _passphrase), 'base64');

  _patch := jsonb_build_object(
    _provider, jsonb_build_object(
      'api_key_encrypted', _encrypted,
      'preferred_model',   _model,
      'validated_at',      now(),
      'status',            _status
    )
  );

  INSERT INTO public.user_ai_settings (user_id, byok_config)
  VALUES (auth.uid(), jsonb_build_object('providers', _patch))
  ON CONFLICT (user_id) DO UPDATE
    SET byok_config = user_ai_settings.byok_config ||
                      jsonb_build_object('providers',
                        coalesce(user_ai_settings.byok_config->'providers', '{}'::jsonb) ||
                        _patch
                      );
END;
$$;

-- ─── RPC: set_active_byok_provider ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_active_byok_provider(
  _provider text,
  _model    text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_ai_settings (user_id, byok_config)
  VALUES (auth.uid(), jsonb_build_object('active_provider', _provider, 'active_model', _model, 'fallback_behavior', 'use_default', 'providers', '{}'::jsonb))
  ON CONFLICT (user_id) DO UPDATE
    SET byok_config = user_ai_settings.byok_config ||
                      jsonb_build_object('active_provider', _provider, 'active_model', _model);
END;
$$;

-- ─── RPC: clear_byok_provider ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.clear_byok_provider(_provider text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  UPDATE public.user_ai_settings
  SET byok_config = byok_config
    #- ARRAY['providers', _provider]
  WHERE user_id = auth.uid();
END;
$$;

-- ─── RPC: get_decrypted_byok_key ─────────────────────────────────────────────
-- Used ONLY by the edge function (service role). Never called from the browser.
-- Returns plaintext key for the given user + provider.
CREATE OR REPLACE FUNCTION public.get_decrypted_byok_key(
  _user_id  uuid,
  _provider text
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  _passphrase text;
  _encrypted  text;
BEGIN
  -- SECURITY (P0): fail closed. No insecure fallback passphrase.
  _passphrase := current_setting('app.byok_encryption_passphrase', true);
  IF _passphrase IS NULL OR length(_passphrase) < 16 THEN
    RAISE EXCEPTION 'BYOK encryption passphrase not configured (app.byok_encryption_passphrase); refusing insecure operation'
      USING ERRCODE = '28000';
  END IF;

  SELECT byok_config->'providers'->_provider->>'api_key_encrypted'
  INTO _encrypted
  FROM public.user_ai_settings
  WHERE user_id = _user_id;

  IF _encrypted IS NULL THEN RETURN NULL; END IF;

  RETURN convert_from(
    pgp_sym_decrypt(decode(_encrypted, 'base64'), _passphrase),
    'utf8'
  );
END;
$$;

-- Revoke public access — edge function uses service role
REVOKE ALL ON FUNCTION public.get_decrypted_byok_key FROM PUBLIC;

-- ─── MASKED VIEW ─────────────────────────────────────────────────────────────
-- Returns the config with api_key_encrypted replaced by a masked preview.
-- This is what the browser receives.
CREATE OR REPLACE VIEW public.user_ai_settings_masked AS
SELECT
  user_id,
  updated_at,
  byok_config - 'providers' ||
  jsonb_build_object(
    'active_provider',   byok_config->>'active_provider',
    'active_model',      byok_config->>'active_model',
    'fallback_behavior', byok_config->>'fallback_behavior',
    'providers', (
      SELECT jsonb_object_agg(
        provider_key,
        provider_val - 'api_key_encrypted' ||
        jsonb_build_object(
          'key_masked', CASE
            WHEN (provider_val->>'api_key_encrypted') IS NOT NULL
            THEN '****'
            ELSE NULL
          END,
          'preferred_model', provider_val->>'preferred_model',
          'validated_at',    provider_val->>'validated_at',
          'status',          provider_val->>'status'
        )
      )
      FROM jsonb_each(coalesce(byok_config->'providers', '{}'::jsonb)) AS p(provider_key, provider_val)
    )
  ) AS byok_config
FROM public.user_ai_settings;

-- RLS applies through the underlying table
GRANT SELECT ON public.user_ai_settings_masked TO authenticated;


-- ─── P0 SECURITY: passphrase rotation ────────────────────────────────────────
-- Re-encrypts all stored BYOK keys from _old_passphrase to _new_passphrase.
-- Run by an operator (service role) during key rotation. Returns count re-encrypted.
CREATE OR REPLACE FUNCTION public.rotate_byok_passphrase(_old_passphrase text, _new_passphrase text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  _row record; _prov text; _val jsonb; _enc text; _plain text; _count int := 0; _cfg jsonb;
BEGIN
  IF _new_passphrase IS NULL OR length(_new_passphrase) < 16 THEN
    RAISE EXCEPTION 'New passphrase too short (min 16 chars)';
  END IF;
  FOR _row IN SELECT user_id, byok_config FROM public.user_ai_settings LOOP
    _cfg := _row.byok_config;
    FOR _prov, _val IN
      SELECT key, value FROM jsonb_each(coalesce(_row.byok_config->'providers', '{}'::jsonb))
    LOOP
      _enc := _val->>'api_key_encrypted';
      IF _enc IS NOT NULL THEN
        _plain := convert_from(pgp_sym_decrypt(decode(_enc, 'base64'), _old_passphrase), 'utf8');
        _cfg := jsonb_set(_cfg, ARRAY['providers', _prov, 'api_key_encrypted'],
                 to_jsonb(encode(pgp_sym_encrypt(_plain, _new_passphrase), 'base64')));
        _count := _count + 1;
      END IF;
    END LOOP;
    UPDATE public.user_ai_settings SET byok_config = _cfg WHERE user_id = _row.user_id;
  END LOOP;
  RETURN _count;
END;
$$;
REVOKE ALL ON FUNCTION public.rotate_byok_passphrase(text, text) FROM PUBLIC;
