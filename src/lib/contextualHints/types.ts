export type HintId = "setup-dwell" | "chat-repeated-error" | "chat-bounce";

export interface HintStep {
  text: string;
  command?: string;
}

export interface Hint {
  id: HintId;
  title: string;
  summary: string;
  steps: HintStep[];
  askRocketPrefill: string;
}

export interface SetupProgress {
  completedCount: number;
  totalCount: number;
}

export interface UserContext {
  packId: string;
  moduleId: string;
  sectionId: string;
  sectionTitle?: string;
  sectionContent?: string;
  isSectionRead: boolean;
  setupProgress?: SetupProgress;
  chatErrorCountLast10m: number;
  chatBounceCountLast5m: number;
  dwellTimeSeconds: number;
}

export interface HintStorageData {
  lastShownAt?: number;
  snoozedUntil?: number;
  dismissedForever?: boolean;
  timesShown: number;
}

export type HintRule = (context: UserContext) => HintId | null;
