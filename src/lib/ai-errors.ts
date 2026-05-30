export type AIErrorCode =
  | "insufficient_evidence"
  | "invalid_input"
  | "conflicting_instruction"
  | "unsupported_task"
  | "invalid_output"
  | "rate_limited"
  | "credit_exhausted"
  | "network_error";

export class AIError extends Error {
  code: AIErrorCode;
  requestId: string;
  suggestedSearchQueries: string[];
  warnings: string[];

  constructor(opts: {
    code: AIErrorCode;
    message: string;
    requestId?: string;
    suggestedSearchQueries?: string[];
    warnings?: string[];
  }) {
    super(opts.message);
    this.name = "AIError";
    this.code = opts.code;
    this.requestId = opts.requestId || "";
    this.suggestedSearchQueries = opts.suggestedSearchQueries || [];
    this.warnings = opts.warnings || [];
  }
}

/**
 * Parse an AI response and return an AIError if the response indicates an error,
 * or null if the response is valid.
 */
export function parseAIError(response: any): AIError | null {
  if (!response) return null;

  // Check for structured error responses from the edge function
  if (response.type === "error" || response.error_code) {
    const code = mapErrorCode(response.error_code || response.code || "invalid_output");
    return new AIError({
      code,
      message: response.message || response.error || "An AI error occurred",
      requestId: response.request_id || "",
      suggestedSearchQueries: response.suggested_search_queries || [],
      warnings: response.warnings || [],
    });
  }

  return null;
}

/**
 * Parse HTTP-level errors from the AI task response.
 */
export function parseHTTPError(status: number, body: any): AIError {
  if (status === 429) {
    return new AIError({
      code: "rate_limited",
      message: body?.message || "Too many requests. Please wait a moment and try again.",
      requestId: body?.request_id || "",
      warnings: body?.warnings || [],
    });
  }

  if (status === 402) {
    return new AIError({
      code: "credit_exhausted",
      message: body?.message || "AI credits exhausted. Contact your admin to add more credits.",
      requestId: body?.request_id || "",
      warnings: body?.warnings || [],
    });
  }

  if (status >= 500) {
    return new AIError({
      code: "network_error",
      message: body?.message || "The AI service is temporarily unavailable. Please try again.",
      requestId: body?.request_id || "",
      warnings: body?.warnings || [],
    });
  }

  return new AIError({
    code: "invalid_output",
    message: body?.error || body?.message || `Request failed with status ${status}`,
    requestId: body?.request_id || "",
    suggestedSearchQueries: body?.suggested_search_queries || [],
    warnings: body?.warnings || [],
  });
}

function mapErrorCode(raw: string): AIErrorCode {
  const mapping: Record<string, AIErrorCode> = {
    insufficient_evidence: "insufficient_evidence",
    invalid_input: "invalid_input",
    missing_input: "invalid_input",
    conflicting_instruction: "conflicting_instruction",
    unsupported_task: "unsupported_task",
    unknown_task: "unsupported_task",
    invalid_output: "invalid_output",
    rate_limited: "rate_limited",
    credit_exhausted: "credit_exhausted",
    network_error: "network_error",
  };
  return mapping[raw] || "invalid_output";
}
