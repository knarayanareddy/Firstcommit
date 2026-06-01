/**
 * auth.ts — request authentication + pack-access authorization (monolith split, stage 3a).
 */
import { requireUser } from "../_shared/authz.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";
import { structuredError } from "./responses.ts";

export async function authenticateRequest(
  req: Request,
  headers: Record<string, string>,
): Promise<{ userId: string }> {
  const { userId } = await requireUser(req, headers);
  return { userId };
}

// ─── PACK ACCESS AUTHORIZATION ───
const AUTHOR_TASKS = new Set([
  "generate_module",
  "refine_module",
  "generate_quiz",
  "generate_glossary",
  "generate_paths",
  "generate_ask_lead",
  "create_template",
  "refine_template",
  "module_planner",
  "generate_exercises",
]);

export async function checkPackAccess(
  userId: string,
  envelope: any,
  headers: Record<string, string>,
): Promise<Response | null> {
  const packId = envelope.pack?.pack_id;
  const taskType = envelope.task?.type;
  const requestId = envelope.task?.request_id || "unknown";

  if (!packId) return null; // Some tasks may not need a pack

  try {
    const supabase = createServiceClient();

    const minLevel = AUTHOR_TASKS.has(taskType) ? "author" : "learner";
    const { data: hasAccess, error } = await supabase.rpc("has_pack_access", {
      _user_id: userId,
      _pack_id: packId,
      _min_level: minLevel,
    });

    if (error) {
      console.error("[checkPackAccess] Supabase RPC error:", error);
      return structuredError(
        requestId,
        "authz_error",
        "Failed to verify pack access due to database error.",
        headers,
      );
    }

    if (!hasAccess) {
      return structuredError(
        requestId,
        "pack_access_denied",
        "You do not have permission to access this onboarding pack.",
        headers,
      );
    }
    return null;
  } catch (e: any) {
    console.error("[checkPackAccess] error:", e);
    return structuredError(
      requestId,
      "authz_error",
      "Failed to verify pack access.",
      headers,
    );
  }
}
