import { describe, it, expect, beforeEach, vi } from "vitest";
import { evaluateHint } from "./engine";
import { UserContext, HintRule } from "./types";
import { defaultRules } from "./defaultRules";

// Mock storage to avoid localStorage issues in test
vi.mock("./storage", () => ({
  isHintThrottled: vi.fn(() => false),
}));

describe("Hint Engine", () => {
  const baseContext: UserContext = {
    packId: "p1",
    moduleId: "m1",
    sectionId: "s1",
    sectionTitle: "Initial Setup",
    isSectionRead: false,
    dwellTimeSeconds: 0,
    chatErrorCountLast10m: 0,
    chatBounceCountLast5m: 0,
  };

  it("should trigger setup-dwell hint after 90 seconds", () => {
    const context: UserContext = { ...baseContext, dwellTimeSeconds: 90 };
    const hintId = evaluateHint(context, defaultRules);
    expect(hintId).toBe("setup-dwell");
  });

  it("should NOT trigger setup-dwell if section is already read", () => {
    const context: UserContext = { ...baseContext, dwellTimeSeconds: 90, isSectionRead: true };
    const hintId = evaluateHint(context, defaultRules);
    expect(hintId).toBeNull();
  });

  it("should trigger chat-repeated-error hint after 2 errors", () => {
    const context: UserContext = { ...baseContext, chatErrorCountLast10m: 2 };
    const hintId = evaluateHint(context, defaultRules);
    expect(hintId).toBe("chat-repeated-error");
  });

  it("should trigger chat-bounce hint after 3 bounces", () => {
    const context: UserContext = { ...baseContext, chatBounceCountLast5m: 3 };
    const hintId = evaluateHint(context, defaultRules);
    expect(hintId).toBe("chat-bounce");
  });

  it("should prioritize setup-dwell over chat-bounce if both match", () => {
    const context: UserContext = { 
      ...baseContext, 
      dwellTimeSeconds: 90, 
      chatBounceCountLast5m: 3 
    };
    const hintId = evaluateHint(context, defaultRules);
    // Rules are evaluated in order
    expect(hintId).toBe("setup-dwell");
  });
});
