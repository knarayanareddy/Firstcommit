import { useState, useEffect } from "react";
import { useSlackIntegration } from "@/hooks/useSlackIntegration";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MessageSquare, Trash2, Loader2, Send } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function SlackSettingsSection() {
  const { integration, isLoading, saveIntegration, deleteIntegration, testWebhook } = useSlackIntegration();

  const [webhookUrl, setWebhookUrl] = useState("");
  const [channelName, setChannelName] = useState("");
  const [notifyInvite, setNotifyInvite] = useState(true);
  const [notifyModule, setNotifyModule] = useState(false);
  const [notifySource, setNotifySource] = useState(false);

  useEffect(() => {
    if (integration) {
      setWebhookUrl(integration.webhook_url);
      setChannelName(integration.channel_name || "");
      setNotifyInvite(integration.notify_on_invite);
      setNotifyModule(integration.notify_on_module_complete);
      setNotifySource(integration.notify_on_new_source);
    }
  }, [integration]);

  if (isLoading) return null;

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" /> Slack Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Webhook URL</Label>
          <Input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/..."
            className="text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Channel Name (optional)</Label>
          <Input
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            placeholder="#general"
            className="text-sm"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Notify on new invite</Label>
            <Switch checked={notifyInvite} onCheckedChange={setNotifyInvite} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Notify on module complete</Label>
            <Switch checked={notifyModule} onCheckedChange={setNotifyModule} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Notify on new source</Label>
            <Switch checked={notifySource} onCheckedChange={setNotifySource} />
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!webhookUrl.trim() || saveIntegration.isPending}
            onClick={() => saveIntegration.mutate({
              webhookUrl, channelName,
              notifyOnInvite: notifyInvite,
              notifyOnModuleComplete: notifyModule,
              notifyOnNewSource: notifySource,
            })}
          >
            {saveIntegration.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            Save
          </Button>
          {webhookUrl.trim() && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => testWebhook(webhookUrl)}>
              <Send className="w-3 h-3" /> Test
            </Button>
          )}
          {integration && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
                  <Trash2 className="w-3 h-3" /> Remove
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove Slack Integration?</AlertDialogTitle>
                  <AlertDialogDescription>This will stop all Slack notifications for this pack.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteIntegration.mutate()}>Remove</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
