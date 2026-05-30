export const XP_RULES = {
  section_read: { amount: 10, reason: "section_read" },
  module_complete: { amount: 50, reason: "module_complete" },
  quiz_pass: { amount: 30, reason: "quiz_pass" },
  quiz_perfect: { amount: 50, reason: "quiz_perfect" },
  path_step: { amount: 15, reason: "path_step" },
  ask_lead: { amount: 5, reason: "ask_lead" },
  streak_3: { amount: 25, reason: "streak_3_days" },
  streak_7: { amount: 75, reason: "streak_7_days" },
  streak_30: { amount: 200, reason: "streak_30_days" },
} as const;

export type XPRuleKey = keyof typeof XP_RULES;
