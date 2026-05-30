export const PLATFORM_KNOWLEDGE = {
  overview:
    "RocketBoard is an AI-powered developer onboarding platform that transforms codebases, documentation, and internal knowledge into structured, interactive learning experiences.",

  phases: {
    setup: "Phase 1: Create an organization and pack. Invite team members and assign roles (Owner, Admin, Author, Learner, Read Only).",
    ingestion: "Phase 2: Connect sources — GitHub repos, Confluence, Notion, Google Drive, SharePoint, Jira, Linear, OpenAPI specs, Postman collections, Figma, Slack channels, Loom videos, PagerDuty, and direct document uploads.",
    planning: "Phase 3: Generate and curate a module plan. The AI analyzes sources, detects signals (technologies, patterns), and proposes modules. Authors can edit, reorder, add, remove, and set prerequisites.",
    generation: "Phase 4: Auto-generate content — modules, quizzes, exercises, glossary, paths, and ask-lead questions. All content starts as draft.",
    learning: "Phase 5: Learners read modules, take quizzes, complete exercises, use AI chat, follow onboarding paths, and track progress.",
    iteration: "Phase 6: Re-sync sources when code changes. Check Content Health for stale content. Refine or regenerate modules.",
  },

  features: {
    modules: "Learning modules with sections, code snippets, citations to source files, and track filtering.",
    quizzes: "Multiple-choice quizzes with AI-generated questions, immediate feedback, code references, and retaking.",
    exercises: "Hands-on coding challenges (find code, explain, config, debug, explore, terminal, free response) with AI review and progressive hints.",
    glossary: "Searchable glossary with definitions, code examples, track filtering, and flashcard mode.",
    paths: "Day 1 and Week 1 onboarding checklists with setup commands, success criteria, and progress tracking.",
    askLead: "AI-curated questions to ask your team lead about architecture, processes, and team culture.",
    teamDirectory: "Team members auto-detected from sources. Meeting tracking with suggested topics.",
    discussions: "Peer discussions, questions, and tips per module. Upvoting, accepted answers, and pinned threads.",
    search: "Global search across modules, glossary, notes, chat history, and source code. Keyboard shortcut: Cmd+K / Ctrl+K.",
    bookmarks: "Save any content for later. Organize in collections with tags. Pin items for quick access.",
    timeline: "30-60-90 day milestone tracking with phase-based progress.",
    chat: "Two AI assistants: Rocket (module-specific, bottom-right) and Mission Control (platform-wide, bottom-left).",
    gamification: "XP points, badges, streaks, and leaderboards for learning activities.",
    notifications: "Email and in-app notifications for invites, milestones, and module publishes.",
    analytics: "Admin analytics dashboard with learner progress, quiz scores, completion heatmaps.",
    darkMode: "Light, dark, and system theme options.",
    export: "Export progress and notes as PDF.",
    offline: "PWA with offline reading capability.",
  },

  navigation: {
    dashboard: "Your home page. Shows progress, continue button, module grid, and smart suggestions.",
    modules: "List of all learning modules with progress and prerequisites.",
    glossary: "Searchable terms with definitions and code examples.",
    paths: "Day 1 and Week 1 onboarding checklists.",
    askLead: "Questions to ask your team lead.",
    team: "Team directory with meeting tracking.",
    discussions: "All discussions across modules.",
    saved: "Your bookmarked content organized in collections.",
    timeline: "Your 30-60-90 day onboarding milestones.",
    settings: "Personalization, preferences, and account settings.",
    help: "Help center with guides and troubleshooting.",
    sources: "Connect and manage knowledge sources (Author+).",
    plan: "Generate and curate the module plan (Author+).",
    review: "Review and publish generated content (Author+).",
    analytics: "Learner progress analytics (Admin+).",
    members: "Manage pack members and invites (Admin+).",
  },

  shortcuts: {
    "Cmd+K / Ctrl+K": "Open global search",
    "Cmd+D / Ctrl+D": "Bookmark current content",
    Escape: "Close modal or search",
    "?": "Show keyboard shortcuts",
    "Arrow keys": "Navigate tour steps",
  },

  troubleshooting: {
    "can't access a page": "Check your access level in Settings. Contact your pack admin if you need elevated access.",
    "module is locked": "Complete the prerequisite module first. Check the modules page for prerequisite details.",
    "AI error": "Rate limit: wait 30 seconds and retry. Network error: check your connection. Other errors: try again or contact admin.",
    "content seems outdated": "Use the feedback button (🚩) to flag it. Authors can check Content Health and refresh stale sections.",
    "quiz question is wrong": "Use the question feedback button after answering. Authors can edit or regenerate questions.",
  },

  tips: [
    "Use Cmd+K to quickly search for anything across modules, glossary, notes, and code.",
    "Bookmark important sections with the 🔖 icon for quick reference later.",
    "Take notes using the suggested prompts — they guide reflection on key concepts.",
    "Click citation badges [S1] to see the actual source code being referenced.",
    "Use the Simplify button if a section feels too advanced for your current level.",
    "Check your Day 1 path first for setup instructions and environment configuration.",
    "Meet the team members listed in the Team Directory during your first two weeks.",
    "Review completed modules when prompted — spaced repetition helps retention.",
    "Use the pre-test option on new modules if you think you already know the content.",
    "Explore the Code Explorer to browse source files referenced in each module.",
  ],
};

export const CONTEXTUAL_SUGGESTIONS: Record<string, { message: string; questions: string[] }> = {
  sources: {
    message: "💡 Need help connecting sources? I can walk you through it.",
    questions: [
      "How do I connect a GitHub repo?",
      "What file types are supported?",
      "How does source ingestion work?",
    ],
  },
  plan: {
    message: "💡 Questions about customizing your plan? Ask me!",
    questions: [
      "How do I customize the module plan?",
      "What are prerequisites?",
      "How do signals work?",
    ],
  },
  modules: {
    message: "💡 Tips for getting the most out of your modules!",
    questions: [
      "How do I take notes on a section?",
      "What do citation badges mean?",
      "How does the quiz work?",
    ],
  },
  review: {
    message: "💡 Need help reviewing content before publishing?",
    questions: [
      "How do I refine a module?",
      "What does publishing do?",
      "How do contradictions work?",
    ],
  },
  settings: {
    message: "💡 Want to customize your experience?",
    questions: [
      "What do the generation limits mean?",
      "How do I change the content language?",
      "What is spaced repetition?",
    ],
  },
  team: {
    message: "💡 Track your 1:1 meetings during onboarding!",
    questions: [
      "How do meeting suggestions work?",
      "Who should I meet first?",
    ],
  },
  glossary: {
    message: "💡 Use flashcard mode to memorize key terms!",
    questions: [
      "How do I use flashcards?",
      "How are glossary terms generated?",
    ],
  },
  default: {
    message: "",
    questions: [
      "How do I get started with RocketBoard?",
      "What should I do first as a new learner?",
      "How do I bookmark content for later?",
      "What keyboard shortcuts are available?",
    ],
  },
};

export function getPageContext(pathname: string): string {
  if (pathname.includes("/sources")) return "sources";
  if (pathname.includes("/plan")) return "plan";
  if (pathname.includes("/review")) return "review";
  if (pathname.includes("/settings")) return "settings";
  if (pathname.includes("/team")) return "team";
  if (pathname.includes("/glossary")) return "glossary";
  if (pathname.includes("/modules/")) return "modules";
  return "default";
}
