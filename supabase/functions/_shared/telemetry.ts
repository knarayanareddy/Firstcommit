/**
 * _shared/telemetry.ts
 *
 * Shared Langfuse telemetry wrapper for all Supabase Edge Functions.
 * Provides structured tracing for AI tasks with domain-specific metadata.
 *
 * Usage:
 *   import { createTrace, withTelemetry } from "../_shared/telemetry.ts";
 */

// ─── Types ───
export interface TraceMetadata {
  taskType: string;
  requestId: string;
  userId?: string;
  packId?: string;
  orgId?: string;
  moduleKey?: string;
  trackKey?: string;
  environment?: string;
  [key: string]: unknown;
}

export interface GenerationMetrics {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs: number;
  costUsd?: number;
  groundingScore?: number; // Phase 6: RAG Observability
  attempts?: number; // Phase 6: Agentic Review tracking
  stripRate?: number;
  claimsTotal?: number;
  claimsStripped?: number;
  snippetsResolved?: number;
  sourceMap?: any[];
}

export interface SpanEvent {
  name: string;
  startTime: number;
  endTime?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  level?: "DEBUG" | "DEFAULT" | "WARNING" | "ERROR";
  statusMessage?: string;
}

export interface ScoreEvent {
  name: string;
  value: number;
  comment?: string;
  metadata?: Record<string, unknown>;
}

export interface TraceData {
  traceId: string;
  metadata: TraceMetadata;
  spans: SpanEvent[];
  scores: ScoreEvent[];
  generation?: GenerationMetrics & {
    input?: unknown;
    output?: unknown;
  };
  status: "success" | "error";
  errorMessage?: string;
  startTime: number;
  endTime?: number;
}

// ─── Langfuse Client (lazy singleton) ───
let _langfuseClient: any = null;

function getLangfuseEnabled(): boolean {
  return !!(
    Deno.env.get("LANGFUSE_SECRET_KEY") &&
    Deno.env.get("LANGFUSE_PUBLIC_KEY")
  );
}

async function getLangfuseClient() {
  if (!getLangfuseEnabled()) return null;
  if (_langfuseClient) return _langfuseClient;

  try {
    const { Langfuse } = await import("npm:langfuse@2");
    _langfuseClient = new Langfuse({
      secretKey: Deno.env.get("LANGFUSE_SECRET_KEY")!,
      publicKey: Deno.env.get("LANGFUSE_PUBLIC_KEY")!,
      baseUrl: Deno.env.get("LANGFUSE_BASE_URL") ||
        "https://cloud.langfuse.com",
      flushAt: 10, // Relaxed flushing (critical for edge functions)
      flushInterval: 0, // No batching delay
    });
    return _langfuseClient;
  } catch (e) {
    console.warn("[telemetry] Failed to init Langfuse:", e);
    return null;
  }
}

// ─── Cost Calculator ───
const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  "google/gemini-3-flash-preview": { input: 0.00015, output: 0.0006 },
  "google/gemini-2.5-flash-preview-05-20": { input: 0.00015, output: 0.0006 },
  // Add more models as needed
};

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const rates = COST_PER_1K_TOKENS[model];
  if (!rates) return 0;
  return (inputTokens / 1000) * rates.input +
    (outputTokens / 1000) * rates.output;
}

/** Strategic sampling helper */
export function shouldTrace(forceEnable = false): boolean {
  if (forceEnable) return true;
  const rate = parseFloat(Deno.env.get("TRACE_SAMPLE_RATE") || "0.05");
  return Math.random() < rate;
}

export function createTrace(
  metadata: TraceMetadata,
  options?: { enabled?: boolean },
): TraceBuilder {
  return new TraceBuilder(metadata, options?.enabled ?? true);
}

export class TraceBuilder {
  private data: TraceData;
  private enabled: boolean;

  constructor(metadata: TraceMetadata, enabled: boolean = true) {
    this.enabled = enabled;
    this.data = {
      traceId: metadata.requestId || crypto.randomUUID(),
      metadata,
      spans: [],
      scores: [],
      status: "success",
      startTime: Date.now(),
    };
  }

  /** Force create/enable a trace that was initially disabled (strategic sampling) */
  enable(): this {
    this.enabled = true;
    return this;
  }

  addSpan(event: SpanEvent): this {
    if (!this.enabled) return this;
    this.data.spans.push(event);
    return this;
  }

  /** Start a span and return a handle to end it later */
  startSpan(name: string, input?: Record<string, unknown>): SpanHandle {
    if (!this.enabled) {
      return new SpanHandle({ name, startTime: Date.now() }, false);
    }
    const event: SpanEvent = { name, startTime: Date.now(), input };
    this.data.spans.push(event);
    return new SpanHandle(event, true);
  }

  setGeneration(
    metrics: GenerationMetrics & { input?: unknown; output?: unknown },
  ): this {
    if (!this.enabled) return this;
    this.data.generation = metrics;
    return this;
  }

  /** Add a numeric score (eval) to the trace */
  score(event: ScoreEvent): this {
    if (!this.enabled) return this;
    this.data.scores.push(event);
    return this;
  }

  /** Update trace metadata (e.g. after user auth) */
  updateMetadata(patch: Partial<TraceMetadata>): this {
    if (!this.enabled) return this;
    this.data.metadata = { ...this.data.metadata, ...patch };
    return this;
  }

  /** Patch the current generation with additional metrics (e.g. groundingScore) */
  updateGeneration(patch: Partial<GenerationMetrics>): this {
    if (!this.enabled) return this;
    if (this.data.generation) {
      this.data.generation = { ...this.data.generation, ...patch };
    }
    return this;
  }

  /** Mark the trace as errored */
  setError(message: string): this {
    if (!this.enabled) return this;
    this.data.status = "error";
    this.data.errorMessage = message;
    return this;
  }

  /** Return the internal trace data (for local storage or debugging) */
  getData() {
    return this.data;
  }

  /** Finalize and flush to Langfuse */
  async flush(): Promise<string> {
    if (!this.enabled) return this.data.traceId;
    this.data.endTime = Date.now();

    const langfuse = await getLangfuseClient();
    if (!langfuse) {
      // Langfuse not configured — log structured JSON to console instead
      console.log(JSON.stringify({
        _telemetry: true,
        traceId: this.data.traceId,
        taskType: this.data.metadata.taskType,
        status: this.data.status,
        latencyMs: this.data.endTime - this.data.startTime,
        spanCount: this.data.spans.length,
        generation: this.data.generation
          ? {
            model: this.data.generation.model,
            inputTokens: this.data.generation.inputTokens,
            outputTokens: this.data.generation.outputTokens,
            latencyMs: this.data.generation.latencyMs,
            groundingScore: this.data.generation.groundingScore,
            attempts: this.data.generation.attempts,
          }
          : null,
        error: this.data.errorMessage || null,
      }));
      return this.data.traceId;
    }

    try {
      // Use service-specific name if provided, otherwise default to ai-task-router
      const serviceName = (this.data.metadata.serviceName as string) ||
        "ai-task-router";

      const trace = langfuse.trace({
        id: this.data.traceId,
        name: `${serviceName}/${this.data.metadata.taskType}`,
        userId: this.data.metadata.userId,
        sessionId: this.data.metadata.packId
          ? `${this.data.metadata.userId}-${this.data.metadata.packId}`
          : undefined,
        metadata: this.data.metadata,
        tags: [
          this.data.metadata.taskType,
          this.data.metadata.environment || "production",
          ...(this.data.metadata.packId
            ? [`pack:${this.data.metadata.packId}`]
            : []),
        ],
      });

      // Add observation spans
      for (const span of this.data.spans) {
        trace.span({
          name: span.name,
          startTime: new Date(span.startTime),
          endTime: span.endTime ? new Date(span.endTime) : new Date(),
          input: span.input,
          output: span.output,
          metadata: span.metadata,
          level: span.level,
          statusMessage: span.statusMessage,
        });
      }

      // Add the LLM generation observation
      if (this.data.generation) {
        const gen = this.data.generation;
        const enableRaw = Deno.env.get("ENABLE_RAW_TELEMETRY") === "true";

        trace.generation({
          name: "llm-call",
          model: gen.model,
          input: enableRaw
            ? gen.input
            : "[redacted: ENABLE_RAW_TELEMETRY not true]",
          output: enableRaw
            ? gen.output
            : "[redacted: ENABLE_RAW_TELEMETRY not true]",
          // Accurate model timing: end of trace minus model latency
          startTime: new Date(this.data.endTime! - gen.latencyMs),
          endTime: new Date(this.data.endTime!),
          usage: {
            input: gen.inputTokens || 0,
            output: gen.outputTokens || 0,
            total: gen.totalTokens || 0,
          },
          metadata: {
            latencyMs: gen.latencyMs,
            costUsd: gen.costUsd,
            groundingScore: gen.groundingScore,
            attempts: gen.attempts,
            stripRate: gen.stripRate,
            claimsTotal: gen.claimsTotal,
            claimsStripped: gen.claimsStripped,
            snippetsResolved: gen.snippetsResolved,
          },
        });
      }

      // Add scores (evals)
      for (const s of this.data.scores) {
        trace.score({
          name: s.name,
          value: s.value,
          comment: s.comment,
          metadata: s.metadata,
        });
      }

      // Set final trace status
      if (this.data.status === "error") {
        trace.update({
          metadata: {
            ...this.data.metadata,
            finalStatus: "error",
            errorMessage: this.data.errorMessage,
          },
        });
      }

      // Critical: flush before edge function returns
      await langfuse.flushAsync();
    } catch (e) {
      console.warn("[telemetry] Langfuse flush error:", e);
    }

    return this.data.traceId;
  }

  /** Get the trace ID (useful for returning to the frontend) */
  getTraceId(): string {
    return this.data.traceId;
  }
}

/** Handle for an in-flight span */
export class SpanHandle {
  private event: SpanEvent;
  private enabled: boolean;

  constructor(event: SpanEvent, enabled: boolean = true) {
    this.event = event;
    this.enabled = enabled;
  }

  end(
    output?: Record<string, unknown>,
    metadata?: Record<string, unknown>,
  ): void {
    if (!this.enabled) return;
    this.event.endTime = Date.now();
    if (output) this.event.output = output;
    if (metadata) {
      this.event.metadata = { ...(this.event.metadata || {}), ...metadata };
    }
  }

  error(message: string): void {
    if (!this.enabled) return;
    this.event.endTime = Date.now();
    this.event.level = "ERROR";
    this.event.statusMessage = message;
  }
}
