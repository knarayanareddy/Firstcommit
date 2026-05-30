export const HELP_TOOLTIPS = {
  // ─── SOURCES PAGE ───────────────────────────────────
  sources: {
    sourceTypes: "RocketBoard can ingest content from GitHub repos, Confluence, Notion, Google Drive (OAuth), SharePoint, Jira, Linear, OpenAPI specs, Postman collections, Figma files, Slack channels, Loom videos, PagerDuty, and uploaded documents.",
    githubRepo: "Enter the full URL of a GitHub repository. RocketBoard will fetch all supported files (.ts, .js, .md, .json, .yaml, Dockerfile, etc.) and extract text content for analysis.",
    googleDriveOAuth: "Connect with your Google Account to import Google Docs, Sheets, and Drive files. A secure OAuth 2.0 popup handles authentication — your credentials are never stored. Tokens auto-refresh so you only reconnect if you revoke access.",
    documentUpload: "Upload files directly from your computer. Supported formats: PDF, DOCX, XLSX, PPTX, MD, TXT, CSV, HTML, JSON, YAML. Max 50MB per file, up to 20 files at once.",
    documentUrl: "Import content from any public URL. Single page mode fetches just that page. Crawl mode follows internal links to import an entire documentation site.",
    syncButton: "Re-fetches content from the original source and updates knowledge chunks. All syncs are protected by a multi-stage security audit and SHA256 content hashing for verified integrity.",
    chunkCount: "Knowledge chunks are **heading-aware** segments (~100-150 lines of code or ~500 words of text). Our parsers use **deterministic IDs** to ensure citations remain stable across syncs.",
    browseChunks: "View the individual text segments extracted from this source. Reindexing is protected by a **Concurrent Lease Lock** and a mandatory security audit gate.",
  },

  // ─── PLAN PAGE ──────────────────────────────────────
  plan: {
    generatePlan: "The AI analyzes your ingested sources and proposes a structured set of onboarding modules. You can edit, reorder, add, or remove modules before approving.",
    detectedSignals: "Signals are technologies, patterns, and practices the AI detected in your sources (e.g., 'Uses TypeScript', 'Has CI/CD Pipeline'). They explain why specific modules were proposed.",
    signalConfidence: "High: strong evidence from multiple files. Medium: some evidence but not definitive. Low: inferred from limited references.",
    proposedTracks: "Tracks are learning paths for different roles (e.g., Frontend, Backend, Infrastructure). The AI proposes tracks based on your codebase structure. You can accept, modify, or skip them.",
    moduleDifficulty: "Beginner: foundational concepts, no prior context needed. Intermediate: builds on basics, assumes some familiarity. Advanced: deep dives, assumes strong foundational knowledge.",
    estimatedMinutes: "Approximate time to read all sections in this module. Based on word count and content complexity. Does not include quiz or exercise time.",
    prerequisiteHard: "Hard prerequisite: the module is LOCKED for learners until the required module is completed to the specified percentage. Learners cannot access the content at all.",
    prerequisiteSoft: "Soft prerequisite: learners see a RECOMMENDATION to complete the required module first, but can choose to proceed anyway. Use this for 'nice to have' ordering.",
    prerequisiteMinCompletion: "The percentage of sections the learner must have read in the prerequisite module. 100% means all sections. 80% allows some flexibility.",
    prerequisiteMinQuiz: "Minimum quiz score required on the prerequisite module. Set to 0 to skip the quiz requirement. Set to 70+ to ensure comprehension before advancing.",
    templateAssignment: "Templates are reusable blueprints that define a standard section structure for generated modules (e.g., always include Overview, API Endpoints, Deployment sections).",
    saveDraft: "Saves your current edits without approving. You can come back and continue editing later.",
    approvePlan: "Locks the plan and enables content generation. After approval, the plan becomes read-only. You can regenerate a new plan if needed.",
    dependencyGraph: "Visual map showing which modules depend on which. Arrows point from prerequisites to dependent modules. Colors indicate completion status.",
  },

  // ─── GENERATION & REVIEW ────────────────────────────
  generation: {
    cascadeGeneration: "Content is generated in sequence: each module → its quiz → its exercises, then glossary → paths → ask-lead questions. Every step includes a **Runtime Grounding Audit** to verify accuracy.",
    draftStatus: "Generated content starts as 'draft' — only visible to authors. Learners cannot see draft content. You must review and publish to make it available.",
    publishPack: "Publishing changes all draft content to 'published' status, making it immediately visible to all learners in this pack. You can continue editing and re-publishing after the initial publish.",
    incrementalPublish: "When you update a module after publishing, the new version starts as draft while the old published version remains visible to learners. Publish the new version when ready.",
    refineModule: "Tell the AI what to change in natural language. The AI will update the module and provide a change log explaining what was modified and why.",
    regenerateModule: "Completely regenerates the module from scratch using current evidence spans. This replaces all content. Use 'Refine' for targeted changes instead.",
    contradictions: "The AI detected conflicting information in your source files. Both sides are shown with their evidence. Review and resolve by checking which source is current.",
    aiRemediation: "The AI Agent has drafted an automatic update for this module because the underlying source code changed. Review the draft to accept the fix.",
    generationStats: "Shows how the generated content compares to the configured limits: word count, section count, citation count, and schema validation status.",
  },

  // ─── MODULE VIEW ────────────────────────────────────
  moduleView: {
    trackFilter: "Filter sections by role track. 'All Tracks' shows everything. Selecting a track shows only sections relevant to that role. Content isn't hidden permanently — just filtered.",
    markAsRead: "Marks this section as completed. Your progress is saved immediately and counts toward module completion percentage.",
    simplifySection: "Generates a simpler version of this section adapted to your audience preference. The original content is preserved — you can toggle between original and simplified.",
    notePrompts: "Suggested reflection questions to guide your note-taking. Click a prompt to add it to your notes. These are suggestions — write whatever helps you learn.",
    citationBadge: "References to the actual source code or documents that support this content. Click to view the original source with syntax highlighting.",
    codeExplorer: "Browse the actual source files relevant to this module. Files are organized in a tree view with syntax-highlighted code and annotation highlighting for cited sections.",
    keyFiles: "The most important source files referenced in this module. Click 'View Code' to see the syntax-highlighted source or 'View Original' to open it in GitHub.",
    endcap: "Reflection section that appears after you've read all sections. Review the prompts before taking the quiz to reinforce key concepts.",
    exerciseHints: "Hints are progressive — each one is more specific than the last. Try to solve the exercise before using hints. Hint usage is tracked but doesn't affect your score.",
    exerciseAIReview: "Your submission is reviewed by the AI using the module's source evidence. Feedback includes a score and suggestions for improvement. You can revise and resubmit.",
    preTest: "Optional knowledge check before reading the module. If you score 80%+, you can skip directly to the full quiz. Useful for experienced hires who may already know the material.",
    discussionTypes: "Discussion: general conversation about the content. Question: something you need answered (can be marked as resolved). Tip: a helpful insight to share with other learners.",
    progressiveDisclosure: "RocketBoard proactively monitors your progress. If you get stuck (dwell time > 90s, chat errors, or chat bouncing), a hint will appear to guide you with small steps or pre-filled AI prompts.",
  },

  // ─── QUIZ ───────────────────────────────────────────
  quiz: {
    quizTab: "Multiple-choice quiz testing your comprehension of the module content. Scores are saved and can be improved by retaking. Questions include explanations with code references.",
    questionFeedback: "Help improve quiz quality by rating questions. If a question is confusing or unfair, your feedback helps the author improve it.",
    areasToReview: "Based on your wrong answers, these are the module sections most likely to help you understand the concepts you missed.",
    retakeQuiz: "Retaking updates your score — it doesn't create a separate record. Your best score is what counts for completion.",
  },

  // ─── SETTINGS ───────────────────────────────────────
  settings: {
    audienceProfile: "Controls the language style of AI-generated content. Technical: shows code and implementation details. Non-Technical: focuses on concepts and workflows. Mixed: balances both.",
    contentDepth: "Shallow: quick overviews, minimal detail. Standard: balanced depth for most learners. Deep: comprehensive with in-depth explanations and edge cases.",
    glossaryDensity: "Low: only essential/critical terms. Standard: common terms most people need. High: comprehensive glossary including niche and advanced terms.",
    generationLimits: "These control the maximum size of AI-generated content. Max Module Words is a hard limit — the AI will not exceed it. Section Words Hint is advisory guidance.",
    maxModuleWords: "The binding constraint for module generation. The AI distributes this word budget across all sections. Default: 1400 words. Increase for more detailed content.",
    maxQuizQuestions: "Maximum number of multiple-choice questions generated per module quiz. Default: 5.",
    mermaidEnabled: "When enabled, the AI may include visual diagrams (architecture, data flow, sequence diagrams) in generated content. Diagrams are rendered inline.",
    targetReadingLevel: "Plain: simple language, short sentences. Standard: normal technical writing. Technical: dense, assumes familiarity with jargon.",
    resetProgress: "Permanently deletes ALL your progress for this pack: reading progress, quiz scores, notes, path progress, ask-lead progress, chat history, bookmarks, and exercise submissions. This cannot be undone.",
    spacedRepetition: "When enabled, completed modules are scheduled for review at increasing intervals (3 days, 1 week, 2 weeks, 1 month) to help with long-term retention.",
    peerPrivacy: "Controls what other learners in your cohort can see. Your notes are ALWAYS private regardless of this setting. Only your progress percentage and discussion posts are affected.",
    languagePreference: "AI-generated content (modules, quizzes, glossary, chat) will be in your selected language. Code, file paths, and technical identifiers are never translated.",
    themeToggle: "Light: standard light theme. Dark: reduced eye strain in low-light environments. System: automatically matches your device's dark/light mode setting.",
    learnerRole: "Your job title or role (e.g., 'Frontend Developer', 'SRE', 'QA Engineer'). Used to personalize AI responses and content recommendations.",
    experienceLevel: "New: less than 1 year in this role. Mid: 1-5 years of experience. Senior: 5+ years. Affects content depth and pre-test thresholds.",
    learningStyle: "Visual: more diagrams and charts. Text-heavy: detailed descriptions. Interactive: more code snippets and examples.",
    frameworkFamiliarity: "Tells the AI to use analogies bridging what you know to what you're learning (e.g., 'I know React').",
    tonePreference: "Direct: concise and straight-to-the-point. Conversational: friendly. Socratic: guides you with questions.",
    aiModelProvider: "Bring Your Own Key (BYOK). Substitute the default AI model by providing your own API key for OpenAI, Anthropic, Google, and more. Keys are encrypted.",
  },

  // ─── MEMBERS PAGE ───────────────────────────────────
  members: {
    accessLevels: "Owner: full control including deleting the pack. Admin: manage members, settings, and all content. Author: create and edit content, view analytics. Learner: read content, take quizzes, use chat. Read Only: view content only, no interactions.",
    pendingInvite: "This person has been invited but hasn't signed up yet. They'll be automatically added to this pack when they create their account with this email address.",
    emailInvite: "Enter the email address to invite. If they already have a RocketBoard account, they'll be added immediately. If not, they'll receive an invitation email.",
  },

  // ─── ANALYTICS ──────────────────────────────────────
  analytics: {
    activeUsers: "Learners who have made any progress (read a section, taken a quiz, etc.) in the last 30 days.",
    avgProgress: "The average overall completion percentage across all active learners. Includes section reading progress only (not quizzes or exercises).",
    avgQuizScore: "The average quiz score across all quiz attempts by all learners. Each learner's most recent attempt per module is used.",
    timeToFiftyPercent: "The average number of days between a learner's first activity and reaching 50% overall progress. Indicates how quickly learners are ramping up.",
    completionHeatmap: "Green: module completed (100%). Yellow: in progress. Gray: not started. Click a cell to see detailed progress for that learner-module combination.",
    questionCorrectRate: "Percentage of learners who answered this question correctly. Below 40% suggests the question may be confusing or the content may not cover the concept well enough.",
  },

  // ─── PATHS ──────────────────────────────────────────
  paths: {
    day1Tab: "Tasks to complete on your first day. Focus on environment setup, access requests, and meeting your immediate team.",
    week1Tab: "Tasks for your first full week. Covers deeper exploration of the codebase, completing initial modules, and understanding team workflows.",
    successCriteria: "Concrete outcomes that verify you've completed the step successfully. Check these against your actual results.",
    setupChecklist: "Interactive command checklist. Click 'Copy' to copy each command to your clipboard, then run it in your terminal. Check off each command as you complete it.",
  },

  // ─── TEAM DIRECTORY ─────────────────────────────────
  team: {
    autoDetected: "This team member was automatically detected from source files (CODEOWNERS, Git commits, PagerDuty, etc.). Authors can edit these entries to add more detail.",
    meetingProgress: "Track which team members you've had 1:1 conversations with during onboarding. Suggested topics help you have productive conversations.",
  },

  // ─── TIMELINE ───────────────────────────────────────
  timeline: {
    milestoneStatus: "Completed: all criteria met. In Progress: partially done. Pending: not started. Overdue: past the expected completion date for this phase.",
    onTrackStatus: "On Track: current phase milestones are progressing as expected. Behind: previous phase has incomplete required milestones. Ahead: already working on future phase milestones.",
  },

  // ─── CONTENT HEALTH ─────────────────────────────────
  contentHealth: {
    freshnessScore: "Percentage of cited evidence chunks that still match their content at the time the module was generated. 100% means all source code is unchanged. Lower means sources have changed.",
    staleContent: "This section references source files that have been modified since the content was generated. For GitHub integrations, the AI will automatically draft an update to reflect the changes.",
    viewDiff: "Compare the source code as it was when the module was generated versus how it looks now. Helps you judge whether the changes are significant enough to regenerate.",
  },

  // ─── BOOKMARKS ──────────────────────────────────────
  bookmarks: {
    collections: "Organize your saved items into named groups (e.g., 'Auth References', 'Setup Commands', 'Review Later'). Bookmarks without a collection appear in 'Uncategorized'.",
    pinnedItems: "Pinned bookmarks appear on your dashboard for the quickest possible access. Max 5 pinned items.",
    tags: "Add custom tags to bookmarks for flexible cross-cutting organization. Filter by tag on the Saved Items page.",
  },

  // ─── DISCUSSIONS ────────────────────────────────────
  discussions: {
    upvote: "Upvote helpful discussions and replies to surface the best content. You can remove your upvote by clicking again.",
    acceptedAnswer: "For question threads, the original author or an admin can mark a reply as the accepted answer. This helps other learners find the solution quickly.",
    pinnedThread: "Pinned discussions always appear at the top of the list. Authors and admins can pin important announcements or frequently-asked questions.",
  },

  // ─── GAMIFICATION ───────────────────────────────────
  gamification: {
    xp: "Experience Points earned by completing learning activities. Read sections (+10), complete modules (+50), perfect quizzes (+30), save notes (+5), and more.",
    streak: "Consecutive days with learning activity. Streaks reset if you miss a day. Longer streaks earn bonus XP.",
    badges: "Achievements earned by reaching milestones. View all available badges and your progress toward each in your Profile.",
    leaderboard: "Ranks learners in this pack by total XP. Your position is always shown even if you're not in the top 10.",
  },

  // ─── GLOBAL ─────────────────────────────────────────
  global: {
    globalSearch: "Search across all content: modules, glossary, your notes, code, and chat history. Protected by centralized zero-trust auth, strict CORS hardening, and Titanium-Hardened Hybrid Search.",
    rocketChat: "Module-specific AI assistant. Ask questions about the current module's content. Responses follow a **4-stage Zero-Hallucination pipeline** with automated grounding audits, trace-level observability, and security-first retrieval from the Titanium-Hardened search engine.",
    missionControl: "Platform-wide AI assistant. Ask about RocketBoard features, navigation help, onboarding tips, or anything not specific to a single module.",
    packSelector: "Switch between different packs. Each pack has its own sources, content, progress, and team. Your progress is saved separately per pack.",
  },

  // ─── ROADMAP & BUILDER ──────────────────────────────
  roadmap: {
    phases: "Onboarding is split into 3 phases: 0-30, 31-60, and 61-90 days. This helps focus your learning on what matters most for your current stage.",
    itemStatus: "Blocked: prerequisite not met. Available: ready to start. In Progress: currently working on it. Done: completed.",
    autoProgress: "Items linked to modules, quizzes, or sections update automatically as you complete the underlying content.",
    phaseProgress: "Shows your overall completion percentage for this specific phase of onboarding.",
  },
  roadmapBuilder: {
    createPlaylist: "A playlist is a collection of requirements for a specific phase. You can have multiple playlists per pack (e.g., 'Core', 'Frontend Branch').",
    assignUser: "Assign a playlist to an individual learner. You can set a custom start date and assign a mentor/lead to oversee their progress.",
    manageItems: "Add modules, sections, quizzes, Platform Docs, or custom tasks to the playlist. Drag to reorder or click the chain icon to set dependencies.",
    dependencyCycle: "The system prevents circular dependencies. An item cannot depend on itself or an item that eventually depends on it.",
  },

  // ─── PLATFORM DOCS ──────────────────────────────────
  docs: {
    librarySearch: "Instantly filter the documents by title, synopsis, or topic.",
    markDoneButton: "Mark this document as 'Done'. Your progress is saved automatically, and any Roadmap assignments linking to this document will accurately reflect your completion.",
    askRocketWidget: "Brings up Rocket—an AI assistant with full context of this exact document. Ask clarification questions about confusing steps, and Rocket will answer securely.",
    syncDocsButton: "Triggers the Edge Function to securely retrieve the latest `.txt` or `.md` files from the configured GitHub repository. The function redacts secrets and reconstructs the documents into interactive React blocks.",
  },
} as const;
