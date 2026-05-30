# Grounding Format Regression Test

This document defines a manual verification recipe to ensure the Mission Control (`global_chat`) output format contract is respected, thereby reducing the `strip_rate`.

## Verification Recipe

### Test Case: Global Source Integration
**Query**: "How do I add a new GitHub source to my pack?"

#### Expected "Good" Output (survives verifier)
- Contains multiple bullet points.
- **Each bullet is exactly ONE sentence.**
- **Each bullet ends with a `[SOURCE: path:start-end]` citation.**
- No introductory text (e.g., "Here is how you...") or concluding well-wishes.
- No semicolons or complex sentence structures.

**Example**:
* Navigate to the Sources page in your pack settings [SOURCE: src/lib/sources.ts:10-15].
* Click the 'Add Source' button and select GitHub [SOURCE: src/components/sources/SourceSelector.tsx:40-42].
* Authenticate with your GitHub account when prompted [SOURCE: supabase/functions/auth-callback/index.ts:100-105].

#### "Bad" Output (risk of high `strip_rate`)
* To add a source, go to settings and click add. Then choose GitHub. [SOURCE: ...]
  * *Reason: Two sentences in one bullet. The first sentence will be stripped because it has no adjacent citation.*

## Success Criteria
1. `response_markdown` follows the contract.
2. `strip_rate` is $\le 0.20$ as reported in `ai_audit_events`.
3. No diagnostic warnings about "Hallucinated citation removed" unless it truly doesn't exist.
