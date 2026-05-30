# DB Final State: `public.module_remediations`

This document defines the authoritative schema and security state of the `module_remediations` table as of **April 22, 2026**, following the complete execution of the migration sequence.

## 📊 Table Schema

| Column | Type | Nullable | Default | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key. |
| `module_key` | `text` | NO | - | Links to `generated_modules`. |
| `section_id` | `text` | NO | - | Specific section within the module. |
| `original_content`| `text` | NO | - | Content before remediation. |
| `proposed_content`| `text` | NO | - | Content drafted by LLM. |
| `diff_summary` | `text` | NO | - | Brief description of the change. |
| `status` | `text` | NO | `'pending'` | Lifecycle: pending, accepted, rejected. |
| `created_at` | `timestamptz` | NO | `now()` | Audit timestamp. |
| `updated_at` | `timestamptz` | NO | `now()` | Last modification timestamp. |
| `pack_id` | `uuid` | **NO** | - | **Required** foreign key for RLS isolation. |

## 🗂️ Indexes

| Index Name | Column(s) | Type |
| :--- | :--- | :--- |
| `module_remediations_pkey` | `id` | B-tree (Primary) |
| `idx_module_remediations_pack_id` | `pack_id` | B-tree |

## 🛡️ RLS Policies

Following migration `20260422000000_harden_remediations_rls.sql`, the split SELECT/UPDATE policies were consolidated into a single strict policy.

| Policy Name | Command | Roles | USING / WITH CHECK |
| :--- | :--- | :--- | :--- |
| `"Authors can manage remediations"` | `ALL` | `authenticated` | `public.has_pack_access(auth.uid(), pack_id, 'author')` |

> [!NOTE]
> The `service_role` bypasses RLS implicitly. The `INSERT` operation for the `auto-remediate-module` function is typically performed via the service client, granting it inherent access despite the restrictive policy for standard authenticated users.

## ⚠️ Migration Conflict Analysis

During a standard `supabase db reset`, the following conflict was identified:

1.  **Redundant Creation**: Migration `20260313195000` attempts to create the table without an `IF NOT EXISTS` clause, despite it being created in the preceding migration `20260313185507`. 
2.  **Failure Mode**: On a fresh database, the reset would fail with `relation "module_remediations" already exists`. 
3.  **Stability**: All migrations from `20260314` onwards use idempotent patterns (`IF NOT EXISTS`, `DO` blocks, `DROP IF EXISTS`), which ensures that the schema reaches the desired final state even if previous steps were inconsistent.

---
*Audit Completed: 2026-04-22*
