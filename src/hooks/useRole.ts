import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";

export type PackAccessLevel = "owner" | "admin" | "author" | "learner" | "read_only";
export type OrgRole = "owner" | "admin" | "member";

const ACCESS_HIERARCHY: PackAccessLevel[] = ["read_only", "learner", "author", "admin", "owner"];

export function useRole() {
  const { user } = useAuth();
  const { currentPack, currentPackId } = usePack();

  const { data: packMembership } = useQuery({
    queryKey: ["pack_membership", user?.id, currentPackId],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("pack_members")
        .select("*")
        .eq("user_id", user.id)
        .eq("pack_id", currentPackId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!currentPackId,
  });

  const { data: orgMembership } = useQuery({
    queryKey: ["org_membership", user?.id, currentPack?.org_id],
    queryFn: async () => {
      if (!user || !currentPack?.org_id) return null;
      const { data, error } = await supabase
        .from("org_members")
        .select("*")
        .eq("user_id", user.id)
        .eq("org_id", currentPack.org_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!currentPack?.org_id,
  });

  const packAccessLevel: PackAccessLevel = (packMembership?.access_level as PackAccessLevel) ?? "read_only";
  const orgRole: OrgRole = (orgMembership?.role as OrgRole) ?? "member";

  const hasPackPermission = (requiredLevel: PackAccessLevel): boolean => {
    const userIdx = ACCESS_HIERARCHY.indexOf(packAccessLevel);
    const requiredIdx = ACCESS_HIERARCHY.indexOf(requiredLevel);
    return userIdx >= requiredIdx;
  };

  const accessLevelLabel = (level: PackAccessLevel): string => {
    const labels: Record<PackAccessLevel, string> = {
      owner: "Owner",
      admin: "Admin",
      author: "Author",
      learner: "Learner",
      read_only: "Read Only",
    };
    return labels[level] ?? level;
  };

  return {
    packAccessLevel,
    orgRole,
    hasPackPermission,
    accessLevelLabel,
    packMembership,
    orgMembership,
  };
}
