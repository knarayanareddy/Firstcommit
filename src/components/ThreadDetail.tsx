import { useState } from "react";
import { DiscussionThread, useDiscussionReplies, useDiscussions, ThreadType } from "@/hooks/useDiscussions";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, ThumbsUp, CheckCircle2, HelpCircle, Lightbulb, AlertCircle, MessageCircle, Pin, Trash2 } from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { SaveAsFaqDialog } from "@/components/SaveAsFaqDialog";
import { trackQuestionSuggestion } from "@/hooks/useFaqSuggestions";

const TYPE_META: Record<ThreadType, { icon: typeof MessageCircle; label: string; color: string }> = {
  discussion: { icon: MessageCircle, label: "Discussion", color: "text-muted-foreground" },
  question: { icon: HelpCircle, label: "Question", color: "text-blue-500" },
  tip: { icon: Lightbulb, label: "Tip", color: "text-amber-500" },
  issue: { icon: AlertCircle, label: "Issue", color: "text-red-500" },
};

interface ThreadDetailProps {
  thread: DiscussionThread;
  onBack: () => void;
}

export function ThreadDetail({ thread, onBack }: ThreadDetailProps) {
  const { user } = useAuth();
  const { hasPackPermission } = useRole();
  const { toggleUpvote, hasUpvoted, updateThread, deleteThread } = useDiscussions();
  const { replies, repliesLoading, createReply, markAccepted } = useDiscussionReplies(thread.id);
  const [replyContent, setReplyContent] = useState("");
  const [faqDialogOpen, setFaqDialogOpen] = useState(false);

  const TypeIcon = TYPE_META[thread.thread_type].icon;
  const threadUpvoted = hasUpvoted("thread", thread.id);
  const isAuthor = thread.author_id === user?.id;
  const canResolve = isAuthor || hasPackPermission("author");

  const handlePostReply = () => {
    if (!replyContent.trim()) return;
    createReply.mutate({ content: replyContent }, { onSuccess: () => setReplyContent("") });
  };

  const handleDelete = () => {
    if (confirm("Delete this discussion?")) {
      deleteThread.mutate(thread.id, { onSuccess: onBack });
    }
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to discussions
      </button>

      {/* Thread */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-start gap-3">
          <TypeIcon className={`w-6 h-6 mt-0.5 ${TYPE_META[thread.thread_type].color}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {thread.is_pinned && <Pin className="w-4 h-4 text-primary fill-primary" />}
              <h1 className="text-xl font-semibold text-card-foreground">{thread.title}</h1>
              {thread.is_resolved && (
                <Badge variant="outline" className="gap-1 text-green-500 border-green-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <Avatar className="h-5 w-5">
                <AvatarImage src={thread.author_avatar} />
                <AvatarFallback className="text-[10px]">{(thread.author_name ?? "L")[0]}</AvatarFallback>
              </Avatar>
              <span>{thread.author_name}</span>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}</span>
              {thread.module_key && (
                <>
                  <span>•</span>
                  <span>Module: {thread.module_key}</span>
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => toggleUpvote.mutate({ targetType: "thread", targetId: thread.id })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              threadUpvoted ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"
            }`}
          >
            <ThumbsUp className={`w-4 h-4 ${threadUpvoted ? "fill-primary" : ""}`} />
            {thread.upvote_count}
          </button>
        </div>

        <div className="mt-4 prose prose-sm max-w-none dark:prose-invert">
          <MarkdownRenderer>{thread.content}</MarkdownRenderer>
        </div>

        {(isAuthor || hasPackPermission("admin")) && (
          <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
            {hasPackPermission("author") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateThread.mutate({ threadId: thread.id, updates: { is_pinned: !thread.is_pinned } })}
              >
                <Pin className={`w-3.5 h-3.5 mr-1.5 ${thread.is_pinned ? "fill-primary text-primary" : ""}`} />
                {thread.is_pinned ? "Unpin" : "Pin"}
              </Button>
            )}
            {(isAuthor || hasPackPermission("admin")) && (
              <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive hover:bg-destructive/10">
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
              </Button>
            )}
          </div>
        )}

        {/* FAQ Conversion (Resolved Questions) */}
        {thread.thread_type === "question" && thread.is_resolved && canResolve && (
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between bg-muted/40 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <div className="text-sm">
                <span className="font-medium text-foreground">Good answer?</span>
                <span className="text-muted-foreground ml-1">Convert this to a reusable FAQ entry.</span>
              </div>
            </div>
            <Button size="sm" className="gradient-primary border-0 shadow-sm" onClick={() => setFaqDialogOpen(true)}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Convert to FAQ
            </Button>
          </div>
        )}
      </div>

      {/* Replies */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          Replies ({replies.length})
        </h3>

        {repliesLoading ? (
          <div className="text-center py-6 text-muted-foreground">Loading replies...</div>
        ) : replies.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">No replies yet. Be the first!</div>
        ) : (
          <div className="space-y-3">
            {replies.map((reply, i) => {
              const upvoted = hasUpvoted("reply", reply.id);
              const isReplyAuthor = reply.author_id === user?.id;
              return (
                <motion.div
                  key={reply.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`bg-card border rounded-lg p-4 ${
                    reply.is_accepted_answer ? "border-green-500/30 bg-green-500/5" : "border-border"
                  }`}
                >
                  {reply.is_accepted_answer && (
                    <Badge variant="outline" className="mb-2 gap-1 text-green-500 border-green-500/30">
                      <CheckCircle2 className="w-3 h-3" /> Accepted Answer
                    </Badge>
                  )}
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={reply.author_avatar} />
                      <AvatarFallback className="text-xs">{(reply.author_name ?? "L")[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-card-foreground">{reply.author_name}</span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-muted-foreground text-xs">
                          {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="mt-2 prose prose-sm max-w-none dark:prose-invert">
                        <MarkdownRenderer>{reply.content}</MarkdownRenderer>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => toggleUpvote.mutate({ targetType: "reply", targetId: reply.id })}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                            upvoted ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          <ThumbsUp className={`w-3 h-3 ${upvoted ? "fill-primary" : ""}`} />
                          {reply.upvote_count}
                        </button>
                        {canResolve && thread.thread_type === "question" && !reply.is_accepted_answer && (
                          <button
                            onClick={() => markAccepted.mutate(reply.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:bg-muted transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Accept Answer
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Reply form */}
        <div className="bg-card border border-border rounded-lg p-4">
          <Textarea
            placeholder="Write a reply... (supports markdown)"
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end mt-3">
            <Button onClick={handlePostReply} disabled={!replyContent.trim() || createReply.isPending}>
              {createReply.isPending ? "Posting..." : "Post Reply"}
            </Button>
          </div>
        </div>
      </div>

      <SaveAsFaqDialog
        open={faqDialogOpen}
        onClose={() => setFaqDialogOpen(false)}
        initialQuestion={thread.title}
        initialAnswer={replies.find((r) => r.is_accepted_answer)?.content ?? ""}
        source="discussion"
      />
    </div>
  );
}
