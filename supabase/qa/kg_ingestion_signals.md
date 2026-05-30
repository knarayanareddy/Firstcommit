# KG Ingestion Signals: QA Verification

Use these queries to audit the quality of deterministic graph signals after an ingestion job.

## 1. Coverage Audit

### 1.1 Chunks Missing Exported Names
Identifies chunks that look like definitions (based on `entity_type`) but have no `exported_names`.
```sql
SELECT count(*) 
FROM knowledge_chunks
WHERE entity_type IN ('function_declaration', 'class_declaration', 'function_definition', 'struct_item')
  AND (exported_names IS NULL OR array_length(exported_names, 1) = 0)
  AND is_redacted = false;
```
**Threshold**: Trigger investigation if > 5% for supported languages.

### 1.2 Files Missing Imports
Identifies source files that likely have imports (non-Empty content) but 0 extracted imports.
```sql
SELECT path, count(*) as chunk_count
FROM knowledge_chunks
WHERE (imports IS NULL OR array_length(imports, 1) = 0)
  AND content ~ '(import|use |require|from )'
  AND is_redacted = false
GROUP BY path
ORDER BY 2 DESC;
```
**Threshold**: Trigger investigation if major library files (e.g., `index.ts`, `main.py`) show 0 imports.

## 2. Granularity Check
Verify that `imports` contain actual symbols, not just full lines or module paths.
```sql
-- Look for "symbol-like" names vs "path-like" names
SELECT unnest(imports) as symbol, count(*)
FROM knowledge_chunks
WHERE array_length(imports, 1) > 0
GROUP BY 1
ORDER BY 2 DESC
LIMIT 20;
```
**Success Criteria**: You should see symbols like `useState`, `createServiceClient`, `ctx` rather than `./utils` or `import { x } from 'y'`.

## 3. Tenancy & Pinning
Ensure signals are correctly associated with the active generation.
```sql
SELECT pack_id, count(DISTINCT chunk_id)
FROM knowledge_chunks
WHERE (exported_names IS NOT NULL OR imports IS NOT NULL)
GROUP BY 1;
```

## Investigation Triggers
- **Empty Exports**: If `exported_names` is empty for a `class_declaration`, the Tree-Sitter query in `ast-chunker.ts` might be missing a language-specific keyword (e.g., `default` in JS, `pub` in Rust).
- **Noisy Imports**: If `imports` contains full lines of code, the `extractImports` query is too broad and missing specific capture tags.
- **Null Metadata**: If `knowledge_chunks` columns are NULL but `metadata->>'imports'` exists, the `upsert` batch in `ingest-source` is missing the mapping.
