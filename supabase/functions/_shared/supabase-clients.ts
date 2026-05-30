/**
 * _shared/supabase-clients.ts
 * Centralized Supabase client creation for Edge Functions.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

export function createAnonClient(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authHeader = req.headers.get("Authorization");

  return createClient(url, anonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });
}

export function createServiceClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  return createClient(url, serviceKey);
}
