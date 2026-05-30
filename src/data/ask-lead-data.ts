import { Track } from "./onboarding-data";

export interface AskLeadQuestion {
  id: string;
  question: string;
  why_it_matters: string;
  track_key?: Track;
  category: "team" | "technical" | "process" | "culture";
}

export const askLeadQuestions: AskLeadQuestion[] = [
  {
    id: "al-1",
    question: "What are the top 3 priorities for the team this quarter?",
    why_it_matters: "Understanding priorities helps you align your work and identify the most impactful contributions.",
    category: "team",
  },
  {
    id: "al-2",
    question: "Which services does our team own, and what are the boundaries with adjacent teams?",
    why_it_matters: "Clear ownership boundaries prevent duplicated work and help you route questions correctly.",
    category: "technical",
    track_key: "backend",
  },
  {
    id: "al-3",
    question: "What's the biggest technical debt item the team wants to address?",
    why_it_matters: "Knowing tech debt hotspots helps you avoid building on fragile foundations and spot improvement opportunities.",
    category: "technical",
  },
  {
    id: "al-4",
    question: "How does the team handle disagreements on technical decisions?",
    why_it_matters: "Understanding the decision-making process helps you contribute constructively to architectural discussions.",
    category: "culture",
  },
  {
    id: "al-5",
    question: "What does a successful first 30 days look like for someone in my role?",
    why_it_matters: "Explicit expectations prevent misaligned effort and help you self-assess your progress.",
    category: "team",
  },
  {
    id: "al-6",
    question: "Which monitoring dashboards should I have open during my on-call shift?",
    why_it_matters: "Pre-configured dashboards drastically reduce time-to-detection when something goes wrong.",
    category: "technical",
    track_key: "infra",
  },
  {
    id: "al-7",
    question: "Are there any upcoming architecture changes or migrations I should be aware of?",
    why_it_matters: "Knowing about migrations prevents you from building features that will need immediate rework.",
    category: "technical",
  },
  {
    id: "al-8",
    question: "What's the process for proposing a new feature or significant refactor?",
    why_it_matters: "Understanding the RFC/proposal process ensures your ideas get proper visibility and buy-in.",
    category: "process",
  },
  {
    id: "al-9",
    question: "How does the team communicate async vs sync? When should I use Slack vs a meeting?",
    why_it_matters: "Communication norms reduce friction and prevent unnecessary interruptions.",
    category: "culture",
  },
  {
    id: "al-10",
    question: "What are the key frontend performance budgets and how are they enforced?",
    why_it_matters: "Performance budgets ensure new features don't degrade user experience.",
    category: "technical",
    track_key: "frontend",
  },
  {
    id: "al-11",
    question: "Who are the go-to people for different parts of the system when I get stuck?",
    why_it_matters: "Knowing the knowledge graph of the team saves hours of debugging in the wrong direction.",
    category: "team",
  },
  {
    id: "al-12",
    question: "What deployment gotchas should I know about (feature flags, dark launches, canary)?",
    why_it_matters: "Deployment practices vary per service; understanding them prevents accidental production issues.",
    category: "process",
    track_key: "cross-repo",
  },
];
