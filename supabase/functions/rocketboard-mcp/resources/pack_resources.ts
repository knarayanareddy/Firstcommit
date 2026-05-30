// @ts-nocheck
/**
 * rocketboard-mcp/resources/pack_resources.ts
 *
 * MCP Resources exposed as Tools (mcp-lite compatibility).
 *
 * Resources:
 *   rocketboard://pack/<id>/agents     → pack conventions (AGENTS.md)
 *   rocketboard://pack/<id>/techdocs/index → tech doc listing
 *   rocketboard://pack/<id>/techdocs/<name> → specific tech doc
 *
 * NOTE: Implemented as MCP tools because mcp-lite's formal Resource API
 * is still evolving. See docs/mcp/README.md for details.
 *
 * SECURITY:
 * - All access checks go through policy.checkPackAccess (learner)
 * - Path validation on techdoc name (no traversal, allowlist prefix)
 * - All outputs redacted + capped
 */

import { z } from "zod";

// Re-export input schemas for use in index.ts tool registration
export { GetPackConventionsInputSchema } from "../tools/get_pack_conventions.ts";
export {
  GetTechDocInputSchema,
  GetTechDocsIndexInputSchema,
} from "../tools/get_tech_docs.ts";

// ─── Resource URI schema (for documentation purposes) ─────────────────────────
// rocketboard://pack/<uuid>/agents
// rocketboard://pack/<uuid>/techdocs/index
// rocketboard://pack/<uuid>/techdocs/<filename>

export const RESOURCE_URI_PATTERNS = {
  agents: (packId: string) => `rocketboard://pack/${packId}/agents`,
  techdocsIndex: (packId: string) =>
    `rocketboard://pack/${packId}/techdocs/index`,
  techdoc: (packId: string, name: string) =>
    `rocketboard://pack/${packId}/techdocs/${name}`,
} as const;

// ─── Resource tool input schemas ──────────────────────────────────────────────

export const GetResourcePackAgentsInputSchema = z.object({
  pack_id: z.string().uuid("pack_id must be a valid UUID"),
}).strict();

export const GetResourceTechDocsIndexInputSchema = z.object({
  pack_id: z.string().uuid("pack_id must be a valid UUID"),
}).strict();

export const GetResourceTechDocInputSchema = z.object({
  pack_id: z.string().uuid("pack_id must be a valid UUID"),
  /** Filename under "Technical documents/" prefix — must NOT contain traversal sequences */
  name: z.string().min(1).max(200, "name must be ≤ 200 chars"),
}).strict();

// Handlers delegate directly to the underlying tool handlers — see index.ts
// for wire-up. Keeping this file as schema + URI reference to avoid duplication.
