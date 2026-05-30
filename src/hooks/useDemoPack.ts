import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { DEMO_PACK_DATA } from "@/data/demo-pack";
import { toast } from "sonner";

export function useDemoPack() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const qc = useQueryClient();

  const loadDemo = useMutation({
    mutationFn: async () => {
      if (!currentPackId || !user) throw new Error("Missing pack or user");

      // 1. Insert Demo Source
      const { data: source, error: sErr } = await supabase
        .from("pack_sources")
        .insert({
          pack_id: currentPackId,
          source_type: DEMO_PACK_DATA.sources[0].source_type,
          source_uri: DEMO_PACK_DATA.sources[0].source_uri,
          label: DEMO_PACK_DATA.sources[0].label,
          source_config: DEMO_PACK_DATA.sources[0].source_config
        })
        .select()
        .single();
      if (sErr) throw sErr;

      // 2. Insert Demo Plan
      const { data: plan, error: pErr } = await supabase
        .from("module_plans")
        .insert({
          pack_id: currentPackId,
          pack_version: 1,
          plan_data: DEMO_PACK_DATA.plan as any,
          status: "approved",
          created_by: user.id
        })
        .select()
        .single();
      if (pErr) throw pErr;

      // 3. Insert Demo Modules
      for (const mod of DEMO_PACK_DATA.modules) {
        const { error: mErr } = await supabase
          .from("generated_modules")
          .insert({
            pack_id: currentPackId,
            module_key: mod.module_key,
            module_revision: 1,
            title: mod.title,
            description: mod.description,
            estimated_minutes: mod.estimated_minutes,
            difficulty: mod.difficulty,
            track_key: mod.track_key,
            module_data: mod.module_data as any,
            status: mod.status
          });
        if (mErr) throw mErr;
      }

      return { sourceId: source.id, planId: plan.id };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pack_sources", currentPackId] });
      qc.invalidateQueries({ queryKey: ["module_plan", currentPackId] });
      qc.invalidateQueries({ queryKey: ["generated_modules", currentPackId] });
      qc.invalidateQueries({ queryKey: ["source_count", currentPackId] });
      qc.invalidateQueries({ queryKey: ["plan_count", currentPackId] });
      qc.invalidateQueries({ queryKey: ["published_module_count", currentPackId] });
      toast.success("Demo pack loaded! Welcome to RocketBoard.");
    },
    onError: (err: any) => {
      console.error("Demo load failed:", err);
      toast.error("Failed to load demo pack. Please try again.");
    }
  });

  return { loadDemo };
}
