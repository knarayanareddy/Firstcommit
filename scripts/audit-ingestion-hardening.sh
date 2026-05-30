#!/bin/bash
# scripts/audit-ingestion-hardening.sh
#
# CI/CD Audit script to ensure secret-handling standards are maintained.
# This script performs three critical checks:
# 1. No local REDACTION_PATTERNS (Single source of truth check)
# 2. Universal adoption of assessChunkRedaction (Standardization check)
# 3. Defense-in-depth presence in AI Task Router (Safety check)

set -e

echo "Starting Ingestion Hardening Audit..."
echo "===================================="

# Check 1: No local REDACTION_PATTERNS in edge functions (excluding shared module)
echo "[CHECK 1] Verifying no local REDACTION_PATTERNS exist..."
LOCAL_PATTERNS=$(grep -r "REDACTION_PATTERNS" supabase/functions --exclude="secret-patterns.ts" --exclude="index.ts.bak" || true)

if [ -n "$LOCAL_PATTERNS" ]; then
  echo "FAIL: Local REDACTION_PATTERNS found in the following files:"
  echo "$LOCAL_PATTERNS"
  exit 1
else
  echo "PASS: No local patterns found. Using shared module source of truth."
fi

# Check 2: All ingestion connectors must use assessChunkRedaction
echo "[CHECK 2] Verifying assessChunkRedaction usage in connectors..."
REQUIRED_CONNECTORS=(
  "ingest-source"
  "ingest-confluence"
  "ingest-notion"
  "ingest-slack"
  "ingest-jira"
  "ingest-linear"
  "ingest-google-drive"
  "ingest-figma"
  "ingest-pagerduty"
  "reindex-orgs"
)

for connector in "${REQUIRED_CONNECTORS[@]}"; do
  if ! grep -q "assessChunkRedaction" "supabase/functions/$connector/index.ts"; then
    echo "FAIL: Connector '$connector' is not using assessChunkRedaction!"
    exit 1
  fi
done
echo "PASS: All required connectors are using assessChunkRedaction."

# Check 3: AI Task Router must have redactText (defense-in-depth)
echo "[CHECK 3] Verifying defense-in-depth in AI Task Router..."
if ! grep -q "sharedRedactText" "supabase/functions/ai-task-router/index.ts"; then
  echo "FAIL: AI Task Router is missing shared defense-in-depth redaction!"
  exit 1
fi
echo "PASS: AI Task Router has defense-in-depth enabled."

echo "===================================="
echo "AUDIT COMPLETE: Ingestion pipeline is HARDENED."
