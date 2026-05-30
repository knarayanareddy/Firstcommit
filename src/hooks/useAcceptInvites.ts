import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * On login/signup, check for pending invites matching the user's email
 * and auto-accept them via the server-side function.
 */
export function useAcceptInvites() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.email) return;
    
    supabase.rpc("accept_pending_invites", {
      _user_id: user.id,
      _email: user.email,
    }).then(({ error }) => {
      if (error) console.warn("Failed to auto-accept invites:", error.message);
    });
  }, [user?.id, user?.email]);
}
