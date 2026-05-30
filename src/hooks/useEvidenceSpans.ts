import { useMutation } from "@tanstack/react-query";
import { usePack } from "@/hooks/usePack";
import { fetchEvidenceSpans as fetchSpans } from "@/lib/fetch-spans";
import { PackId } from "@/types/brands";
import { EvidenceSpanV2 as EvidenceSpan } from "@/types/evidence";

export type { EvidenceSpan };

export function useEvidenceSpans() {
  const { currentPackId } = usePack();

  const retrieveSpans = useMutation({
    mutationFn: async ({ query, maxSpans = 10, moduleKey, trackKey }: {
      query: string;
      maxSpans?: number;
      moduleKey?: string;
      trackKey?: string;
    }): Promise<EvidenceSpan[]> => {
      if (!currentPackId) throw new Error("No pack selected");
      return fetchSpans(currentPackId as PackId, query, maxSpans, { module_key: moduleKey, track_key: trackKey });
    },
  });

  return { retrieveSpans };
}
