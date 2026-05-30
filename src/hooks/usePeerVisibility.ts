import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { toast } from "sonner";

export interface PeerVisibilityPrefs {
  show_my_progress: boolean;
  show_my_activity: boolean;
  allow_direct_messages: boolean;
}

export function usePeerVisibility() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const qc = useQueryClient();
  const qk = ["peer_visibility", user?.id, currentPackId];

  const prefsQuery = useQuery({
    queryKey: qk,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("peer_visibility_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .eq("pack_id", currentPackId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { show_my_progress: true, show_my_activity: true, allow_direct_messages: true } as PeerVisibilityPrefs;
      return data as unknown as PeerVisibilityPrefs;
    },
    enabled: !!user && !!currentPackId,
  });

  const updatePrefs = useMutation({
    mutationFn: async (prefs: Partial<PeerVisibilityPrefs>) => {
      const { data: existing } = await supabase
        .from("peer_visibility_preferences")
        .select("id")
        .eq("user_id", user!.id)
        .eq("pack_id", currentPackId!)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("peer_visibility_preferences")
          .update(prefs as any)
          .eq("user_id", user!.id)
          .eq("pack_id", currentPackId!);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("peer_visibility_preferences")
          .insert({
            user_id: user!.id,
            pack_id: currentPackId!,
            ...prefs,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      toast.success("Privacy settings updated");
    },
  });

  return {
    prefs: prefsQuery.data ?? { show_my_progress: true, show_my_activity: true, allow_direct_messages: true },
    prefsLoading: prefsQuery.isLoading,
    updatePrefs,
  };
}
