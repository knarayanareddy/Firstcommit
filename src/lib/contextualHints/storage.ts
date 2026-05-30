import { HintId, HintStorageData } from "./types";

const STORAGE_PREFIX = "rocket-hint-";

function getStorageKey(packId: string, moduleId: string, sectionId: string, hintId: HintId): string {
  return `${STORAGE_PREFIX}${packId}-${moduleId}-${sectionId}-${hintId}`;
}

export function getHintState(packId: string, moduleId: string, sectionId: string, hintId: HintId): HintStorageData {
  const key = getStorageKey(packId, moduleId, sectionId, hintId);
  const data = localStorage.getItem(key);
  if (!data) return { timesShown: 0 };
  try {
    return JSON.parse(data);
  } catch {
    return { timesShown: 0 };
  }
}

export function saveHintState(packId: string, moduleId: string, sectionId: string, hintId: HintId, state: HintStorageData) {
  const key = getStorageKey(packId, moduleId, sectionId, hintId);
  localStorage.setItem(key, JSON.stringify(state));
}

export function isHintThrottled(packId: string, moduleId: string, sectionId: string, hintId: HintId): boolean {
  const state = getHintState(packId, moduleId, sectionId, hintId);
  if (state.dismissedForever) return true;
  
  const now = Date.now();
  if (state.snoozedUntil && now < state.snoozedUntil) return true;
  
  // Don't show same hint more than once per 24h for same section
  if (state.lastShownAt && now - state.lastShownAt < 24 * 60 * 60 * 1000) return true;
  
  return false;
}
