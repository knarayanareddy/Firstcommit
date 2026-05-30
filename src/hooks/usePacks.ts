import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function usePacks() {
  const { user } = useAuth();

  const { data: packs = [], isLoading } = useQuery({
    queryKey: ["user_packs", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get all pack IDs the user is a member of
      const { data: memberships, error: memErr } = await supabase
        .from("pack_members")
        .select("pack_id")
        .eq("user_id", user.id);

      if (memErr) throw memErr;
      if (!memberships || memberships.length === 0) return [];

      const packIds = memberships.map((m) => m.pack_id);

      const { data, error } = await supabase
        .from("packs")
        .select("*")
        .in("id", packIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  return { packs, isLoading };
}
