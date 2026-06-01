// @ts-nocheck
import { createTrace } from "../_shared/telemetry.ts";
import type { TraceBuilder } from "../_shared/telemetry.ts";
import type { EvidenceSpan } from "./types.ts";
import { errorResponse, structuredError } from "./responses.ts";
import { authenticateRequest, checkPackAccess } from "./auth.ts";
import { recordAiAudit, recordRagMetrics } from "./persistence.ts";
import { resolveAIConfig } from "./ai-call.ts";
import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { readJson } from "../_shared/http.ts";
import { preprocessEnvelope } from "./envelope.ts";

// ─── TASK HANDLERS (monolith split, stage 4b) ───
import { handleValidateKey } from "./handlers/validate-key.ts";
import { handleChat } from "./handlers/chat.ts";
import { handleGlobalChat } from "./handlers/global-chat.ts";
import { handleGenerateModule } from "./handlers/generate-module.ts";
import { handleGenerateQuiz } from "./handlers/generate-quiz.ts";
import { handleRefineModule } from "./handlers/refine-module.ts";
import { handleSimplifySection } from "./handlers/simplify-section.ts";
import { handleModulePlanner } from "./handlers/module-planner.ts";
import { handleGenerateGlossary } from "./handlers/generate-glossary.ts";
import { handleGeneratePaths } from "./handlers/generate-paths.ts";
import { handleGenerateAskLead } from "./handlers/generate-ask-lead.ts";
import { handleCreateTemplate } from "./handlers/create-template.ts";
import { handleRefineTemplate } from "./handlers/refine-template.ts";
import { handleGenerateExercises } from "./handlers/generate-exercises.ts";
import { handleVerifyExercise } from "./handlers/verify-exercise.ts";

const ALLOWED_ORIGINS = parseAllowedOrigins();

// enforceNoDirectCode moved to ./envelope.ts (monolith split, stage 3c-ii).

// EvidenceSpan moved to ./types.ts (breaks the verifier/faithfulness -> index.ts import cycle).
export type { EvidenceSpan };

// TODO: Replace in-memory rate limiting with a shared durable store (Redis/PostgreSQL) for cross-instance quotas.
// ─── RATE LIMITING ───
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(userId, { count: 1, windowStart: now });
    return true;
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return false;
  return true;
}

// Clean up stale entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap) {
    if (now - val.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(key);
    }
  }
}, 120_000);

const LANGFUSE_SAMPLE_RATE = Number(
  Deno.env.get("LANGFUSE_SAMPLE_RATE") || "1.0",
);

// redactText + redactSpans moved to ./envelope.ts (monolith split, stage 3c-ii).
// resolveGroundingPolicy moved to ./grounding.ts (monolith split, stage 3b).

// sanitizeInputs moved to ./envelope.ts (monolith split, stage 3c-ii).

// SECURITY_RULES_BLOCK + GROUNDING_RULES moved to ./generation-core.ts (monolith split, stage 4a).

// ─── HELPERS ───
// Response builders moved to ./responses.ts (stage 3a).

// buildSpansBlock moved to ./prompts.ts (monolith split, stage 1b).

// quickVerifyCitations moved to ./grounding.ts (monolith split, stage 3b).

// Prompt block builders moved to ./prompts.ts (monolith split, stage 1).

// BYOK config + resolveAIConfig moved to ./ai-call.ts (monolith split, stage 2a).

// callAI + AI_MODEL + JSON parsers moved to ./ai-call.ts (monolith split, stage 2b).

// callWithAgenticReview moved to ./generation-core.ts (monolith split, stage 4a).

// authenticateRequest + checkPackAccess moved to ./auth.ts (stage 3a).

// recordRagMetrics + recordAiAudit moved to ./persistence.ts (stage 3c).

// preprocessEnvelope moved to ./envelope.ts (monolith split, stage 3c-ii).

// buildSectionIndex moved to ./envelope.ts (monolith split, stage 3c-ii).

// ─── CHAT HANDLER ───
// handleChat moved to ./handlers/chat.ts (monolith split, stage 4b).

// ─── GLOBAL CHAT HANDLER (Mission Control) ───
// handleGlobalChat moved to ./handlers/global-chat.ts (monolith split, stage 4b).

// ─── MODULE PLANNER HANDLER ───
// handleModulePlanner moved to ./handlers/module-planner.ts (monolith split, stage 4b).

// ─── GENERATE MODULE HANDLER ───
// handleGenerateModule moved to ./handlers/generate-module.ts (monolith split, stage 4b).

// ─── GENERATE QUIZ HANDLER ───
// handleGenerateQuiz moved to ./handlers/generate-quiz.ts (monolith split, stage 4b).

// ─── GENERATE GLOSSARY HANDLER ───
// handleGenerateGlossary moved to ./handlers/generate-glossary.ts (monolith split, stage 4b).

// ─── GENERATE PATHS HANDLER ───
// handleGeneratePaths moved to ./handlers/generate-paths.ts (monolith split, stage 4b).

// ─── GENERATE ASK LEAD HANDLER ───
// handleGenerateAskLead moved to ./handlers/generate-ask-lead.ts (monolith split, stage 4b).

// ─── REFINE MODULE HANDLER ───
// handleRefineModule moved to ./handlers/refine-module.ts (monolith split, stage 4b).

// ─── SIMPLIFY SECTION HANDLER ───
// handleSimplifySection moved to ./handlers/simplify-section.ts (monolith split, stage 4b).

// ─── CREATE TEMPLATE HANDLER ───
// handleCreateTemplate moved to ./handlers/create-template.ts (monolith split, stage 4b).

// ─── REFINE TEMPLATE HANDLER ───
// handleRefineTemplate moved to ./handlers/refine-template.ts (monolith split, stage 4b).

// ─── GENERATE EXERCISES HANDLER ───
// handleGenerateExercises moved to ./handlers/generate-exercises.ts (monolith split, stage 4b).

// ─── VERIFY EXERCISE HANDLER ───
// handleVerifyExercise moved to ./handlers/verify-exercise.ts (monolith split, stage 4b).

// ─── VALIDATE BYOK KEY ───
// handleValidateKey moved to ./handlers/validate-key.ts (monolith split, stage 4b).

// ─── MAIN HANDLER ───
Deno.serve(async (req: Request) => {
  const currentCorsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS);
  const corsResponse = handleCorsPreflight(req, ALLOWED_ORIGINS);
  if (corsResponse) return corsResponse;

  // ─── AUTHENTICATION (Phase 1) ───
  // (Redundant call removed; handled by authenticateRequest inside try/catch)

  let trace = createTrace({ taskType: "startup", requestId: "unknown" }, {
    enabled: false,
  });

  try {
    // JWT Authentication
    const authResult = await authenticateRequest(req, currentCorsHeaders);
    if (authResult instanceof Response) return authResult;
    const { userId } = authResult;

    // Late-bind userId to trace if it was already created
    trace.updateMetadata({ userId });

    // Rate limiting
    if (!checkRateLimit(userId)) {
      return structuredError(
        "unknown",
        "rate_limited",
        "Too many requests. Please wait a moment and try again (limit: 30/min).",
        currentCorsHeaders,
      );
    }

    const envelope = await readJson(req, currentCorsHeaders);
    const taskType = envelope.task?.type;
    const requestId = envelope.task?.request_id || envelope.task?.trace_id ||
      crypto.randomUUID();

    if (!taskType) {
      return errorResponse(
        400,
        { error: "Missing task.type in envelope" },
        currentCorsHeaders,
      );
    }

    // ─── Telemetry: create trace ───
    const isErrorOrRetry = (envelope.task?.attempts || 1) > 1;
    const shouldTrace = isErrorOrRetry || Math.random() < LANGFUSE_SAMPLE_RATE;

    trace = createTrace({
      taskType,
      requestId,
      userId,
      packId: envelope.pack?.pack_id,
      org_id: envelope.pack?.org_id,
      moduleKey: envelope.context?.current_module_key ||
        envelope.inputs?.module?.module_key,
      trackKey: envelope.context?.current_track_key,
      environment: Deno.env.get("LANGFUSE_ENVIRONMENT") || "production",
      serviceName: "ai-task-router",
    }, { enabled: shouldTrace });

    // Handle validate key as a special case bypassing normal auth logic if needed
    if (taskType === "validate_key") {
      return handleValidateKey(envelope);
    }

    // Resolve AI Config (BYOK)
    envelope.context = envelope.context || {};
    envelope.context.ai_config = await resolveAIConfig(userId);

    // Pack access authorization
    const authSpan = trace.startSpan("pack-authorization");
    const accessDenied = await checkPackAccess(
      userId,
      envelope,
      currentCorsHeaders,
    );
    if (accessDenied) {
      authSpan.error("Access denied");
      trace.setError("Pack access denied");
      await trace.flush();
      return accessDenied;
    }
    authSpan.end({ authorized: true });

    // Preprocess: sanitize inputs + redact spans
    const preprocessSpan = trace.startSpan("preprocessing", {
      spanCount: envelope.retrieval?.evidence_spans?.length || 0,
    });
    const preprocessed = preprocessEnvelope(envelope, currentCorsHeaders);
    if (preprocessed instanceof Response) {
      preprocessSpan.error("Preprocessing rejected input");
      trace.setError("Input validation failed");
      await trace.flush();
      return preprocessed;
    }
    const { envelope: safeEnvelope, warnings: extraWarnings } = preprocessed;
    preprocessSpan.end({
      warningCount: extraWarnings.length,
      finalSpanCount: safeEnvelope.retrieval?.evidence_spans?.length || 0,
    });

    // ─── Dispatch to handler ───
    let result: Response;
    switch (taskType) {
      case "chat":
        result = await handleChat(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
          trace,
        );
        break;
      case "global_chat":
        result = await handleGlobalChat(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
          trace,
        );
        break;
      case "module_planner":
        result = await handleModulePlanner(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
          trace,
        );
        break;
      case "generate_module":
        result = await handleGenerateModule(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
          trace,
        );
        break;
      case "generate_quiz":
        result = await handleGenerateQuiz(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
          trace,
        );
        break;
      case "generate_glossary":
        result = await handleGenerateGlossary(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
          trace,
        );
        break;
      case "generate_paths":
        result = await handleGeneratePaths(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
          trace,
        );
        break;
      case "generate_ask_lead":
        result = await handleGenerateAskLead(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
          trace,
        );
        break;
      case "simplify_section":
        result = await handleSimplifySection(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
          trace,
        );
        break;
      case "create_template":
        result = await handleCreateTemplate(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
        );
        break;
      case "refine_template":
        result = await handleRefineTemplate(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
        );
        break;
      case "refine_module":
        result = await handleRefineModule(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
        );
        break;
      case "generate_exercises":
        result = await handleGenerateExercises(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
        );
        break;
      case "verify_exercise":
        result = await handleVerifyExercise(
          safeEnvelope,
          currentCorsHeaders,
          extraWarnings,
        );
        break;
      default:
        result = structuredError(
          requestId,
          "unsupported_task",
          `Unknown task type: ${taskType}`,
          currentCorsHeaders,
        );
    }

    // ─── Inject traceId into the response body ───
    try {
      const body = await result.clone().json();
      body.trace_id = trace.getTraceId();
      result = new Response(JSON.stringify(body), {
        status: result.status,
        headers: result.headers,
      });
    } catch { /* non-JSON response, skip injection */ }

    // ─── Record local metrics (Phase 6) ───
    await recordRagMetrics(trace, safeEnvelope);

    // ─── AI Audit Log (Phase 6) ───
    try {
      const respClone = result.clone();
      const body = await respClone.json();
      const markdown = body.display_response || body.response_markdown || "";
      if (markdown) {
        await recordAiAudit(trace, safeEnvelope, markdown);
      }
    } catch (e) {
      console.warn("[serve] AI Audit recording failed:", (e as any).message);
    }

    // ─── Flush telemetry ───
    await trace.flush();
    return result;
  } catch (e: any) {
    if (e.response) return e.response;

    console.error("ai-task-router error:", e);
    trace.setError(e.message || "Unknown error");

    // Part C: Record grounding failure metrics even on 422 refusal path so rag_metrics is never empty.
    if (e.status === 422 || e.error_code === "insufficient_evidence") {
      try {
        const targetEnvelope =
          (typeof safeEnvelope !== "undefined" && safeEnvelope) ||
          (typeof envelope !== "undefined" && envelope);
        if (targetEnvelope) {
          await recordRagMetrics(trace, targetEnvelope);
        }
      } catch (metricsError) {
        console.warn("[catch] Failed to record failure metrics:", metricsError);
      }
    }

    await trace.flush();
    const requestId = (typeof envelope !== "undefined" &&
      (envelope.task?.request_id || envelope.task?.trace_id)) || "unknown";
    if (e.error_code) {
      return structuredError(
        requestId,
        e.error_code,
        e.message || "An error occurred",
        currentCorsHeaders,
      );
    }
    return structuredError(
      requestId,
      "network_error",
      e instanceof Error ? e.message : "Unknown error",
      currentCorsHeaders,
    );
  }
});
