# Authorization Policy: Remediation Pipeline

This document defines the finalized authorization logic for the AI-assisted remediation drafting pipeline (`auto-remediate-module`).

## 🛡️ Policy Overview
The remediation drafting endpoint (`auto-remediate-module`) is hardened to support both automated triggers from source control and manual drafting by authorized content managers.

### 1. Internal / Automated Triggers
- **Identity Gate**: Handled by `requireUserOrInternal`.
- **Validation**: Requires a valid `ROCKETBOARD_INTERNAL_SECRET` passed in the `X-Rocketboard-Internal` header (or a Service Role Bearer fallback).
- **Authorization**: **Bypassed**. Internal system actors are assumed to be authorized once the secret is verified. This ensures that the GitHub Webhook -> Staleness Check -> Auto-Remediation pipeline remains unblocked.

### 2. User-Initiated Drafting
- **Identity Gate**: Handled by `requireUserOrInternal`.
- **Validation**: Requires a valid Supabase JWT.
- **Authorization**: **Mandatory Member Check**.
    - The user must hold at least the **"author"** role for the target `pack_id` in the `pack_members` table.
    - Verified via the `requirePackRole()` helper.
    - If the user lacks this permission, the endpoint returns a `403 Forbidden`.

---

## ✅ Security Objectives
This policy achieves the following security goals:
- **Reduces LLM Token Exposure**: Prevents unauthorized users from triggering expensive LLM remediation drafting jobs for arbitrary packs.
- **Data Isolation**: Ensures that remediation drafts are only created for packs the user has explicit authority over.
- **Automation Support**: Maintains a zero-friction path for the established Git-to-Content pipeline.

## 🤖 LLM Configuration & Provider Routing
The remediation drafting pipeline is designed to be provider-agnostic, supporting both direct OpenAI access and the Lovable AI Gateway.

### Environment Variables
| Variable | Purpose |
| :--- | :--- |
| `OPENAI_API_KEY` | Primary key for direct OpenAI access. |
| `LOVABLE_API_KEY` | Fallback key for Lovable Gateway processing. |
| `GITHUB_TOKEN` | Required to fetch source code diffs for LLM context. |

### Routing Logic
The system prioritizes providers in the following order to optimize for both quality and cost:

1.  **OpenAI (Primary)**:
    - **Trigger**: `OPENAI_API_KEY` is present.
    - **Endpoint**: `https://api.openai.com/v1/chat/completions`
    - **Model**: `gpt-4o`
2.  **Lovable Gateway (Fallback)**:
    - **Trigger**: `OPENAI_API_KEY` is missing but `LOVABLE_API_KEY` is present.
    - **Endpoint**: `https://ai.gateway.lovable.dev/v1/chat/completions`
    - **Model**: `google/gemini-3-flash-preview`
