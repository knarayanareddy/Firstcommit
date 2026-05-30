import { useState, useMemo } from "react";
import { Server, Lock, Cpu, Key, Trash2, CheckCircle2, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAISettings } from "@/hooks/useAISettings";
import { AI_PROVIDERS, PROVIDER_TIERS, PLATFORM_DEFAULT } from "@/data/ai-providers";
import { Loader2 } from "lucide-react";

export function AIModelProviderSection() {
  const { activeConfig, fallbackBehavior, providers, getProviderState, validateKey, saveKey, clearKey, setActiveProvider, setFallbackBehavior, isSaving } = useAISettings();

  const [selectedProvider, setSelectedProvider] = useState<string>("openai");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [apiKeyInput, setApiKeyInput] = useState<string>("");
  const [showKey, setShowKey] = useState(false);

  // Auto-select first available model when provider changes
  useMemo(() => {
    const prov = AI_PROVIDERS[selectedProvider];
    if (prov && !selectedModel) {
      const firstAvailable = prov.models.find(m => m.available !== false);
      if (firstAvailable) setSelectedModel(firstAvailable.id);
    }
  }, [selectedProvider]);

  const handleProviderChange = (val: string) => {
    setSelectedProvider(val);
    const firstAvailable = AI_PROVIDERS[val]?.models.find(m => m.available !== false);
    setSelectedModel(firstAvailable?.id || "");
    setApiKeyInput("");
  };

  const handleSave = async () => {
    if (!apiKeyInput) return;
    try {
      await validateKey({ provider: selectedProvider, apiKey: apiKeyInput, model: selectedModel });
      await saveKey({ provider: selectedProvider, apiKey: apiKeyInput, model: selectedModel });
      setApiKeyInput("");
    } catch {
      // error handled by hook
    }
  };

  const activeProviderCfg = AI_PROVIDERS[activeConfig.provider];
  const activeModelLabel = activeConfig.isDefault 
    ? PLATFORM_DEFAULT.label 
    : (activeProviderCfg?.models.find(m => m.id === activeConfig.model)?.label || activeConfig.model);

  const savedProviderKeys = Object.keys(providers);

  return (
    <div className="bg-card border border-border rounded-xl p-6" data-tour="settings-ai-provider">
      <div className="flex items-center gap-2 mb-4">
        <Server className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-card-foreground">AI Model Provider (BYOK)</h2>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4">
        By default, RocketBoard uses Gemini 3 Flash. You can supply your own API key to unlock reasoning models and higher context windows.
      </p>

      {/* Active Status Badge */}
      <div className="flex items-center gap-2 mb-6 p-3 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-2 flex-1">
          {activeConfig.isDefault ? (
            <div className="w-2 h-2 rounded-full bg-slate-400" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-green-500" />
          )}
          <span className="text-sm font-medium">
            {activeConfig.isDefault ? "⚙️ RocketBoard Default" : `🟢 Using your key: ${activeProviderCfg?.label || activeConfig.provider}`}
          </span>
          <span className="text-sm text-muted-foreground ml-2">— {activeModelLabel}</span>
        </div>
        {!activeConfig.isDefault && (
          <Button variant="ghost" size="sm" onClick={() => setActiveProvider({ provider: "default", model: "default" })}>
            Revert to Default
          </Button>
        )}
      </div>

      {/* Add New Key Form */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-sm font-medium">Add or Update Provider Key</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Provider</label>
            <Select value={selectedProvider} onValueChange={handleProviderChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_TIERS.map((tier) => (
                  <SelectGroup key={tier.label}>
                    <SelectLabel>{tier.label}</SelectLabel>
                    {tier.keys.map((key) => {
                      const p = AI_PROVIDERS[key];
                      return p ? <SelectItem key={key} value={key}>{p.label}</SelectItem> : null;
                    })}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Model Context</label>
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_PROVIDERS[selectedProvider]?.models.map((m) => (
                  <SelectItem key={m.id} value={m.id} disabled={m.available === false}>
                    <div className="flex items-center justify-between w-full">
                      <span>{m.label}</span>
                      {m.coming_soon && <span className="text-[10px] uppercase bg-muted px-1.5 py-0.5 rounded ml-2">Soon</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block flex justify-between">
            API Key
            <a href={AI_PROVIDERS[selectedProvider]?.keyUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">Get Key</a>
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                placeholder={AI_PROVIDERS[selectedProvider]?.keyPlaceholder || "Paste API key..."}
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button onClick={handleSave} disabled={!apiKeyInput || isSaving} className="w-32">
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : "Validate & Save"}
            </Button>
          </div>
        </div>
      </div>

      {/* Saved Keys List */}
      {savedProviderKeys.length > 0 && (
        <div className="mt-6 pt-4 border-t space-y-3">
          <h3 className="text-sm font-medium">Saved Providers</h3>
          {savedProviderKeys.map((provKey) => {
            const state = getProviderState(provKey);
            if (!state) return null;
            const pDef = AI_PROVIDERS[provKey];
            const isActive = activeConfig.provider === provKey;

            return (
              <div key={provKey} className="flex items-center justify-between p-3 border rounded-lg bg-card text-sm">
                <div className="flex items-center gap-3">
                  <Key className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{pDef?.label || provKey} <span className="text-muted-foreground text-xs font-normal font-mono ml-2">{state.key_masked}</span></p>
                    <div className="flex items-center gap-2 text-xs mt-0.5">
                      {state.status === "valid" ? (
                        <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Valid</span>
                      ) : (
                        <span className="text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {state.status === "expired" ? "Expired" : "Invalid"}</span>
                      )}
                      <span className="text-muted-foreground">• Default model: {pDef?.models.find((m) => m.id === state.preferred_model)?.label || state.preferred_model}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isActive && state.status === "valid" && (
                    <Button variant="outline" size="sm" onClick={() => setActiveProvider({ provider: provKey, model: state.preferred_model || "" })}>
                      Use this key
                    </Button>
                  )}
                  {isActive && <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded font-medium mr-2">ACTIVE</span>}
                  <Button variant="ghost" size="icon" onClick={() => clearKey(provKey)} title="Delete key">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Fallback Behavior */}
      <div className="mt-6 pt-4 border-t">
        <label className="text-xs font-medium text-muted-foreground mb-2 block flex items-center gap-1.5 border-none">
          <Cpu className="w-3.5 h-3.5" /> Key Failure Behavior
        </label>
        <Select value={fallbackBehavior} onValueChange={(val) => setFallbackBehavior(val)}>
          <SelectTrigger className="w-full sm:w-64 border-none shadow-none focus:ring-0 px-0 h-8 font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="use_default">Fallback to Gemini 3 Flash automatically</SelectItem>
            <SelectItem value="fail_gracefully">Fail generation with an error</SelectItem>
            <SelectItem value="queue_retry">Retry with default (Queue mode)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 flex items-start gap-2 bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground">
        <Lock className="w-4 h-4 shrink-0 mt-0.5" />
        <p>Keys are encrypted at-rest using AES-256 and never logged or made completely visible. Usage is billed directly to your provider account; RocketBoard incurs no generation costs when utilizing your configuration.</p>
      </div>
    </div>
  );
}
