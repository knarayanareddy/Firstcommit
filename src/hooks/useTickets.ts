import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Ticket {
  id: string;
  title: string;
  url: string;
  provider: "jira" | "linear" | "github";
  label: string;
}

export function useTickets(packId?: string) {
  return useQuery({
    queryKey: ["tickets", packId],
    queryFn: async (): Promise<Ticket[]> => {
      // In a real implementation, this would fetch from Jira/Linear APIs 
      // via edge functions using stored OAuth tokens.
      // Mocking for Phase 4 demonstration.
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return [
        {
          id: "ENG-101",
          title: "Update README with local setup instructions",
          url: "https://linear.app/rocketboard/issue/ENG-101",
          provider: "linear",
          label: "good-first-issue",
        },
        {
          id: "RB-402",
          title: "Fix broken link in onboarding docs",
          url: "https://jira.com/rocketboard/browse/RB-402",
          provider: "jira",
          label: "good-first-issue",
        },
        {
          id: "GITHUB-12",
          title: "Add unit tests for telemetry hook",
          url: "https://github.com/rocketboard/repo/issues/12",
          provider: "github",
          label: "good-first-issue",
        }
      ];
    },
    enabled: !!packId,
  });
}

export async function assignTicket(ticketId: string) {
  // Mock assignment
  console.log(`Assigning ticket ${ticketId} to current user`);
  return { success: true };
}
