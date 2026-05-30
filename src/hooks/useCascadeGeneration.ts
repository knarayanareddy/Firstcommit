import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { useRole } from "@/hooks/useRole";
import { useQueryClient } from "@tanstack/react-query";
import { sendAITask } from "@/lib/ai-client";
import {
  buildGenerateModuleEnvelope,
  buildGenerateQuizEnvelope,
  buildGenerateGlossaryEnvelope,
  buildGeneratePathsEnvelope,
  buildGenerateAskLeadEnvelope,
} from "@/lib/envelope-builder";
import { fetchEvidenceSpansMultiQuery, buildRetrievalQueries } from "@/lib/fetch-spans";
import type { ModulePlanEntry } from "@/hooks/useModulePlan";
import type { GeneratedModuleData } from "@/hooks/useGeneratedModules";

export type CascadeJobStatus = "queued" | "generating" | "completed" | "failed";

export interface CascadeModuleStatus {
  moduleKey: string;
  title: string;
  moduleStatus: CascadeJobStatus;
  quizStatus: CascadeJobStatus;
  exerciseStatus: CascadeJobStatus;
  error?: string;
  quizError?: string;
  exerciseError?: string;
}

export interface CascadeSupportStatus {
  glossary: CascadeJobStatus;
  paths: CascadeJobStatus;
  askLead: CascadeJobStatus;
  glossaryError?: string;
  pathsError?: string;
  askLeadError?: string;
  glossaryTermCount?: number;
}

export function useCascadeGeneration() {
  const { user } = useAuth();
  const { currentPack, currentPackId } = usePack();
  const { packAccessLevel } = useRole();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [moduleStatuses, setModuleStatuses] = useState<CascadeModuleStatus[]>([]);
  const [supportStatus, setSupportStatus] = useState<CascadeSupportStatus>({
    glossary: "queued", paths: "queued", askLead: "queued",
  });
  const abortRef = useRef(false);

  const authInfo = useCallback(() => ({
    user_id: user!.id,
    org_id: currentPack?.org_id || null,
    roles: [],
    pack_access_level: packAccessLevel,
  }), [user, currentPack, packAccessLevel]);

  const packInfo = useCallback(() => ({
    pack_id: currentPackId!,
    pack_version: currentPack?.pack_version,
    title: currentPack?.title,
    description: currentPack?.description,
    language_mode: currentPack?.language_mode,
  }), [currentPackId, currentPack]);

  const updateModuleStatus = (key: string, update: Partial<CascadeModuleStatus>) => {
    setModuleStatuses(prev => prev.map(m => m.moduleKey === key ? { ...m, ...update } : m));
  };

  const upsertJob = async (jobType: string, moduleKey: string | null, status: CascadeJobStatus, errorMessage?: string) => {
    if (!currentPackId) return;
    // Find existing job
    const { data: existing } = await supabase
      .from("generation_jobs")
      .select("id")
      .eq("pack_id", currentPackId)
      .eq("job_type", jobType)
      .eq("module_key", moduleKey ?? "")
      .maybeSingle();

    const now = new Date().toISOString();
    if (existing) {
      await supabase.from("generation_jobs").update({
        status,
        error_message: errorMessage || null,
        started_at: status === "generating" ? now : undefined,
        completed_at: status === "completed" || status === "failed" ? now : undefined,
      } as any).eq("id", existing.id);
    } else {
      await supabase.from("generation_jobs").insert({
        pack_id: currentPackId,
        job_type: jobType,
        module_key: moduleKey,
        status,
        error_message: errorMessage || null,
        started_at: status === "generating" ? now : null,
        completed_at: status === "completed" || status === "failed" ? now : null,
      } as any);
    }
  };

  const runCascade = useCallback(async (modules: ModulePlanEntry[], existingModuleKeys: Set<string>) => {
    if (!currentPackId || !user) return;
    abortRef.current = false;
    setRunning(true);

    const modulesToGen = modules.filter(m => !existingModuleKeys.has(m.module_key));
    
    // Initialize statuses
    setModuleStatuses(modules.map(m => ({
      moduleKey: m.module_key,
      title: m.title,
      moduleStatus: existingModuleKeys.has(m.module_key) ? "completed" : "queued",
      quizStatus: "queued",
      exerciseStatus: "queued",
    })));
    setSupportStatus({ glossary: "queued", paths: "queued", askLead: "queued" });

    // Clear old jobs for this pack
    await supabase.from("generation_jobs").delete().eq("pack_id", currentPackId);

    // STEP 1+2: Module + Quiz cascade
    for (const mod of modulesToGen) {
      if (abortRef.current) break;

      // Generate module
      updateModuleStatus(mod.module_key, { moduleStatus: "generating" });
      await upsertJob("module", mod.module_key, "generating");

      try {
        const moduleQueries = buildRetrievalQueries(
          `${mod.title} ${mod.description || ""}`,
          { packTitle: currentPack?.title, taskType: "generate_module" }
        );
        const spans = await fetchEvidenceSpansMultiQuery(currentPackId, moduleQueries, 20);
        const envelope = buildGenerateModuleEnvelope({
          auth: authInfo(), pack: packInfo(), evidenceSpans: spans,
          moduleKey: mod.module_key, moduleTitle: mod.title,
          moduleDescription: mod.description, trackKey: mod.track_key,
        });
        const result = await sendAITask(envelope);
        const moduleData = result.module as GeneratedModuleData;

        // Save as DRAFT
        await supabase.from("generated_modules").upsert({
          pack_id: currentPackId,
          module_key: mod.module_key,
          module_revision: 1,
          title: moduleData.title || mod.title,
          description: moduleData.description || mod.description || null,
          estimated_minutes: moduleData.estimated_minutes || mod.estimated_minutes || null,
          difficulty: moduleData.difficulty || mod.difficulty || null,
          track_key: moduleData.track_key || mod.track_key || null,
          audience: moduleData.audience || null,
          depth: moduleData.depth || null,
          module_data: moduleData as any,
          contradictions: (result.contradictions || []) as any,
          status: "draft",
        }, { onConflict: "pack_id,module_key,module_revision" });
        if (error) throw error;
        
        // Record freshness snapshot
        await supabase.functions.invoke("record-content-freshness", {
          body: {
            pack_id: currentPackId,
            module_key: mod.module_key,
            module_revision: 1,
            module_data: moduleData,
          }
        }).catch(err => console.error("Freshness recording failed:", err));

        updateModuleStatus(mod.module_key, { moduleStatus: "completed" });
        await upsertJob("module", mod.module_key, "completed");
        queryClient.invalidateQueries({ queryKey: ["generated_modules", currentPackId] });

        // Auto-generate quiz for this module
        updateModuleStatus(mod.module_key, { quizStatus: "generating" });
        await upsertJob("quiz", mod.module_key, "generating");
        try {
          const quizSpans = await fetchEvidenceSpansMultiQuery(
            currentPackId,
            [`${mod.title} quiz assessment`, `${mod.title} key concepts test`],
            12
          ).catch(() => []);
          const quizEnvelope = buildGenerateQuizEnvelope({
            auth: authInfo(), pack: packInfo(),
            moduleKey: mod.module_key, trackKey: mod.track_key,
            moduleData, evidenceSpans: quizSpans,
          });
          const quizResult = await sendAITask(quizEnvelope);
          await supabase.from("generated_quizzes").upsert({
            pack_id: currentPackId, module_key: mod.module_key,
            quiz_data: quizResult.quiz as any,
          }, { onConflict: "pack_id,module_key" });

          updateModuleStatus(mod.module_key, { quizStatus: "completed" });
          await upsertJob("quiz", mod.module_key, "completed");
        } catch (e: any) {
          updateModuleStatus(mod.module_key, { quizStatus: "failed", quizError: e.message });
          await upsertJob("quiz", mod.module_key, "failed", e.message);
        }

        // Auto-generate exercises for this module
        updateModuleStatus(mod.module_key, { exerciseStatus: "generating" });
        try {
          const exEnvelope = {
            task: { type: "generate_exercises", request_id: crypto.randomUUID() },
            auth: authInfo(), pack: packInfo(),
            retrieval: { evidence_spans: [] },
            inputs: { module_key: mod.module_key, module_title: mod.title, module_description: mod.description },
          };
          const exResult = await sendAITask(exEnvelope);
          const exercises = exResult.exercises || [];
          // Save exercises
          await supabase.from("exercises").delete().eq("pack_id", currentPackId).eq("module_key", mod.module_key);
          for (let i = 0; i < exercises.length; i++) {
            const ex = exercises[i];
            await supabase.from("exercises").insert({
              pack_id: currentPackId, module_key: mod.module_key,
              exercise_key: ex.exercise_key || `${mod.module_key}-ex-${i + 1}`,
              title: ex.title, description: ex.description,
              exercise_type: ex.exercise_type, difficulty: ex.difficulty || "intermediate",
              estimated_minutes: ex.estimated_minutes || 10, hints: ex.hints || [],
              verification: ex.verification || {}, evidence_citations: ex.evidence_citations || [],
              sort_order: i,
            } as any);
          }
          updateModuleStatus(mod.module_key, { exerciseStatus: "completed" });
          queryClient.invalidateQueries({ queryKey: ["exercises", currentPackId, mod.module_key] });
        } catch (e: any) {
          updateModuleStatus(mod.module_key, { exerciseStatus: "failed", exerciseError: e.message });
        }
      } catch (e: any) {
        updateModuleStatus(mod.module_key, { moduleStatus: "failed", error: e.message });
        await upsertJob("module", mod.module_key, "failed", e.message);
      }
    }

    // STEP 3: Supporting content
    if (!abortRef.current) {
      // Glossary
      setSupportStatus(prev => ({ ...prev, glossary: "generating" }));
      await upsertJob("glossary", null, "generating");
      try {
        const glossaryQueries = buildRetrievalQueries(
          "glossary terms definitions technical vocabulary",
          { packTitle: currentPack?.title, packDescription: currentPack?.description, taskType: "generate_glossary" }
        );
        const spans = await fetchEvidenceSpansMultiQuery(currentPackId, glossaryQueries, 25, { match_threshold: 0.2 }).catch(() => []);
        const envelope = buildGenerateGlossaryEnvelope({
          auth: authInfo(), pack: packInfo(), evidenceSpans: spans,
        });
        const result = await sendAITask(envelope);
        await supabase.from("generated_glossaries").delete().eq("pack_id", currentPackId);
        await supabase.from("generated_glossaries").insert({
          pack_id: currentPackId, glossary_data: result.glossary as any, glossary_density: "standard",
        });
        const termCount = Array.isArray(result.glossary) ? result.glossary.length : 0;
        setSupportStatus(prev => ({ ...prev, glossary: "completed", glossaryTermCount: termCount }));
        await upsertJob("glossary", null, "completed");
        queryClient.invalidateQueries({ queryKey: ["generated_glossary", currentPackId] });
      } catch (e: any) {
        setSupportStatus(prev => ({ ...prev, glossary: "failed", glossaryError: e.message }));
        await upsertJob("glossary", null, "failed", e.message);
      }
    }

    if (!abortRef.current) {
      // Paths
      setSupportStatus(prev => ({ ...prev, paths: "generating" }));
      await upsertJob("paths", null, "generating");
      try {
        const pathsQueries = buildRetrievalQueries(
          "setup onboarding getting started environment configuration",
          { packTitle: currentPack?.title, packDescription: currentPack?.description, taskType: "generate_paths" }
        );
        const spans = await fetchEvidenceSpansMultiQuery(currentPackId, pathsQueries, 25, { match_threshold: 0.2 }).catch(() => []);
        const envelope = buildGeneratePathsEnvelope({
          auth: authInfo(), pack: packInfo(), evidenceSpans: spans,
        });
        const result = await sendAITask(envelope);
        await supabase.from("generated_paths").delete().eq("pack_id", currentPackId);
        await supabase.from("generated_paths").insert({
          pack_id: currentPackId, paths_data: { day1: result.day1 || [], week1: result.week1 || [] } as any,
        });
        setSupportStatus(prev => ({ ...prev, paths: "completed" }));
        await upsertJob("paths", null, "completed");
        queryClient.invalidateQueries({ queryKey: ["generated_paths", currentPackId] });
      } catch (e: any) {
        setSupportStatus(prev => ({ ...prev, paths: "failed", pathsError: e.message }));
        await upsertJob("paths", null, "failed", e.message);
      }
    }

    if (!abortRef.current) {
      // Ask Lead
      setSupportStatus(prev => ({ ...prev, askLead: "generating" }));
      await upsertJob("ask_lead", null, "generating");
      try {
        const askLeadQueries = buildRetrievalQueries(
          "team process architecture decisions workflow onboarding culture",
          { packTitle: currentPack?.title, packDescription: currentPack?.description, taskType: "generate_ask_lead" }
        );
        const spans = await fetchEvidenceSpansMultiQuery(currentPackId, askLeadQueries, 25, { match_threshold: 0.2 }).catch(() => []);
        const envelope = buildGenerateAskLeadEnvelope({
          auth: authInfo(), pack: packInfo(), evidenceSpans: spans,
        });
        const result = await sendAITask(envelope);
        await supabase.from("generated_ask_lead").delete().eq("pack_id", currentPackId);
        await supabase.from("generated_ask_lead").insert({
          pack_id: currentPackId, questions_data: result.questions as any,
        });
        setSupportStatus(prev => ({ ...prev, askLead: "completed" }));
        await upsertJob("ask_lead", null, "completed");
        queryClient.invalidateQueries({ queryKey: ["generated_ask_lead", currentPackId] });
      } catch (e: any) {
        setSupportStatus(prev => ({ ...prev, askLead: "failed", askLeadError: e.message }));
        await upsertJob("ask_lead", null, "failed", e.message);
      }
    }

    setRunning(false);
  }, [currentPackId, user, currentPack, packAccessLevel, authInfo, packInfo, queryClient]);

  const abort = useCallback(() => { abortRef.current = true; }, []);

  return {
    running,
    moduleStatuses,
    supportStatus,
    runCascade,
    abort,
  };
}
