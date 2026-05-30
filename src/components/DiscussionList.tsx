import { useState } from "react";
import { useDiscussions, ThreadType, DiscussionThread, ThreadFilters } from "@/hooks/useDiscussions";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, MessageSquarePlus, ThumbsUp, Pin, CheckCircle2, HelpCircle, Lightbulb, AlertCircle, Filter } from "lucide-react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

const TYPE_META: Record<ThreadType, { icon: typeof MessageCircle; label: string; color: string }> = {
  discussion: { icon: MessageCircle, label: "Discussion", color: "text-muted-foreground" },
  question: { icon: HelpCircle, label: "Question", color: "text-blue-500" },
  tip: { icon: Lightbulb, label: "Tip", color: "text-amber-500" },
  issue: { icon: AlertCircle, label: "Issue", color: "text-red-500" },
};

interface DiscussionListProps {
  moduleKey?: string;
  sectionId?: string;
  onSelectThread?: (thread: DiscussionThread) => void;
}

export function DiscussionList({ moduleKey, sectionId, onSelectThread }: DiscussionListProps) {
  const { user } = useAuth();
  const { hasPackPermission } = useRole();
  const [filters, setFilters] = useState<ThreadFilters>({ moduleKey, sectionId });
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<ThreadType>("discussion");

  const { threads, threadsLoading, createThread, toggleUpvote, hasUpvoted, updateThread } = useDiscussions(filters);

  const pinnedThreads = threads.filter((t) => t.is_pinned);
  const regularThreads = threads.filter((t) => !t.is_pinned);

  const handleCreate = () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    createThread.mutate(
      { moduleKey, sectionId, title: newTitle, content: newContent, threadType: newType },
      { onSuccess: () => { setNewDialogOpen(false); setNewTitle(""); setNewContent(""); setNewType("discussion"); } }
    );
  };

  const handlePin = (thread: DiscussionThread) => {
    updateThread.mutate({ threadId: thread.id, updates: { is_pinned: !thread.is_pinned } });
  };

  const ThreadCard = ({ thread, index }: { thread: DiscussionThread; index: number }) => {
    const TypeIcon = TYPE_META[thread.thread_type].icon;
    const upvoted = hasUpvoted("thread", thread.id);
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.03 }}
        className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-all cursor-pointer"
        onClick={() => onSelectThread?.(thread)}
      >
        <div className="flex items-start gap-3">
          <TypeIcon className={`w-5 h-5 mt-0.5 shrink-0 ${TYPE_META[thread.thread_type].color}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {thread.is_pinned && <Pin className="w-3.5 h-3.5 text-primary" />}
              <span className="font-medium text-card-foreground">{thread.title}</span>
              {thread.is_resolved && (
                <Badge variant="outline" className="text-[10px] gap-1 text-green-500 border-green-500/30">
                  <CheckCircle2 className="w-3 h-3" /> Resolved
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{thread.content}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Avatar className="h-4 w-4">
                  <AvatarImage src={thread.author_avatar} />
                  <AvatarFallback className="text-[8px]">{(thread.author_name ?? "L")[0]}</AvatarFallback>
                </Avatar>
                <span>{thread.author_name}</span>
              </div>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}</span>
              <span>•</span>
              <span>{thread.reply_count} {thread.reply_count === 1 ? "reply" : "replies"}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); toggleUpvote.mutate({ targetType: "thread", targetId: thread.id }); }}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                upvoted ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"
              }`}
            >
              <ThumbsUp className={`w-3.5 h-3.5 ${upvoted ? "fill-primary" : ""}`} />
              {thread.upvote_count}
            </button>
            {hasPackPermission("author") && (
              <button
                onClick={(e) => { e.stopPropagation(); handlePin(thread); }}
                className={`p-1.5 rounded hover:bg-muted transition-colors ${thread.is_pinned ? "text-primary" : "text-muted-foreground"}`}
              >
                <Pin className={`w-3.5 h-3.5 ${thread.is_pinned ? "fill-primary" : ""}`} />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setNewDialogOpen(true)} className="gap-1.5">
            <MessageSquarePlus className="w-4 h-4" /> New Discussion
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={filters.threadType ?? "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, threadType: v === "all" ? null : v as ThreadType }))}
          >
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <Filter className="w-3 h-3 mr-1" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="discussion">Discussions</SelectItem>
              <SelectItem value="question">Questions</SelectItem>
              <SelectItem value="tip">Tips</SelectItem>
              <SelectItem value="issue">Issues</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.sortBy ?? "recent"}
            onValueChange={(v) => setFilters((f) => ({ ...f, sortBy: v as any }))}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="upvotes">Most Upvoted</SelectItem>
              <SelectItem value="unresolved">Unresolved Qs</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Threads */}
      {threadsLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading discussions...</div>
      ) : threads.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No discussions yet. Start one!</p>
        </div>
      ) : (
        <>
          {pinnedThreads.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Pin className="w-3 h-3" /> Pinned
              </h4>
              {pinnedThreads.map((t, i) => <ThreadCard key={t.id} thread={t} index={i} />)}
            </div>
          )}
          {regularThreads.length > 0 && (
            <div className="space-y-2">
              {pinnedThreads.length > 0 && (
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mt-4">Recent</h4>
              )}
              {regularThreads.map((t, i) => <ThreadCard key={t.id} thread={t} index={i} />)}
            </div>
          )}
        </>
      )}

      {/* New Discussion Dialog */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Discussion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex gap-2">
              {(Object.keys(TYPE_META) as ThreadType[]).map((t) => {
                const Icon = TYPE_META[t].icon;
                return (
                  <button
                    key={t}
                    onClick={() => setNewType(t)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      newType === t ? "bg-primary/10 text-primary border border-primary/30" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {TYPE_META[t].label}
                  </button>
                );
              })}
            </div>
            <Input
              placeholder="Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <Textarea
              placeholder="Write your discussion... (supports markdown)"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={5}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setNewDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={!newTitle.trim() || !newContent.trim() || createThread.isPending}>
                {createThread.isPending ? "Posting..." : "Post Discussion"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
