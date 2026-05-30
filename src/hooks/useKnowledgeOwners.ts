import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KnowledgeOwner {
  email: string;
  score: number;
  slackHandle?: string | null;
  teamsHandle?: string | null;
}

export function useKnowledgeOwners(packId: string | null) {
  return useQuery({
    queryKey: ["knowledge_owners", packId],
    queryFn: async () => {
      if (!packId) return [];

      // 1. Fetch owners linked to this pack's sources
      const { data: ownersData, error: ownersError } = await supabase
        .from('knowledge_owners')
        .select(`
          user_email,
          ownership_score,
          pack_sources!inner(pack_id)
        `)
        .eq('pack_sources.pack_id', packId)
        .order('ownership_score', { ascending: false });

      if (ownersError) throw ownersError;

      if (!ownersData || ownersData.length === 0) return [];

      const uniqueEmails = Array.from(new Set(ownersData.map(o => o.user_email)));

      // 2. Fetch profiles for these emails to get Slack/Teams handles
      const { data: profilesData, error: profilesError } = await supabase
        .from('author_profiles')
        .select('email, slack_handle, teams_handle')
        .in('email', uniqueEmails);

      if (profilesError) throw profilesError;

      const profileMap = new Map();
      profilesData?.forEach(p => profileMap.set(p.email, p));

      // 3. Aggregate scores per email
      const aggregated = new Map<string, number>();
      ownersData.forEach(o => {
        const current = aggregated.get(o.user_email) || 0;
        aggregated.set(o.user_email, current + Number(o.ownership_score));
      });

      const results: KnowledgeOwner[] = Array.from(aggregated.entries()).map(([email, score]) => {
        const profile = profileMap.get(email);
        return {
          email,
          score,
          slackHandle: profile?.slack_handle,
          teamsHandle: profile?.teams_handle,
        };
      });

      // Sort by final score descending and take top 5
      return results.sort((a, b) => b.score - a.score).slice(0, 5);
    },
    enabled: !!packId,
  });
}
