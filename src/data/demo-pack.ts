import { GeneratedModuleData } from "@/hooks/useGeneratedModules";
import { ModulePlanData } from "@/hooks/useModulePlan";

export const DEMO_PACK_DATA = {
  sources: [
    {
      source_type: "github_repo",
      source_uri: "rocketboard/core-engine",
      label: "RocketBoard Core Engine",
      source_config: { branch: "main", visibility: "public" }
    }
  ],
  plan: {
    type: "module_planner",
    request_id: "demo-request",
    pack_version: 1,
    generation_meta: { timestamp_iso: new Date().toISOString(), request_id: "demo-request" },
    detected_signals: [
      { signal_key: "uses_typescript", confidence: "high", explanation: "Found tsconfig.json and .ts files.", citations: [] },
      { signal_key: "has_auth_system", confidence: "high", explanation: "Found supabase/auth folders and middleware.", citations: [] }
    ],
    tracks: [
      { track_key: "foundations", title: "Foundations", description: "Core concepts and architecture" },
      { track_key: "frontend", title: "Frontend Development", description: "UI patterns and components" }
    ],
    module_plan: [
      {
        module_key: "demo-1",
        title: "Platform Overview",
        description: "A high-level look at RocketBoard's vision and architecture.",
        estimated_minutes: 10,
        difficulty: "beginner",
        rationale: "Essential context for all new hires.",
        citations: [],
        track_key: "foundations",
        audience: "technical",
        depth: "standard"
      }
    ],
    contradictions: [],
    warnings: []
  } as ModulePlanData,
  modules: [
    {
      module_key: "demo-1",
      title: "Platform Overview",
      description: "A high-level look at RocketBoard's vision and architecture.",
      estimated_minutes: 10,
      difficulty: "beginner",
      track_key: "foundations",
      status: "published",
      module_data: {
        module_key: "demo-1",
        title: "Platform Overview",
        description: "A high-level look at RocketBoard's vision and architecture.",
        estimated_minutes: 10,
        difficulty: "beginner",
        track_key: "foundations",
        sections: [
          {
            section_id: "sec-1",
            heading: "What is RocketBoard?",
            markdown: "RocketBoard is the world's first **AI-native developer onboarding platform**. It transforms your messy codebase into a structured curriculum for new engineers.",
            learning_objectives: ["Understand the core value prop", "Learn about the generation cascade"],
            note_prompts: ["How would you explain RocketBoard to a non-technical peer?"],
            citations: []
          }
        ],
        endcap: {
          reflection_prompts: ["What part of the architecture is most surprising?"],
          quiz_objectives: ["platform-roots"],
          ready_for_quiz_markdown: "Ready to test your knowledge?"
        },
        key_takeaways: ["RocketBoard uses AI to stay in sync with code.", "Onboarding is versioned to match releases."],
      } as GeneratedModuleData
    }
  ]
};
