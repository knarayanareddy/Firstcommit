export type HelpCategory =
  | "getting-started"
  | "sources"
  | "content-creation"
  | "learning"
  | "collaboration"
  | "settings"
  | "troubleshooting"
  | "keyboard-shortcuts"
  | "whats-new"
  | "vs-code-extension"
  | "tech-implementation";

export type HelpArticle = {
  id: string;
  slug: string;
  title: string;
  category: HelpCategory;
  audience: ("admin" | "author" | "learner" | "all")[];
  tags: string[];
  summary: string;
  content: string;
  relatedArticles?: string[];
  lastUpdated: string;
};

export const HELP_CATEGORY_META: Record<HelpCategory, { icon: string; label: string }> = {
  "getting-started": { icon: "ðŸš€", label: "Getting Started" },
  sources: { icon: "ðŸ“¦", label: "Sources" },
  "content-creation": { icon: "âœ�ï¸�", label: "Content Creation" },
  learning: { icon: "ðŸ“š", label: "Learning" },
  collaboration: { icon: "ðŸ‘¥", label: "Collaboration" },
  settings: { icon: "âš™ï¸�", label: "Settings" },
  troubleshooting: { icon: "ðŸ”§", label: "Troubleshooting" },
  "keyboard-shortcuts": { icon: "âŒ¨ï¸�", label: "Shortcuts" },
  "whats-new": { icon: "âœ¨", label: "What's New" },
  "vs-code-extension": { icon: "ðŸ”Œ", label: "VS Code Extension" },
  "tech-implementation": { icon: "ðŸ› ï¸�", label: "Tech Implementation" },
};

export const HELP_ARTICLES: HelpArticle[] = [
  // â”€â”€â”€ GETTING STARTED â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "gs-1",
    slug: "what-is-rocketboard",
    title: "What is RocketBoard?",
    category: "getting-started",
    audience: ["all"],
    tags: ["overview", "introduction", "platform"],
    summary: "Overview of the platform â€” what it does, who it's for.",
    lastUpdated: "2026-03-15",
    content: `# Welcome to RocketBoard ðŸš€

RocketBoard is an **AI-powered Zero-Hallucination RAG platform** that transforms your codebase, documentation, and internal knowledge into structured, interactive learning experiences.

## Your Learning Journey

:::step[1. Ingest]{ðŸ“¦}
Connect your GitHub repos, Notion docs, and Slack channels. Our **Titanium-Hardened** AST-Aware parser builds a technical map of your knowledge, protected by a 4-Stage Zero-Hallucination Pipeline and grounding audits.
:::

:::step[2. Plan]{ðŸ—ºï¸�}
AI analyzes the map and proposes a logical learning path. You curate the modules, tracks, and templates.
:::

:::step[3. Generate]{âœ¨}
Click a button to generate rich modules, quizzes, and glossary termsâ€”all **Grounded** in your actual source code.
:::

:::step[4. Ramp Up]{ðŸ�…}
Learners consume content at their own pace, ask questions via **Rocket Chat**, and earn XP as they master the codebase.
:::

## Who uses RocketBoard?

:::card[Admins & Owners]{ðŸ›¡ï¸�}
**Set the Strategy:** Define organization-wide standards and manage the overall onboarding portfolio.
:::

:::card[Authors & Experts]{âœ�ï¸�}
**Curate the Knowledge:** Refine AI drafts, verify technical accuracy, and publish content to your team.
:::

:::card[Learners & New Hires]{ðŸŽ“}
**Accelerate Onboarding:** Get up to speed on complex repositories in days, not months, with AI-guided learning.
:::

:::card[Rocket's Pro-Tip]{ðŸš€}
Ready to see it in action? Use the button below to ask our Mission Control assistant anything about the platform!
:::

[UI_ACTION: open_help(Ask Mission Control)]`,
    relatedArticles: ["gs-2", "gs-1"],
  },
  // â”€â”€â”€ ROADMAPS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "rm-1",
    slug: "roadmap-admin-guide",
    title: "Administrating Structured Roadmaps",
    category: "tech-implementation",
    audience: ["admin"],
    tags: ["roadmap", "setup", "rollout", "admin"],
    summary: "Technical guide for rolling out and managing structured onboarding roadmaps.",
    lastUpdated: "2026-03-29",
    content: `# Administrating Structured Roadmaps ðŸ—ºï¸�

Structured Roadmaps turn onboarding from "content + chat" into a program with timelines, accountability, and clear progress.

## 1. Rollout & Activation
The feature is disabled by default to allow for per-pack piloting. To enable it for a specific pack, an admin must set the \`roadmap_enabled\` flag.

:::card[Enable via SQL]{âš™ï¸�}
\`\`\`sql
UPDATE public.packs SET roadmap_enabled = TRUE WHERE id = 'YOUR_PACK_ID';
\`\`\`
:::

## 2. Setting Up Your First Playlist
Navigate to **Roadmap Builder** to create your first structured playlist.
- **Phases:** Group items into **Day 1-30**, **Day 31-60**, or **Day 61-90**.
- **Assignments:** Assign playlists to specific learners with a start date and a mentor.

## 3. Managing Dependencies
Prevent information overload by setting dependencies between items.
- Items are **Locked** until their prerequisites are completed.
- The system automatically detects completion of linked modules, quizzes, and sections.

## 4. Integrity & Security
- **Cycle Prevention:** The database prevents circular dependencies.
- **RLS isolation:** Roadmaps are strictly scoped to the pack level.
- **Audit Logs:** Every status transition is tracked for accountability.`,
    relatedArticles: ["rm-2", "gs-2"],
  },
  {
    id: "rm-2",
    slug: "roadmap-learner-guide",
    title: "Using Your Onboarding Roadmap",
    category: "learning",
    audience: ["learner", "all"],
    tags: ["roadmap", "progress", "onboarding"],
    summary: "How to use your personalized onboarding roadmap to track your progress.",
    lastUpdated: "2026-03-29",
    content: `# Charting Your Journey ðŸ—ºï¸�

Welcome to your personalized onboarding roadmap! This page shows exactly what you need to do and when to do it.

## Your Learning Phases
Your roadmap is organized into three key phases to help you ramp up effectively without being overwhelmed.
- **Day 1-30:** Foundations and setup.
- **Day 31-60:** Feature ownership and deeper exploration.
- **Day 61-90:** Full autonomy and advanced mastery.

## Understanding Item States
- **Locked (ðŸ”’):** This item is blocked by a prerequisite. Hover to see what you need to finish first.
- **Up Next:** Available for you to start now.
- **In Progress:** You've started this item.
- **Completed (âœ…):** Well done! You've mastered this requirement.

## Automatic Progress
If a roadmap item is linked to a module or quiz, RocketBoard will **automatically** mark it as completed once you finish the linked content. No manual check-ins required!

:::card[Rocket's Pro-Tip]{ðŸš€}
Focus on the items in your current phase. If you're blocked, check the "Blocked by" message to find your next available task.
:::`,
    relatedArticles: ["rm-1", "learn-1"],
  },
  {
    id: "gs-2",
    slug: "seven-phase-flow",
    title: "The 7-Phase Setup Flow",
    category: "getting-started",
    audience: ["admin", "author"],
    tags: ["setup", "workflow", "phases"],
    summary: "Step-by-step walkthrough of the complete RocketBoard setup flow.",
    lastUpdated: "2026-03-19",
    content: `# The 7-Phase Setup Flow

Getting your team ramped up on a new codebase follows this battle-tested seven-phase journey.

:::step[Phase 1: Setup]
Create your organization and your first pack. Invite team members and assign roles (Owner, Admin, Author, Learner, Read Only).
:::

:::step[Phase 2: Ingestion]
Connect your knowledge sources. Supported: GitHub repos, Confluence, Notion, Google Drive, SharePoint, Jira, Linear, and more.
:::

:::step[Phase 3: Planning]
AI analyzes your sources to propose a module roadmap. Review detected signals, tracks, and prerequisites before approving.
:::

:::step[Phase 4: Generation]
Generate all content in one cascade: modules â†’ quizzes â†’ exercises â†’ glossary â†’ paths â†’ ask-lead questions.
:::

:::step[Phase 5: Learning]
Learners read modules, take quizzes, complete exercises, explore the glossary, and track milestones on their dashboard.
:::

:::step[Phase 6: Iteration]
Re-sync sources when code changes. Check **Content Health** for stale indicators and approve AI-drafted remedies.
:::

:::step[Phase 7: Observability]{ðŸ“¡}
Monitor every AI task and ingestion job with **Unified Telemetry**. Audit grounding scores, retrieval latency, and trace failures to the exact source chunk. Every build is verified by our automated security audit and technical documentation audit, ensuring 100% integrity across the platform (Doc 25 & 26).
:::`,
    relatedArticles: ["gs-1", "src-1"],
  },
  {
    id: "gs-3",
    slug: "quick-start-learners",
    title: "Quick Start for Learners",
    category: "getting-started",
    audience: ["learner", "all"],
    tags: ["quickstart", "learner", "beginner"],
    summary: "Get started as a learner in under 5 minutes.",
    lastUpdated: "2026-03-01",
    content: `# Quick Start for Learners

Welcome! Here's how to get started in under 5 minutes.

:::step[1. Dashboard]
Open your **Dashboard** to see your assigned modules, onboarding paths, and overall progress.
:::

:::step[2. Follow Paths]
Start with your **Day 1 path** to get all your environment setup and team access sorted out.
:::

:::step[3. Read & Learn]
Open a module, read through sections, and mark them as complete. Use the **Simplify** button for tough concepts.
:::

:::step[4. Take Quizzes]
Test your knowledge at the end of each module. If you get stuck, use **Mission Control** to ask questions.
:::

:::card[Tips for Success]{ðŸ’¡}
- Press **Cmd+K** to search everything instantly
- Use **Rocket Chat** (ðŸš€) on any module page to ask about the specific content
- **Don't worry about getting stuck!** RocketBoard monitors your progress and will proactively offer contextual hints if you've been on a section for a while or if the AI detects a struggle.
- Check the **Glossary** for unfamiliar team jargon
:::`,
    relatedArticles: ["gs-1", "learn-1"],
  },
  {
    id: "gs-4",
    slug: "quick-start-admins",
    title: "Quick Start for Admins & Authors",
    category: "getting-started",
    audience: ["admin", "author"],
    tags: ["quickstart", "admin", "author"],
    summary: "Set up your first pack and generate content.",
    lastUpdated: "2026-03-01",
    content: `# The RocketBoard Workflow

Getting the most out of RocketBoard follows a six-phase journey from raw code to a published onboarding experience.

:::step[1. Connect & Ingest]
Connect your GitHub repos or documentation wikis. RocketBoard's AI Agent parses the files and creates a semantic knowledge map.
:::

:::step[2. Curate the Plan]
Review the AI-generated module list. You can add sections, reorder topics, and set prerequisites to ensure a logical learning path.
:::

:::step[3. AI Content Generation]
Hit "Generate" and watch as the AI drafts deep-dives, code walkthroughs, and technical exercises based on your actual codebase.
:::

:::step[4. Review & Refine]
Review citations to ensure accuracy. If a section needs more detail, use the **Refine** button to chat with the AI and tweak the content.
:::

:::step[5. Publish & Onboard]
Publish your pack to make it visible to your team. Invite new hires and track their progress through the "Learner Insights" dashboard.
:::

:::step[6. Automated Maintenance]
As your code changes, RocketBoard detects staleness and drafts automated remediations for you to review and accept.
:::`,
    relatedArticles: ["gs-2", "src-1"],
  },
  {
    id: "gs-5",
    slug: "understanding-roles",
    title: "Understanding Roles & Permissions",
    category: "getting-started",
    audience: ["all"],
    tags: ["roles", "permissions", "access"],
    summary: "What each role can do in RocketBoard.",
    lastUpdated: "2026-03-01",
    content: `# Understanding Roles & Permissions

RocketBoard uses a robust access control system to ensure everyone has the right level of power for their role.

:::card[Pack Owners & Admins]{ðŸ›¡ï¸�}
Full control over the organization, packs, billing, and member invites.
:::

:::card[Authors]{âœ�ï¸�}
Strategic access to curate sources, generate content drafts, and publish educational modules.
:::

:::card[Learners]{ðŸŽ“}
Pure consumption access to read modules, take quizzes, and track personal ramp-up milestones.
:::

## Permission Matrix

| Feature | Owner | Admin | Author | Learner | Read Only |
|---------|-------|-------|--------|---------|-----------|
| View content | âœ… | âœ… | âœ… | âœ… | âœ… |
| Read modules & quizzes | âœ… | âœ… | âœ… | âœ… | âœ… |
| Take quizzes & exercises | âœ… | âœ… | âœ… | âœ… | â�Œ |
| Post discussions | âœ… | âœ… | âœ… | âœ… | â�Œ |
| Save bookmarks & notes | âœ… | âœ… | âœ… | âœ… | â�Œ |
| Manage sources | âœ… | âœ… | âœ… | â�Œ | â�Œ |
| Generate & edit content | âœ… | âœ… | âœ… | â�Œ | â�Œ |
| Manage members | âœ… | âœ… | â�Œ | â�Œ | â�Œ |
| View analytics | âœ… | âœ… | â�Œ | â�Œ | â�Œ |
| Delete pack | âœ… | â�Œ | â�Œ | â�Œ | â�Œ |`,
    relatedArticles: ["gs-1", "set-1"],
  },

  // â”€â”€â”€ SOURCES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "src-1",
    slug: "connecting-github",
    title: "Connecting GitHub Repositories",
    category: "sources",
    audience: ["admin", "author"],
    tags: ["github", "source", "repository", "ingestion"],
    summary: "How to add and sync a GitHub repository.",
    lastUpdated: "2026-03-01",
    content: `# Connecting GitHub Repositories

Ground your AI in your actual codebase by connecting your GitHub repositories.

:::step[1. Go to Sources]
Navigate to the **Sources** page from the sidebar.
:::

:::step[2. Add Repository]
Click **Add Source** and select **GitHub Repository**.
:::

:::step[3. Enter URL]
Paste the full repository URL (e.g., \`https://github.com/org/repo\`).
:::

:::step[4. Start Sync]
Click **Sync** on the source card. RocketBoard will begin parsing your code and creating embeddings.
:::

[ACTION: connect_github(Add a GitHub Repo Now)]

## Automated Safeguards

:::card[Security & Isolation]{ðŸ”’}
Secrets like API keys and tokens are automatically **redacted** using centralized patterns. Furthermore, all outbound connection URLs are validated by our **SSRF Guard** to prevent attacks on internal networks. All knowledge chunks are protected by **Pack-Scoped RLS**, ensuring zero-leak isolation across teams.
:::

:::card[Supported Languages]{ðŸ“�}
RocketBoard natively supports TypeScript, JavaScript, Python, Go, Rust, Java, and many more.
:::`,
    relatedArticles: ["src-7", "ts-1"],
  },
  {
    id: "src-2",
    slug: "connecting-confluence",
    title: "Connecting Confluence",
    category: "sources",
    audience: ["admin", "author"],
    tags: ["confluence", "wiki", "source"],
    summary: "How to ingest Confluence wiki spaces.",
    lastUpdated: "2026-03-01",
    content: `# Connecting Confluence

Ground your AI in your Confluence wiki spaces and documentation pages.

:::step[1. Start Connection]
Go to **Sources** â†’ **Add Source** and select **Confluence**.
:::

:::step[2. Provide Details]
Enter your Confluence base URL (e.g., \`https://org.atlassian.net/wiki\`) and the Space Key you wish to ingest.
:::

:::step[3. Authenticate]
Provide your email and a valid **API Token** (generate this from your Atlassian account security settings).
:::

:::step[4. Sync]
Click **Add Source** then **Sync**. RocketBoard will ingest pages from the space as knowledge chunks.
:::`,
    relatedArticles: ["src-1", "src-7"],
  },
  {
    id: "src-3",
    slug: "connecting-notion",
    title: "Connecting Notion",
    category: "sources",
    audience: ["admin", "author"],
    tags: ["notion", "source", "wiki"],
    summary: "How to ingest Notion pages and databases.",
    lastUpdated: "2026-03-01",
    content: `# Connecting Notion

Import your team's Notion pages and databases as primary knowledge sources.

:::step[1. Add Source]
Go to **Sources** â†’ **Add Source** and select **Notion**.
:::

:::step[2. Credentials]
Enter the URL of the top-level Notion page and your Notion **Internal Integration Token**.
:::

:::step[3. Permissions]
Ensure that your Notion integration has been **invited** to the pages you wish to ingest.
:::

:::step[4. Start Ingestion]
Click **Add Source** then **Sync** to begin the knowledge mapping process.
:::`,
    relatedArticles: ["src-1", "src-7"],
  },
  {
    id: "src-5",
    slug: "connecting-google-drive",
    title: "Connecting Google Drive (OAuth)",
    category: "sources",
    audience: ["admin", "author"],
    tags: ["google drive", "oauth", "source", "documents"],
    summary: "Import Google Docs, Sheets, and Drive files using OAuth.",
    lastUpdated: "2026-03-15",
    content: `# Connecting Google Drive (OAuth)

Import Google Docs, Sheets, and other Drive files directly into your knowledge base using your Google Account.

:::step[1. Add Source]
Go to **Sources** â†’ **Add Source** and select **Google Drive**.
:::

:::step[2. Connect with Google]
Click the **Connect with Google** button. A secure popup will open asking you to authenticate with your Google Account. Your credentials are never stored â€” only a secure OAuth token is saved.
:::

:::step[3. Paste Drive URL]
Paste the URL of a Google Doc, Sheet, or Drive folder. RocketBoard will import the content and convert it to knowledge chunks.
:::

:::step[4. Sync]
Click **Sync**. The content will be imported and indexed. Tokens are refreshed automatically â€” you only need to reconnect if you revoke access.
:::

:::card[Supported File Types]{ðŸ“‚}
- Google Docs (converted to Markdown)
- Google Sheets (tabular data extracted)
- Any file in a shared Drive folder
:::

:::card[Security]{ðŸ”’}
OAuth tokens are stored encrypted in your Supabase database with row-level security. Only the ingest function can read them.
:::`,
    relatedArticles: ["src-1", "src-7"],
  },
  {
    id: "src-4",
    slug: "uploading-documents",
    title: "Uploading Documents",
    category: "sources",
    audience: ["admin", "author"],
    tags: ["upload", "document", "pdf", "docx"],
    summary: "How to upload PDF, DOCX, XLSX and other files.",
    lastUpdated: "2026-03-01",
    content: `# Uploading Documents

Boost your knowledge base by uploading legacy documentation and static files.

:::card[Supported Formats]{ðŸ“„}
PDF, DOCX, XLSX, PPTX, MD, TXT, CSV, HTML, JSON, YAML
:::

:::step[1. Open Upload]
Go to **Sources** â†’ **Add Source** â†’ **Document** and choose the **Upload** tab.
:::

:::step[2. Select Files]
Drag & drop files or click to browse. You can upload up to 20 files at once (max 50MB per file).
:::

:::card[URL Import Strategy]{ðŸ”—}
Choose the **URL** tab to import from a public URL. Use **Crawl mode** to automatically follow internal links.
:::`,
    relatedArticles: ["src-7", "src-1"],
  },
  {
    id: "src-7",
    slug: "understanding-chunks",
    title: "Understanding Knowledge Chunks",
    category: "sources",
    audience: ["admin", "author"],
    tags: ["chunks", "knowledge", "ingestion"],
    summary: "What chunks are and how they're used.",
    lastUpdated: "2026-03-19",
    content: `# Understanding Knowledge Chunks

Knowledge chunks are the atomic units of information in RocketBoard, typically representing ~100-150 lines of code or ~500 words of text.

:::card[Smart Structural Chunking]{ðŸ§±}
RocketBoard uses a **heading-aware chunker**. Instead of blind line breaks, it splits content by Markdown headers (H1-H6) and groups sections logically until the word limit is reached. This preserves technical context and prevents evidence from being cut off mid-paragraph.
:::

:::card[Deterministic Chunk IDs]{ðŸ†”}
Every chunk is assigned a stable ID based on its document path, line range, and SHA256 content hash. This ensures that re-ingesting content results in an **UPSERT** rather than a duplicate, preserving citation links even as your documentation evolves.
:::

:::card[Privacy & Redaction]{ðŸ›¡ï¸�}
Secrets (API keys, tokens, passwords) are automatically detected and replaced with \`***REDACTED***\` during ingestion using centralized security patterns. Every ingestion run is verified by our **Titanium-Hardened Integrity Audit**.
:::

:::card[Cost-Saving Deduplication]{ðŸ’°}
By hashing chunk content with **SHA256**, RocketBoard can detect unchanged data and reuse existing embeddings, significantly reducing OpenAI/Gemini API costs during repeated syncs.
:::`,
    relatedArticles: ["src-1", "src-4"],
  },
  {
    id: "src-8",
    slug: "ingestion-safeguards",
    title: "Ingestion Safeguards & Recovery",
    category: "sources",
    audience: ["admin"],
    tags: ["safeguards", "cooldown", "recovery", "security"],
    summary: "How RocketBoard protects your resources during ingestion.",
    lastUpdated: "2026-03-19",
    content: `# Ingestion Safeguards & Recovery ðŸ›¡ï¸�

To prevent runaway API costs and resource abuse, RocketBoard enforces several production-grade safeguards.

## 1. Cooldown Period â�³
Every source has a mandatory **1-hour cooldown** between successful syncs. This prevents accidental double-syncs and protects your GitHub/Notion API rate limits.
*(Author Tip: If a job fails, the cooldown is bypassed so you can retry immediately.)*

## 2. Concurrency Locks ðŸ”’
Only one reindexing job can run per organization at a time. If two authors attempt to reindex the same pack simultaneously, the second job will wait or be rejected to prevent race conditions.

## 3. Automatic Resilience ðŸ§¼
If an ingestion job fails (e.g., network timeout), RocketBoard automatically:
1. Marks the job as **failed** with a detailed error message.
2. Purges all partially written chunks for that specific \`job_id\` from the database.
3. Allows an **immediate retry** without waiting for the cooldown.

## 4. Tracing & Triggers ðŸ“¡
Every ingestion step is instrumented with metadata. You can audit the latency and success rate of your syncs in the **Observability** dashboard, with every chunk mapped back to its parent job.`
  },

  // â”€â”€â”€ CONTENT CREATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "cc-1",
    slug: "generating-module-plan",
    title: "Generating a Module Plan",
    category: "content-creation",
    audience: ["admin", "author"],
    tags: ["plan", "modules", "generation", "signals"],
    summary: "How the AI proposes modules and how to curate the plan.",
    lastUpdated: "2026-03-01",
    content: `# Generating a Module Plan

Turn raw code into a structured roadmap. The AI analyzes your source tree to propose a logical onboarding sequence.

:::step[1. Trigger Analysis]
Go to the **Plan** page and click **Generate Plan**. The AI will begin mapping "signals" to potential modules.
:::

[ACTION: generate_plan(Generate Plan from Sources)]

:::card[Curation Tools]{ðŸ› ï¸�}
- **Edit & Reorder:** Tweak titles and drag modules into the right order.
- **Dependencies:** Set **prerequisites** to control the learner's journey.
- **Categorization:** Assign **tracks** (e.g., Backend, Frontend) and module **templates**.
:::

:::step[2. Approval]
Click **Approve Plan** once the roadmap looks right. This unlocks the full content generation cascade.
:::`,
    relatedArticles: ["cc-2", "cc-3"],
  },
  {
    id: "cc-2",
    slug: "content-generation",
    title: "Content Generation Cascade",
    category: "content-creation",
    audience: ["admin", "author"],
    tags: ["generation", "cascade", "modules", "quiz"],
    summary: "What happens when you click Generate All Content.",
    lastUpdated: "2026-03-01",
    content: `# Content Generation Cascade

One click to build an entire education track. When you click **Generate All**, RocketBoard triggers a multi-stage production sequence.

:::step[1. Knowledge Modules]
AI drafts the primary instructional content, complete with code walkthroughs and citations.
:::

:::step[2. Assessment & Practice]
Multiple-choice **Quizzes** and hands-on **Exercises** are drafted to validate learner understanding.
:::

:::step[3. Auxiliary Content]
The system populates a searchable **Glossary**, compiles **Onboarding Paths**, and prepares **Ask-Lead** questions.
:::

:::card[Draft Status]{ðŸ“�}
All generated content starts as a **Draft**. Nothing is visible to learners until you explicitly hit **Publish**.
:::`,
    relatedArticles: ["cc-1", "cc-3"],
  },
  {
    id: "cc-3",
    slug: "reviewing-publishing",
    title: "Reviewing and Publishing Content",
    category: "content-creation",
    audience: ["admin", "author"],
    tags: ["review", "publish", "draft", "refine"],
    summary: "How to review, refine, and publish generated content.",
    lastUpdated: "2026-03-15",
    content: `# Reviewing and Publishing âœ¨

Before your team sees the content, you have full control to audit, refine, and polish every word.

:::step[1. Audit the Review Page]{ðŸ‘�ï¸�}
Preview each module as learners will see it. Look for **Contradiction Badges** or **Freshness Warnings** that indicate source-code drift.
:::

:::step[2. Refine with AI]{âœ�ï¸�}
Click **Refine** on any section. Chat with the AI in natural language to adjust the tone, add specific examples, or expand on complex logic.
:::

:::step[3. Accept AI Drafts]{ðŸ”„}
If your source code has changed, look for the "Blue Badge" on the review page. AI-drafted remedies are waiting for your approval.
:::

:::step[4. Go Live]{ðŸš€}
Click **Publish Pack** to move all content from *Draft* to *Live*. You can re-publish at any time!
:::

[UI_ACTION: open_sandbox(Try it in the Sandbox)]`,
    relatedArticles: ["cc-1", "cc-5"],
  },
  {
    id: "cc-4",
    slug: "module-templates",
    title: "Module Templates",
    category: "content-creation",
    audience: ["admin", "author"],
    tags: ["templates", "blueprint", "structure"],
    summary: "How to create and use templates for standardized module structures.",
    lastUpdated: "2026-03-15",
    content: `# Module Templates ðŸ“‹

Standardize your onboarding by creating blueprints for recurring module types (e.g., "Feature Deep-Dive" or "Service Architecture").

:::step[1. Create Blueprint]{ðŸ“�}
Go to the **Templates** page. Define the section hierarchy you want every module of this type to follow.
:::

:::step[2. Assign to Plan]{ðŸ”—}
On the **Plan** page, use the dropdown on each module card to select your template.
:::

:::step[3. Generate]{âš¡}
The AI will respect your template structure, filling in each section using your source code as evidence.
:::

:::card[Rocket's Pro-Tip]{ðŸš€}
Consistent structure helps learners ramp up faster as they become familiar with where to find specific details like "Environment Setup" or "Testing".
:::`,
    relatedArticles: ["cc-1"],
  },
  {
    id: "cc-5",
    slug: "citations-evidence",
    title: "Understanding Citations and Evidence",
    category: "content-creation",
    audience: ["all"],
    tags: ["citations", "evidence", "source code", "spans"],
    summary: "How AI content is grounded in your actual source code.",
    lastUpdated: "2026-03-15",
    content: `# Understanding Citations & Verification ðŸ›¡ï¸�

RocketBoard doesn't just "chat" with your codeâ€”it verifies every single claim against your actual repository.

:::card[Layer 1: Titanium Hybrid Search v2]{ðŸ”�}
We combine **Vector** (for concepts) and **Full-Text** (via \`websearch_to_tsquery\`) to find the most relevant code chunks with defensive shielding and query clamping.
:::

:::card[Layer 2: Grounding Audit]{âš–ï¸�}
Our "AI Judge" verifies that every citation badge (e.g., [S1]) actually exists in your code. Hallucinations are automatically stripped via a multi-layered verification chain.
:::

:::card[Layer 3: Zero-Hallucination Hydration]{ðŸ§±}
The LLM is strictly forbidden from writing code and can only emit placeholders. Our server resolves these placeholders into exact code from the source files, ensuring **Zero Hallucination** in every snippet.
:::

:::card[Layer 4: Continuous Observability & Auditing]{ðŸ“¡}
Every generation is tracked with unified telemetry. Authors can audit the **Grounding Score**, **Strip Rate**, and **Retrieval Relevance** in real-time. This is backed by our **Titanium-Hardened Verification Script** and **Security Audit Regression Gate**, which cryptographically verify documentation and security standards against the repository baseline.
:::

## How to use Citations

*   **Hover:** See a live preview of the cited code.
*   **Click:** Open the **Code Explorer** to see the file in context.
*   **Audit:** Check the trace logs to see the "Grounding Score" and "Strip Rate" for any response.

:::card[Rocket's Pro-Tip]{ðŸš€}
Clicking a citation badge [S1] takes you directly to the logic. Every snippet you see is a literal extract from your actual codebase, verified by our 4-stage pipeline.
:::`,
    relatedArticles: ["cc-3", "src-7"],
  },
  {
    id: "cc-6",
    slug: "prerequisites",
    title: "Setting Prerequisites Between Modules",
    category: "content-creation",
    audience: ["admin", "author"],
    tags: ["prerequisites", "dependencies", "ordering"],
    summary: "How to control module ordering with dependencies.",
    lastUpdated: "2026-03-15",
    content: `# Learning Prerequisites â›“ï¸�

Control the learner's journey by setting logical dependencies between modules.

:::card[Hard Prerequisites]{ðŸ”’}
The module is **locked** until the prerequisite is completed. Ideal for absolute requirements like "Environment Setup".
:::

:::card[Soft Prerequisites]{ðŸ’¡}
A recommendation is shown, but learners can proceed to the content anyway.
:::

:::step[How to Configure]{âš™ï¸�}
1. Open the **Plan** page.
2. Select a module and click the **Dependencies** icon.
3. Choose the parent module and set the **Min Completion %** (Default: 100%).
:::

:::card[Rocket's Pro-Tip]{ðŸš€}
Use the **Dependency Graph** view to visualize your entire onboarding curriculum and ensure there are no dead-ends!
:::`,
    relatedArticles: ["cc-1"],
  },
  {
    id: "cc-7",
    slug: "content-health",
    title: "Content Health and Freshness",
    category: "content-creation",
    audience: ["admin", "author"],
    tags: ["freshness", "stale", "content health"],
    summary: "How to keep generated content up-to-date.",
    lastUpdated: "2026-03-15",
    content: `# Content Health & Freshness ðŸ¥—

Don't let your documentation rot. RocketBoard monitors your code and alerts you when modules become "stale".

:::step[1. Monitor Drift]{ðŸ“‰}
Check the **Content Health** dashboard to see which modules reference files that have been modified since the last generation.
:::

:::step[2. Review Git Diffs]{ðŸ”�}
Click on a stale module to see the exact code changes that occurred in your repository compared to the content.
:::

:::step[3. AI Auto-Repair]{ðŸ› ï¸�}
Accept the **AI-Drafted Update**. Our agent reads the new code and proposes text changes to keep the module accurate.
:::

:::card[Rocket's Pro-Tip]{ðŸš€}
Enable **Auto-Sync** for your GitHub sources to get real-time health alerts as soon as code is pushed to your main branch!
:::`,
    relatedArticles: ["cc-3", "src-1"],
  },

  // â”€â”€â”€ LEARNING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "learn-1",
    slug: "reading-modules",
    title: "Reading Modules",
    category: "learning",
    audience: ["learner", "all"],
    tags: ["modules", "reading", "progress", "notes"],
    summary: "How to read content, take notes, and track progress.",
    lastUpdated: "2026-03-01",
    content: `# Reading Modules

Dive into your curated learning content. RocketBoard modules are designed for focused, technical reading.

:::step[1. Section Map]
Use the interactive mini-map on the right to jump between concepts or track your vertical scroll progress.
:::

:::step[2. Code Explorer]
Click any citation badge to open the side-car code explorer. View the raw source file exactly as it exists in your repo.
:::

:::card[Toolbox]{ðŸ§°}
- **Mark as Read:** Click the completion button to update your progress dashboard.
- **Notes & Reflection:** Use the private notes panel to document your understanding.
- **Simplify:** Feeling overwhelmed? Click **Simplify** to get a high-level summary of the current section.
:::`,
    relatedArticles: ["learn-2", "gs-3"],
  },
  {
    id: "learn-2",
    slug: "taking-quizzes",
    title: "Taking Quizzes",
    category: "learning",
    audience: ["learner", "all"],
    tags: ["quiz", "assessment", "score"],
    summary: "How quizzes work, scoring, and retaking.",
    lastUpdated: "2026-03-01",
    content: `# Taking Quizzes

Validate your knowledge with multiple-choice assessments grounded in your codebase.

:::card[Immediate Feedback]{âœ…}
Answer questions and get instant results. Correct and incorrect answers both provide deep-dive explanations linked back to the sources.
:::

:::step[1. Complete Quiz]
Work through the 5-10 questions per module. Your score is tracked automatically on your member profile.
:::

:::step[2. Review Gaps]
After submission, RocketBoard highlights specific module sections you should revisit based on missed questions.
:::

:::card[Retake Policy]{ðŸ”„}
You can retake any quiz multiple times. Your **most recent score** is what will be reflected on your manager's dashboard.
:::`,
    relatedArticles: ["learn-1", "learn-3"],
  },
  {
    id: "learn-3",
    slug: "exercises",
    title: "Completing Exercises",
    category: "learning",
    audience: ["learner", "all"],
    tags: ["exercises", "coding", "hands-on"],
    summary: "How hands-on exercises work.",
    lastUpdated: "2026-03-15",
    content: `# Hands-On Exercises ðŸ› ï¸�

Put your knowledge into practice with interactive coding challenges that are reviewed by the AI in real-time.

:::card[Code Find]{ðŸ”�}
Locate specific patterns or architectural decisions within the source explorer.
:::

:::card[Explain Logic]{âœ�ï¸�}
Write a short explanation of how a specific function or class works. The AI verifies your reasoning against the truth.
:::

:::card[Debug & Explore]{ðŸ�ž}
Find a hidden bug or investigate how a specific environment variable affects system behavior.
:::

:::card[Hints & AI Review]{ðŸ§ }
Stuck? Use **Progressive Hints**. When you're done, submit for an **AI Review** to get a score and personalized feedback.
:::`,
    relatedArticles: ["learn-1", "learn-2"],
  },
  {
    id: "learn-4",
    slug: "ai-chat",
    title: "Using AI Chat (Rocket & Mission Control)",
    category: "learning",
    audience: ["all"],
    tags: ["chat", "ai", "rocket", "mission control"],
    summary: "Two AI assistants â€” module-specific and platform-wide.",
    lastUpdated: "2026-03-13",
    content: `# Using AI Chat

RocketBoard has two AI assistants, each grounded in your actual codebase and documentation.

## ðŸš€ Rocket (Module Chat)

:::card[Module-Specific Intelligence]{ðŸ§ }
Rocket is available on every module page (bottom-right FAB). It answers questions about the current module's content, grounded in evidence from your connected sources.
:::

:::step[1. Ask a Question]
Type any question about the module â€” e.g., "How does the auth flow work?" or "Explain this middleware."
:::

:::step[2. Read Citations]
The AI response includes inline citation badges like **[S1]**, **[S2]**, etc. These are interactive:
- **Hover** over a badge to see a preview of the source code snippet.
- **Click** the badge to open the full file in the Source Explorer with syntax highlighting.
- **Structural Integrity:** Every code snippet is resolved from the server to guarantee it matches your code exactly. 
:::

:::step[3. Explore Sources]
At the bottom of each response, you'll see interactive source badges showing the files referenced. Click any badge to dive into the evidence that grounded the AI's answer.
:::

:::step[4. Report Issues]
If an answer seems incorrect or misleading, click the **ðŸš© Report** button. Your feedback is tagged with a trace ID and routed to pack authors for review.
:::

## ðŸ§ Mission Control (Global Chat)

:::card[Platform Assistant]{ðŸ—ºï¸�}
Mission Control is available on all pages (bottom-left). It answers questions about RocketBoard's features, settings, and navigation.
:::

- Ask: "How do I bookmark something?" or "What keyboard shortcuts are available?"
- It can trigger UI actions â€” e.g., switching themes or navigating to specific pages.`,
    relatedArticles: ["learn-1", "gs-3"],
  },
  {
    id: "learn-5",
    slug: "onboarding-paths",
    title: "Onboarding Paths (Day 1 & Week 1)",
    category: "learning",
    audience: ["learner", "all"],
    tags: ["paths", "day1", "week1", "checklist"],
    summary: "How to use the structured checklists.",
    lastUpdated: "2026-03-15",
    content: `# Onboarding Paths ðŸš€

Structured checklists to ensure you have everything you need to be productive from day one.

:::card[Day 1: Setup & Access]{ðŸ”‘}
Focus on environment setup, access requests, and meeting your immediate team. Check off items as you go!
:::

:::card[Week 1: Core Concepts]{ðŸ“š}
Deeper exploration: complete initial modules, understand team workflows, and explore the codebase.
:::

:::step[How it works]{âš™ï¸�}
1. Open the **Paths** tab on your dashboard.
2. Select your assigned path (e.g., "Frontend New Hire").
3. Follow the sequence and mark tasks as complete.
4. Your manager can see your progress to provide support where needed.
:::`,
    relatedArticles: ["gs-3", "learn-1"],
  },
  {
    id: "learn-6",
    slug: "glossary-flashcards",
    title: "Glossary and Flashcards",
    category: "learning",
    audience: ["all"],
    tags: ["glossary", "flashcards", "terms"],
    summary: "How to use the searchable glossary and flashcard mode.",
    lastUpdated: "2026-03-15",
    content: `# Glossary & Flashcards ðŸ“–

Master the team jargon and technical terminology used in your codebase.

:::card[Searchable Glossary]{ðŸ”�}
Filter by name, definition, or track. Each term includes context and **Grounded Code Examples**.
:::

:::card[Flashcard Mode]{ðŸŽ´}
Practice terms with interactive flip cards. A great way to review before taking a module quiz!
:::

:::card[Rocket's Pro-Tip]{ðŸš€}
Press **Cmd+K** on any page to search the glossary instantly. You don't even have to leave the module you're reading!
:::`,
    relatedArticles: ["learn-1"],
  },
  {
    id: "learn-7",
    slug: "spaced-repetition",
    title: "Spaced Repetition Reviews",
    category: "learning",
    audience: ["learner", "all"],
    tags: ["review", "spaced repetition", "retention"],
    summary: "How review reminders help with long-term retention.",
    lastUpdated: "2026-03-15",
    content: `# Spaced Repetition ðŸ§ 

Cement your knowledge for the long term. RocketBoard automatically schedules "Review Sessions" based on the Ebbinghaus Forgetting Curve.

:::step[1. Complete a Module]{âœ…}
As soon as you finish a module, it's added to your review queue.
:::

:::step[2. Scheduled Reminders]{â�±ï¸�}
You'll get prompts on your dashboard at increasing intervals: **3 Days**, **1 Week**, **2 Weeks**, and **1 Month**.
:::

:::step[3. Quick Review]{ðŸ”„}
Sessions are short (2-3 minutes) and focus on key takeaways and quiz questions you previously answered correctly.
:::

:::card[Rocket's Pro-Tip]{ðŸš€}
You can enable or disable Spaced Repetition in your **Settings** panel under "Learning Preferences".
:::`,
    relatedArticles: ["learn-1"],
  },
  {
    id: "learn-8",
    slug: "interactive-platform-docs",
    title: "Interactive Platform Docs",
    category: "learning",
    audience: ["all"],
    tags: ["docs", "library", "documentation", "sops", "checklists"],
    summary: "How to read and track progress in Interactive Platform Docs.",
    lastUpdated: "2026-03-20",
    content: `# Interactive Platform Docs ðŸ“™

RocketBoard brings your team's standalone markdown and text documents to life natively within the platform.

:::card[The Docs Library]{ðŸ“š}
Access the **Docs Library** from your sidebar to see all operational procedures, architectural specs, and internal guides properly categorised and instantly searchable.
:::

:::step[1. Interactive Reading]{ðŸ‘“}
Documents are parsed into rich blocks. You'll see properly formatted checklists, code snippets, Mermaid diagrams, and highlight boxes exactly as the author intended.
:::

:::step[2. Mark as Done]{âœ…}
Click **Mark Done** at the bottom of any document to track your completion. Your progress syncs directly with any Roadmap playlists that assign this document to you.
:::

:::step[3. Ask Rocket]{ðŸš€}
Don't understand a specific step or acronym? Click the **Ask Rocket** button at the top of the document. This opens a chat window where Rocket will answer questions using the exact context of the document you are currently reading!
:::

:::card[Rocket's Pro-Tip]{ðŸš€}
Authors can manually sync the latest changes to these documents directly from your GitHub repository by visiting the **Docs Admin** page.
:::`,
    relatedArticles: ["learn-1", "gs-3"],
  },

  // â”€â”€â”€ COLLABORATION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "collab-1",
    slug: "team-directory",
    title: "Team Directory",
    category: "collaboration",
    audience: ["all"],
    tags: ["team", "directory", "meetings"],
    summary: "Finding and meeting your team members.",
    lastUpdated: "2026-03-15",
    content: `# Team Directory ðŸ‘¥

Onboarding isn't just about codeâ€”it's about the people who write it. The Team Directory helps you connect with your new colleagues.

:::card[Auto-Detection]{ðŸ¤–}
Team members are automatically identified from **CODEOWNERS** files and Git commit history. You'll see who is the expert on every module.
:::

:::card[Meeting Tracker]{ðŸ“…}
Check off each person as you have your initial 1:1 conversations.
:::

:::card[Rocket's Pro-Tip]{ðŸš€}
Each profile includes "Suggested Topics"â€”AI-generated icebreakers based on the files that person maintains. Use them to have more productive 1:1s!
:::`,
    relatedArticles: ["collab-2"],
  },
  {
    id: "collab-2",
    slug: "discussions",
    title: "Discussions and Peer Learning",
    category: "collaboration",
    audience: ["all"],
    tags: ["discussions", "questions", "tips", "threads"],
    summary: "How to ask questions, share tips, and learn with peers.",
    lastUpdated: "2026-03-15",
    content: `# Discussions & Peer Learning ðŸ’¬

Connect with other learners and experts directly within the context of your codebase.

:::card[Questions & Resolution]{â�“}
Ask a question and get answers from your team. Authors can mark the most helpful response as the **Accepted Answer**.
:::

:::card[Technical Tips]{ðŸ’¡}
Share insights or "gotchas" you discovered while exploring a specific module.
:::

:::card[Announcements]{ðŸ“¢}
Stay updated with official notes from Pack Authors about module refreshes or architectural shifts.
:::

:::card[Rocket's Pro-Tip]{ðŸš€}
You can **Upvote** helpful threads to help future learners find the best information quickly!
:::`,
    relatedArticles: ["collab-1"],
  },
  {
    id: "collab-3",
    slug: "cohorts",
    title: "Cohorts",
    category: "collaboration",
    audience: ["all"],
    tags: ["cohorts", "groups", "peers"],
    summary: "How cohort groups work for tracking peer progress.",
    lastUpdated: "2026-03-01",
    content: `# Cohorts

Cohorts are groups of learners who started onboarding around the same time, helping them learn together.

:::card[Peer Progress]{ðŸ“…}
See how your peers are doing (respecting privacy settings) to gauge your own ramp-up speed.
:::

:::card[Management]{ðŸ› ï¸�}
Admins can create and manage cohorts to track specific hiring classes or project teams.
:::

:::card[Visibility]{ðŸ‘�ï¸�}
Cohort members can see each other's completion status, fostering a sense of shared progress and healthy competition.
:::`,
    relatedArticles: ["collab-1"],
  },
  {
    id: "collab-4",
    slug: "ask-your-lead",
    title: "Ask Your Lead",
    category: "collaboration",
    audience: ["learner", "all"],
    tags: ["ask lead", "questions", "team lead"],
    summary: "Curated questions to ask your team lead.",
    lastUpdated: "2026-03-15",
    content: `# Ask Your Lead ðŸ§

RocketBoard helps you have better 1:1s with your manager by providing curated, high-impact questions based on your progress.

:::card[Architecture & Context]{ðŸ�—ï¸�}
AI generates questions about "Why" specific decisions were made, helping you understand the history of the codebase.
:::

:::card[Processes & Workflow]{ðŸ”„}
Understand the team's PR review style, deployment cadence, and on-call rotations.
:::

:::card[Individual Growth]{ðŸŒ±}
Personalized questions tailored to your role and seniority level.
:::

:::card[Rocket's Pro-Tip]{ðŸš€}
Mark questions as "Asked" to keep a historical log of your 1:1 discussions. This is great for end-of-quarter reviews!
:::`,
    relatedArticles: ["collab-1"],
  },

  // â”€â”€â”€ SETTINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "set-1",
    slug: "personalizing-experience",
    title: "Personalizing Your Experience",
    category: "settings",
    audience: ["all"],
    tags: ["settings", "preferences", "personalization"],
    summary: "All the ways to customize RocketBoard.",
    lastUpdated: "2026-03-01",
    content: `# Personalizing Your Experience

RocketBoard adapts to your specific learning style and technical background. Customize your experience in the **Settings** panel.

:::card[Learner Profile]{ðŸ‘¤}
- **Role & Experience:** The AI adapts its code density and depth to your specific job title and seniority.
- **Learning Style:** Choose between Visual, Text-heavy, or Interactive explanations.
- **Framework Familiarity:** Tell the AI what you already know (e.g. 'I know React') to get explanations using precise analogies.
- **Tone Preference:** Choose Direct, Conversational, or Socratic tones for your AI chat interactions.
:::

:::card[Audience & Depth]{ðŸ“š}
- **Technical / Non-Technical / Mixed:** Controls the overall balance of code vs concept.
- **Shallow / Standard / Deep:** Controls verbosity and the inclusion of edge-cases.
:::

:::card[Content Depth]{ðŸ“š}
- **Shallow:** Quick, 5-minute overviews of key features.
- **Standard:** The default experience for most learners.
- **Deep:** Comprehensive guides covering edge cases and performance.
:::

:::card[Theme & Privacy]{ðŸŽ¨}
Toggle between **Light/Dark** modes or sync with your system. You can also control your **Peer Privacy** settings to hide or show your progress in cohorts.
:::`,
    relatedArticles: ["set-2", "gs-5"],
  },
  {
    id: "set-2",
    slug: "generation-limits",
    title: "Generation Limits Explained",
    category: "settings",
    audience: ["admin", "author"],
    tags: ["limits", "generation", "words", "quiz"],
    summary: "What each generation limit controls.",
    lastUpdated: "2026-03-01",
    content: `# Generation Limits

Authors can fine-tune exactly how much content the AI drafts during the generation cascade.

:::card[Word Limits]{ðŸ”¡}
**Max Module Words:** Prevents the AI from drafting overly verbose sections. Default: 1,400 words.
:::

:::card[Educational Limits]{ðŸ“�}
**Max Quiz Questions:** Controls how many multiple-choice questions are generated per module. Default: 5.
**Max Key Takeaways:** Limits the number of summary points at the end of each section. Default: 5.
:::`,
    relatedArticles: ["set-1"],
  },
  {
    id: "set-3",
    slug: "access-levels",
    title: "Understanding Access Levels",
    category: "settings",
    audience: ["all"],
    tags: ["roles", "access", "permissions"],
    summary: "What each role can and cannot do.",
    lastUpdated: "2026-03-01",
    content: `# Understanding Access Levels

RocketBoard roles determine exactly what you can see and edit.

:::card[Elevated Access]{âš™ï¸�}
- **Owner:** Full organizational control, including billing and deletions.
- **Admin:** Broad management powers for members, settings, and all packs.
- **Author:** Strategic power to curate sources and trigger AI generation.
:::

:::card[Consumption Access]{ðŸ“–}
- **Learner:** Standard access to read, quiz, and track ramp-up.
- **Read Only:** View-only access to published modules without interactive quizzes.
:::

[See the full Roles & Permissions table](/help/getting-started/understanding-roles)`,
    relatedArticles: ["gs-5"],
  },

  // â”€â”€â”€ TROUBLESHOOTING â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "ts-1",
    slug: "ingestion-failed",
    title: "Source Ingestion Failed",
    category: "troubleshooting",
    audience: ["admin", "author"],
    tags: ["error", "ingestion", "github", "source"],
    summary: "Common reasons ingestion fails and how to fix them.",
    lastUpdated: "2026-03-01",
    content: `# Source Ingestion Failed

:::card[System Timeout]{â�±ï¸�}
The repository is exceptionally large (>500MB). Try connecting specific subdirectories instead of the whole mono-repo.
:::

## Steps to Fix

:::step[1. Check Permissions]
Verify that the credentials or tokens used for the source are still valid and haven't expired.
:::

:::step[2. Connectivity Test]
Ensure the source URL is accessible from a standard browser window.
:::

:::step[3. Re-Add Source]
Sometimes a fresh start is best. Remove the source and attempt to add it again with a fresh token.
:::`,
    relatedArticles: ["src-1", "ts-2"],
  },
  {
    id: "ts-2",
    slug: "ai-generation-errors",
    title: "AI Generation Errors",
    category: "troubleshooting",
    audience: ["admin", "author"],
    tags: ["error", "ai", "generation", "rate limit"],
    summary: "Understanding and resolving AI error messages.",
    lastUpdated: "2026-03-01",
    content: `# AI Generation Errors

Sometimes the AI Agent runs into a wall. Hereâ€™s how to handle common errors.

:::card[Insufficient Evidence]{ðŸ“‰}
**Cause:** The selected sources don't contain enough information to answer the prompt.
**Fix:** Add more relevant source files or broaden your source selection.
:::

:::card[Rate Limited]{â�³}
**Cause:** We've hit a temporary peak in AI service demand.
**Fix:** Wait about 30 seconds and click **Retry**.
:::

:::card[Credit Exhausted]{ðŸ’³}
**Cause:** Your organization has reached its monthly AI token limit.
**Fix:** Contact your pack admin to upgrade your plan.
:::

:::card[Network Error]{ðŸŒ�}
**Cause:** A glitch in the connection between your browser and our AI engines.
**Fix:** Check your internet connection and try again.
:::`,
    relatedArticles: ["ts-1", "ts-3"],
  },
  {
    id: "ts-3",
    slug: "content-wrong-outdated",
    title: "Content Looks Wrong or Outdated",
    category: "troubleshooting",
    audience: ["all"],
    tags: ["stale", "wrong", "outdated", "refresh"],
    summary: "What to do when generated content doesn't match your code.",
    lastUpdated: "2026-03-01",
    content: `# Content Looks Wrong or Outdated

If the AI-generated content seems inaccurate or stale, follow these steps to repair it.

:::step[1. Check Health]
Open the **Content Health** dashboard to see if the AI has already flagged stale citations for this module.
:::

:::step[2. Re-Sync Sources]
If code has changed recently, click **Sync** on the source card to update the underlying knowledge chunks.
:::

:::step[3. AI Refine]
Use the **Refine** button on the module to describe what's wrong. The AI will rewrite the section based on your feedback.
:::

:::card[Report Issue]{ðŸš©}
Click the flag icon on any section to notify a Pack Author that the content needs manual review.
:::`,
    relatedArticles: ["cc-7", "ts-2"],
  },
  {
    id: "sec-1",
    slug: "security-ci-verification",
    title: "Security & CI Verification Architecture",
    category: "tech-implementation",
    audience: ["admin", "author"],
    tags: ["security", "vault", "ci", "webhooks"],
    summary: "Overview of platform security hardening, vault-backed keys, and drift detection.",
    lastUpdated: "2026-04-24",
    content: `# Security & Architectural Protections

RocketBoard relies on strict security policies to protect your knowledge pipeline.

## Vault-Backed Credentials
For integrations like GitHub or Google OAuth, all API credentials are **cryptographically vaulted** on the Edge using AES-256 RPC calls. At no point can custom Edge Functions or untrusted scripts read an API key maliciously in plaintext.

## Environment & Webhook Protections
If \`ENVIRONMENT="production"\`, traffic sent to the GitHub webhook must be cryptographically signed via \`GITHUB_WEBHOOK_SECRET\`. If missing or invalid, the platform forcibly drops the connection with \`401 Unauthorized\`. 

If you see \`[ENV WARNING]\` logs, refer to your production environment variable matrix.

## Edge-to-Edge Internal Safety
Features like the auto-remediation agent communicate natively via an \`X-Rocketboard-Internal\` dynamic header, circumventing the need to broadcast the blanket Service Role key across boundaries.

## CI Drift Pipeline
A background chron job executes every week (\`db-types-check\`) enforcing deterministic typing consistency between our Database migrations layer and your Typescript definitions. Any deviations trigger immediate build lint errors.`,
    relatedArticles: [],
  },

  // ─── KEYBOARD SHORTCUTS ──────────────────────────
  {
    id: "kb-1",
    slug: "keyboard-shortcuts",
    title: "Keyboard Shortcuts Reference",
    category: "keyboard-shortcuts",
    audience: ["all"],
    tags: ["keyboard", "shortcuts", "hotkeys"],
    summary: "All keyboard shortcuts in one place.",
    lastUpdated: "2026-04-24",
    content: `# Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Cmd/Ctrl + S** | Trigger Platform Content Sync |
| **Cmd/Ctrl + K** | Open global search |
| **Cmd/Ctrl + D** | Bookmark current content |
| **Escape** | Close modal, overlay, or search |
| **?** | Show keyboard shortcuts |
| **Arrow keys** | Navigate tour steps |
| **Tab** | Navigate between interactive elements |`,
    relatedArticles: [],
  },
  {
    id: "ts-4",
    slug: "cant-access-feature",
    title: "Can't Access a Feature",
    category: "troubleshooting",
    audience: ["all"],
    tags: ["access", "permission", "locked"],
    summary: "Troubleshooting access and permission issues.",
    lastUpdated: "2026-03-15",
    content: `# Can't Access a Feature? ðŸ”’

If you're seeing a "Locked" icon or a "Permission Denied" message, follow this recovery flow.

:::step[1. Check Prerequisites]{â›“ï¸�}
Is the module locked? Many modules require you to complete a "Day 1" path or a parent module first.
:::

:::step[2. Verify your Role]{ðŸ‘¤}
Go to **Settings** â†’ **Profile**. If you need to add sources or generate content, you must have the **Author** or **Admin** role.
:::

:::step[3. Consult your Admin]{ðŸ›¡ï¸�}
Roles are managed at the Organization level. Contact your Pack Owner or Admin to request elevated access.
:::

:::card[Rocket's Pro-Tip]{ðŸš€}
Admins can use the **Audit Logs** to see exactly why an access request was denied.
:::`,
    relatedArticles: ["gs-5", "set-3"],
  },
  {
    id: "ts-5",
    slug: "quiz-questions-unfair",
    title: "Quiz Questions Are Unfair or Incorrect",
    category: "troubleshooting",
    audience: ["all"],
    tags: ["quiz", "feedback", "incorrect"],
    summary: "How to report and fix quiz quality issues.",
    lastUpdated: "2026-03-01",
    content: `# Quiz Quality & Fairness

We strive for 100% accuracy, but AI-generated questions can sometimes be ambiguous.

:::card[Report Inaccuracy]{ðŸš©}
Use the **feedback** button immediately after answering a question to report a technical error or unfair framing.
:::

:::step[1. Author Review]
Pack authors are notified of flagged questions. They can edit the text manually or click **Regenerate** to try a different angle.
:::

:::step[2. Global Analytics]
Admins can view correct/incorrect rates for every question. Any question with an abnormally low success rate is automatically highlighted for review.
:::`,
    relatedArticles: ["learn-2"],
  },

  // â”€â”€â”€ KEYBOARD SHORTCUTS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "kb-1",
    slug: "keyboard-shortcuts",
    title: "Keyboard Shortcuts Reference",
    category: "keyboard-shortcuts",
    audience: ["all"],
    tags: ["keyboard", "shortcuts", "hotkeys"],
    summary: "All keyboard shortcuts in one place.",
    lastUpdated: "2026-03-01",
    content: `# Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Cmd/Ctrl + K** | Open global search |
| **Cmd/Ctrl + D** | Bookmark current content |
| **Escape** | Close modal, overlay, or search |
| **?** | Show keyboard shortcuts |
| **Arrow keys** | Navigate tour steps |
| **Tab** | Navigate between interactive elements |`,
    relatedArticles: [],
  },

  // â”€â”€â”€ SETTINGS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "set-1",
    slug: "bring-your-own-key",
    title: "Bring Your Own Key (BYOK)",
    category: "settings",
    audience: ["all"],
    tags: ["byok", "api keys", "models", "openai", "anthropic", "gemini"],
    summary: "How to configure your own AI model provider and API keys.",
    lastUpdated: "2026-03-15",
    content: `# Bring Your Own Key (BYOK)

RocketBoard is powered natively by Google Gemini 3 Flash Preview. However, if you or your organization demand specialized reasoning models or alternate context windows (like GPT-5.4 or Claude 4.6), you can supply your own API key.

## Adding a Custom Key
:::step[1. Go to Settings]
Navigate to the **Settings** page and find the **AI Model Provider (BYOK)** section.
:::

:::step[2. Select Provider]
Choose your desired vendor from the 4-tier provider catalog.
:::

:::step[3. Select Model]
Choose your preferred baseline model (this acts as the default for generations).
:::

:::step[4. Save & Validate]
Paste your API key and click **Validate & Save**. The platform executes a real-time health check on your key before accepting it.
:::

## Key Security
:::card[Encrypted at Rest]{ðŸ”’}
Keys are encrypted using AES-256 before being stored in the database. They are never printed back to the frontend (masked entirely) and are exclusively decrypted inside isolated serverless edge functions just in time for AI generation calls.
:::

## Fallback Behavior
You can choose what happens if your custom key fails (e.g., rate-limited or out of credits). By default, RocketBoard gracefully falls back to the built-in Gemini 3 Flash model so your workflow is never interrupted.`,
    relatedArticles: [],
  },

  // â”€â”€â”€ WHAT'S NEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "wn-1",
    slug: "whats-new",
    title: "What's New in RocketBoard",
    category: "whats-new",
    audience: ["all"],
    tags: ["changelog", "updates", "new features"],
    summary: "Recent updates and new features.",
    lastUpdated: "2026-03-15",
    content: `# What's New in RocketBoard

## March 15, 2026 (Latest)
- **Zero-Hallucination 7-Phase Engine** â€” Complete overhaul of the RAG pipeline with AST-aware ingestion, runtime grounding audits, and agentic self-correction retry loops.
- **Google Drive OAuth** â€” Connect your Google Account to import Docs, Sheets, and Drive files directly. Secure OAuth 2.0 flow with automatic token refresh.
- **Agentic Multi-Query RAG** â€” The AI now fires 3-4 diverse query variants in parallel before generating content, dramatically improving retrieval coverage.
- **Dynamic RRF Weights** â€” Hybrid search now intelligently balances vector and keyword search based on whether the query is conceptual or identifier-based.
- **Security Hardening** â€” Critical RLS vulnerabilities patched for organizations, members, and badges.

## March 18, 2026 (Titanium Update)
- **Titanium Security Hardening** â€” Full migration to **Pack-Scoped RLS** for \`knowledge_chunks\`. Direct table access now requires explicit pack membership, ending cross-pack data leakage.
- **Websearch-to-TSQuery** â€” Upgraded search parsing to use Postgres \`websearch\` grammar. Safely handle quotes, +/- operators, and complex technical queries with defensive query clamping.
- **Defensive Resource Shields** â€” Implemented hard caps on retrieval spans (50) and query length (500 chars) in both Edge and SQL layers to prevent resource exhaustion and abuse.

## March 13, 2026
- **Interactive Chat Citations** â€” Click \`[S1]\`, \`[S2]\` badges in AI responses to open source code with syntax highlighting. Hover for instant previews.
- **AI Observability** â€” Full telemetry tracing for all AI tasks (token usage, latency, cost). Trace IDs link user feedback to specific AI interactions.
- **Automated Remediation** â€” AI-drafted module updates when source code changes are detected via GitHub webhooks
- **Content Health Dashboard** â€” Track when source code changes affect generated content
- **Guided Tours** â€” Interactive walkthroughs for first-time users on every major page
- **Help Center** â€” Searchable in-app help with articles for every feature
- **Platform-Aware Mission Control** â€” Ask about RocketBoard features and get accurate answers
- **Help Tooltips** â€” Contextual â“˜ tooltips across the entire platform

## February 2026
- **Exercises** â€” Hands-on coding challenges with AI review
- **Spaced Repetition** â€” Review schedule for long-term retention
- **Cohorts** â€” Peer group progress tracking
- **Bookmarks & Collections** â€” Save and organize content`,
    relatedArticles: ["tech-1"],
  },
  {
    id: "tech-1",
    slug: "zero-hallucination-rag-architecture",
    title: "7-Phase Zero-Hallucination RAG Implementation",
    category: "tech-implementation",
    audience: ["admin", "author"],
    tags: ["architecture", "rag", "hallucination", "technical"],
    summary: "Deep dive into the 7-phase architecture underpinning RocketBoard's reliable AI.",
    lastUpdated: "2026-03-15",
    content: `# The Zero-Hallucination Journey ðŸš€

RocketBoard's RAG engine is built on a "Zero-Hallucination" philosophy. Here is the 7-phase architecture that powers our trusted AI output.

\`\`\`mermaid
sequenceDiagram
    participant U as User Query
    participant R as Multi-Query Engine
    participant S as Hybrid Search v2
    participant G as Grounding Audit
    participant A as Agentic Loop

    U->>R: Input Query
    R->>S: Generate 4x Query Variants
    S->>S: Vector + FTS + AST Match
    S->>G: Retrieve Evidence Pool
    G->>G: Verification Audit
    G-->>A: [Fail] Logic Errors
    A->>R: Retry with Feedback
    G-->>U: [Pass] Verified Answer
\`\`\`

## The 7-Phase Lifecycle

:::step[Phase 0: Grounded Foundation]{ðŸ›¡ï¸�}
We established a strict **Citation Backbone**. Every statement made by the AI MUST be cross-referenced to a file and line range using the \`[SOURCE: file:lines]\` standard.
:::

:::step[Phase 1: AST-Aware Ingestion]{ðŸ§±}
Standard chunking is blind to code logic. We use **Tree-sitter** to parse your codebase into logical entities (Functions, Classes, Exports). This ensures evidence spans are structured, not just random slices of text.
:::

:::step[Phase 2: Titanium Hybrid Search v2]{ðŸ”�}
We combine three retrieval layers for maximum recall:
*   **Vector (Semantic):** For conceptual questions.
*   **Full-Text (Websearch):** Using \`websearch_to_tsquery\` for safe, production-grade lexical parsing.
*   **AST Metadata:** For surgical precision on type signatures and logical entities.
:::

:::step[Phase 3: Relevance Gating]{ðŸš§}
The "Information Silo" problem is solved via **Batch Reranking**. We purge irrelevant noise before the AI even sees it, keeping the context window pristine.
:::

:::step[Phase 4: Grounding Audit]{âš–ï¸�}
Our "AI Judge" performs a **Runtime Verification**. It extracts generated code and verifies its existence in the source. If it's not in your repo, it's not in the response.
:::

:::step[Phase 5: Agentic Self-Correction]{ðŸ”„}
If the audit fails, the **Agentic Loop** kicks in. The AI is given its own audit results and instructed to fix the groundingâ€”handling up to 3 self-correction attempts automatically.
:::

:::step[Phase 6: Full Observability]{ðŸ“Š}
Every decision is logged. We monitor **Grounding Scores** and **Latency** in real-time via Langfuse and our local \`rag_metrics\` database.
:::

:::step[Phase 7: User-Facing Clarity]{âœ¨}
The final phase brings it all together with interactive citations, page tours, and this technical documentation.
:::

:::card[Rocket's Pro-Tip]{ðŸš€}
You can view the raw performance data for every query in the **Analytics** dashboard. It shows you exactly how many self-correction steps were needed to get your answer!
:::

[UI_ACTION: navigate_sources(Manage Your Sources)]`,
    relatedArticles: ["cc-5", "src-7"],
  },
  {
    id: "tech-2",
    slug: "ssrf-protection",
    title: "Understanding SSRF Protection",
    category: "tech-implementation",
    audience: ["admin"],
    tags: ["security", "ssrf", "protection", "edge-functions"],
    summary: "How RocketBoard protects your internal network from malicious outbound requests.",
    lastUpdated: "2026-03-25",
    content: `# SSRF Protection & Network Security ðŸ›¡ï¸�

RocketBoard takes a "Security-First" approach to outbound networking. When you connect a source or query the AI, our **Titanium SSRF Guard** ensures that no request can be manipulated to target your internal infrastructure.

## The Threat: Server-Side Request Forgery (SSRF)
In a typical SSRF attack, a malicious actor provides a URL (like \`http://localhost/admin\`) to a server, hoping the server will fetch sensitive data from its internal network.

## Our Defense: Titanium-Hardened Validation
Every URL that enters our Edge Functions (via connectors, webhooks, or AI routing) passes through \`parseAndValidateExternalUrl\` before any network call is made.

### ðŸ›¡ï¸� 1. IP Address Filtering (RFC 1918/3927)
We explicitly block all requests to:
- **Loopback**: \`127.0.0.1\`, \`::1\`
- **Private Networks**: \`10.0.0.0/8\`, \`172.16.0.0/12\`, \`192.168.0.0/16\`
- **Link-Local**: \`169.254.0.0/16\`
- **Raw IP Literals**: Only hostnames are allowed by default to prevent IP-obfuscation bypasses.

### ðŸ›¡ï¸� 2. Protocol & Credential Stripping
- **HTTPS Only**: All requests are forced to use TLS unless explicitly overridden for managed dev environments.
- **No Embedded Credentials**: URLs like \`https://user:pass@host.com\` are rejected to prevent credential-leaking headers.

### ðŸ›¡ï¸� 3. Domain Allowlisting
Connectors like Jira and Confluence are tied to specific suffixes (e.g., \`*.atlassian.net\`). Even if an author provides a different URL, the guard will block it unless it matches the allowlist.

### ðŸ›¡ï¸� 4. Concurrent Job Locking
To prevent race conditions during bulk ingestion, RocketBoard uses **DB-backed lease locks**. This ensures that two reindex jobs for the same pack can never run simultaneously, preventing data corruption and generation-pinning drift.

:::card[Rocket's Pro-Tip]{ðŸš€}
Your security is our priority. By centralizing these guards in a shared security module, we ensure consistent protection across all 28+ edge functions and 13 connectors.
:::`,
    relatedArticles: ["src-1", "src-7"],
  },
  {
    id: "learn-5",
    slug: "contextual-hints",
    title: "Contextual Hints & Learning Guidance",
    category: "learning",
    audience: ["learner"],
    tags: ["hints", "guidance", "stuck", "proactive"],
    summary: "How RocketBoard's proactive hint system helps you when you're stuck.",
    lastUpdated: "2026-03-19",
    content: `# Contextual Hints & Guidance ðŸš€
    
RocketBoard is designed to be your adaptive onboarding partner. Our **Contextual Hint Engine** proactively monitors your learning journey to detect when you might need a nudge forward.

## How it works

The system looks for three primary "struggle signals":

:::card[1. Dwell Time]{â�³}
If you've been on a single section for more than **90 seconds** without marking it as read, RocketBoard will surface a small hint to help you move to the next concept.
:::

:::card[2. Chat Errors]{âš ï¸�}
If you experience repeated technical issues with the AI chat (e.g., 2+ errors in 10 minutes), the system will offer a guided way to resolve the blockage.
:::

:::card[3. Chat Bouncing]{ðŸ”„}
If you open and close the chat panel several times in a short window without sending a message, the AI detects that you might be looking for an answer but aren't sure how to phrase the question.
:::

## Progressive Disclosure

Hints follow a "Progressive Disclosure" pattern to ensure you still have the "Aha!" moment yourself:

1. **The Nudge**: A small notification appears in the corner with a "Show hint" option.
2. **The Guided Answer**: If you click "Show hint," the system provides a specific step or explanation.
3. **Ask Rocket with Context**: If you're still stuck, you can click **"Ask Rocket"**. This opens the chat with a **pre-filled, context-aware question** tailored to the exact section you're reading.

:::card[Privacy & Throttling]{ðŸ›¡ï¸�}
Hints are designed to be helpful, not annoying. Every hint has a **24-hour cooldown** per section, and you can always **Snooze** or **Dismiss** a hint if you'd prefer to work through it on your own.
:::`,
    relatedArticles: ["learn-1", "learn-3"],
  },
  // â”€â”€â”€ VS CODE EXTENSION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  {
    id: "vsc-1",
    slug: "vscode-user-guide",
    title: "VS Code Extension: User Guide",
    category: "vs-code-extension",
    audience: ["all"],
    tags: ["vscode", "extension", "setup", "guide"],
    summary: "Complete guide to installing, configuring, and using the RocketBoard VS Code extension.",
    lastUpdated: "2026-03-19",
    content: `# RocketBoard VS Code Extension ðŸ”Œ

RocketBoard is a grounded AI coding assistant that explains your code selections using your own repository's context.

## ðŸš€ Features

- **Explain Selection**: Select any block of code and get a detailed explanation.
- **Grounded AI**: Every claim is backed by evidence from your codebase.
- **Interactive Citations**: Clickable badges \`[S1]\`, \`[S2]\`, etc.
- **Pack Selection**: Ground explanations against specific project "packs".

## ðŸ“¦ Setup and Installation

### Prerequisites
- **VS Code**: Version 1.80.0 or higher.
- **Node.js**: Version 18.x or higher.

### Installation (Build from Source)
1. **Clone the Repo**: \`git clone https://github.com/knarayanareddy/rocketboard-ai-guide.git\`
2. **Install**: \`npm install\` in \`vscode-extension/\`
3. **Build**: \`npm run compile\`
4. **Launch**: Press \`F5\` to open the Extension Development Host.

### Detailed Configuration
Set these in **File > Preferences > Settings**:
| Setting | Description |
|---|---|
| \`rocketboard.supabaseUrl\` | **Required.** Your Supabase project URL. |
| \`rocketboard.packId\` | The UUID of the specific pack. |

## ðŸ”‘ Authentication
1. Log in to your RocketBoard dashboard.
2. Navigate to **API Keys** and copy your token.
3. In VS Code, run \`RocketBoard: Set token\`.

## ðŸ› ï¸� Usage
1. **Select Pack**: Click the Status Bar item (bottom right).
2. **Explain Code**: Highlight code and run \`RocketBoard: Explain selection\`.
3. **Citations**: Click \`[S1]\` to jump to source code.`,
  },
  {
    id: "vsc-2",
    slug: "vscode-maintainers-guide",
    title: "VS Code Extension: Maintainer's Guide",
    category: "vs-code-extension",
    audience: ["admin", "author"],
    tags: ["vscode", "maintainer", "architecture", "internals"],
    summary: "Technical deep dive into the extension's architecture, state management, and API integration.",
    lastUpdated: "2026-03-19",
    content: `# maintainer's Guide ðŸ› ï¸�

This document describes the technical internals of the RocketBoard VS Code extension.

## ðŸ“‚ Repository Layout
- \`src/extension.ts\`: Main entry point.
- \`src/packPicker.ts\`: Pack selection logic.
- \`src/auth.ts\`: \`SecretStorage\` token management.
- \`src/api.ts\`: Edge Function integration.
- \`src/citations.ts\`: \`[S#]\` citation mapping.
- \`src/webview.ts\`: Webview configuration.

## ðŸ’¾ State & Persistence
- **Config**: \`rocketboard.*\` settings.
- **WorkspaceState**: Active pack ID and title.
- **Secrets**: Secure API token storage.

## ðŸ“¡ API Integration
1. \`/functions/v1/list-my-packs\`: Fetch available packs.
2. \`/functions/v1/retrieve-spans\`: Fetch evidence for selection.
3. \`/functions/v1/ai-task-router\`: Generate grounded response.

## ðŸ�—ï¸� Technical Internals
- **Webview**: Uses Strict CSP and \`DOMPurify\` for sanitization.
- **Citations**: Resolved across workspaces with path-traversal guards.`,
  },
  {
    id: "vsc-3",
    slug: "vscode-security-model",
    title: "VS Code Extension: Security Model",
    category: "vs-code-extension",
    audience: ["all"],
    tags: ["vscode", "security", "threat model", "sanitization"],
    summary: "Overview of the extension's security posture and threat mitigation strategies.",
    lastUpdated: "2026-03-19",
    content: `# Security Model ðŸ›¡ï¸�

RocketBoard is built with a security-first mindset.

## âš¡ Threat Model & Mitigations
| Threat | Mitigation |
|---|---|
| **Token Theft** | Use VS Code \`SecretStorage\` (OS Keychain). |
| **XSS / Malicious MD** | Strict CSP + \`DOMPurify\` sanitization. |
| **Path Traversal** | Workspace root validation on all citation clicks. |
| **Range Disclosure** | Range bounding (capped at 5000 lines). |

## ðŸ“� Secure Coding Rules
1. **Strict Secret Handling**: Never log tokens or raw code.
2. **Webview Safety**: Use Nonces and sanitize all HTML.
3. **Workspace Isolation**: Restrict file operations to the workspace root.
4. **External Fetches**: Only communicate with the configured Supabase URL.`,
  },
  {
    id: "tech-3",
    slug: "deno-runtime-standards",
    title: "Deno 2.0 & Runtime Standards",
    category: "tech-implementation",
    audience: ["admin", "author"],
    tags: ["deno", "runtime", "node", "standards"],
    summary: "Technical standards for the Deno 2.0 migration and Edge Function configuration.",
    lastUpdated: "2026-03-25",
    content: `# Deno 2.0 & Runtime Standards ðŸ¦•

RocketBoard has migrated to **Deno 2.0** to leverage enhanced performance and native Node.js compatibility.

## Key Changes
- **Node Compatibility**: Switched from legacy \`nodeModulesDir: true\` to the new \`nodeModulesDir: "auto"\` standard in all \`deno.json\` files.
- **Dependency Resolution**: Faster and more reliable \`npm:\` specifier resolution.
- **Formatting**: Strict enforcement of \`deno fmt\` for all Edge Function code, including multiline Response objects.

## Mandatory CI Gates
All Pull Requests are subject to the following automated checks:
1. **\`deno fmt --check\`**: Ensures consistent code style across all 76+ functions.
2. **\`node scripts/audit-edge-functions.mjs\`**: Scans for security regressions like wildcard CORS or missing auth guards.

:::card[Rocket's Pro-Tip]{ðŸš€}
When developing locally, always run \`deno fmt\` before pushing to ensure your changes pass the formatting gate!
:::`,
  },
];
