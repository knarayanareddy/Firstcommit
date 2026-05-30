import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { XP_RULES, XPRuleKey } from "@/lib/xp-rules";
import { toast } from "sonner";

export function useXP() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const queryClient = useQueryClient();

  const { data: xpEntries = [] } = useQuery({
    queryKey: ["learner_xp", user?.id, currentPackId],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("learner_xp")
        .select("*")
        .eq("user_id", user.id)
        .eq("pack_id", currentPackId!)
        .order("earned_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!currentPackId,
  });

  const totalXP = xpEntries.reduce((a, e) => a + e.amount, 0);

  const awardXP = useMutation({
    mutationFn: async (ruleKey: XPRuleKey) => {
      if (!user || !currentPackId) return;
      const rule = XP_RULES[ruleKey];
      const { error } = await supabase.rpc("award_xp_server", {
        p_user_id: user.id,
        p_pack_id: currentPackId,
        p_amount: rule.amount,
        p_reason: rule.reason,
      });
      if (error) throw error;
      return rule;
    },
    onSuccess: (rule) => {
      queryClient.invalidateQueries({ queryKey: ["learner_xp", user?.id, currentPackId] });
      if (rule) {
        toast.success(`+${rule.amount} XP`, { description: rule.reason.replace(/_/g, " ") });
      }
    },
  });

  return { xpEntries, totalXP, awardXP };
}
