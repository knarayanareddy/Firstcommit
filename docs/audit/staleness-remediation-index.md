# Audit Index: Staleness & Remediation Subsystem

This document serves as a baseline for the staleness detection, remediation drafting, and lifecycle auditing infrastructure within RocketBoard AI.

## 🚀 Edge Functions (`supabase/functions/`)

| File Path | Purpose | Key Details |
| :--- | :--- | :--- |
| `check-staleness/` | **Staleness Detector** | Logic to compare `chunk_hash_at_generation` in `content_freshness` rows with current hashes in `knowledge_chunks`. |
| `process-staleness-queue/` | **Queue Worker** | Internal cron job that pulls pending tasks from `staleness_check_queue` and invokes `check-staleness`. |
| `github-webhook/` | **Events Orchestrator** | Receives Git push events, identifies affected packs via `pack_sources`, and triggers both checking and remediation. |
| `auto-remediate-module/` | **Remediation Drafter** | Fetches GitHub diffs via API, uses LLM (GPT-4o) to draft updated documentation modules, and saves to `module_remediations`. |

## 🛠️ Shared Auth Helpers (`_shared/`)

| File Path | Purpose |
| :--- | :--- |
| `authz.ts` | Primary `requireUser` logic for validating Supabase JWTs. |
| `pack-access.ts` | Server-side role verification (`getPackRole`, `requirePackRole`) mapping members to access levels. |
| `cors.ts` | Standardized CORS preflight and header injection. |

## 🖥️ Frontend Files (`src/`)

| File Path | Purpose |
| :--- | :--- |
| `src/hooks/useContentFreshness.ts` | React hook for fetching `content_freshness` status and triggering on-demand checks. |
| `src/hooks/useRemediations.ts` | React hook for managing the lifecycle of `module_remediations` (list, apply, reject). |
| `src/pages/ContentHealthPage.tsx` | Dashboard view visualizing the "freshness" of the documentation across the organization. |
| `src/pages/ReviewPage.tsx` | Specialized UI for comparing proposed remediation diffs and applying changes to modules. |

## 🗄️ Database Migrations

Key migrations defining the schema and security policies for this subsystem:

| Migration Filename | Primary Impact |
| :--- | :--- |
| `20260308154025_c319c777...` | **Core Security**: Defines the `public.has_pack_access()` PL/pgSQL function used for RLS. |
| `20260313195000_vector_search_and_remediation.sql` | **Remediation Schema**: Creates `module_remediations` table and basic drafting logic. |
| `20260409000000_lifecycle_minv1.sql` | **Observability**: Establishes `lifecycle_audit_events` for tracking automated system actions. |
| `20260411000000_staleness_queue.sql` | **Job Queue**: Defines `staleness_check_queue` and the `on_ingestion_job_completed` trigger for automated checking. |
| `20260422000000_harden_remediations_rls.sql` | **Hardening**: Implements strict RLS for remediation proposals, limiting access to 'author' level or higher. |

## ⚠️ Suspected Issues List

> [!WARNING]
> These items represent potential technical debt or architectural risks identified during the baseline audit. They are documented for future remediation and should not be fixed at this time.

1.  **Worker Race Condition**: `process-staleness-queue` contains a check-then-act gap when verifying if another worker is already processing a pack. High-concurrency cron runs could lead to duplicate invocations.
2.  **LLM Context Limits**: `auto-remediate-module` truncates its diff input at 4,000 characters. Documentation groups tied to large commits may lose critical context during remediation.
3.  **Webhook Sync Processing**: The `github-webhook` function performs synchronous HTTP invokes for staleness and remediation. For repositories tied to many packs, this risks Edge Function timeouts.
4.  **Audit Gap for Manual Actions**: While system-triggered queue runs are logged to `lifecycle_audit_events`, there is no explicit audit record for manual approval/rejection of remediation drafts by users.
5.  **RLS Overhead**: `has_pack_access()` is invoked on almost every row-level operation in the subsystem. As the `pack_members` table grows, this may become a performance bottleneck.

---
*Baseline Report Generated: 2026-04-22*

## 🛡️ Security & Authorization Model
The pipeline adheres to the principle of least privilege, ensuring multi-tenant isolation:

| Component | Auth Mode | Role Requirement |
| :--- | :--- | :--- |
| `check-staleness` | Hybrid | **Author** (for `pack_id`) or Internal Secret |
| `record-content-freshness` | Hybrid | **Author** (for `pack_id`) or Internal Secret |
| `auto-remediate-module` | Hybrid | **Author** (for `pack_id`) or Internal Secret |
| `process-staleness-queue` | **Internal-Only** | Mandatory `X-Rocketboard-Internal` |
| `github-webhook` | Public/HMAC | Signed by GitHub; triggers Internal functions |

> [!CAUTION]
> **IDOR Protection**: The `record-content-freshness` writer uses a service client for high-privilege DB writes. It enforces a mandatory `requirePackRole` check for all human callers to prevent cross-organization ledger manipulation.
