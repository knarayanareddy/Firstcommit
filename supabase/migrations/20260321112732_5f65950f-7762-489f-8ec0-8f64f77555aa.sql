
-- Fix security definer view by explicitly setting security_invoker
ALTER VIEW public.user_ai_settings_masked SET (security_invoker = on);
