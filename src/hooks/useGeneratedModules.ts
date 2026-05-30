import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { useRole } from "@/hooks/useRole";
import { sendAITask } from "@/lib/ai-client";
import { buildGenerateModuleEnvelope, buildRefineModuleEnvelope } from "@/lib/envelope-builder";
import type { EvidenceSpan } from "@/hooks/useEvidenceSpans";
import { fetchEvidenceSpans } from "@/lib/fetch-spans";

export interface GeneratedSection {
  section_id: string;
  heading: string;
  markdown: string;
  learning_objectives?: string[];
  note_prompts?: string[];
  citations?: { span_id: string; path?: string; chunk_id?: string }[];
}

export interface GeneratedEndcap {
  reflection_prompts: string[];
  quiz_objectives: string[];
  ready_for_quiz_markdown: string;
  citations?: { span_id: string }[];
}

export interface GeneratedModuleData {
  module_key: string;
  title: string;
  description: string;
  estimated_minutes: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  track_key: string | null;
  audience: string | null;
  depth: string | null;
  sections: GeneratedSection[];
  endcap: GeneratedEndcap;
  key_takeaways: string[];
  evidence_index?: { topic: string; citations: { span_id: string }[] }[];
}

export interface GeneratedModuleRow {
  id: string;
  pack_id: string;
  module_key: string;
  module_revision: number;
  title: string;
  description: string | null;
  estimated_minutes: number | null;
  difficulty: string | null;
  track_key: string | null;
  audience: string | null;
  depth: string | null;
  module_data: GeneratedModuleData;
  contradictions: any[] | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ChangeLogEntry {
  change: string;
  reason: string;
  citations?: { span_id: string; path?: string; chunk_id?: string }[];
}

// Evidence spans fetched via shared helper (imported at top)

export function useGeneratedModules() {
  const { user } = useAuth();
  const { currentPack, currentPackId } = usePack();
  const { packAccessLevel } = useRole();
  const queryClient = useQueryClient();

  // Fetch all generated modules for the pack (latest revision per module_key)
  const modulesQuery = useQuery({
    queryKey: ["generated_modules", currentPackId],
    queryFn: async () => {
      if (!currentPackId) return [];
      const { data, error } = await supabase
        .from("generated_modules")
        .select("*")
        .eq("pack_id", currentPackId)
        .in("status", ["draft", "published"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      // Deduplicate: keep highest revision per module_key
      const byKey = new Map<string, any>();
      for (const row of data || []) {
        const existing = byKey.get(row.module_key);
        if (!existing || row.module_revision > existing.module_revision) {
          byKey.set(row.module_key, row);
        }
      }
      return Array.from(byKey.values()) as GeneratedModuleRow[];
    },
    enabled: !!currentPackId,
  });

  // Fetch a single module (latest revision)
  const fetchModule = (moduleKey: string) => {
    return useQuery({
      queryKey: ["generated_module", currentPackId, moduleKey],
      queryFn: async () => {
        if (!currentPackId) return null;
        const { data, error } = await supabase
          .from("generated_modules")
          .select("*")
          .eq("pack_id", currentPackId)
          .eq("module_key", moduleKey)
          .order("module_revision", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return data as unknown as GeneratedModuleRow | null;
      },
      enabled: !!currentPackId && !!moduleKey,
    });
  };

  // Fetch revision history for a module
  const fetchRevisionHistory = (moduleKey: string) => {
    return useQuery({
      queryKey: ["module_revisions", currentPackId, moduleKey],
      queryFn: async () => {
        if (!currentPackId) return [];
        const { data, error } = await supabase
          .from("generated_modules")
          .select("id, module_key, module_revision, title, created_at, updated_at")
          .eq("pack_id", currentPackId)
          .eq("module_key", moduleKey)
          .order("module_revision", { ascending: false });
        if (error) throw error;
        return (data || []) as { id: string; module_key: string; module_revision: number; title: string; created_at: string; updated_at: string }[];
      },
      enabled: !!currentPackId && !!moduleKey,
    });
  };

  // Fetch a specific revision
  const fetchSpecificRevision = (moduleKey: string, revision: number) => {
    return useQuery({
      queryKey: ["generated_module_revision", currentPackId, moduleKey, revision],
      queryFn: async () => {
        if (!currentPackId) return null;
        const { data, error } = await supabase
          .from("generated_modules")
          .select("*")
          .eq("pack_id", currentPackId)
          .eq("module_key", moduleKey)
          .eq("module_revision", revision)
          .maybeSingle();
        if (error) throw error;
        return data as unknown as GeneratedModuleRow | null;
      },
      enabled: !!currentPackId && !!moduleKey && revision > 0,
    });
  };

  // Generate a module via AI and save to DB
  const generateModule = useMutation({
    mutationFn: async (opts: {
      moduleKey: string;
      title: string;
      description?: string;
      trackKey?: string | null;
      difficulty?: string;
      estimatedMinutes?: number;
    }) => {
      if (!currentPackId || !user) throw new Error("Missing pack or user");

      const spans = await fetchEvidenceSpans(
        currentPackId,
        `${opts.title} ${opts.description || ""}`,
        15
      );

      const envelope = buildGenerateModuleEnvelope({
        auth: {
          user_id: user.id,
          org_id: currentPack?.org_id || null,
          roles: [],
          pack_access_level: packAccessLevel,
        },
        pack: {
          pack_id: currentPackId,
          pack_version: currentPack?.pack_version,
          title: currentPack?.title,
          description: currentPack?.description,
          language_mode: currentPack?.language_mode,
        },
        evidenceSpans: spans,
        moduleKey: opts.moduleKey,
        moduleTitle: opts.title,
        moduleDescription: opts.description,
        trackKey: opts.trackKey,
      });

      const result = await sendAITask(envelope);
      const moduleData = result.module as GeneratedModuleData;

      const { data, error } = await supabase
        .from("generated_modules")
        .upsert({
          pack_id: currentPackId,
          module_key: opts.moduleKey,
          module_revision: 1,
          title: moduleData.title || opts.title,
          description: moduleData.description || opts.description || null,
          estimated_minutes: moduleData.estimated_minutes || opts.estimatedMinutes || null,
          difficulty: moduleData.difficulty || opts.difficulty || null,
          track_key: moduleData.track_key || opts.trackKey || null,
          audience: moduleData.audience || null,
          depth: moduleData.depth || null,
          module_data: moduleData as any,
          contradictions: (result.contradictions || []) as any,
          status: "draft",
        }, { onConflict: "pack_id,module_key,module_revision" })
        .select()
        .single();

      if (error) throw error;

      // Record freshness snapshot
      await supabase.functions.invoke("record-content-freshness", {
        body: {
          pack_id: currentPackId,
          module_key: opts.moduleKey,
          module_revision: 1,
          module_data: moduleData,
        }
      }).catch(err => console.error("Freshness recording failed:", err));

      return data as unknown as GeneratedModuleRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generated_modules", currentPackId] });
    },
  });

  // Refine a module via AI
  const refineModule = useMutation({
    mutationFn: async (opts: {
      moduleKey: string;
      authorInstruction: string;
      existingModuleData: GeneratedModuleData;
      currentRevision: number;
      trackKey?: string | null;
    }): Promise<{ row: GeneratedModuleRow; changeLog: ChangeLogEntry[] }> => {
      if (!currentPackId || !user) throw new Error("Missing pack or user");

      const spans = await fetchEvidenceSpans(
        currentPackId,
        `${opts.existingModuleData.title} ${opts.authorInstruction}`,
        15
      );

      const envelope = buildRefineModuleEnvelope({
        auth: {
          user_id: user.id,
          org_id: currentPack?.org_id || null,
          roles: [],
          pack_access_level: packAccessLevel,
        },
        pack: {
          pack_id: currentPackId,
          pack_version: currentPack?.pack_version,
          title: currentPack?.title,
          description: currentPack?.description,
          language_mode: currentPack?.language_mode,
        },
        existingModule: opts.existingModuleData,
        authorInstruction: opts.authorInstruction,
        moduleKey: opts.moduleKey,
        trackKey: opts.trackKey,
        moduleRevision: opts.currentRevision,
        evidenceSpans: spans,
      });

      const result = await sendAITask(envelope);
      const moduleData = result.module as GeneratedModuleData;
      const changeLog = (result.change_log || []) as ChangeLogEntry[];
      const newRevision = result.module_revision || opts.currentRevision + 1;

      const { data, error } = await supabase
        .from("generated_modules")
        .insert({
          pack_id: currentPackId,
          module_key: opts.moduleKey,
          module_revision: newRevision,
          title: moduleData.title || opts.existingModuleData.title,
          description: moduleData.description || opts.existingModuleData.description || null,
          estimated_minutes: moduleData.estimated_minutes || opts.existingModuleData.estimated_minutes || null,
          difficulty: moduleData.difficulty || opts.existingModuleData.difficulty || null,
          track_key: moduleData.track_key || opts.trackKey || null,
          audience: moduleData.audience || null,
          depth: moduleData.depth || null,
          module_data: moduleData as any,
          contradictions: (result.contradictions || []) as any,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;

      // Record freshness snapshot
      await supabase.functions.invoke("record-content-freshness", {
        body: {
          pack_id: currentPackId,
          module_key: opts.moduleKey,
          module_revision: newRevision,
          module_data: moduleData,
        }
      }).catch(err => console.error("Freshness recording failed:", err));

      return { row: data as unknown as GeneratedModuleRow, changeLog };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["generated_modules", currentPackId] });
      queryClient.invalidateQueries({ queryKey: ["generated_module", currentPackId, vars.moduleKey] });
      queryClient.invalidateQueries({ queryKey: ["module_revisions", currentPackId, vars.moduleKey] });
    },
  });

  // Save manual edits directly
  const saveManualEdit = useMutation({
    mutationFn: async (opts: {
      moduleKey: string;
      moduleData: GeneratedModuleData;
      currentRevision: number;
    }): Promise<{ row: GeneratedModuleRow; changeLog: ChangeLogEntry[] }> => {
      if (!currentPackId || !user) throw new Error("Missing pack or user");

      const newRevision = opts.currentRevision + 1;
      const changeLog: ChangeLogEntry[] = [
        { change: "Manual author edits", reason: "Direct modification of module content" }
      ];

      const { data, error } = await supabase
        .from("generated_modules")
        .insert({
          pack_id: currentPackId,
          module_key: opts.moduleKey,
          module_revision: newRevision,
          title: opts.moduleData.title,
          description: opts.moduleData.description || null,
          estimated_minutes: opts.moduleData.estimated_minutes || null,
          difficulty: opts.moduleData.difficulty || null,
          track_key: opts.moduleData.track_key || null,
          audience: opts.moduleData.audience || null,
          depth: opts.moduleData.depth || null,
          module_data: opts.moduleData as any,
          contradictions: [],
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;

      // Record freshness snapshot
      await supabase.functions.invoke("record-content-freshness", {
        body: {
          pack_id: currentPackId,
          module_key: opts.moduleKey,
          module_revision: newRevision,
          module_data: opts.moduleData,
        }
      }).catch(err => console.error("Freshness recording failed:", err));

      return { row: data as unknown as GeneratedModuleRow, changeLog };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["generated_modules", currentPackId] });
      queryClient.invalidateQueries({ queryKey: ["generated_module", currentPackId, vars.moduleKey] });
      queryClient.invalidateQueries({ queryKey: ["module_revisions", currentPackId, vars.moduleKey] });
    },
  });

  return {
    modules: modulesQuery.data || [],
    modulesLoading: modulesQuery.isLoading,
    fetchModule,
    fetchRevisionHistory,
    fetchSpecificRevision,
    generateModule,
    refineModule,
    saveManualEdit,
  };
}
