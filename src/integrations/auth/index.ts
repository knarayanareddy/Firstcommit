// Native Supabase OAuth wrapper (replaces the former Lovable cloud-auth integration).
// Vendor-independent: uses supabase-js directly, no third-party auth SDK.
import { supabase } from "../supabase/client";

type SignInOptions = { redirectTo?: string; scopes?: string; queryParams?: Record<string, string> };

export const authClient = {
  signInWithOAuth: async (
    provider: "google" | "github" | "apple" | "azure",
    opts?: SignInOptions,
  ) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: opts?.redirectTo ?? window.location.origin,
        scopes: opts?.scopes,
        queryParams: opts?.queryParams,
      },
    });
    return { data, error, redirected: !error };
  },
  signOut: () => supabase.auth.signOut(),
};

export default authClient;
