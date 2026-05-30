# Roadmap Feature Rollout Guide

This guide outlines the steps to safely pilot and roll out the Structured Onboarding Roadmap feature.

## 1. Prerequisites
- Apply the following migrations:
  - `20260329000000_roadmap_playlists.sql` (Core)
  - `20260329000001_roadmap_hardening.sql` (Indexes & Integrity)
  - `20260329000002_roadmap_feature_flag.sql` (Feature Flag)

## 2. Enabling for a Pack
The feature is disabled by default. To enable it for a specific pack:
```sql
UPDATE public.packs SET roadmap_enabled = TRUE WHERE id = 'YOUR_PACK_ID';
```

## 3. Seeding Demo Data
To quickly demonstrate the feature, run the seed script:
`supabase/qa/roadmap/02_seed.sql` (Update the UUIDs in the script first).

## 4. Verification (QA)
Before onboarding real users, verify the RLS policies:
1.  Navigate to `supabase/qa/roadmap/`.
2.  Follow the instructions in `README.md` to run the test harness.

## 5. Rollback Strategy
If issues are detected, the feature can be globally or selectively hidden by flipping the `roadmap_enabled` flag:
```sql
UPDATE public.packs SET roadmap_enabled = FALSE WHERE id = 'YOUR_PACK_ID';
```
This hides all Roadmap-related UI elements for all users in that pack.

## 6. Known Constraints (v1)
- **Dependency Scope**: Items can only depend on other items within the same playlist.
- **Cycle Prevention**: Circular dependencies are blocked at the database level.
- **Progress Immutability**: Once an item is marked "Done", it currently cannot be moved back to "Available" via the UI or standard progress API (integrity protection).
