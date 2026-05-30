// Simplified JSON schema definitions for AI task outputs.
// Each entry lists required keys and their expected types.

type FieldType = "string" | "number" | "array" | "object" | "boolean" | "any";

export interface FieldSchema {
  type: FieldType;
  optional?: boolean;
}

export interface TaskSchema {
  requiredFields: Record<string, FieldSchema>;
  description: string;
}

export const TASK_OUTPUT_SCHEMAS: Record<string, TaskSchema> = {
  chat: {
    description: "Chat response with markdown and optional extras",
    requiredFields: {
      type: { type: "string" },
      request_id: { type: "string" },
      response_markdown: { type: "string" },
      referenced_spans: { type: "array", optional: true },
      unverified_claims: { type: "array", optional: true },
      contradictions: { type: "array", optional: true },
      suggested_search_queries: { type: "array", optional: true },
      suggested_next: { type: "string", optional: true },
      warnings: { type: "array", optional: true },
    },
  },
  global_chat: {
    description: "Global chat response (Mission Control) with markdown and optional extras",
    requiredFields: {
      type: { type: "string" },
      request_id: { type: "string" },
      response_markdown: { type: "string" },
      referenced_spans: { type: "array", optional: true },
      unverified_claims: { type: "array", optional: true },
      contradictions: { type: "array", optional: true },
      suggested_search_queries: { type: "array", optional: true },
      warnings: { type: "array", optional: true },
    },
  },
  module_planner: {
    description: "Module plan with tracks and detected signals",
    requiredFields: {
      type: { type: "string" },
      request_id: { type: "string" },
      pack_id: { type: "string" },
      pack_version: { type: "number" },
      generation_meta: { type: "object" },
      detected_signals: { type: "array" },
      tracks: { type: "array" },
      module_plan: { type: "array" },
      contradictions: { type: "array", optional: true },
      warnings: { type: "array", optional: true },
    },
  },
  generate_module: {
    description: "Generated module with sections and endcap",
    requiredFields: {
      type: { type: "string" },
      request_id: { type: "string" },
      pack_id: { type: "string" },
      pack_version: { type: "number" },
      generation_meta: { type: "object" },
      module: { type: "object" },
      warnings: { type: "array", optional: true },
    },
  },
  generate_quiz: {
    description: "Generated quiz questions",
    requiredFields: {
      type: { type: "string" },
      request_id: { type: "string" },
      pack_id: { type: "string" },
      pack_version: { type: "number" },
      generation_meta: { type: "object" },
      quiz: { type: "object" },
      warnings: { type: "array", optional: true },
    },
  },
  generate_glossary: {
    description: "Generated glossary terms",
    requiredFields: {
      type: { type: "string" },
      request_id: { type: "string" },
      pack_id: { type: "string" },
      pack_version: { type: "number" },
      generation_meta: { type: "object" },
      glossary: { type: "array" },
      warnings: { type: "array", optional: true },
    },
  },
  generate_paths: {
    description: "Generated onboarding paths (day1 + week1)",
    requiredFields: {
      type: { type: "string" },
      request_id: { type: "string" },
      pack_id: { type: "string" },
      pack_version: { type: "number" },
      generation_meta: { type: "object" },
      day1: { type: "array" },
      week1: { type: "array" },
      warnings: { type: "array", optional: true },
    },
  },
  generate_ask_lead: {
    description: "Generated ask-your-lead questions",
    requiredFields: {
      type: { type: "string" },
      request_id: { type: "string" },
      pack_id: { type: "string" },
      pack_version: { type: "number" },
      generation_meta: { type: "object" },
      questions: { type: "array" },
      warnings: { type: "array", optional: true },
    },
  },
  simplify_section: {
    description: "Simplified section with adapted content",
    requiredFields: {
      type: { type: "string" },
      request_id: { type: "string" },
      pack_id: { type: "string" },
      pack_version: { type: "number" },
      generation_meta: { type: "object" },
      module_key: { type: "string" },
      section_id: { type: "string" },
      simplified_markdown: { type: "string" },
      citations: { type: "array", optional: true },
      audience: { type: "string", optional: true },
      depth: { type: "string", optional: true },
      warnings: { type: "array", optional: true },
    },
  },
  refine_module: {
    description: "Refined module with change log",
    requiredFields: {
      type: { type: "string" },
      request_id: { type: "string" },
      pack_id: { type: "string" },
      pack_version: { type: "number" },
      generation_meta: { type: "object" },
      module_revision: { type: "number" },
      module: { type: "object" },
      change_log: { type: "array" },
      contradictions: { type: "array", optional: true },
      warnings: { type: "array", optional: true },
    },
  },
  create_template: {
    description: "Created template output",
    requiredFields: {
      type: { type: "string" },
      request_id: { type: "string" },
      org_id: { type: "string", optional: true },
      generation_meta: { type: "object" },
      template: { type: "object" },
      warnings: { type: "array", optional: true },
    },
  },
  refine_template: {
    description: "Refined template output",
    requiredFields: {
      type: { type: "string" },
      request_id: { type: "string" },
      org_id: { type: "string", optional: true },
      generation_meta: { type: "object" },
      template: { type: "object" },
      change_log: { type: "array" },
      warnings: { type: "array", optional: true },
    },
  },
  generate_exercises: {
    description: "Generated hands-on coding exercises",
    requiredFields: {
      type: { type: "string" },
      request_id: { type: "string" },
      pack_id: { type: "string" },
      pack_version: { type: "number" },
      generation_meta: { type: "object" },
      exercises: { type: "array" },
      warnings: { type: "array", optional: true },
    },
  },
  verify_exercise: {
    description: "Verified learner exercise submission",
    requiredFields: {
      type: { type: "string" },
      request_id: { type: "string" },
      status: { type: "string" },
      feedback_markdown: { type: "string" },
      score: { type: "number" },
      suggestions: { type: "array" },
      warnings: { type: "array", optional: true },
    },
  },
  error: {
    description: "Error response from AI",
    requiredFields: {
      type: { type: "string" },
      error_code: { type: "string" },
      message: { type: "string" },
      request_id: { type: "string", optional: true },
    },
  },
};
