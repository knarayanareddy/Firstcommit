import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { toast } from "sonner";
import { useEffect } from "react";

export type ThreadType = "discussion" | "question" | "tip" | "issue";

export interface DiscussionThread {
  id: string;
  pack_id: string;
  module_key: string | null;
  section_id: string | null;
  author_id: string;
  title: string;
  content: string;
  thread_type: ThreadType;
  is_pinned: boolean;
  is_resolved: boolean;
  upvote_count: number;
  reply_count: number;
  created_at: string;
  updated_at: string;
  author_name?: string;
  author_avatar?: string;
}

export interface DiscussionReply {
  id: string;
  thread_id: string;
  author_id: string;
  content: string;
  is_accepted_answer: boolean;
  upvote_count: number;
  created_at: string;
  author_name?: string;
  author_avatar?: string;
}

export interface ThreadFilters {
  moduleKey?: string | null;
  sectionId?: string | null;
  threadType?: ThreadType | null;
  resolved?: boolean | null;
  sortBy?: "recent" | "upvotes" | "unresolved";
}

export function useDiscussions(filters?: ThreadFilters) {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const qc = useQueryClient();

  const threadsKey = ["discussion_threads", currentPackId, filters?.moduleKey, filters?.threadType, filters?.resolved, filters?.sortBy];

  const threadsQuery = useQuery({
    queryKey: threadsKey,
    queryFn: async () => {
      let query = supabase
        .from("discussion_threads")
        .select("*")
        .eq("pack_id", currentPackId!);

      if (filters?.moduleKey) query = query.eq("module_key", filters.moduleKey);
      if (filters?.moduleKey === null) query = query.is("module_key", null);
      if (filters?.sectionId) query = query.eq("section_id", filters.sectionId);
      if (filters?.threadType) query = query.eq("thread_type", filters.threadType);
      if (filters?.resolved === true) query = query.eq("is_resolved", true);
      if (filters?.resolved === false) query = query.eq("is_resolved", false);

      if (filters?.sortBy === "upvotes") {
        query = query.order("upvote_count", { ascending: false });
      } else if (filters?.sortBy === "unresolved") {
        query = query.eq("thread_type", "question").eq("is_resolved", false).order("created_at", { ascending: false });
      } else {
        query = query.order("is_pinned", { ascending: false }).order("created_at", { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch author profiles
      const authorIds = [...new Set((data ?? []).map((t: any) => t.author_id))];
      const { data: profiles } = authorIds.length > 0
        ? await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", authorIds)
        : { data: [] };
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

      return (data ?? []).map((t: any): DiscussionThread => {
        const profile = profileMap.get(t.author_id);
        return {
          ...t,
          author_name: profile?.display_name ?? "Learner",
          author_avatar: profile?.avatar_url ?? null,
        };
      });
    },
    enabled: !!currentPackId,
  });

  // Realtime subscription for new threads
  useEffect(() => {
    if (!currentPackId) return;
    const channel = supabase
      .channel(`threads-${currentPackId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "discussion_threads",
        filter: `pack_id=eq.${currentPackId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: threadsKey });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentPackId]);

  const createThread = useMutation({
    mutationFn: async ({ moduleKey, sectionId, title, content, threadType }: {
      moduleKey?: string; sectionId?: string; title: string; content: string; threadType: ThreadType;
    }) => {
      const { data, error } = await supabase
        .from("discussion_threads")
        .insert({
          pack_id: currentPackId!,
          module_key: moduleKey ?? null,
          section_id: sectionId ?? null,
          author_id: user!.id,
          title,
          content,
          thread_type: threadType,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["discussion_threads"] });
      toast.success("Discussion posted");
      if (variables.threadType === "question") {
        import("@/hooks/useFaqSuggestions").then(({ trackQuestionSuggestion }) => {
          trackQuestionSuggestion(currentPackId!, variables.title);
        });
      }
    },
  });

  const updateThread = useMutation({
    mutationFn: async ({ threadId, updates }: {
      threadId: string; updates: Partial<{ title: string; content: string; is_pinned: boolean; is_resolved: boolean }>;
    }) => {
      const { error } = await supabase
        .from("discussion_threads")
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq("id", threadId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discussion_threads"] });
    },
  });

  const deleteThread = useMutation({
    mutationFn: async (threadId: string) => {
      const { error } = await supabase.from("discussion_threads").delete().eq("id", threadId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["discussion_threads"] });
      toast.success("Discussion deleted");
    },
  });

  // Upvotes
  const myUpvotesQuery = useQuery({
    queryKey: ["my_upvotes", user?.id, currentPackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discussion_upvotes")
        .select("target_type, target_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((u: any) => `${u.target_type}:${u.target_id}`));
    },
    enabled: !!user,
  });

  const toggleUpvote = useMutation({
    mutationFn: async ({ targetType, targetId }: { targetType: "thread" | "reply"; targetId: string }) => {
      const key = `${targetType}:${targetId}`;
      const hasUpvoted = myUpvotesQuery.data?.has(key);

      if (hasUpvoted) {
        const { error } = await supabase
          .from("discussion_upvotes")
          .delete()
          .eq("user_id", user!.id)
          .eq("target_type", targetType)
          .eq("target_id", targetId);
        if (error) throw error;
        // Atomic decrement via RPC
        if (targetType === "thread") {
          await supabase.rpc("decrement_thread_upvote", { thread_id: targetId });
        } else {
          await supabase.rpc("decrement_reply_upvote", { reply_id: targetId });
        }
        return { action: "removed" as const };
      } else {
        const { error } = await supabase
          .from("discussion_upvotes")
          .insert({ user_id: user!.id, target_type: targetType, target_id: targetId } as any);
        if (error) throw error;
        // Atomic increment via RPC
        if (targetType === "thread") {
          await supabase.rpc("increment_thread_upvote", { thread_id: targetId });
        } else {
          await supabase.rpc("increment_reply_upvote", { reply_id: targetId });
        }
        return { action: "added" as const };
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my_upvotes"] });
      qc.invalidateQueries({ queryKey: ["discussion_threads"] });
      qc.invalidateQueries({ queryKey: ["discussion_replies"] });
    },
  });

  const hasUpvoted = (targetType: "thread" | "reply", targetId: string) =>
    myUpvotesQuery.data?.has(`${targetType}:${targetId}`) ?? false;

  return {
    threads: threadsQuery.data ?? [],
    threadsLoading: threadsQuery.isLoading,
    createThread,
    updateThread,
    deleteThread,
    toggleUpvote,
    hasUpvoted,
  };
}

// Separate hook for replies to a specific thread
export function useDiscussionReplies(threadId: string | null, threadAuthorId?: string, threadTitle?: string) {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const qc = useQueryClient();

  const repliesKey = ["discussion_replies", threadId];

  const repliesQuery = useQuery({
    queryKey: repliesKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discussion_replies")
        .select("*")
        .eq("thread_id", threadId!)
        .order("is_accepted_answer", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;

      const authorIds = [...new Set((data ?? []).map((r: any) => r.author_id))];
      const { data: profiles } = authorIds.length > 0
        ? await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", authorIds)
        : { data: [] };
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));

      return (data ?? []).map((r: any): DiscussionReply => ({
        ...r,
        author_name: profileMap.get(r.author_id)?.display_name ?? "Learner",
        author_avatar: profileMap.get(r.author_id)?.avatar_url ?? null,
      }));
    },
    enabled: !!threadId,
  });

  // Realtime for replies
  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`replies-${threadId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "discussion_replies",
        filter: `thread_id=eq.${threadId}`,
      }, () => {
        qc.invalidateQueries({ queryKey: repliesKey });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId]);

  const createReply = useMutation({
    mutationFn: async ({ content }: { content: string }) => {
      const { data, error } = await supabase
        .from("discussion_replies")
        .insert({
          thread_id: threadId!,
          author_id: user!.id,
          content,
        } as any)
        .select()
        .single();
      if (error) throw error;
      // Atomic increment via RPC
      await supabase.rpc("increment_thread_reply_count", { thread_id: threadId! });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: repliesKey });
      qc.invalidateQueries({ queryKey: ["discussion_threads"] });
      toast.success("Reply posted");
    },
  });

  const markAccepted = useMutation({
    mutationFn: async (replyId: string) => {
      // Unmark all other accepted answers for this thread
      await supabase
        .from("discussion_replies")
        .update({ is_accepted_answer: false } as any)
        .eq("thread_id", threadId!);
      // Mark this one
      const { error } = await supabase
        .from("discussion_replies")
        .update({ is_accepted_answer: true } as any)
        .eq("id", replyId);
      if (error) throw error;
      // Mark thread as resolved
      await supabase
        .from("discussion_threads")
        .update({ is_resolved: true } as any)
        .eq("id", threadId!);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: repliesKey });
      qc.invalidateQueries({ queryKey: ["discussion_threads"] });
      toast.success("Answer accepted");
    },
  });

  return {
    replies: repliesQuery.data ?? [],
    repliesLoading: repliesQuery.isLoading,
    createReply,
    markAccepted,
  };
}
