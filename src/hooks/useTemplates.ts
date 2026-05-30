import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { useRole } from "@/hooks/useRole";
import { sendAITask } from "@/lib/ai-client";
import { buildCreateTemplateEnvelope, buildRefineTemplateEnvelope } from "@/lib/envelope-builder";

export interface TemplateSection {
  section_id: string;
  heading: string;
  purpose: string;
}

export interface TriggerRules {
  required_signals: string[];
  path_patterns_any: string[];
  file_types_any: string[];
  repo_hints_any: string[];
}

export interface EvidenceRequirement {
  requirement: string;
  why: string;
}

export interface TemplateData {
  template_key: string;
  title: string;
  description: string;
  trigger_rules: TriggerRules;
  generation_instructions: string;
  section_outline: TemplateSection[];
  evidence_requirements: EvidenceRequirement[];
}

export interface TemplateRow {
  id: string;
  org_id: string;
  template_key: string;
  title: string;
  description: string | null;
  template_data: TemplateData;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateChangeLogEntry {
  change: string;
  reason: string;
}

export function useTemplates() {
  const { user } = useAuth();
  const { currentPack } = usePack();
  const { packAccessLevel } = useRole();
  const queryClient = useQueryClient();
  const orgId = currentPack?.org_id;

  const templatesQuery = useQuery({
    queryKey: ["templates", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("module_templates")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as TemplateRow[];
    },
    enabled: !!orgId,
  });

  const fetchTemplate = (templateId: string) => {
    return useQuery({
      queryKey: ["template", templateId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("module_templates")
          .select("*")
          .eq("id", templateId)
          .maybeSingle();
        if (error) throw error;
        return data as unknown as TemplateRow | null;
      },
      enabled: !!templateId,
    });
  };

  const createTemplate = useMutation({
    mutationFn: async (authorInstruction: string): Promise<{ template: TemplateData; warnings: string[] }> => {
      if (!user || !orgId) throw new Error("Missing user or org");

      const envelope = buildCreateTemplateEnvelope({
        auth: {
          user_id: user.id,
          org_id: orgId,
          roles: [],
          pack_access_level: packAccessLevel,
        },
        pack: {
          pack_id: currentPack?.id || null,
          pack_version: currentPack?.pack_version,
          title: currentPack?.title,
          description: currentPack?.description,
          language_mode: currentPack?.language_mode,
        },
        authorInstruction,
      });

      const result = await sendAITask(envelope);
      return {
        template: result.template as TemplateData,
        warnings: (result.warnings || []) as string[],
      };
    },
  });

  const saveTemplate = useMutation({
    mutationFn: async (template: TemplateData) => {
      if (!orgId || !user) throw new Error("Missing org or user");
      const { data, error } = await supabase
        .from("module_templates")
        .upsert({
          org_id: orgId,
          template_key: template.template_key,
          title: template.title,
          description: template.description || null,
          template_data: template as any,
          created_by: user.id,
        }, { onConflict: "org_id,template_key" })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TemplateRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates", orgId] });
    },
  });

  const refineTemplate = useMutation({
    mutationFn: async (opts: {
      existingTemplate: TemplateData;
      authorInstruction: string;
    }): Promise<{ template: TemplateData; changeLog: TemplateChangeLogEntry[]; warnings: string[] }> => {
      if (!user || !orgId) throw new Error("Missing user or org");

      const envelope = buildRefineTemplateEnvelope({
        auth: {
          user_id: user.id,
          org_id: orgId,
          roles: [],
          pack_access_level: packAccessLevel,
        },
        pack: {
          pack_id: currentPack?.id || null,
          pack_version: currentPack?.pack_version,
          title: currentPack?.title,
          description: currentPack?.description,
          language_mode: currentPack?.language_mode,
        },
        existingTemplate: opts.existingTemplate,
        authorInstruction: opts.authorInstruction,
      });

      const result = await sendAITask(envelope);
      return {
        template: result.template as TemplateData,
        changeLog: (result.change_log || []) as TemplateChangeLogEntry[],
        warnings: (result.warnings || []) as string[],
      };
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from("module_templates")
        .delete()
        .eq("id", templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates", orgId] });
    },
  });

  return {
    templates: templatesQuery.data || [],
    templatesLoading: templatesQuery.isLoading,
    fetchTemplate,
    createTemplate,
    saveTemplate,
    refineTemplate,
    deleteTemplate,
  };
}
