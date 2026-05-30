# RocketBoard RAG Regression Test Harness

This harness provides automated regression testing for the RocketBoard RAG pipeline. It ensures that changes to retrieval, ranking, or generation do not degrade grounding quality or increase costs beyond acceptable thresholds.

## Overview
The harness executes "golden questions" against a staging Supabase project, calls the Edge Functions as a real user, and asserts quality metrics persisted in `rag_metrics`.

## SLOs & Metrics Evaluated
- **Grounding Gate**: Ensures responses pass the mandatory Grounding SLO Gate.
- **Strip Rate**: Catch high levels of unverified/hallucinated claims.
- **Citations**: Minimum required citations per response.
- **Unique Files**: Ensures retrieval is pulling from a diverse set of relevant files.
- **Detective Yield**: Measures the effectiveness of multi-hop reasoning.
- **Latency**: Catch performance regressions in retrieval or generation.
- **Attempts**: Track how many retries were needed to satisfy the grounding gate.

## Repository Structure
- `/suites`: YAML-based test definitions.
- `/scripts`: Node/TS runner logic.
- `/seed`: Documentation and resources for staging project setup.

## Suite Format (YAML)
```yaml
version: 1
defaults:
  task_type: global_chat
  thresholds:
    min_citations: 2
    max_strip_rate: 0.20
    max_latency_ms: 30000

tests:
  - id: my-test
    name: "Explain feature X"
    query: "How does feature X work?"
    thresholds:
      min_unique_files: 3
```

## Running Locally
1. Navigate to `/rag-eval`.
2. Install dependencies: `npm install`.
3. Set environment variables (see `/seed/README.md`).
4. Run a suite:
   ```bash
   export RAG_EVAL_SUPABASE_URL=...
   # (Set other vars)
   npm run test -- --suite suites/baseline.yaml
   ```

## CI Integration
The harness runs automatically on every Pull Request to `main` via `.github/workflows/rag-regression.yml`.

## Safety Rules
- **No Secrets in Repo**: Always use GitHub Secrets or environment variables.
- **No Response Bodies**: The runner prints metrics only. Do not log full LLM responses in CI to prevent PII exposure and log bloating.
- **Real User Auth**: Always use a real user JWT (signInWithPassword) to test RLS accurately.
