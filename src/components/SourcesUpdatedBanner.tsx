import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSources } from "@/hooks/useSources";
import { useGeneratedModules } from "@/hooks/useGeneratedModules";
import { usePack } from "@/hooks/usePack";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function SourcesUpdatedBanner() {
  const navigate = useNavigate();
  const { currentPackId } = usePack();
  const { hasPackPermission } = useRole();
  const { sources } = useSources();
  const { modules } = useGeneratedModules();

  const storageKey = `dismiss_sources_banner_${currentPackId}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(storageKey) === "true"; } catch { return false; }
  });

  const isOutdated = useMemo(() => {
    if (!sources.length || !modules.length) return false;
    const syncedSources = sources.filter((s: any) => s.last_synced_at);
    if (syncedSources.length === 0) return false;
    const latestSync = Math.max(...syncedSources.map((s: any) => new Date(s.last_synced_at).getTime()));
    if (!latestSync) return false;
    const latestGen = Math.max(...modules.map(m => new Date(m.created_at).getTime()));
    return latestSync > latestGen;
  }, [sources, modules]);

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(storageKey, "true"); } catch {}
  };

  if (!isOutdated || dismissed || !hasPackPermission("author")) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="mb-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-3"
      >
        <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Sources have been updated since content was last generated</p>
          <p className="text-xs text-muted-foreground mt-0.5">Some content may be outdated.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm" variant="outline"
            onClick={() => navigate(`/packs/${currentPackId}/plan`)}
            className="text-xs"
          >
            Regenerate
          </Button>
          <button onClick={handleDismiss} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
