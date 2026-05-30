import { useState } from "react";
import { ArrowLeft, Loader2, MessageSquare, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface SlackConfig {
  botToken: string;
  channelIds: string[];
  daysBack: number;
  threadedOnly: boolean;
  pinnedOnly: boolean;
  minReactions: number;
}

interface SlackFormProps {
  onSubmit: (config: SlackConfig) => Promise<void>;
  onBack: () => void;
  isSubmitting: boolean;
}

export function SlackForm({ onSubmit, onBack, isSubmitting }: SlackFormProps) {
  const [botToken, setBotToken] = useState("");
  const [channelInput, setChannelInput] = useState("");
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [daysBack, setDaysBack] = useState(30);
  const [threadedOnly, setThreadedOnly] = useState(false);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [minReactions, setMinReactions] = useState(0);
  const [testingConnection, setTestingConnection] = useState(false);
  const [channels, setChannels] = useState<{ id: string; name: string; members: number }[]>([]);

  const handleTestConnection = async () => {
    if (!botToken) return;
    setTestingConnection(true);
    try {
      const resp = await fetch(`https://slack.com/api/conversations.list?types=public_channel&limit=100`, {
        headers: { Authorization: `Bearer ${botToken}` },
      });
      const data = await resp.json();
      if (data.ok) {
        setChannels(
          (data.channels || []).map((ch: any) => ({
            id: ch.id,
            name: ch.name,
            members: ch.num_members || 0,
          }))
        );
      }
    } catch (err) {
      console.error("Test connection failed:", err);
    }
    setTestingConnection(false);
  };

  const addChannel = (channelId: string) => {
    if (!channelIds.includes(channelId)) {
      setChannelIds([...channelIds, channelId]);
    }
  };

  const removeChannel = (channelId: string) => {
    setChannelIds(channelIds.filter(id => id !== channelId));
  };

  const handleAddManualChannel = () => {
    if (channelInput.trim() && !channelIds.includes(channelInput.trim())) {
      setChannelIds([...channelIds, channelInput.trim()]);
      setChannelInput("");
    }
  };

  const canSubmit = botToken && channelIds.length > 0;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-lg bg-[#4A154B] flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Slack Channels</h3>
          <p className="text-xs text-muted-foreground">Import valuable discussions</p>
        </div>
      </div>
      
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Bot Token</label>
        <div className="flex gap-2">
          <Input type="password" placeholder="xoxb-..." value={botToken} onChange={(e) => setBotToken(e.target.value)} />
          <Button variant="outline" onClick={handleTestConnection} disabled={!botToken || testingConnection}>
            {testingConnection ? <Loader2 className="w-4 h-4 animate-spin" /> : "Test"}
          </Button>
        </div>
      </div>

      {channels.length > 0 && (
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Select Channels</label>
          <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
            {channels.map(ch => (
              <div key={ch.id} className="flex items-center gap-2">
                <Checkbox
                  checked={channelIds.includes(ch.id)}
                  onCheckedChange={(checked) => checked ? addChannel(ch.id) : removeChannel(ch.id)}
                />
                <span className="text-sm">#{ch.name}</span>
                <span className="text-xs text-muted-foreground">({ch.members} members)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Or Add Channel ID</label>
        <div className="flex gap-2">
          <Input placeholder="C01234567" value={channelInput} onChange={(e) => setChannelInput(e.target.value)} />
          <Button variant="outline" size="icon" onClick={handleAddManualChannel}><Plus className="w-4 h-4" /></Button>
        </div>
      </div>

      {channelIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {channelIds.map(id => {
            const ch = channels.find(c => c.id === id);
            return (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs">
                {ch ? `#${ch.name}` : id}
                <button onClick={() => removeChannel(id)}><X className="w-3 h-3" /></button>
              </span>
            );
          })}
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">Time Range</label>
        <Select value={String(daysBack)} onValueChange={(v) => setDaysBack(Number(v))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox checked={threadedOnly} onCheckedChange={(v) => setThreadedOnly(!!v)} />
          <span className="text-sm">Threaded discussions only</span>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={pinnedOnly} onCheckedChange={(v) => setPinnedOnly(!!v)} />
          <span className="text-sm">Pinned messages only</span>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={minReactions > 0} onCheckedChange={(v) => setMinReactions(v ? 3 : 0)} />
          <span className="text-sm">Messages with 3+ reactions</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Create a Slack app at <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="underline">api.slack.com/apps</a> with <code>channels:history</code>, <code>channels:read</code>, and <code>users:read</code> scopes.
      </p>

      <Button onClick={() => onSubmit({ botToken, channelIds, daysBack, threadedOnly, pinnedOnly, minReactions })} disabled={isSubmitting || !canSubmit} className="w-full gap-2">
        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />} Add & Ingest
      </Button>
    </div>
  );
}
