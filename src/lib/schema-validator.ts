import { TASK_OUTPUT_SCHEMAS, type FieldSchema } from "./output-schemas";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function checkType(value: unknown, expected: FieldSchema["type"]): boolean {
  if (expected === "any") return true;
  if (expected === "array") return Array.isArray(value);
  if (expected === "object") return typeof value === "object" && value !== null && !Array.isArray(value);
  return typeof value === expected;
}

export function validateAIOutput(taskType: string, output: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Must be an object
  if (typeof output !== "object" || output === null || Array.isArray(output)) {
    return { valid: false, errors: ["AI output is not a JSON object"], warnings };
  }

  const obj = output as Record<string, unknown>;

  // 2. Check type field
  if (obj.type === "error") {
    // Validate against error schema
    const errorSchema = TASK_OUTPUT_SCHEMAS.error;
    for (const [key, schema] of Object.entries(errorSchema.requiredFields)) {
      if (schema.optional) continue;
      if (!(key in obj)) {
        errors.push(`Error response missing required field: "${key}"`);
      }
    }
    return { valid: errors.length === 0, errors, warnings };
  }

  if (obj.type !== taskType) {
    errors.push(`Expected type "${taskType}" but got "${obj.type}"`);
  }

  // 3. Look up schema
  const schema = TASK_OUTPUT_SCHEMAS[taskType];
  if (!schema) {
    warnings.push(`No schema defined for task type "${taskType}"`);
    return { valid: true, errors, warnings };
  }

  // 4. Check required keys and types
  for (const [key, fieldSchema] of Object.entries(schema.requiredFields)) {
    if (!(key in obj)) {
      if (!fieldSchema.optional) {
        errors.push(`Missing required field: "${key}"`);
      }
      continue;
    }
    if (!checkType(obj[key], fieldSchema.type)) {
      errors.push(`Field "${key}" expected ${fieldSchema.type} but got ${Array.isArray(obj[key]) ? "array" : typeof obj[key]}`);
    }
  }

  // 5. Warn on unexpected top-level keys
  const knownKeys = new Set(Object.keys(schema.requiredFields));
  knownKeys.add("_raw"); // internal fallback key
  for (const key of Object.keys(obj)) {
    if (!knownKeys.has(key)) {
      warnings.push(`Unexpected field: "${key}"`);
    }
  }

  // 6. Deep validation for specific task types
  if (taskType === "generate_module" && obj.module) {
    const mod = obj.module as Record<string, unknown>;
    if (!Array.isArray(mod.sections)) {
      errors.push('module.sections must be an array');
    } else if (mod.sections.length === 0) {
      errors.push('module.sections must have at least one section');
    } else {
      for (let i = 0; i < mod.sections.length; i++) {
        const sec = (mod.sections as any[])[i];
        if (!sec.section_id) errors.push(`module.sections[${i}] missing section_id`);
        if (!sec.heading) errors.push(`module.sections[${i}] missing heading`);
      }
    }
  }

  if (taskType === "generate_quiz" && obj.quiz) {
    const quiz = obj.quiz as Record<string, unknown>;
    if (!Array.isArray(quiz.questions)) {
      errors.push('quiz.questions must be an array');
    } else if (quiz.questions.length === 0) {
      errors.push('quiz.questions must have at least one question');
    } else {
      for (let i = 0; i < quiz.questions.length; i++) {
        const q = (quiz.questions as any[])[i];
        if (!q.id) errors.push(`quiz.questions[${i}] missing id`);
        if (!q.prompt) errors.push(`quiz.questions[${i}] missing prompt`);
        if (!Array.isArray(q.choices)) errors.push(`quiz.questions[${i}] missing choices`);
        if (!q.correct_choice_id) errors.push(`quiz.questions[${i}] missing correct_choice_id`);
      }
    }
  }

  if ((taskType === "chat" || taskType === "global_chat") && typeof obj.response_markdown === "string") {
    if ((obj.response_markdown as string).trim().length === 0) {
      errors.push('response_markdown must be a non-empty string');
    }
  }
 
  if (taskType === "generate_exercises" && obj.exercises) {
    const exercises = obj.exercises as Record<string, unknown>[];
    if (!Array.isArray(exercises)) {
      errors.push('exercises must be an array');
    } else if (exercises.length === 0) {
      errors.push('exercises must have at least one item');
    } else {
      for (let i = 0; i < exercises.length; i++) {
        const ex = exercises[i];
        if (!ex.title) errors.push(`exercises[${i}] missing title`);
        if (!ex.description) errors.push(`exercises[${i}] missing description`);
        if (!ex.exercise_type) errors.push(`exercises[${i}] missing exercise_type`);
      }
    }
  }
 
  if (taskType === "verify_exercise") {
    const status = obj.status as string;
    const validStatuses = ["correct", "partially_correct", "incorrect"];
    if (!validStatuses.includes(status)) {
      errors.push(`Invalid status "${status}". Must be one of: ${validStatuses.join(", ")}`);
    }
    if (typeof obj.score === "number" && (obj.score < 0 || obj.score > 100)) {
      errors.push('score must be between 0 and 100');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
