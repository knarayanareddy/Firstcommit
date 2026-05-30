# Roadmap & Structured Playlists Design

## Overview
The Roadmap system transforms onboarding from a simple list of content into a structured, time-bound program. It introduces hierarchical "Playlists" (e.g., Day 1-30, Day 31-60) with interactive items and "Blocked/Done" dependencies.

## Data Model (Schema)

### Table: `playlists`
Groups items into phases.
- `id`: uuid
- `pack_id`: uuid (FK)
- `title`: text (e.g., "Day 1-30: Core Fundamentals")
- `phase`: enum('day_1_30', 'day_31_60', 'day_61_90')
- `required`: boolean
- `owner_user_id`: uuid (Mentor/Lead)
- `default_start_offset_days`: int

### Table: `playlist_items`
Specific tasks or learning objects in a playlist.
- `id`: uuid
- `playlist_id`: uuid (FK)
- `item_type`: enum('module', 'section', 'quiz', 'milestone', 'task', 'link')
- `module_id`: uuid (Optional)
- `section_id`: text (Optional)
- `milestone_id`: uuid (Optional bridge to `onboarding_milestones`)
- `url`: text (Optional)
- `due_offset_days`: int
- `unlock_offset_days`: int

### Table: `playlist_item_dependencies`
"Prerequisite" relationships.
- `item_id`: uuid (Blocked item)
- `depends_on_item_id`: uuid (Prerequisite)

### Table: `playlist_assignments`
Assigns a playlist to a learner.
- `id`: uuid
- `playlist_id`: uuid (FK)
- `learner_user_id`: uuid (FK)
- `start_date`: date
- `status`: enum('active', 'paused', 'completed', 'cancelled')

### Table: `playlist_item_progress`
Learner's current state for each item.
- `assignment_id`: uuid (FK)
- `item_id`: uuid (FK)
- `status`: enum('blocked', 'available', 'in_progress', 'done', 'skipped')

## Integration Strategy

### Automatic Progress Detection (v1)
- **Sections**: Bridge to `user_progress` (`is_read` column).
- **Modules**: Bridge to `user_progress` (all sections read) or `quiz_scores`.
- **Milestones**: Bridge to `learner_milestone_progress`.

### RLS & Multi-tenancy
- Use existing `has_pack_access` function.
- Learners: Read assigned playlists/progress; Update their own progress status.
- Authors: Manage playlists/items/assignments for their packs.

## Phase 1 Implementation Plan
1. Create migrations for the above tables + RLS.
2. Implement basic triggers for `updated_at`.
3. Build the `/roadmap` page for learners (3-lane timeline view).
4. Add a simple `/roadmap-builder` for authors.
