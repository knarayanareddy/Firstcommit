import { useState, useEffect, useCallback, useRef } from "react";
import { UserContext, HintId, SetupProgress } from "../lib/contextualHints/types";
import { evaluateHint } from "../lib/contextualHints/engine";
import { defaultRules, HINTS } from "../lib/contextualHints/defaultRules";
import { saveHintState, getHintState } from "../lib/contextualHints/storage";

interface UseContextualHintsProps {
  packId: string;
  moduleId: string;
  moduleTitle: string;
  sectionId: string;
  sectionTitle?: string;
  sectionContent?: string;
  isSectionRead: boolean;
  setupProgress?: SetupProgress;
}

export function useContextualHints({
  packId,
  moduleId,
  moduleTitle,
  sectionId,
  sectionTitle,
  sectionContent,
  isSectionRead,
  setupProgress,
}: UseContextualHintsProps) {
  const [activeHintId, setActiveHintId] = useState<HintId | null>(null);
  const [dwellTime, setDwellTime] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [bounceCount, setBounceCount] = useState(0);
  
  const lastErrorTime = useRef<number[]>([]);
  const lastBounceTime = useRef<number[]>([]);
  const chatOpenTime = useRef<number | null>(null);

  // Dwell timer
  useEffect(() => {
    setDwellTime(0);
    if (isSectionRead) return;

    const interval = setInterval(() => {
      setDwellTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [sectionId, isSectionRead]);

  // Evaluate hints on state change
  useEffect(() => {
    const context: UserContext = {
      packId,
      moduleId,
      sectionId,
      sectionTitle,
      sectionContent,
      isSectionRead,
      setupProgress,
      dwellTimeSeconds: dwellTime,
      chatErrorCountLast10m: errorCount,
      chatBounceCountLast5m: bounceCount,
    };

    const hintId = evaluateHint(context, defaultRules);
    if (hintId !== activeHintId) {
      setActiveHintId(hintId);
    }
  }, [
    packId,
    moduleId,
    sectionId,
    sectionTitle,
    sectionContent,
    isSectionRead,
    setupProgress,
    dwellTime,
    errorCount,
    bounceCount,
    activeHintId,
  ]);

  const reportError = useCallback(() => {
    const now = Date.now();
    lastErrorTime.current = [...lastErrorTime.current, now].filter(
      (t) => now - t < 10 * 60 * 1000
    );
    setErrorCount(lastErrorTime.current.length);
  }, []);

  const reportChatOpen = useCallback(() => {
    chatOpenTime.current = Date.now();
  }, []);

  const reportChatClose = useCallback(() => {
    if (chatOpenTime.current) {
      const duration = Date.now() - chatOpenTime.current;
      if (duration < 10000) { // Less than 10s is a "bounce" if they haven't sent much (simplified)
        const now = Date.now();
        lastBounceTime.current = [...lastBounceTime.current, now].filter(
          (t) => now - t < 5 * 60 * 1000
        );
        setBounceCount(lastBounceTime.current.length);
      }
      chatOpenTime.current = null;
    }
  }, []);

  const dismissHint = useCallback((hintId: HintId, forever = false) => {
    const state = getHintState(packId, moduleId, sectionId, hintId);
    saveHintState(packId, moduleId, sectionId, hintId, {
      ...state,
      lastShownAt: Date.now(),
      dismissedForever: forever,
      timesShown: state.timesShown + 1,
    });
    setActiveHintId(null);
  }, [packId, moduleId, sectionId]);

  const snoozeHint = useCallback((hintId: HintId, minutes: number) => {
    const state = getHintState(packId, moduleId, sectionId, hintId);
    saveHintState(packId, moduleId, sectionId, hintId, {
      ...state,
      lastShownAt: Date.now(),
      snoozedUntil: Date.now() + minutes * 60 * 1000,
      timesShown: state.timesShown + 1,
    });
    setActiveHintId(null);
  }, [packId, moduleId, sectionId]);

  const buildAskRocketPrompt = useCallback(() => {
    if (!activeHintId) return "";
    const hint = HINTS[activeHintId];
    return hint.askRocketPrefill
      .replace("{{sectionTitle}}", sectionTitle || "this section")
      .replace("{{moduleTitle}}", moduleTitle);
  }, [activeHintId, sectionTitle, moduleTitle]);

  return {
    activeHintId,
    activeHint: activeHintId ? HINTS[activeHintId] : null,
    reportError,
    reportChatOpen,
    reportChatClose,
    dismissHint,
    snoozeHint,
    buildAskRocketPrompt,
  };
}
