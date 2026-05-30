import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { toast } from "sonner";

export type BookmarkType =
  | "module_section"
  | "glossary_term"
  | "path_step"
  | "ask_lead_question"
  | "exercise"
  | "code_snippet"
  | "chat_message"
  | "faq"
  | "custom";

export interface Bookmark {
  id: string;
  user_id: string;
  pack_id: string;
  bookmark_type: BookmarkType;
  reference_key: string;
  label: string | null;
  subtitle: string | null;
  preview_text: string | null;
  collection_id: string | null;
  tags: string[];
  is_pinned: boolean;
  created_at: string;
}

export interface BookmarkCollection {
  id: string;
  user_id: string;
  pack_id: string;
  name: string;
  icon: string;
  sort_order: number;
  created_at: string;
}

export function useBookmarks() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const qc = useQueryClient();
  const qk = ["bookmarks", user?.id, currentPackId];
  const ck = ["bookmark_collections", user?.id, currentPackId];

  const bookmarks = useQuery({
    queryKey: qk,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookmarks")
        .select("*")
        .eq("user_id", user!.id)
        .eq("pack_id", currentPackId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Bookmark[];
    },
    enabled: !!user && !!currentPackId,
  });

  const collections = useQuery({
    queryKey: ck,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookmark_collections")
        .select("*")
        .eq("user_id", user!.id)
        .eq("pack_id", currentPackId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as BookmarkCollection[];
    },
    enabled: !!user && !!currentPackId,
  });

  const toggleBookmark = useMutation({
    mutationFn: async (params: {
      type: BookmarkType;
      referenceKey: string;
      label?: string;
      subtitle?: string;
      previewText?: string;
      collectionId?: string;
      tags?: string[];
    }) => {
      const existing = (bookmarks.data ?? []).find(
        (b) => b.bookmark_type === params.type && b.reference_key === params.referenceKey
      );
      if (existing) {
        const { error } = await supabase.from("bookmarks").delete().eq("id", existing.id);
        if (error) throw error;
        return { action: "removed" as const };
      } else {
        const { error } = await supabase.from("bookmarks").insert({
          user_id: user!.id,
          pack_id: currentPackId!,
          bookmark_type: params.type,
          reference_key: params.referenceKey,
          label: params.label ?? null,
          subtitle: params.subtitle ?? null,
          preview_text: params.previewText ?? null,
          collection_id: params.collectionId ?? null,
          tags: params.tags ?? [],
        } as any);
        if (error) throw error;
        return { action: "saved" as const };
      }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: qk });
      toast.success(result.action === "saved" ? "Saved!" : "Removed from saved items");
    },
  });

  const removeBookmark = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bookmarks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
    },
  });

  const bulkRemove = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("bookmarks").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      toast.success("Removed selected items");
    },
  });

  const moveToCollection = useMutation({
    mutationFn: async ({ bookmarkIds, collectionId }: { bookmarkIds: string[]; collectionId: string | null }) => {
      for (const id of bookmarkIds) {
        const { error } = await supabase
          .from("bookmarks")
          .update({ collection_id: collectionId } as any)
          .eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
      toast.success("Moved to collection");
    },
  });

  const togglePin = useMutation({
    mutationFn: async (bookmarkId: string) => {
      const bm = (bookmarks.data ?? []).find((b) => b.id === bookmarkId);
      if (!bm) throw new Error("Bookmark not found");
      const { error } = await supabase
        .from("bookmarks")
        .update({ is_pinned: !bm.is_pinned } as any)
        .eq("id", bookmarkId);
      if (error) throw error;
      return !bm.is_pinned;
    },
    onSuccess: (pinned) => {
      qc.invalidateQueries({ queryKey: qk });
      toast.success(pinned ? "Pinned to dashboard" : "Unpinned");
    },
  });

  const addTags = useMutation({
    mutationFn: async ({ bookmarkId, tags }: { bookmarkId: string; tags: string[] }) => {
      const bm = (bookmarks.data ?? []).find((b) => b.id === bookmarkId);
      const existingTags = bm?.tags ?? [];
      const merged = [...new Set([...existingTags, ...tags])];
      const { error } = await supabase
        .from("bookmarks")
        .update({ tags: merged } as any)
        .eq("id", bookmarkId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk });
    },
  });

  // Collections
  const createCollection = useMutation({
    mutationFn: async ({ name, icon }: { name: string; icon?: string }) => {
      const { data, error } = await supabase
        .from("bookmark_collections")
        .insert({
          user_id: user!.id,
          pack_id: currentPackId!,
          name,
          icon: icon ?? "📁",
          sort_order: (collections.data ?? []).length,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as BookmarkCollection;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ck });
      toast.success("Collection created");
    },
  });

  const renameCollection = useMutation({
    mutationFn: async ({ id, name, icon }: { id: string; name?: string; icon?: string }) => {
      const update: any = {};
      if (name !== undefined) update.name = name;
      if (icon !== undefined) update.icon = icon;
      const { error } = await supabase.from("bookmark_collections").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ck });
    },
  });

  const deleteCollection = useMutation({
    mutationFn: async (id: string) => {
      // Move bookmarks to uncategorized first (collection_id ON DELETE SET NULL handles this)
      const { error } = await supabase.from("bookmark_collections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ck });
      qc.invalidateQueries({ queryKey: qk });
      toast.success("Collection deleted");
    },
  });

  const isBookmarked = (type: BookmarkType, referenceKey: string) =>
    (bookmarks.data ?? []).some((b) => b.bookmark_type === type && b.reference_key === referenceKey);

  const getBookmark = (type: BookmarkType, referenceKey: string) =>
    (bookmarks.data ?? []).find((b) => b.bookmark_type === type && b.reference_key === referenceKey);

  const pinnedBookmarks = (bookmarks.data ?? []).filter((b) => b.is_pinned).slice(0, 5);

  const allTags = [...new Set((bookmarks.data ?? []).flatMap((b) => b.tags ?? []))].sort();

  return {
    bookmarks: bookmarks.data ?? [],
    isLoading: bookmarks.isLoading,
    collections: collections.data ?? [],
    collectionsLoading: collections.isLoading,
    toggleBookmark,
    removeBookmark,
    bulkRemove,
    moveToCollection,
    togglePin,
    addTags,
    createCollection,
    renameCollection,
    deleteCollection,
    isBookmarked,
    getBookmark,
    pinnedBookmarks,
    allTags,
  };
}
