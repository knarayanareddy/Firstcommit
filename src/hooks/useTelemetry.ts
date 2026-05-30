import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";

export function useTelemetry(moduleKey: string, sectionId?: string) {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const startTime = useRef<number>(Date.now());
  const maxScroll = useRef<number>(0);

  useEffect(() => {
    // Reset on mount/change
    startTime.current = Date.now();
    maxScroll.current = 0;

    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight > 0) {
        const depth = (window.scrollY / scrollHeight) * 100;
        if (depth > maxScroll.current) {
          maxScroll.current = depth;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      
      // Flush telemetry on unmount
      const timeSpent = Math.floor((Date.now() - startTime.current) / 1000);
      if (timeSpent > 5 && user && currentPackId) { // Only log if > 5 seconds
        (supabase.from("module_telemetry" as any) as any).insert({
          user_id: user.id,
          pack_id: currentPackId,
          module_key: moduleKey,
          section_id: sectionId || null,
          time_spent_seconds: timeSpent,
          scroll_depth_percent: Math.round(maxScroll.current),
        }).then(({ error }: any) => {
          if (error) console.error("Telemetry error:", error);
        });
      }
    };
  }, [moduleKey, sectionId, user, currentPackId]);

  const logHelpRequest = async () => {
    if (!user || !currentPackId) return;
    await (supabase.from("module_telemetry" as any) as any).insert({
      user_id: user.id,
      pack_id: currentPackId,
      module_key: moduleKey,
      section_id: sectionId || null,
      time_spent_seconds: Math.floor((Date.now() - startTime.current) / 1000),
      scroll_depth_percent: Math.round(maxScroll.current),
      help_requested: true,
    });
  };

  return { logHelpRequest };
}
