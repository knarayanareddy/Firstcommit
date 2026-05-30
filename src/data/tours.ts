import type { Tour } from "@/lib/tour-system";

export const ALL_TOURS: Tour[] = [
  {
    id: "dashboard-welcome",
    pagePattern: "^/packs/[^/]+$",
    steps: [
      {
        target: "[data-tour='dashboard-hero']",
        title: "Welcome to Your Pack Dashboard!",
        content: "This is your home base. You'll see your progress, modules, and quick actions here. Let's take a quick look around.",
      },
      {
        target: "[data-tour='continue-learning']",
        title: "Continue Where You Left Off",
        content: "This button always takes you to your most recent module and section. It's the fastest way to resume learning.",
      },
      {
        target: "[data-tour='stats-strip']",
        title: "Your Progress at a Glance",
        content: "Track your modules completed, sections read, and quiz scores. These update in real-time as you learn.",
      },
      {
        target: "[data-tour='module-grid']",
        title: "Your Learning Modules",
        content: "Each card represents a module. Click to start reading. Modules may have prerequisites — locked ones show a 🔒 icon.",
      },
      {
        target: "[data-tour='suggested-action']",
        title: "Smart Suggestions",
        content: "RocketBoard suggests your next step based on your progress. Follow these for the most effective onboarding path.",
      },
      {
        target: "[data-tour='sidebar-nav']",
        title: "Navigation",
        content: "Use the sidebar to access all features: Modules, Glossary, Paths, Team Directory, Discussions, and more. Press **Cmd+K** to search anything.",
      },
    ],
  },
  {
    id: "sources-setup",
    pagePattern: "^/packs/[^/]+/sources$",
    requiredRole: "author",
    steps: [
      {
        target: "[data-tour='sources-heading']",
        title: "Connect Your Knowledge Sources",
        content: "This is where you connect your codebase and documents. RocketBoard analyzes these to generate onboarding content.",
      },
      {
        target: "[data-tour='add-source']",
        title: "Add a Source",
        content: "Add a GitHub repository, upload documents, or connect Google Drive via OAuth. Most packs have 2-5 sources. The AI retrieves evidence across all of them simultaneously.",
      },
      {
        target: "[data-tour='source-list']",
        title: "Source Management",
        content: "After adding a source, click 'Sync' to ingest. Vetted by our **Titanium SSRF Guard** and **Multi-Stage Security Audit**, ensuring true SHA-256 chunk hashing and Vault-secured API keys before any chunk is authored.",
      },
    ],
  },
  {
    id: "plan-curation",
    pagePattern: "^/packs/[^/]+/plan$",
    requiredRole: "author",
    steps: [
      {
        target: "[data-tour='generate-plan']",
        title: "Generate Your Learning Plan",
        content: "Click here and the AI will analyze your sources to propose onboarding modules tailored to your codebase.",
      },
      {
        target: "[data-tour='detected-signals']",
        title: "What the AI Found",
        content: "These 'signals' show technologies and patterns detected in your code. They explain why specific modules were proposed.",
      },
      {
        target: "[data-tour='module-plan-list']",
        title: "Your Module Plan",
        content: "These are the proposed modules. You have full editorial control: edit titles, reorder by dragging, add custom modules, or remove ones you don't need.",
      },
      {
        target: "[data-tour='module-card-edit']",
        title: "Edit Modules In-Place",
        content: "Click any title or description to edit. Change difficulty, time estimates, and assign tracks or templates per module.",
      },
      {
        target: "[data-tour='prerequisites']",
        title: "Set Prerequisites",
        content: "Define which modules must be completed before others. 'Hard' prerequisites lock the module; 'Soft' ones just show a recommendation.",
      },
      {
        target: "[data-tour='approve-plan']",
        title: "Approve When Ready",
        content: "Once you're happy with the plan, approve it. This enables content generation. You can always regenerate a new plan later.",
      },
    ],
  },
  {
    id: "review-publish",
    pagePattern: "^/packs/[^/]+/review$",
    requiredRole: "author",
    steps: [
      {
        target: "[data-tour='review-heading']",
        title: "Review Your Generated Content",
        content: "All modules and supporting content are generated as drafts. Review everything here before making it visible to learners.",
      },
      {
        target: "[data-tour='review-module-card']",
        title: "Module Review Card",
        content: "Preview each module, refine with AI, or regenerate. Reindexing is protected by **Concurrent Lease Locks** and the **Security Audit Regression Gate**.",
      },
      {
        target: "[data-tour='review-module-card']",
        title: "AI Draft Updates ✨",
        content: "If source code changes make a module stale, RocketBoard automatically drafts a content fix. Verified by the enhanced **4-Stage Zero-Hallucination Pipeline** with real-time grounding audits.",
      },
      {
        target: "[data-tour='preview-button']",
        title: "Preview as Learner",
        content: "See exactly what learners will see. Check that code snippets are relevant, explanations are clear, and citations are accurate.",
      },
      {
        target: "[data-tour='refine-button']",
        title: "Refine with AI",
        content: "Tell the AI what to change in plain English: 'Add more detail about error handling' or 'Simplify section 3'. The AI updates the module and shows you what changed.",
      },
      {
        target: "[data-tour='publish-button']",
        title: "Publish to Learners",
        content: "When you're satisfied, publish the pack. All draft content becomes visible to learners immediately. You can continue editing after.",
      },
    ],
  },
  {
    id: "ai-error-recovery",
    // No pagePattern: this tour is triggered programmatically when AI generation fails,
    // not auto-triggered on any page visit.
    steps: [
      {
        target: "[data-tour='ai-error-display']",
        title: "AI Generation Failed",
        content: "Don't worry, AI generation occasionally fails. The system caught the error and gracefully halted.",
      },
      {
        target: "[data-tour='ai-error-retry']",
        title: "Retry Generation",
        content: "Click 'Retry' to attempt the process again. The AI will often succeed on a second attempt.",
        waitForClick: true,
      },
    ],
  },
  {
    id: "module-reading-intro",
    pagePattern: "^/packs/[^/]+/modules/[^/]+$",
    steps: [
      {
        target: "[data-tour='module-header']",
        title: "Welcome to This Module",
        content: "You'll read through sections at your own pace. Mark each section as read when you're done. If you get stuck, RocketBoard will proactively offer **Contextual Hints** after 90 seconds of dwell time.",
      },
      {
        target: "[data-tour='module-tabs']",
        title: "Four Tabs",
        content: "**Content:** the learning material. **Quiz:** test your knowledge. **Exercises:** hands-on challenges. **Discussions:** ask questions and share tips.",
      },
      {
        target: "[data-tour='module-section']",
        title: "Reading Sections",
        content: "Expand each section to read. Look for code snippets from your actual codebase — they're highlighted with file paths.",
      },
      {
        target: "[data-tour='mark-read']",
        title: "Track Your Progress",
        content: "Click to mark a section as completed. Your progress is saved automatically and you can resume anytime.",
        waitForClick: true,
      },
    ],
  },
  {
    id: "module-reading-notes",
    pagePattern: "^/packs/[^/]+/modules/[^/]+$",
    steps: [
      {
        target: "[data-tour='notes-button']",
        title: "Take Personal Notes",
        content: "Use the notes panel to write down key takeaways. Try highlighting text to quickly save it as a note!",
      },
      {
        target: "[data-tour='citation-badge']",
        title: "Source References",
        content: "These badges link to the actual source code. Click to view the original file with syntax highlighting. Hover for a preview.",
      },
      {
        target: "[data-tour='bookmark-button']",
        title: "Save for Later",
        content: "Bookmark any section for quick reference. Access all saved items from the 🔖 Saved page in the sidebar.",
      },
    ],
  },
  {
    id: "module-reading-chat",
    pagePattern: "^/packs/[^/]+/modules/[^/]+$",
    steps: [
      {
        target: "[data-tour='rocket-fab']",
        title: "Ask the AI",
        content: "Click to open Rocket — your module-specific AI assistant. Ask questions about anything in this module and get answers grounded in your actual codebase.",
        waitForClick: true,
      },
      {
        target: "[data-tour='chat-message']",
        title: "Grounded Multi-Query Citations",
        content: "Look for **[S1]**, **[S2]** badges. These follow a **4-stage Zero-Hallucination pipeline** with automated grounding audits. The AI is forbidden from writing code and must use placeholders. If you 'bounce', the system detects your struggle.",
      },
      {
        target: "[data-tour='chat-sources']",
        title: "Source Badges",
        content: "The bottom of each response shows all referenced source files as interactive badges. Click any badge to explore the evidence that grounded the answer.",
      },
      {
        target: "[data-tour='chat-report']",
        title: "Report Incorrect Answers & Close the Loop",
        content: "If an answer seems wrong, click the **flag** icon. Your feedback is instantly tagged with a Trace ID and linked to our technical telemetry, allowing authors to audit the exact retrieval context and 'fix the glitch' across the entire pack.",
      },
    ],
  },
  {
    id: "glossary-intro",
    pagePattern: "^/packs/[^/]+/glossary$",
    steps: [
      {
        target: "[data-tour='glossary-search']",
        title: "Search Glossary Terms",
        content: "Type to instantly filter terms. Search matches term names and definitions.",
      },
      {
        target: "[data-tour='glossary-track-filter']",
        title: "Filter by Track",
        content: "Show only terms relevant to your role track (e.g., Frontend, Backend).",
      },
      {
        target: "[data-tour='glossary-term']",
        title: "Term Details",
        content: "Each term includes a definition, usage context (often with code examples), and links to the source evidence.",
      },
    ],
  },
  {
    id: "paths-intro",
    pagePattern: "^/packs/[^/]+/paths$",
    steps: [
      {
        target: "[data-tour='paths-tabs']",
        title: "Day 1 and Week 1",
        content: "Start with Day 1 for immediate setup tasks. Week 1 covers deeper exploration over your first full week.",
      },
      {
        target: "[data-tour='paths-step']",
        title: "Step-by-Step Guidance",
        content: "Each step has a description, sub-steps, time estimate, and success criteria. Check off steps as you complete them.",
      },
      {
        target: "[data-tour='paths-tabs']",
        title: "Track Your Path Progress",
        content: "Progress is saved automatically. Come back anytime to continue where you left off.",
      },
    ],
  },
  {
    id: "team-intro",
    pagePattern: "^/packs/[^/]+/team$",
    steps: [
      {
        target: "[data-tour='team-member']",
        title: "Meet Your Team",
        content: "Each card shows a team member, their areas of expertise, and what they own in the codebase.",
      },
      {
        target: "[data-tour='meeting-checkbox']",
        title: "Track Your 1:1 Meetings",
        content: "Check off each person as you meet with them. Suggested topics help you have productive conversations.",
      },
      {
        target: "[data-tour='meeting-progress']",
        title: "Meeting Progress",
        content: "Aim to meet all recommended people during your first two weeks. These connections are invaluable for ramping up.",
      },
    ],
  },
  {
    id: "ask-lead-intro",
    pagePattern: "^/packs/[^/]+/ask-lead$",
    steps: [
      {
        target: "[data-tour='ask-lead-header']",
        title: "Ask Your Lead",
        content: "A curated list of high-signal questions to bring to your first 1:1 meetings with team leads and senior colleagues.",
      },
      {
        target: "[data-tour='ask-lead-category-filter']",
        title: "Filter by Category or Track",
        content: "Narrow the list by topic (Team, Technical, Process, Culture) or your role track to find the most relevant questions.",
      },
      {
        target: "[data-tour='ask-lead-progress']",
        title: "Track Your Progress",
        content: "Check off each question as you ask it. This counter shows how many you've covered so far.",
      },
      {
        target: "[data-tour='ask-lead-question']",
        title: "Question Cards",
        content: "Each card shows the question and why it matters. Click the circle to mark it as asked. Use the bookmark icon to save your favorites for later.",
      },
    ],
  },
  {
    id: "faq-intro",
    pagePattern: "^/packs/[^/]+/faq$",
    steps: [
      {
        target: "[data-tour='faq-header']",
        title: "Frequently Asked Questions",
        content: "A living knowledge base of common questions and answers — sourced from chat conversations, discussion threads, and team authors.",
      },
      {
        target: "[data-tour='faq-search']",
        title: "Search Instantly",
        content: "Type anything to filter across both questions and answers in real-time.",
      },
      {
        target: "[data-tour='faq-tag-filter']",
        title: "Filter by Tag",
        content: "Use tags to browse questions by topic area — great for finding all FAQs related to a specific domain.",
      },
      {
        target: "[data-tour='faq-entry']",
        title: "FAQ Entry",
        content: "Each entry shows the question and a full markdown answer. Authors can edit or archive entries using the hover actions.",
      },
    ],
  },
  {
    id: "faq-suggestions-intro",
    pagePattern: "^/packs/[^/]+/faq-suggestions$",
    requiredRole: "author",
    steps: [
      {
        target: "[data-tour='suggestions-header']",
        title: "AI-Detected Repeated Questions",
        content: "RocketBoard monitors chat and discussions for repeated questions. When the same question is asked multiple times, it surfaces here for you to act on.",
      },
      {
        target: "[data-tour='suggestion-card']",
        title: "Suggestion Card",
        content: "Each card shows the canonical question, how many times it was asked, and example phrasings. Expand it to see the exact user questions.",
      },
      {
        target: "[data-tour='convert-faq-button']",
        title: "Convert to FAQ",
        content: "Click to open a pre-filled FAQ dialog. Review the AI-suggested answer, then save it to make the knowledge permanent. You can also dismiss or save as a glossary term instead.",
      },
    ],
  },
  {
    id: "discussions-intro",
    pagePattern: "^/packs/[^/]+/discussions$",
    steps: [
      {
        target: "[data-tour='discussions-header']",
        title: "Pack Discussions",
        content: "A space for async conversations about anything in the pack — module questions, process clarifications, or general onboarding chat.",
      },
      {
        target: "[data-tour='discussion-list']",
        title: "Thread List",
        content: "Click any thread to read the conversation and reply. You can start a new thread using the **New Thread** button. Questions are grouped by module when applicable.",
      },
    ],
  },
  {
    id: "analytics-intro",
    pagePattern: "^/packs/[^/]+/analytics$",
    requiredRole: "admin",
    steps: [
      {
        target: "[data-tour='analytics-header']",
        title: "Pack Analytics",
        content: "Track how your team is engaging with the pack — overall progress, reading activity, quiz performance, and XP earned.",
      },
      {
        target: "[data-tour='analytics-metrics']",
        title: "Key Metrics",
        content: "At-a-glance numbers: total members, modules published, sections read, quizzes taken, XP earned, and active learners in the last 7 days.",
      },
      {
        target: "[data-tour='analytics-chart']",
        title: "Module Engagement",
        content: "A bar chart showing how many sections and quizzes each module has received. Useful for spotting which modules are underused.",
      },
      {
        target: "[data-tour='analytics-leaderboard']",
        title: "Leaderboard",
        content: "See the top learners by XP earned. Use this to celebrate progress and identify who might need a nudge.",
      },
    ],
  },
  {
    id: "feedback-intro",
    pagePattern: "^/packs/[^/]+/feedback$",
    requiredRole: "author",
    steps: [
      {
        target: "[data-tour='feedback-header']",
        title: "Learner Feedback",
        content: "This page centralises all feedback your learners have submitted — section ratings, flags, and AI chat reports — in one place.",
      },
      {
        target: "[data-tour='feedback-tabs']",
        title: "Content vs Chat Feedback",
        content: "**Content Feedback** shows in-module ratings and flagged sections. **Chat Reports** shows AI chat messages reported as incorrect or unhelpful.",
      },
      {
        target: "[data-tour='feedback-module-ratings']",
        title: "Module Ratings",
        content: "See thumbs up/down counts and average star ratings per module. Flag counts highlight modules that may need attention.",
      },
      {
        target: "[data-tour='feedback-flagged']",
        title: "Flagged Content",
        content: "Specific sections that learners marked as confusing, outdated, or incorrect. Click **Resolve** once you've addressed the issue.",
      },
    ],
  },
  {
    id: "members-intro",
    pagePattern: "^/packs/[^/]+/members$",
    requiredRole: "admin",
    steps: [
      {
        target: "[data-tour='members-header']",
        title: "Manage Members",
        content: "Add people to the pack, control their access level, and manage pending invites from this page.",
      },
      {
        target: "[data-tour='invite-form']",
        title: "Invite by Email",
        content: "Enter an email and choose a role — **Learner**, **Author**, **Admin**, etc. If the user already has an account they'll be added immediately; otherwise they'll receive an invite link.",
      },
      {
        target: "[data-tour='members-table']",
        title: "Member List",
        content: "All current members are listed here. Use the role dropdown to change access levels at any time. Remove members with the trash icon.",
      },
    ],
  },
  {
    id: "bookmarks-intro",
    pagePattern: "^/packs/[^/]+/bookmarks$",
    steps: [
      {
        target: "[data-tour='bookmarks-header']",
        title: "Saved Items",
        content: "Everything you've bookmarked across modules, glossary terms, exercises, paths, and Ask Lead questions is collected here.",
      },
      {
        target: "[data-tour='bookmark-item']",
        title: "Bookmark Card",
        content: "Click a bookmark to jump straight to the source. Use the pin icon to surface it on your dashboard, or the trash icon to remove it. You can also select multiple and bulk-manage them.",
      },
    ],
  },
  {
    id: "timeline-intro",
    pagePattern: "^/packs/[^/]+/timeline$",
    steps: [
      {
        target: "[data-tour='timeline-header']",
        title: "My Timeline",
        content: "A milestone-based onboarding timeline organised into phases: Day 1, Week 1, Month 1, and beyond. Check off milestones as you complete them.",
      },
      {
        target: "[data-tour='timeline-entry']",
        title: "Milestone",
        content: "Click the circle to mark a milestone as complete. Required milestones are highlighted. Admins can add custom milestones for the whole team.",
      },
    ],
  },
  {
    id: "content-health-intro",
    pagePattern: "^/packs/[^/]+/health$",
    requiredRole: "author",
    steps: [
      {
        target: "[data-tour='health-header']",
        title: "Content Health",
        content: "Monitors whether your generated content is still accurate after source code changes. If a source file is updated, the sections that reference it are flagged as stale.",
      },
      {
        target: "[data-tour='health-card']",
        title: "Module Health Overview",
        content: "Each card shows the freshness status for a module. Green means all sections are up-to-date; amber/red means stale sections need attention. Click **Check Now** to run a fresh staleness scan.",
      },
      {
        target: "[data-tour='health-card']",
        title: "Automated Remediation",
        content: "When significant staleness is detected, the AI Agent automatically kicks in, reads the raw git diffs, and drafts an updated module section. Head to the Review page to accept these drafts!",
      },
    ],
  },
  {
    id: "quiz-analytics-intro",
    pagePattern: "^/packs/[^/]+/quiz-analytics$",
    requiredRole: "author",
    steps: [
      {
        target: "[data-tour='quiz-analytics-header']",
        title: "Quiz Analytics",
        content: "Deep-dive into how learners are performing on quizzes — pass rates, score distributions, and per-question analysis.",
      },
      {
        target: "[data-tour='quiz-score-distribution']",
        title: "Overall Metrics",
        content: "Key numbers at a glance: total attempts, average score, pass rate, and first-try pass rate across all modules.",
      },
      {
        target: "[data-tour='quiz-module-breakdown']",
        title: "Per-Module Breakdown",
        content: "Click any module row to expand it and see question-level stats. Questions with low correct rates (🔴) indicate concepts that may need clearer explanation in the module content.",
      },
    ],
  },
  {
    id: "settings-intro",
    pagePattern: "^/settings$",
    steps: [
      {
        target: "[data-tour='settings-header']",
        title: "Your Settings",
        content: "Personalise how RocketBoard generates and displays content for you. Changes take effect on new AI responses immediately.",
      },
      {
        target: "[data-tour='settings-profile']",
        title: "Profile Completeness",
        content: "Fill in all fields to get the most personalised content. The AI uses your role, experience level, learning style, framework familiarity, and tone preference when generating modules and chat responses.",
      },
      {
        target: "[data-tour='settings-pack']",
        title: "Audience & Depth",
        content: "Choose whether you want **Technical**, **Non-Technical**, or **Mixed** content. Pair this with a depth level to fine-tune verbosity and detail.",
      },
      {
        target: "[data-tour='settings-ai-provider']",
        title: "AI Model Provider (BYOK)",
        content: "RocketBoard defaults to Gemini 3 Flash, but you can bring your own API key to unlock frontier models like Claude 4.6 or GPT-5.4. Your keys are AES-256 encrypted.",
      },
    ],
  },
  {
    id: "templates-intro",
    pagePattern: "^/templates$",
    requiredRole: "admin",
    steps: [
      {
        target: "[data-tour='templates-header']",
        title: "Module Templates",
        content: "Templates are blueprints that control how the AI structures generated modules. They define section outlines, trigger rules, and content constraints.",
      },
      {
        target: "[data-tour='template-grid']",
        title: "Your Templates",
        content: "Click any template card to view or edit it. Assign templates to individual modules in the **Plan** page to ensure consistent formatting across similar content types.",
      },
    ],
  },
  {
    id: "roadmap-learner-tour",
    pagePattern: "^/packs/[^/]+/roadmap$",
    steps: [
      {
        target: "[data-tour='roadmap-header']",
        title: "Your Onboarding Roadmap",
        content: "This is your personalized journey. It breaks down your onboarding into three phases: Day 1-30, 31-60, and 61-90.",
      },
      {
        target: "[data-tour='roadmap-phase-day-1-30']",
        title: "Phased Learning",
        content: "We group items into phases to help you focus on what's most important right now. You can see your progress for each phase here.",
      },
      {
        target: "[data-tour='roadmap-item-card']",
        title: "Roadmap Items",
        content: "Each card represents a task, module, or milestone. Click 'Start' to jump to the content.",
      },
      {
        target: "[data-tour='roadmap-lock']",
        title: "Locked Items",
        content: "Items with a lock icon are blocked by prerequisites. Hover to see what you need to complete first.",
      },
    ],
  },
  {
    id: "roadmap-builder-tour",
    pagePattern: "^/packs/[^/]+/roadmap-builder$",
    requiredRole: "author",
    steps: [
      {
        target: "[data-tour='builder-header']",
        title: "Welcome to Roadmap Builder",
        content: "As an author or admin, you can design the structured journey for your team here.",
      },
      {
        target: "[data-tour='create-playlist']",
        title: "Create a Playlist",
        content: "A playlist is a collection of items for a specific phase (e.g., 'Backend Day 1-30').",
      },
      {
        target: "[data-tour='assign-user']",
        title: "Assign to Learners",
        content: "Once a playlist is ready, assign it to learners. You can set a custom start date and assign a mentor for each assignment.",
      },
      {
        target: "[data-tour='add-item-button']",
        title: "Add Items & Dependencies",
        content: "Add modules, Platform Docs, links, or custom tasks to your playlists. Use the dependency tool to set the required order of learning.",
      },
    ],
  },
  {
    id: "docs-library-intro",
    pagePattern: "^/packs/[^/]+/docs$",
    steps: [
      {
        target: "[data-tour='docs-library-header']",
        title: "Platform Docs Library",
        content: "Welcome to your interactive documentation library. This is where you can find and read standard operational procedures, internal guides, and technical specifications.",
      },
      {
        target: "[data-tour='docs-search-bar']",
        title: "Search & Filter",
        content: "Quickly find documents by typing keywords or filtering by category tags. All documents are synced directly from your team's code repository.",
      },
      {
        target: "[data-tour='docs-grid']",
        title: "Your Documents",
        content: "Click on any document card to read it interactively. Completed documents will have a green checkmark indicating you've finished reading them.",
      },
      {
        target: "[data-tour='docs-admin-link']",
        title: "Manage Content",
        content: "If you are an author or admin, click the 'Manage' button to sync the latest Markdown files directly from your repository.",
      },
    ],
  },
  {
    id: "docs-admin-intro",
    pagePattern: "^/packs/[^/]+/docs-admin$",
    requiredRole: "admin",
    steps: [
      {
        target: "[data-tour='docs-admin-header']",
        title: "Manage Platform Docs",
        content: "This panel allows you to manually trigger a sync of all Technical Documents from your configured Github repository.",
      },
      {
        target: "[data-tour='docs-sync-button']",
        title: "Trigger Sync",
        content: "Click this button to ingest documents from your repository's /Technical documents folder. The engine performs an **Integrity-Verified Audit** against the repository baseline, redacting secrets automatically and assigning a SHA256 script hash to the sync run.",
      },
      {
        target: "[data-tour='docs-sync-button']",
        title: "Webhook Automation",
        content: "In production, incoming continuous-integration traffic must be cryptographically signed, or the engine will drop the request immediately (401 Unauthorized), ensuring fail-secure synchronization.",
      },
    ],
  },
];

