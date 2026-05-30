# Audit: Staleness Pipeline Smoke Test

This document provides instructions for running the automated staleness pipeline smoke test locally or in CI.

## 🚀 Purpose
The smoke test verifies the full lifecycle of the staleness remediation subsystem:
1.  **Baseline Generation**: Recording codebase hashes at generation time.
2.  **Drift Detection**: Identifying when the codebase has changed since the module was written.
3.  **Authorization**: Ensuring only authorized services or authors can trigger these audits.

---

## 🛠️ Usage

### Local Execution
To run the smoke test on your local machine, ensure you have the Supabase CLI installed and the local services running.

```bash
# Set the internal secret (must match your local .env)
export ROCKETBOARD_INTERNAL_SECRET=test_secret

# Run the script
chmod +x scripts/smoke-staleness-pipeline.sh
./scripts/smoke-staleness-pipeline.sh
```

### CI Integration
In GitHub Actions or other CI providers, you can wire the script into your test stage.

```yaml
# Example GitHub Action Step
- name: Run Staleness Pipeline Smoke Test
  run: ./scripts/smoke-staleness-pipeline.sh
  env:
    ROCKETBOARD_INTERNAL_SECRET: ${{ secrets.ROCKETBOARD_INTERNAL_SECRET }}
```

---

## ✅ Expected Output
A successful run should output:
```text
🔄 Resetting local Supabase...
🌱 Seeding test data...
📝 Recording initial freshness ledger...
✅ Ledger entry created.
⚡ Simulating codebase change (hash mutation)...
🔍 Running staleness audit...
✅ Staleness detected successfully! (count: 1)
🛡️ Verifying unauthorized rejection...
✅ Unauthorized access correctly rejected (Status: 401).
🎉 Smoke test PASSED successfully!
```
