import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useUserOrgs() {
  const { user } = useAuth();

  const { data: orgMemberships = [], isLoading } = useQuery({
    queryKey: ["user_org_memberships", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("org_members")
        .select("org_id, role")
        .eq("user_id", user.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  return {
    orgMemberships,
    hasOrgs: orgMemberships.length > 0,
    isLoading,
  };
}
