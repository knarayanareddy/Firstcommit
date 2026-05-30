# KG Retrieval v2: Regression Test Plan

## 1. Functional Verification
### 1.1 Symbol Precision
- **Test Query**: "Show me the definition and references of `authenticateRequest` in the router."
- **Success Criteria**:
  - `kg_expand_v1` adds at least 1 definition span and several reference spans.
  - `rerank_skipped` is `true` in logs/metrics.
  - Response correctly identifies the definition file and usage locations.

### 1.2 Citation Stability
- **Success Criteria**:
  - Citation badges `[S#]` appear in the response.
  - Clicking a badge opens the Evidence Viewer with the correct code snippet.
  - No `UNAUTHORIZED_CODE_BLOCK` errors (proving `enforceNoDirectCode` is still active).

### 1.3 Grounding Gate Compliance
- **Test Case**: Ask a question with no relevance to the graph (e.g., "What is the capital of France?").
- **Success Criteria**:
  - `kg_added_spans` is low or 0.
  - `rerank_skipped` is `false` (fallback to LLM).
  - Grounding Gate correctly refuses or strips ungrounded claims.

## 2. Tenant & Security Safety
### 2.1 RLS Membership Check
- **SQL Test**:
  ```sql
  -- Run as a random learner from another pack
  SET ROLE authenticated;
  SET request.jwt.claims = '{"sub": "another-user-uuid"}'; 
  SELECT * FROM public.kg_expand_v1(..., 'other-pack-uuid', ...);
  ```
- **Expected Outcome**: `RAISE EXCEPTION 'Unauthorized...'`

### 2.2 Cross-Pack Leakage
- **Success Criteria**: `kg_expand_v1` only returns rows where `pack_id = p_pack_id`. Verify by ensuring no symbols from Pack B "accidentally" appear when querying Pack A.

## 3. Performance & Load
### 3.1 Bounded Execution
- **SQL Test**: Call `kg_expand_v1` with a symbol that has 1000+ references (e.g., `import`).
- **Success Criteria**:
  - Result count <= `p_limit` (default 12, max 50).
  - Execution time < 500ms for the DB query alone.
  - Detective loop total `time_ms` < 2500ms.

## 4. Failure Mode Resilience
### 4.1 RPC Error Fallback
- **Test Manual**: Temporarily rename `kg_expand_v1` to `kg_expand_v1_broken` or throw a hard error in SQL.
- **Success Criteria**: Router logs a warning `[Detective] KG expansion failed` but continues to `batchRerankWithLLM` and returns a valid response.

## 5. Telemetry Accuracy
### 5.1 Metrics Pipeline
- **Check**: `SELECT * FROM rag_metrics ORDER BY created_at DESC LIMIT 5;`
- **Verify Columns**:
  - `kg_enabled` (bool)
  - `rerank_skipped` (bool)
  - `kg_added_spans` > 0 for symbol queries.
  - `rerank_skip_reason` = 'graph_confident'.

---

# Known Limitations (v2.0)
1. **Cold-Start Rerank**: The first query in a cold-start Edge Function might still be slow due to initialization, even if rerank is skipped.
2. **Deterministic-Only**: KG v2 does not "discover" semantic relations; it only follows explicit AST links (`exported_names`/`imports`). Synonyms won't trigger graph expansion.
3. **Redaction Sensitivity**: If a symbol name itself is sensitive (e.g., `SecretKey_DO_NOT_LEAK`), its occurrences will be visible in `relation_symbol` metadata, though the chunk content will remain redacted.
4. **Seed Dependency**: KG expansion requires at least one high-relevance seed from `hybrid_search_v2` to initiate symbol extraction. If vector search fails completely, KG cannot help.
