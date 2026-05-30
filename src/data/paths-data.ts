import { Track } from "./onboarding-data";

export interface PathStep {
  id: string;
  title: string;
  time_estimate_minutes: number;
  steps: string[];
  success_criteria: string[];
  track_key?: Track;
}

export const day1Path: PathStep[] = [
  {
    id: "d1-1",
    title: "Environment Setup",
    time_estimate_minutes: 45,
    steps: [
      "Clone the monorepo and install dependencies",
      "Run `dev-env bootstrap` to set up Docker containers",
      "Run `dev-env doctor` to verify everything is configured",
      "Start the dev server with `pnpm dev` (frontend) or `make dev` (backend)",
    ],
    success_criteria: [
      "dev-env doctor passes with no errors",
      "Local dev server runs and loads the app in browser",
    ],
    track_key: "cross-repo",
  },
  {
    id: "d1-2",
    title: "Access & Permissions",
    time_estimate_minutes: 30,
    steps: [
      "Verify GitHub access to all required repos",
      "Set up PagerDuty account and join your on-call rotation",
      "Join key Slack channels: #engineering, #incident-response, your team channel",
      "Request Grafana/monitoring dashboard access",
    ],
    success_criteria: [
      "Can push a branch to at least one repo",
      "PagerDuty sends a test notification",
      "Can view Grafana dashboards",
    ],
    track_key: "cross-repo",
  },
  {
    id: "d1-3",
    title: "First Code Change",
    time_estimate_minutes: 60,
    steps: [
      "Pick a 'good-first-issue' labeled ticket from your team's board",
      "Create a branch following the naming convention: type/TICKET-description",
      "Make the change and write a test",
      "Open a PR and request reviews",
    ],
    success_criteria: [
      "PR follows naming conventions",
      "CI passes (lint, type-check, tests)",
      "At least one reviewer approves",
    ],
  },
  {
    id: "d1-4",
    title: "Complete Architecture Module",
    time_estimate_minutes: 20,
    steps: [
      "Read through the Architecture Overview module in RocketBoard",
      "Take notes on sections relevant to your track",
      "Complete the quiz at the end",
    ],
    success_criteria: [
      "All sections marked as read",
      "Quiz passed with ≥ 80%",
    ],
  },
];

export const week1Path: PathStep[] = [
  {
    id: "w1-1",
    title: "Complete All Onboarding Modules",
    time_estimate_minutes: 120,
    steps: [
      "Work through remaining modules: Development Workflow, Monitoring & Incidents, Security, Testing",
      "Focus on modules tagged with your track",
      "Take notes and pass all quizzes",
    ],
    success_criteria: [
      "All track-relevant modules at 100%",
      "All quizzes passed",
    ],
  },
  {
    id: "w1-2",
    title: "Shadow an On-Call Shift",
    time_estimate_minutes: 60,
    steps: [
      "Pair with a current on-call engineer for one shift",
      "Observe how they triage alerts",
      "Review a recent post-mortem together",
    ],
    success_criteria: [
      "Can explain the escalation chain from memory",
      "Comfortable acknowledging an alert in PagerDuty",
    ],
    track_key: "infra",
  },
  {
    id: "w1-3",
    title: "Ship a Meaningful PR",
    time_estimate_minutes: 240,
    steps: [
      "Pick a real ticket (not just a good-first-issue)",
      "Write implementation with proper tests",
      "Get 2 approvals and merge to main",
      "Verify the deploy preview looks correct",
    ],
    success_criteria: [
      "PR merged with 2+ approvals",
      "CI green, no regressions",
      "Change visible in staging",
    ],
  },
  {
    id: "w1-4",
    title: "Ask-the-Lead Session",
    time_estimate_minutes: 30,
    steps: [
      "Review the 'Ask Your Lead' questions in RocketBoard",
      "Schedule a 1:1 with your team lead",
      "Come prepared with questions and notes from your modules",
    ],
    success_criteria: [
      "1:1 completed",
      "Key questions answered and noted",
    ],
  },
  {
    id: "w1-5",
    title: "Team Deep Dive",
    time_estimate_minutes: 90,
    steps: [
      "Attend your team's sprint planning or standup",
      "Read through your team's service documentation",
      "Set up local debugging for your team's primary service",
      "Understand the team's key metrics in Grafana",
    ],
    success_criteria: [
      "Can explain your team's services and ownership areas",
      "Local debugging workflow established",
      "Familiar with team's Grafana dashboards",
    ],
  },
];
