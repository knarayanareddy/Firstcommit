import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePack } from "@/hooks/usePack";

export interface PackTrack {
  id: string;
  pack_id: string;
  track_key: string;
  title: string;
  description: string | null;
}

export function usePackTracks() {
  const { currentPackId } = usePack();

  const tracksQuery = useQuery({
    queryKey: ["pack_tracks", currentPackId],
    queryFn: async () => {
      if (!currentPackId) return [];
      const { data, error } = await supabase
        .from("pack_tracks")
        .select("*")
        .eq("pack_id", currentPackId)
        .order("track_key");
      if (error) throw error;
      return (data || []) as PackTrack[];
    },
    enabled: !!currentPackId,
  });

  return {
    tracks: tracksQuery.data || [],
    tracksLoading: tracksQuery.isLoading,
  };
}
