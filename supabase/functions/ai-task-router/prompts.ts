/**
 * prompts.ts — pure system-prompt block builders extracted from index.ts (monolith split, stage 1).
 *
 * These are pure string builders (no I/O, no shared module state). Behavior is identical to
 * the originals; index.ts now imports them. Typed as `any` to match the existing envelope
 * shapes verbatim — tightening these types is a follow-up.
 */

export function buildPackBlock(pack: any): string {
  const tracks = (pack.tracks || []).map((t: any) =>
    `- ${t.track_key}: ${t.title}`
  ).join("\n");
  return pack.title
    ? `\n## Pack Context\nPack: ${pack.title}\n${
      pack.description || ""
    }\nTracks:\n${tracks}`
    : "";
}

export function buildLanguageBlock(context: any, pack: any): string {
  const lang = context?.audience_profile?.output_language ||
    context?.output_language || "en";
  if (lang === "en" || pack?.language_mode === "english") return "";
  return `\n## OUTPUT LANGUAGE INSTRUCTION\nWrite ALL user-facing prose (headings, content, explanations, definitions, reflection prompts, quiz questions, option text) in language code "${lang}". NEVER translate: code identifiers, file paths, variable names, IDs, citation fields (span_id, path, chunk_id), or JSON keys. JSON keys must remain in English.\n`;
}

export function buildLearnerProfileBlock(context: any): string {
  const profile = context?.learner_profile;
  if (
    !profile ||
    (!profile.role && !profile.experience_level &&
      !profile.framework_familiarity && profile.learning_style === "balanced" &&
      profile.tone_preference === "standard")
  ) return "";

  const rules = [];
  if (profile.role) {
    rules.push(`- Assume the reader's role is: ${profile.role}`);
  }
  if (profile.experience_level) {
    rules.push(
      `- Adjust explanations for experience level: ${profile.experience_level}`,
    );
  }
  if (profile.framework_familiarity) {
    rules.push(
      `- Use analogies bridging this knowledge: ${profile.framework_familiarity}`,
    );
  }

  if (profile.learning_style === "visual") {
    rules.push(
      `- Maximize the use of Mermaid diagrams and charts to illustrate concepts.`,
    );
  }
  if (profile.learning_style === "text") {
    rules.push(
      `- Provide highly detailed, comprehensive written descriptions without over-relying on diagrams.`,
    );
  }
  if (profile.learning_style === "interactive") {
    rules.push(
      `- Focus heavily on concrete code snippets, examples, and hands-on scenarios.`,
    );
  }

  if (profile.tone_preference === "direct") {
    rules.push(
      `- Use a highly concise, direct, and straight-to-the-point tone. Avoid fluff.`,
    );
  }
  if (profile.tone_preference === "conversational") {
    rules.push(`- Use a friendly, approachable, and encouraging tone.`);
  }
  if (profile.tone_preference === "socratic") {
    rules.push(
      `- Often guide the learner with thought-provoking questions to help them deduce the answer themselves.`,
    );
  }

  if (rules.length === 0) return "";
  return `\n## LEARNER PROFILE INSTRUCTION\nThe user has provided specific learning preferences. YOU MUST adhere to these when formulating your response:\n${
    rules.join("\n")
  }\n`;
}

export function buildMermaidBlock(envelope: any): string {
  const enabled = envelope?.generation_prefs?.include_mermaid_if_supported;
  if (enabled) {
    return `\n## MERMAID DIAGRAMS\nYou may include Mermaid diagrams using \`\`\`mermaid code blocks when they help illustrate architecture, flows, or relationships. Diagrams must be grounded: node labels should reference actual entities from evidence. If evidence is insufficient to create an accurate diagram, omit it and add a warning. Keep diagrams simple and readable.\n`;
  }
  return `\n## MERMAID DIAGRAMS\nDo NOT include any Mermaid diagrams in your output.\n`;
}

export function buildLimitsConstraintBlock(limits: any): string {
  return `\nBINDING CONSTRAINT: Your total module output must not exceed ${
    limits.max_module_words || 1400
  } words. Distribute across sections proportionally. Each section should aim for ~${
    limits.max_section_words_hint || 200
  } words. Chat responses must not exceed ${
    limits.max_chat_words || 350
  } words. Include at most ${limits.max_key_takeaways || 7} key takeaways and ${
    limits.max_quiz_questions || 5
  } quiz questions. These are hard limits — do not exceed them.\n`;
}
