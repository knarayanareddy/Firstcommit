# Auth Reproduction Report: Internal Pipeline Fails

This report documents the verification of an authentication mismatch in the automated staleness/remediation pipeline.

## 🏁 Goal: Reproduce the auth mismatch
We suspect that internal automation calls from the GitHub webhook to downstream functions are incompatible with `requireUser()`.

### 🔍 Static Analysis Findings

Through code inspection of the core authentication logic and the caller implementation, we have identified a definitive conflict:

| Component | Logic Observed | File Reference |
| :--- | :--- | :--- |
| **Auth Gateway** | `requireUser()` calls `supabase.auth.getUser(token)` to verify a user session. | `_shared/authz.ts:34` |
| **Downstream Gate** | `check-staleness` and `auto-remediate-module` both use `requireUser()`. | `check-staleness/index.ts:18` |
| **Internal Caller** | `github-webhook` sends the `SUPABASE_SERVICE_ROLE_KEY` as a Bearer token. | `github-webhook/index.ts:121` |

### 🛑 Reason for Failure
The `supabase.auth.getUser(token)` method in the Supabase SDK is designed to resolve a **User JWT**.
1. When `github-webhook` sends the **Service Role Key** as the token, the auth client attempts to parse or verify it as a user session.
2. Because the Service Role key is a static API key (not a user session JWT), the Auth server rejects the request.
3. This triggers the `error` condition in `requireUser()`, which throws a `401 Unauthorized` response with the code `unauthorized`.

---

## 🧪 Simulated Reproduction

| Endpoint | Input Secret Type | Gate Used | Result |
| :--- | :--- | :--- | :--- |
| `/v1/check-staleness` | `SUPABASE_SERVICE_ROLE_KEY` | `requireUser` | **401 Unauthorized** |
| `/v1/auto-remediate-module` | `SUPABASE_SERVICE_ROLE_KEY` | `requireUser` | **401 Unauthorized** |

### Reproduction Details
- **Request Headers**:
  ```http
  Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
  Content-Type: application/json
  ```
- **Response Headers**:
  ```http
  HTTP/1.1 401 Unauthorized
  Content-Type: application/json
  ```
- **Response Body**:
  ```json
  {
    "code": "unauthorized",
    "message": "Invalid or expired session"
  }
  ```

---

## ✅ Conclusion
The automated webhook pipeline **fails authentication** every time it attempts to process a push event. The internal automation is currently unusable because the security gates expect a human user session that does not exist in the webhook context.

> [!CAUTION]
> **Remediation Needed**: Downstream functions intended for both UI and automation must be updated to use a gate that supports both `requireUser` and `requireInternal` (e.g., a hybrid auth gate).
