/**
 * responses.ts — JSON/error Response builders (monolith split, stage 3a). Leaf module.
 */
import { json } from "../_shared/http.ts";

export function errorResponse(
  status: number,
  body: object,
  headers: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export function structuredError(
  requestId: string,
  errorCode: string,
  message: string,
  headers: Record<string, string>,
  extra?: { suggested_search_queries?: string[]; warnings?: string[] },
) {
  return jsonResponse({
    type: "error",
    request_id: requestId,
    error_code: errorCode,
    message,
    suggested_search_queries: extra?.suggested_search_queries || [],
    warnings: extra?.warnings || [],
  }, headers);
}

export function jsonResponse(body: object, headers: Record<string, string>) {
  return json(200, body, headers);
}

export function unsupportedTask(
  requestId: string,
  taskType: string,
  headers: Record<string, string>,
) {
  return structuredError(
    requestId,
    "unsupported_task",
    `Task type '${taskType}' not yet implemented`,
    headers,
  );
}
