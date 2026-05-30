export interface Limits {
  max_spans_to_cite: number;
  max_module_words: number;
  max_section_words_hint: number;
  max_note_prompts_per_section: number;
  max_key_takeaways: number;
  max_reflection_prompts: number;
  max_quiz_questions: number;
  max_chat_words: number;
  max_warnings: number;
}

export const DEFAULT_LIMITS: Limits = {
  max_spans_to_cite: 10,
  max_module_words: 1400,
  max_section_words_hint: 200,
  max_note_prompts_per_section: 3,
  max_key_takeaways: 7,
  max_reflection_prompts: 4,
  max_quiz_questions: 5,
  max_chat_words: 350,
  max_warnings: 8,
};

export const LIMITS_DESCRIPTIONS: Record<keyof Limits, string> = {
  max_spans_to_cite: "Maximum evidence spans cited per generation",
  max_module_words: "Maximum word count for generated modules (binding)",
  max_section_words_hint: "Suggested words per section (advisory)",
  max_note_prompts_per_section: "Note prompts shown per section",
  max_key_takeaways: "Maximum key takeaways per module",
  max_reflection_prompts: "Reflection prompts in module endcap",
  max_quiz_questions: "Maximum quiz questions per module",
  max_chat_words: "Maximum words per chat response",
  max_warnings: "Maximum warnings returned per response",
};

export function getEffectiveLimits(
  packOverrides?: Partial<Limits> | null,
  userOverrides?: Partial<Limits> | null,
): Limits {
  return {
    ...DEFAULT_LIMITS,
    ...(packOverrides ? stripNulls(packOverrides) : {}),
    ...(userOverrides ? stripNulls(userOverrides) : {}),
  };
}

function stripNulls(obj: Record<string, any>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v != null && typeof v === "number" && v > 0) result[k] = v;
  }
  return result;
}
