import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, Send, X, Bot, User, Loader2, Trash2, AlertTriangle, ExternalLink, Rocket, ChevronDown, ChevronUp, Flag, BookOpen } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion, AnimatePresence } from "framer-motion";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { AIErrorDisplay } from "@/components/AIErrorDisplay";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { useRole } from "@/hooks/useRole";
import { sendAITask, AIError } from "@/lib/ai-client";
import { buildChatEnvelope } from "@/lib/envelope-builder";
import { fetchEvidenceSpans } from "@/lib/fetch-spans";
import { normalizeChunkRef } from "@/types/evidence";
import { ChatReportDialog } from "@/components/ChatReportDialog";
import { useNavigate } from "react-router-dom";
import { CitationBadge } from "@/components/CitationBadge";
import type { AIErrorCode } from "@/lib/ai-errors";
import { PackId, ChunkPK, StableChunkId, ChunkRef, asPackId } from "@/types/brands";

export interface ReferencedSection {
  module_key: string;
  section_id: string;
  section_heading: string;
  reason: string;
}

export interface ChatResponse {
  display_response: string;
  canonical_response: string;
  source_map: { 
    badge: string; 
    filepath: string; 
    start: number; 
    end: number; 
    chunk_ref?: ChunkRef | string;
    chunk_pk?: ChunkPK | string;
    stable_chunk_id?: StableChunkId | string | null;
    chunk_id?: string; // Legacy
  }[];
  referenced_sections?: ReferencedSection[];
  unverified_claims?: { claim: string; reason: string }[];
  contradictions?: { description: string }[];
  suggested_search_queries?: string[];
  warnings?: string[];
  trace_id?: string;
  metrics?: {
    claims_total: number;
    claims_stripped: number;
    strip_rate: number;
    snippets_resolved: number;
  };
}

type Msg = { role: "user" | "assistant"; content: string; response?: ChatResponse };

interface ModuleContext {
  title: string;
  description: string;
  keyTakeaways: string[];
  sections: { title: string; content: string }[];
}

interface ModuleChatPanelProps {
  moduleId: string;
  moduleContext: ModuleContext;
  openRequest?: { requestId: string; prefill?: string } | null;
  onOpenChange?: (open: boolean) => void;
  onAssistantError?: (err: { code: AIErrorCode; message: string }) => void;
}

async function saveMessage(userId: string, moduleId: string, role: string, content: string, packId?: string, metadata?: any) {
  const payload: any = {
    user_id: userId,
    module_id: moduleId,
    role,
    content,
    pack_id: packId || null,
  };
  
  // Only include metadata if it's an object and has keys
  if (metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0) {
    payload.metadata = metadata;
  }

  const { error } = await supabase.from("chat_messages").insert(payload);
  
  if (error) {
    console.error("[CHAT_PERSISTENCE_ERROR]", error);
    // 42703 is Postgres code for undefined_column
    if (error.code === '42703' || (error.message && error.message.includes('metadata'))) {
      toast.error("Chat persistence schema mismatch (missing chat_messages.metadata). Please apply migrations.");
    }
  }
}

// ─── Sub-component: sources panel shown per-message ───
function MessageSources({
  response,
  packId,
  moduleId,
}: {
  response: ChatResponse;
  packId: PackId | null;
  moduleId: string;
}) {
  const navigate = useNavigate();
  const hasSpans = (response.source_map?.length ?? 0) > 0;
  const hasSections = (response.referenced_sections?.length ?? 0) > 0;
  const hasUnverified = (response.unverified_claims?.length ?? 0) > 0;

  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const openSection = (sec: ReferencedSection) => {
    if (packId) {
      navigate(`/packs/${packId}/modules/${sec.module_key}#section=${sec.section_id}`);
    }
  };

  const topSection = response.referenced_sections?.[0];

  if (!hasSpans && !hasSections && !hasUnverified) return null;

  return (
    <div className="mt-2 space-y-2">
      {/* ── Not fully verified callout ── */}
      {hasUnverified && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            Not fully verified
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-amber-800 dark:text-amber-200">
            {response.unverified_claims!.map((c, i) => (
              <li key={i}>{c.claim} — <span className="opacity-75">{c.reason}</span></li>
            ))}
          </ul>
          {response.suggested_search_queries && response.suggested_search_queries.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {response.suggested_search_queries.map((q) => (
                <span key={q} className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-200 text-[10px] cursor-default">
                  🔍 {q}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Top section shortcut ── */}
      {topSection && !sourcesOpen && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => openSection(topSection)}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
          >
            <BookOpen className="w-2.5 h-2.5" />
            Open in module: {topSection.section_heading}
          </button>
        </div>
      )}

      {/* ── Show sources toggle ── */}
      {(hasSpans || hasSections) && (
        <div>
          <button
            onClick={() => setSourcesOpen((prev) => !prev)}
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {sourcesOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {sourcesOpen ? "Hide sources" : "Show sources"}
            {!sourcesOpen && (hasSpans || hasSections) && (
              <span className="ml-1 text-primary">
                ({(response.source_map?.length ?? 0) + (response.referenced_sections?.length ?? 0)})
              </span>
            )}
          </button>

          <AnimatePresence>
            {sourcesOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-2">
                  {/* Span badges */}
                  {hasSpans && (
                    <div className="flex flex-wrap gap-1">
                      {response.source_map!.map((source) => {
                        const { chunk_ref, chunk_pk, stable_chunk_id } = normalizeChunkRef(source);
                        return (
                          <CitationBadge
                            key={source.badge}
                            spanId={source.badge}
                            path={source.filepath}
                            chunkRef={chunk_ref}
                            startLine={source.start}
                            endLine={source.end}
                          />
                        );
                      })}
                    </div>
                  )}

                  {/* Referenced sections */}
                  {hasSections && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground font-medium">Related sections:</p>
                      {response.referenced_sections!.map((sec) => (
                        <div key={sec.section_id} className="flex items-center gap-1.5">
                          <button
                            onClick={() => openSection(sec)}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-primary/5 text-primary border border-primary/15 hover:bg-primary/15 transition-colors"
                          >
                            <BookOpen className="w-2.5 h-2.5" />
                            {sec.section_heading}
                            <ExternalLink className="w-2 h-2 ml-0.5 opacity-60" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Report button ── */}
      <div>
        <button
          onClick={() => setReportOpen(true)}
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-amber-500 transition-colors"
        >
          <Flag className="w-2.5 h-2.5" />
          Report
        </button>
        <ChatReportDialog
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          messageContent={response.display_response || (response as any).response_markdown || ""}
          moduleId={moduleId}
          traceId={response.trace_id}
        />
      </div>
    </div>
  );
}

import { useAudiencePrefs } from "@/hooks/useAudiencePrefs";

export function ModuleChatPanel({ 
  moduleId, 
  moduleContext, 
  openRequest, 
  onOpenChange, 
  onAssistantError 
}: ModuleChatPanelProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { currentPack, currentPackId } = usePack();
  const packId = currentPackId ? asPackId(currentPackId) : null;
  const { packAccessLevel } = useRole();
  const { learnerRole, experienceLevel, learningStyle, frameworkFamiliarity, tonePreference } = useAudiencePrefs();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [lastError, setLastError] = useState<AIError | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastProcessedRequestId = useRef<string | null>(null);

  // Handle openRequest from parent
  useEffect(() => {
    if (openRequest && openRequest.requestId !== lastProcessedRequestId.current) {
      lastProcessedRequestId.current = openRequest.requestId;
      setIsOpen(true);
      if (openRequest.prefill) {
        setInput(openRequest.prefill);
      }
    }
  }, [openRequest]);

  // Emit onOpenChange
  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    if (!isOpen || !user || historyLoaded) return;
    (async () => {
      const q = supabase
        .from("chat_messages")
        .select("role, content, metadata")
        .eq("user_id", user.id)
        .eq("module_id", moduleId)
        .order("created_at", { ascending: true });
      
      const { data } = packId
        ? await q.eq("pack_id", packId)
        : await q;

      if (data && data.length > 0) {
        setMessages(data.map((d) => ({ 
          role: d.role as "user" | "assistant", 
          content: d.content,
          response: d.metadata as unknown as ChatResponse
        })));
      }
      setHistoryLoaded(true);
    })();
  }, [isOpen, user, moduleId, historyLoaded, currentPackId]);

  useEffect(() => {
    setMessages([]);
    setHistoryLoaded(false);
    setLastError(null);
  }, [moduleId]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, lastError, scrollToBottom]);

  const clearHistory = async () => {
    if (!user) return;
    await supabase.from("chat_messages").delete().eq("user_id", user.id).eq("module_id", moduleId);
    setMessages([]);
    setLastError(null);
    toast.success("Chat history cleared");
  };

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput("");

    const userMsg: Msg = { role: "user", content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setIsLoading(true);
    setLastError(null);

    if (user) saveMessage(user.id, moduleId, "user", text, packId || undefined);

    try {
      const spans = packId ? await fetchEvidenceSpans(packId, text) : [];

      const envelope = buildChatEnvelope({
        auth: {
          user_id: user?.id || null,
          org_id: currentPack?.org_id || null,
          roles: [],
          pack_access_level: packAccessLevel,
        },
        pack: {
          pack_id: packId,
          pack_version: currentPack?.pack_version,
          title: currentPack?.title,
          description: currentPack?.description,
          language_mode: currentPack?.language_mode,
        },
        learnerProfile: {
          role: learnerRole,
          experience_level: experienceLevel,
          learning_style: learningStyle,
          framework_familiarity: frameworkFamiliarity,
          tone_preference: tonePreference
        },
        messages: allMessages,
        evidenceSpans: spans,
        moduleKey: moduleId,
        query: text,
      });

      const result = await sendAITask(envelope);
      const typedResult = result as ChatResponse;
      const displayResponse = typedResult.display_response || typedResult.canonical_response || (result as any).response_markdown || "No response received.";
      
      // Store response WITH the full metadata on the message object
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: displayResponse, response: typedResult },
      ]);

      // Save assistant response WITH metadata
      if (user) await saveMessage(user.id, moduleId, "assistant", displayResponse, packId || undefined, typedResult);
    } catch (e: any) {
      if (e instanceof AIError) {
        setLastError(e);
        onAssistantError?.({ code: e.code, message: e.message });
      } else {
        const netErr: { code: AIErrorCode; message: string } = {
          code: "network_error",
          message: e.message || "Failed to get response",
        };
        setLastError(new (await import("@/lib/ai-errors")).AIError(netErr));
        onAssistantError?.(netErr);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className={`fixed z-50 ${isMobile ? "bottom-4 right-4" : "bottom-6 right-6"}`}>
            <Button onClick={() => setIsOpen(true)} size="lg" className={`rounded-full shadow-lg gradient-primary border-0 ${isMobile ? "h-12 w-12" : "h-14 w-14"}`} title="Rocket — Module Assistant">
              <Rocket className={isMobile ? "w-5 h-5" : "w-6 h-6"} />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={`fixed z-50 bg-card border border-border shadow-2xl flex flex-col overflow-hidden ${
              isMobile
                ? "inset-0 rounded-none"
                : "bottom-6 right-6 w-[400px] h-[580px] rounded-2xl"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/50">
              <div className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-primary" />
              <span className="font-semibold text-sm text-foreground">🚀 Rocket — Module Assistant</span>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={clearHistory} title="Clear history">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
              {messages.length === 0 && historyLoaded && !lastError && (
                <div className="text-center py-8">
                  <Rocket className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    🚀 Ask <strong className="text-foreground">Rocket</strong> anything about <strong className="text-foreground">{moduleContext.title}</strong>
                  </p>
                  <div className="mt-4 space-y-2">
                    {["Summarize the key concepts", "What should I focus on?", "Explain the main takeaways"].map((q) => (
                      <button
                        key={q}
                        onClick={() => setInput(q)}
                        className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-muted hover:bg-accent transition-colors text-muted-foreground"
                      >
                        💡 {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!historyLoaded && isOpen && (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}
                  <div className="flex flex-col min-w-0 max-w-[85%]">
                    <div
                      className={`rounded-xl px-3 py-2 text-sm overflow-hidden ${
                        msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_code]:break-all [&_pre_code]:break-normal">
                          <MarkdownRenderer 
                            packId={packId || undefined}
                            referencedSpans={msg.response?.source_map?.map(s => {
                              const normalized = normalizeChunkRef(s as any);
                              return { 
                                span_id: s.badge, 
                                path: s.filepath, 
                                chunk_ref: normalized.chunk_ref,
                                chunk_pk: normalized.chunk_pk,
                                stable_chunk_id: normalized.stable_chunk_id,
                                start_line: s.start,
                                end_line: s.end
                              };
                            })}>
                            {msg.content}
                          </MarkdownRenderer>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                    {/* Per-message sources, sections, report */}
                    {msg.role === "assistant" && msg.response && (
                      <div className="ml-1 mt-1">
                        <MessageSources
                          response={msg.response}
                          packId={packId}
                          moduleId={moduleId}
                        />
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-3.5 h-3.5 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="bg-muted rounded-xl px-3 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}

              {/* AI Error inline */}
              {lastError && !isLoading && (
                <div className="ml-8">
                  <AIErrorDisplay error={lastError} compact onRetry={send} onSearchQuery={(q) => setInput(q)} />
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border p-3">
              <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question..."
                  className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  disabled={isLoading}
                />
                <Button type="submit" size="icon" className="h-9 w-9 rounded-lg" disabled={isLoading || !input.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
