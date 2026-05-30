import { UserContext, HintId, HintRule, Hint } from "./types";

export const defaultRules: HintRule[] = [
  // A) Setup dwell hint
  (context) => {
    const isLikelySetup = /setup|install|configure/i.test(context.sectionTitle || "");
    const progressLow = context.setupProgress 
      ? (context.setupProgress.completedCount / context.setupProgress.totalCount) < 0.5
      : true;

    if (
      isLikelySetup &&
      context.dwellTimeSeconds >= 90 &&
      !context.isSectionRead &&
      progressLow
    ) {
      return "setup-dwell";
    }
    return null;
  },

  // B) Chat repeated error hint
  (context) => {
    if (context.chatErrorCountLast10m >= 2) {
      return "chat-repeated-error";
    }
    return null;
  },

  // C) Chat bounce hint
  (context) => {
    if (context.chatBounceCountLast5m >= 3) {
      return "chat-bounce";
    }
    return null;
  }
];

export const HINTS: Record<HintId, Hint> = {
  "setup-dwell": {
    id: "setup-dwell",
    title: "Stuck on setup?",
    summary: "Setup errors can be tricky. Try these steps or ask Rocket for help.",
    steps: [
      { text: "Re-run the command slowly to watch for specific error flags." },
      { text: "Check your local environment variables and permissions." },
      { text: "If it fails, click 'Ask Rocket' and paste the exact error output." }
    ],
    askRocketPrefill: "I'm working on the '{{sectionTitle}}' section of '{{moduleTitle}}' and I'm stuck on the setup steps. Can you help me debug?"
  },
  "chat-repeated-error": {
    id: "chat-repeated-error",
    title: "Rocket needs more context",
    summary: "It looks like Rocket is struggling to find the right evidence.",
    steps: [
      { text: "Mention specific file names, function names, or exact error strings." },
      { text: "Explain what you tried and what you expected to happen." }
    ],
    askRocketPrefill: "Rocket seems to be having trouble with my previous requests about '{{sectionTitle}}'. Can we start fresh? I need a step-by-step plan to debug [PASTE YOUR ISSUE HERE]."
  },
  "chat-bounce": {
    id: "chat-bounce",
    title: "Try a more specific question",
    summary: "Rocket works best when you ask targeted technical questions.",
    steps: [
      { text: "Instead of 'how does this work', try 'how is X implemented in Y?'" }
    ],
    askRocketPrefill: "I have a question about '{{sectionTitle}}'. [PICK ONE: How is authentication handled here? | Where are the database migrations stored? | Explain the error handling in this section.]"
  }
};
