import type { EvidenceSpan } from "@/hooks/useEvidenceSpans";
import { DEFAULT_LIMITS, getEffectiveLimits, type Limits } from "@/lib/limits";

interface PackInfo {
  pack_id: string | null;
  pack_version?: number;
  title?: string | null;
  description?: string | null;
  language_mode?: string | null;
  tracks?: { track_key: string; title: string; description?: string | null }[];
}

interface AuthInfo {
  user_id: string | null;
  org_id?: string | null;
  roles?: string[];
  pack_access_level?: string | null;
}

interface AudienceProfile {
  audience?: string;
  depth?: string;
  glossary_density?: string;
  output_language?: string;
}

interface LearnerProfile {
  role?: string | null;
  experience_level?: string | null;
  learning_style?: string;
  framework_familiarity?: string | null;
  tone_preference?: string;
}

interface GenerationPrefsInput {
  include_mermaid_if_supported?: boolean;
  target_reading_level?: string;
  max_sections_hint?: number;
}

interface LimitsOverrides {
  max_module_words?: number;
  max_quiz_questions?: number;
  max_key_takeaways?: number;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

function baseEnvelope(
  taskType: string,
  auth: AuthInfo,
  pack: PackInfo,
  genPrefs?: GenerationPrefsInput,
  limitsOverrides?: LimitsOverrides,
  learnerProfile?: LearnerProfile,
) {
  return {
    task: {
      type: taskType,
      request_id: crypto.randomUUID(),
      timestamp_iso: new Date().toISOString(),
    },
    auth: {
      actor_type: auth.user_id ? "user" : "anonymous",
      user_id: auth.user_id,
      org_id: auth.org_id || null,
      roles: auth.roles || [],
      pack_permissions: {
        pack_id: pack.pack_id,
        access_level: auth.pack_access_level || null,
      },
    },
    pack: {
      pack_id: pack.pack_id,
      pack_version: pack.pack_version || 1,
      title: pack.title || null,
      description: pack.description || null,
      language_mode: pack.language_mode || "english",
      tracks: pack.tracks || [],
    },
    context: {
      current_module_key: null as string | null,
      current_track_key: null as string | null,
      output_language: null as string | null,
      audience_profile: { audience: "technical", depth: "standard", glossary_density: "standard", output_language: "en" } as AudienceProfile,
      learner_profile: { 
        role: learnerProfile?.role || null, 
        experience_level: learnerProfile?.experience_level || null,
        learning_style: learnerProfile?.learning_style || "balanced",
        framework_familiarity: learnerProfile?.framework_familiarity || null,
        tone_preference: learnerProfile?.tone_preference || "standard"
      },
      learner_state: { completed_module_keys: [], last_opened_module_key: null, last_opened_track_key: null },
      author_instruction: null as string | null,
      conversation: { conversation_id: null, messages: [] as ConversationMessage[] },
      ui_capabilities: { notes_enabled: true, quiz_enabled: true, quiz_shown_at_end_of_module: true, quiz_required_for_completion: false },
    },
    templates: { applied_templates: [] },
    retrieval: { query: null as string | null, evidence_spans: [] as EvidenceSpan[], detective_mode: false as boolean },
    inputs: {
      module_revision: null,
      existing_module: null,
      module: null,
      existing_template: null,
      original_section_markdown: null,
    },
    generation_prefs: {
      include_mermaid_if_supported: genPrefs?.include_mermaid_if_supported ?? true,
      target_reading_level: genPrefs?.target_reading_level ?? "plain",
      max_sections_hint: genPrefs?.max_sections_hint ?? 7,
    },
    limits: getEffectiveLimits(
      limitsOverrides ? {
        max_module_words: limitsOverrides.max_module_words,
        max_quiz_questions: limitsOverrides.max_quiz_questions,
        max_key_takeaways: limitsOverrides.max_key_takeaways,
      } : null,
    ),
    expected_output_schema: {},
  };
}

// Common opts shared across builders
interface CommonOpts {
  auth: AuthInfo;
  pack: PackInfo;
  audienceProfile?: AudienceProfile;
  learnerProfile?: LearnerProfile;
  generationPrefs?: GenerationPrefsInput;
  limitsOverrides?: LimitsOverrides;
  evidenceSpans?: EvidenceSpan[];
  detectiveMode?: boolean;
}

function applyCommon(env: ReturnType<typeof baseEnvelope>, opts: CommonOpts) {
  if (opts.audienceProfile) env.context.audience_profile = { ...env.context.audience_profile, ...opts.audienceProfile };
  env.retrieval.evidence_spans = opts.evidenceSpans || [];
  if (opts.detectiveMode !== undefined) env.retrieval.detective_mode = opts.detectiveMode;
}

export function buildChatEnvelope(opts: CommonOpts & {
  messages: ConversationMessage[];
  moduleKey?: string | null;
  trackKey?: string | null;
  query?: string;
}) {
  const env = baseEnvelope("chat", opts.auth, opts.pack, opts.generationPrefs, opts.limitsOverrides, opts.learnerProfile);
  applyCommon(env, opts);
  env.context.conversation.messages = opts.messages;
  env.context.current_module_key = opts.moduleKey || null;
  env.context.current_track_key = opts.trackKey || null;
  env.retrieval.query = opts.query || null;
  return env;
}

export function buildGlobalChatEnvelope(opts: CommonOpts & {
  messages: ConversationMessage[];
  query?: string;
  platformContext?: Record<string, any>;
}) {
  const env = baseEnvelope("global_chat", opts.auth, opts.pack, opts.generationPrefs, opts.limitsOverrides, opts.learnerProfile);
  applyCommon(env, opts);
  env.context.conversation.messages = opts.messages;
  env.context.current_module_key = null;
  env.context.current_track_key = null;
  env.retrieval.query = opts.query || null;
  if (opts.platformContext) {
    (env as any).platform_context = opts.platformContext;
  }
  return env;
}

export function buildModulePlannerEnvelope(opts: CommonOpts) {
  const env = baseEnvelope("module_planner", opts.auth, opts.pack, opts.generationPrefs, opts.limitsOverrides, opts.learnerProfile);
  applyCommon(env, opts);
  env.retrieval.query = "architecture setup configuration deployment infrastructure code structure";
  return env;
}

export function buildGenerateModuleEnvelope(opts: CommonOpts & {
  moduleKey: string;
  moduleTitle: string;
  moduleDescription?: string;
  trackKey?: string | null;
  moduleRevision?: number;
}) {
  const env = baseEnvelope("generate_module", opts.auth, opts.pack, opts.generationPrefs, opts.limitsOverrides, opts.learnerProfile);
  applyCommon(env, opts);
  env.retrieval.query = `${opts.moduleTitle} ${opts.moduleDescription || ""}`;
  env.context.current_module_key = opts.moduleKey;
  env.context.current_track_key = opts.trackKey || null;
  env.inputs.module_revision = opts.moduleRevision || 1;
  (env.inputs as any).module = {
    module_key: opts.moduleKey,
    title: opts.moduleTitle,
    description: opts.moduleDescription || "",
    track_key: opts.trackKey || null,
  };
  return env;
}

export function buildGenerateQuizEnvelope(opts: CommonOpts & {
  moduleKey: string;
  trackKey?: string | null;
  moduleData?: any;
}) {
  const env = baseEnvelope("generate_quiz", opts.auth, opts.pack, opts.generationPrefs, opts.limitsOverrides, opts.learnerProfile);
  applyCommon(env, opts);
  env.context.current_module_key = opts.moduleKey;
  env.context.current_track_key = opts.trackKey || null;
  env.retrieval.query = `${opts.moduleKey} quiz assessment`;
  if (opts.moduleData) (env.inputs as any).existing_module = opts.moduleData;
  return env;
}

export function buildGenerateGlossaryEnvelope(opts: CommonOpts & {
  glossaryDensity?: string;
}) {
  const env = baseEnvelope("generate_glossary", opts.auth, opts.pack, opts.generationPrefs, opts.limitsOverrides, opts.learnerProfile);
  applyCommon(env, opts);
  env.retrieval.query = "glossary terms definitions technical vocabulary";
  env.context.audience_profile = {
    ...env.context.audience_profile,
    glossary_density: opts.glossaryDensity || "standard",
    ...opts.audienceProfile,
  };
  return env;
}

export function buildGeneratePathsEnvelope(opts: CommonOpts) {
  const env = baseEnvelope("generate_paths", opts.auth, opts.pack, opts.generationPrefs, opts.limitsOverrides, opts.learnerProfile);
  applyCommon(env, opts);
  env.retrieval.query = "setup onboarding getting started environment workflow";
  return env;
}

export function buildGenerateAskLeadEnvelope(opts: CommonOpts) {
  const env = baseEnvelope("generate_ask_lead", opts.auth, opts.pack, opts.generationPrefs, opts.limitsOverrides, opts.learnerProfile);
  applyCommon(env, opts);
  env.retrieval.query = "team lead questions onboarding process workflow architecture decisions";
  return env;
}

export function buildSimplifySectionEnvelope(opts: CommonOpts & {
  moduleKey: string;
  sectionId: string;
  originalMarkdown: string;
  trackKey?: string | null;
}) {
  const env = baseEnvelope("simplify_section", opts.auth, opts.pack, opts.generationPrefs, opts.limitsOverrides, opts.learnerProfile);
  applyCommon(env, opts);
  env.context.current_module_key = opts.moduleKey;
  env.context.current_track_key = opts.trackKey || null;
  env.retrieval.query = opts.originalMarkdown.slice(0, 200);
  env.inputs.original_section_markdown = opts.originalMarkdown;
  (env.inputs as any).section_id = opts.sectionId;
  return env;
}

export function buildRefineModuleEnvelope(opts: CommonOpts & {
  existingModule: any;
  authorInstruction: string;
  moduleKey: string;
  trackKey?: string | null;
  moduleRevision: number;
}) {
  const env = baseEnvelope("refine_module", opts.auth, opts.pack, opts.generationPrefs, opts.limitsOverrides, opts.learnerProfile);
  applyCommon(env, opts);
  env.context.current_module_key = opts.moduleKey;
  env.context.current_track_key = opts.trackKey || null;
  env.context.author_instruction = opts.authorInstruction;
  env.retrieval.query = `${opts.existingModule?.title || opts.moduleKey} ${opts.authorInstruction}`;
  env.inputs.existing_module = opts.existingModule;
  env.inputs.module_revision = opts.moduleRevision;
  return env;
}

export function buildCreateTemplateEnvelope(opts: { auth: AuthInfo; pack: PackInfo; authorInstruction: string; generationPrefs?: GenerationPrefsInput; limitsOverrides?: LimitsOverrides; learnerProfile?: LearnerProfile }) {
  const env = baseEnvelope("create_template", opts.auth, opts.pack, opts.generationPrefs, opts.limitsOverrides, opts.learnerProfile);
  env.context.author_instruction = opts.authorInstruction;
  return env;
}

export function buildRefineTemplateEnvelope(opts: { auth: AuthInfo; pack: PackInfo; existingTemplate: any; authorInstruction: string; generationPrefs?: GenerationPrefsInput; limitsOverrides?: LimitsOverrides; learnerProfile?: LearnerProfile }) {
  const env = baseEnvelope("refine_template", opts.auth, opts.pack, opts.generationPrefs, opts.limitsOverrides, opts.learnerProfile);
  env.context.author_instruction = opts.authorInstruction;
  env.inputs.existing_template = opts.existingTemplate;
  return env;
}
