import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePack } from "@/hooks/usePack";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function useSlackIntegration() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const queryClient = useQueryClient();

  const { data: integration, isLoading } = useQuery({
    queryKey: ["slack_integration", currentPackId],
    queryFn: async () => {
      if (!currentPackId) return null;
      const { data, error } = await supabase
        .from("slack_integrations")
        .select("*")
        .eq("pack_id", currentPackId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentPackId,
  });

  const saveIntegration = useMutation({
    mutationFn: async (params: {
      webhookUrl: string;
      channelName?: string;
      notifyOnInvite: boolean;
      notifyOnModuleComplete: boolean;
      notifyOnNewSource: boolean;
    }) => {
      if (!currentPackId || !user) throw new Error("Missing context");

      const payload = {
        pack_id: currentPackId,
        webhook_url: params.webhookUrl,
        channel_name: params.channelName || null,
        notify_on_invite: params.notifyOnInvite,
        notify_on_module_complete: params.notifyOnModuleComplete,
        notify_on_new_source: params.notifyOnNewSource,
        created_by: user.id,
      };

      if (integration) {
        const { error } = await supabase
          .from("slack_integrations")
          .update(payload)
          .eq("id", integration.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("slack_integrations")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slack_integration", currentPackId] });
      toast.success("Slack integration saved");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteIntegration = useMutation({
    mutationFn: async () => {
      if (!integration) return;
      const { error } = await supabase
        .from("slack_integrations")
        .delete()
        .eq("id", integration.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slack_integration", currentPackId] });
      toast.success("Slack integration removed");
    },
  });

  const testWebhook = async (webhookUrl: string) => {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "🚀 RocketBoard test notification — your Slack integration is working!" }),
      });
      if (!res.ok) throw new Error("Webhook returned error");
      toast.success("Test message sent to Slack!");
    } catch {
      toast.error("Failed to send test message. Check your webhook URL.");
    }
  };

  const sendNotification = async (messageType: string, data: any) => {
    if (!currentPackId) return false;
    const { data: result, error } = await supabase.functions.invoke('send-slack-message', {
      body: { packId: currentPackId, messageType, data }
    });
    return result?.success || false;
  };

  return { integration, isLoading, saveIntegration, deleteIntegration, testWebhook, sendNotification };
}
