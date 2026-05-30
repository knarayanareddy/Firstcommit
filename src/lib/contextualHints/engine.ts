import { UserContext, HintId, HintRule } from "./types";
import { isHintThrottled } from "./storage";

export function evaluateHint(context: UserContext, rules: HintRule[]): HintId | null {
  for (const rule of rules) {
    const hintId = rule(context);
    if (hintId && !isHintThrottled(context.packId, context.moduleId, context.sectionId, hintId)) {
      return hintId;
    }
  }
  return null;
}
