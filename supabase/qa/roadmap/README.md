# Roadmap RLS & Integrity QA Harness

This directory contains standalone SQL scripts to verify the security and integrity of the Roadmap feature.

## Prerequisites
1.  Access to the Supabase SQL Editor.
2.  Three test user UUIDs (Learner, Author, Outsider).

## How to Run
1.  **Preparation**: Open `01_setup.sql` and replace the placeholder UUIDs with your test user IDs.
2.  **Setup**: Run `01_setup.sql`. This creates a test pack and assigns roles.
3.  **Seed**: Run `02_seed.sql`. This creates a sample playlist, items, and assignments.
4.  **Verify**: Run `03_assertions.sql`. Check the console output/results against the "EXPECT" comments.

## Scripts Breakdown
- `01_setup.sql`: Configures the testing environment (pack, members).
- `02_seed.sql`: Populates the roadmap data structures.
- `03_assertions.sql`: Performs the actual RLS and Trigger tests.
- `04_cleanup.sql`: (Optional) Removes test data.
