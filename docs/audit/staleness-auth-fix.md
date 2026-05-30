# Remediation Report: Auth Mismatch Resolved

This report documents the fix for the authentication mismatch in the automated staleness/remediation pipeline.

## 🛠️ The Fix: Hybrid Auth Gate
We have implemented a **Hybrid Auth Gate** (`requireUserOrInternal`) that correctly handles both human-triggered and system-triggered actions.

### 🧩 Components Updated

| File | Change Summary |
| :--- | :--- |
| `_shared/authz.ts` | Added `requireUserOrInternal`, which prioritizes internal secret verification (including Service Role fallback) before falling back to User JWT validation. |
| `check-staleness/index.ts` | Switched to the hybrid gate. Now accepts automated pings from the webhook. |
| `auto-remediate-module/index.ts` | Switched to the hybrid gate. Now accepts automated drafting requests. |
| `github-webhook/index.ts` | Updated to send the `X-Rocketboard-Internal` header, aligning with the new security standard. |

---

## 🧪 Testing Instructions

### 1. Automated Verification (Internal)
You can verify the fix by calling the functions with the internal secret:
```bash
# Verify internal auth via Service Role fallback (Deprecated but supported)
curl -X POST https://<PROJ>.supabase.co/functions/v1/check-staleness \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -d '{"pack_id": "<PACK_ID>"}'

# Verify internal auth via proprietary header (Preferred)
curl -X POST https://<PROJ>.supabase.co/functions/v1/check-staleness \
  -H "X-Rocketboard-Internal: <INTERNAL_SECRET>" \
  -d '{"pack_id": "<PACK_ID>"}'
```

### 2. Manual Verification (User)
Trigger a "Check Staleness" or "Draft Remediation" from the **Content Health Dashboard**. These calls use the User JWT and should continue to succeed without change.

### 3. Webhook Verification
Perform a `git push` to a repository linked to a pack. Check the Edge Function logs for `github-webhook` to confirm it triggers downstream calls with the new header and receives `200 OK` responses.

---

## ✅ Results
The automated pipeline is now **unblocked**. Pushes to GitHub will successfully trigger staleness checks and remediation drafts without encountering 401 errors.
