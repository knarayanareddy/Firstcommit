import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PackId, asPackId } from "@/types/brands";

export const DEFAULT_PACK_ID = "00000000-0000-0000-0000-000000000002" as PackId;

export interface Pack {
  id: PackId;
  org_id: string;
  title: string;
  description: string | null;
  language_mode: string;
  pack_version: number;
  roadmap_enabled: boolean | null;
  created_at: string;
  updated_at: string;
}

interface PackContextType {
  currentPack: Pack | null;
  currentPackId: PackId;
  setPack: (pack: Pack) => void;
  loading: boolean;
}

const PackContext = createContext<PackContextType>({
  currentPack: null,
  currentPackId: DEFAULT_PACK_ID,
  setPack: () => {},
  loading: true,
});

export function PackProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentPack, setCurrentPack] = useState<Pack | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCurrentPack(null);
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);

      // Try to restore last selected pack from localStorage
      const savedPackId = localStorage.getItem("rocketboard_current_pack");

      if (savedPackId) {
        const { data: pack } = await supabase
          .from("packs")
          .select("*")
          .eq("id", savedPackId)
          .maybeSingle();

        if (pack) {
          setCurrentPack(pack as any as Pack);
          setLoading(false);
          return;
        }
      }

      // Fallback: load user's first pack membership
      const { data: memberships } = await supabase
        .from("pack_members")
        .select("pack_id")
        .eq("user_id", user.id)
        .limit(1);

      if (memberships && memberships.length > 0) {
        const { data: pack } = await supabase
          .from("packs")
          .select("*")
          .eq("id", memberships[0].pack_id)
          .maybeSingle();

        if (pack) {
          setCurrentPack(pack as any as Pack);
          localStorage.setItem("rocketboard_current_pack", pack.id);
        }
      }

      setLoading(false);
    })();
  }, [user]);

  const setPack = (pack: Pack) => {
    setCurrentPack(pack);
    localStorage.setItem("rocketboard_current_pack", pack.id);
  };

  return (
    <PackContext.Provider
      value={{
        currentPack,
        currentPackId: currentPack?.id || DEFAULT_PACK_ID,
        setPack,
        loading,
      }}
    >
      {children}
    </PackContext.Provider>
  );
}

/**
 * Hook to get the current pack context.
 * Returns context only; usePackFromUrl syncs URL pack id.
 */
export function usePack() {
  const ctx = useContext(PackContext);
  return ctx;
}

/**
 * Hook to read :packId from URL and sync with PackContext.
 * Call this from components inside pack-scoped routes.
 */
export function usePackFromUrl() {
  const params = useParams<{ packId: string }>();
  const ctx = useContext(PackContext);

  useEffect(() => {
    if (params.packId && params.packId !== ctx.currentPack?.id) {
      // Load the pack from URL if it doesn't match current
      supabase
        .from("packs")
        .select("*")
        .eq("id", params.packId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) ctx.setPack(data as any as Pack);
        });
    }
  }, [params.packId]);

  return {
    ...ctx,
    packIdFromUrl: params.packId as PackId | undefined,
  };
}
