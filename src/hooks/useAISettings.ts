// @ts-nocheck
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PLATFORM_DEFAULT } from "@/data/ai-providers";
import { toast } from "sonner";

export interface BYOKProviderState {
  key_masked: string | null;
  preferred_model: string | null;
  validated_at: string | null;
  status: "valid" | "invalid" | "expired" | null;
}

export interface BYOKConfig {
  active_provider: string | null;
  active_model: string | null;
  fallback_behavior: "use_default" | "fail_gracefully" | "queue_retry";
  providers: Record<string, BYOKProviderState>;
}

export function useAISettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["ai_settings", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("user_ai_settings_masked")
        .select("byok_config")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching AI settings:", error);
        return null;
      }
      
      const defaultConfig: BYOKConfig = {
        active_provider: null,
        active_model: null,
        fallback_behavior: "use_default",
        providers: {},
      };
      
      if (!data?.byok_config) return defaultConfig;
      
      // Merge with default to ensure structural safety
      return { ...defaultConfig, ...(data.byok_config as unknown as BYOKConfig) };
    },
    enabled: !!user,
  });

  const activeConfig = {
    provider: config?.active_provider || PLATFORM_DEFAULT.provider,
    model: config?.active_model || PLATFORM_DEFAULT.model,
    isDefault: !config?.active_provider || config.active_provider === "default",
  };

  const getProviderState = (providerId: string): BYOKProviderState | null => {
    return config?.providers?.[providerId] || null;
  };

  const fallbackBehavior = config?.fallback_behavior || "use_default";

  // Validate Key Endpoint
  const validateKeyMutation = useMutation({
    mutationFn: async ({ provider, apiKey, model }: { provider: string; apiKey: string; model: string }) => {
      const { data, error } = await supabase.functions.invoke("ai-task-router", {
        body: { task: { type: "validate_key" }, provider, api_key: apiKey, model },
      });
      if (error) throw new Error("Network error during validation");
      if (data?.type === "error") throw new Error(data.message || "Invalid key");
      return data;
    },
  });

  const saveKeyMutation = useMutation({
    mutationFn: async ({ provider, apiKey, model }: { provider: string; apiKey: string; model: string }) => {
      const { error } = await supabase.rpc("save_byok_key", {
        _provider: provider,
        _api_key: apiKey,
        _model: model,
        _status: "valid",
      });
      if (error) throw error;
      
      // Auto-set as active if saved successfully
      const { error: activeErr } = await supabase.rpc("set_active_byok_provider", {
        _provider: provider,
        _model: model,
      });
      if (activeErr) throw activeErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_settings", user?.id] });
      toast.success("API key saved securely");
    },
    onError: (err) => {
      toast.error(`Failed to save key: ${err.message}`);
    },
  });

  const setActiveMutation = useMutation({
    mutationFn: async ({ provider, model }: { provider: string; model: string }) => {
      if (provider === "default") {
        const { error } = await supabase.from("user_ai_settings").update({ 
          byok_config: { 
            active_provider: null, 
            active_model: null,
            fallback_behavior: fallbackBehavior,
            providers: config?.providers || {} 
          } 
        }).eq("user_id", user!.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.rpc("set_active_byok_provider", {
        _provider: provider,
        _model: model,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_settings", user?.id] });
      toast.success("Active AI provider updated");
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  });

  const setFallbackBehaviorMutation = useMutation({
    mutationFn: async (behavior: string) => {
      const { error } = await supabase.from("user_ai_settings").update({ 
        byok_config: { 
          active_provider: config?.active_provider, 
          active_model: config?.active_model,
          fallback_behavior: behavior,
          providers: config?.providers || {} 
        } 
      }).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_settings", user?.id] });
    },
  });

  const clearKeyMutation = useMutation({
    mutationFn: async (provider: string) => {
      const { error } = await supabase.rpc("clear_byok_provider", { _provider: provider });
      if (error) throw error;
      
      // If we just cleared our active provider, revert to default
      if (config?.active_provider === provider) {
         await supabase.from("user_ai_settings").update({ 
          byok_config: { 
            active_provider: null, 
            active_model: null,
            fallback_behavior: fallbackBehavior,
            providers: config?.providers || {} 
          } 
        }).eq("user_id", user!.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai_settings", user?.id] });
      toast.info("API key deleted from secure vault");
    },
    onError: (err) => toast.error(`Error deleting key: ${err.message}`),
  });

  return {
    isLoading,
    activeConfig,
    fallbackBehavior,
    providers: config?.providers || {},
    getProviderState,
    validateKey: validateKeyMutation.mutateAsync,
    saveKey: saveKeyMutation.mutateAsync,
    setActiveProvider: setActiveMutation.mutate,
    setFallbackBehavior: setFallbackBehaviorMutation.mutate,
    clearKey: clearKeyMutation.mutate,
    isSaving: saveKeyMutation.isPending || validateKeyMutation.isPending || setActiveMutation.isPending,
  };
}
