# RocketBoard: 6-Phase Zero-Hallucination RAG Migration Plan (Build-Ready)

This document is the absolute final blueprint for the 6-Phase Migration Plan, meticulously adapted to RocketBoard's specific constraints. All previous pseudocode and described logic have been replaced with the exact implementation code required to handle production edge cases safely.

---

## Phase 0: Grounded Generation (Prompting & Citations)
**Duration estimate**: 1-2 days
**Goal**: Immediate mitigation of hallucinations by forcing explicit `[SOURCE]` tags, providing an escape hatch, refusing partial code completions, and bridging the gap with an immediate lightweight verification check.

**Files to Modify**:
- `supabase/functions/ai-task-router/index.ts`

**Changes**:
```typescript
// 1. UPDATE SPAN FORMATTING (With field-name tolerance and language fences)
function buildSpansBlock(spans: any[]): string {
  if (!spans?.length) return "";
  return `\n## Evidence Spans\nUse these evidence spans to ground your answers. YOU MUST CITE EVERY CLAIM using this exact format: [SOURCE: filepath:start_line-end_line]\n\n${
    spans.map((s: any) => {
      const start = s.start_line ?? s.line_start ?? "?";
      const end = s.end_line ?? s.line_end ?? "?";
      const text = s.text ?? s.content ?? "";
      const lang = s.path?.split('.').pop() || 'ts';
      return `[SOURCE: ${s.path}:${start}-${end}]\n\`\`\`${lang}\n${text}\n\`\`\``;
    }).join("\n\n")
  }`;
}

// 2. STRENGTHEN SYSTEM PROMPT (Append to existing SYSTEM_PROMPT)
const GROUNDED_RULES = `
## ABSOLUTE RULES
1. ONLY use information from the [SOURCE] blocks provided.
2. Every technical claim MUST include a citation: [SOURCE: filepath:lineStart-lineEnd].
3. Code snippets MUST be EXACT copies from the sources. Do NOT invent missing code.
4. If the sources don't contain enough information, respond EXACTLY:
   "I don't have enough context in the indexed sources to fully answer this."
5. NEVER invent file paths, function names, or line numbers.
6. If a code snippet from the sources appears INCOMPLETE (e.g., truncated function body), show ONLY what is present and add this note:
   "⚠️ The full implementation extends beyond the indexed chunk. See {filepath} for the complete source."
   Do NOT attempt to complete or reconstruct the missing portions.
`;

// 3. PHASE 0: QUICK VERIFICATION BRIDGE
function quickVerifyCitations(llmResponse: string, evidenceSpans: Array<{ path: string }>): { response: string; warnings: string[] } {
  const CITE_REGEX = /\[SOURCE:\s*([^\]:]+?)(?::\d+-\d+)?\]/g;
  const knownPaths = new Set(evidenceSpans.map(s => s.path));
  const warnings: string[] = [];
  let match;

  while ((match = CITE_REGEX.exec(llmResponse)) !== null) {
    const citedPath = match[1].trim();
    if (!knownPaths.has(citedPath)) {
      warnings.push(`Citation references "${citedPath}" which was not in retrieved evidence`);
    }
  }

  let response = llmResponse;
  if (warnings.length > 0) {
    response += '\n\n---\n⚠️ *Some citations in this response could not be verified against retrieved sources.*';
  }

  return { response, warnings };
}
```

---

## Phase 1: Intelligent Ingestion (AST Chunking & Re-indexing)
**Duration estimate**: 1-2 weeks
**Goal**: Transition to semantic Tree-Sitter chunking via `web-tree-sitter`. Extract chunks mathematically, filter orphans, enforce Multi-Tenant execution securely with `.eq()` constraints and active SQL RLS properties.

**Files to Create**:
- `supabase/functions/ingest-source/ast-chunker.ts`
- `scripts/reindex-orgs.ts`

**Database Migrations**: `20260317000000_ast_chunking_foundation.sql`
```sql
ALTER TABLE knowledge_chunks 
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_name TEXT,
  ADD COLUMN IF NOT EXISTS signature TEXT,
  ADD COLUMN IF NOT EXISTS line_start INT,
  ADD COLUMN IF NOT EXISTS line_end INT,
  ADD COLUMN IF NOT EXISTS contextualized_content TEXT,
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS generation_id UUID,
  ADD COLUMN IF NOT EXISTS imports JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS exported_names JSONB DEFAULT '[]'::jsonb,
  ADD CONSTRAINT imports_is_array CHECK (jsonb_typeof(imports) = 'array');

-- ENABLE RLS on all related tables natively avoiding UI leakages
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- NEW: Prevent 'mixed' retrieval utilizing a dedicated Active Generation ledger.
CREATE TABLE pack_active_generation (
  org_id UUID NOT NULL,
  pack_id UUID NOT NULL,
  active_generation_id UUID NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (org_id, pack_id)
);
ALTER TABLE pack_active_generation ENABLE ROW LEVEL SECURITY;

CREATE TABLE reindex_progress (
  org_id UUID NOT NULL REFERENCES organizations(id),
  pack_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  chunks_processed INT DEFAULT 0,
  chunks_total INT DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (org_id, pack_id)
);
ALTER TABLE reindex_progress ENABLE ROW LEVEL SECURITY;

-- FTS INDEX REBUILD: Use 'simple' to preserve code identifiers exactly. Double weight entity_name.
ALTER TABLE knowledge_chunks DROP COLUMN IF EXISTS fts;
ALTER TABLE knowledge_chunks ADD COLUMN fts TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      COALESCE(content, '') || ' ' ||
      COALESCE(entity_name, '') || ' ' ||
      COALESCE(entity_name, '') || ' ' || 
      COALESCE(signature, '') || ' ' ||
      COALESCE(path, '')
    )
  ) STORED;
CREATE INDEX idx_knowledge_chunks_fts ON knowledge_chunks USING gin(fts);

-- Indexes for hybrid querying
CREATE INDEX idx_chunks_imports ON knowledge_chunks USING gin(imports);
CREATE INDEX idx_chunks_exports ON knowledge_chunks USING gin(exported_names);

-- Vector tracking + multi-tenant isolation compound scans
CREATE INDEX IF NOT EXISTS idx_chunks_org_pack_path ON knowledge_chunks(org_id, pack_id, path);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enforce Multi-tenant Isolation Policies natively
CREATE POLICY "org_isolation_chunks" ON knowledge_chunks FOR SELECT USING ( org_id IN ( SELECT org_id FROM org_members WHERE user_id = auth.uid() ) );

-- reindex_progress: separate read vs write policies with WITH CHECK
DROP POLICY IF EXISTS org_isolation_progress ON reindex_progress;
CREATE POLICY reindex_progress_select ON reindex_progress FOR SELECT USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
CREATE POLICY reindex_progress_insert ON reindex_progress FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
CREATE POLICY reindex_progress_update ON reindex_progress FOR UPDATE USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())) WITH CHECK (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

-- pack_active_generation: allow org members to read; restrict writes (backend/service role only)
DROP POLICY IF EXISTS org_isolation_active_pack ON pack_active_generation;
CREATE POLICY pack_active_generation_select ON pack_active_generation FOR SELECT USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
```

**Changes (Explicit Implementations)**:

```typescript
// In ingest-source/ast-chunker.ts
import Parser from 'web-tree-sitter';

let parserInitialized = false;
let TS_LANG: any;

const LANG_WASM: Record<string, string> = {
  typescript: './tree-sitter-typescript.wasm',
  tsx: './tree-sitter-tsx.wasm',
  // Future: python, go, etc.
};

let initialized = false;
const LANG_CACHE = new Map<string, any>();

async function getLanguage(lang: string) {
  if (!initialized) {
    await Parser.init();
    initialized = true;
  }
  if (LANG_CACHE.has(lang)) return LANG_CACHE.get(lang);

  const wasmUrl = new URL(LANG_WASM[lang], import.meta.url);
  const languageObj = await Parser.Language.load(wasmUrl);
  LANG_CACHE.set(lang, languageObj);
  return languageObj;
}

// A. TOP-LEVEL GLUE: WASM Initialization and AST Generation
export async function astChunk(filepath: string, sourceCode: string, knownPaths: Set<string>): Promise<any[]> {
    const ext = filepath.split('.').pop()?.toLowerCase();
    const lang = ext === 'tsx' ? 'tsx' : 'typescript';

    const parser = new Parser();
    parser.setLanguage(await getLanguage(lang));
    const tree = parser.parse(sourceCode);
    
    const imports = extractImports(tree.rootNode, lang).map(imp => {
       const resolved = resolveImportPath(imp.path, filepath, knownPaths);
       return resolved ? { path: resolved, names: imp.names, lineStart: imp.lineStart, lineEnd: imp.lineEnd } : null;
    }).filter(Boolean);
    
    const lines = sourceCode.split('\n');
    const chunks = walkAST(tree.rootNode, lang, lines, filepath, imports);
    
    const orphanChunks = extractOrphanCode(lines, chunks, filepath, imports);
    chunks.push(...orphanChunks);
    
    return chunks.flatMap(chunk => {
        if (chunk.content.split('\n').length > 200) {
            return splitOversizedChunk(chunk, 150, 20);
        }
        return [chunk];
    });
}

// B. EXTRACT ORPHAN CODE (Ensures module-exports and top level variables index)
function extractOrphanCode(sourceLines: string[], astChunks: any[], filepath: string, imports: any[]): any[] {
  const coveredLines = new Set<number>();
  for (const chunk of astChunks) { for (let i = chunk.lineStart; i <= chunk.lineEnd; i++) coveredLines.add(i); }
  for (const imp of imports) { for (let i = imp.lineStart; i <= imp.lineEnd; i++) coveredLines.add(i); }
  
  const orphanRanges: Array<{start: number, end: number}> = [];
  let rangeStart: number | null = null;
  
  for (let line = 1; line <= sourceLines.length; line++) {
    if (!coveredLines.has(line)) { if (rangeStart === null) rangeStart = line; } 
    else { if (rangeStart !== null) { orphanRanges.push({ start: rangeStart, end: line - 1 }); rangeStart = null; } }
  }
  if (rangeStart !== null) orphanRanges.push({ start: rangeStart, end: sourceLines.length });
  
  return orphanRanges
    .filter(range => {
      const content = sourceLines.slice(range.start - 1, range.end).join('\n').trim();
      return content.length > 30 && content.split('\n').filter(l => l.trim()).length > 2;
    })
    .map(range => {
      const content = sourceLines.slice(range.start - 1, range.end).join('\n');
      return {
        content,
        contextualizedContent: `# File: ${filepath}\n# Top-level code (lines ${range.start}-${range.end})\n\n${content}`,
        filepath, lineStart: range.start, lineEnd: range.end,
        entityType: 'module_code', entityName: filepath.split('/').pop() || filepath,
        signature: '', parentEntity: undefined, imports: [],
      };
    });
}

// C. SPLIT OVERSIZED CHUNKS
function splitOversizedChunk(chunk: any, maxLines: number = 150, overlapLines: number = 20): any[] {
  const lines = chunk.content.split('\n');
  if (lines.length <= maxLines) return [chunk];
  
  const subChunks: any[] = [];
  let start = 0;
  
  while (start < lines.length) {
    let end = Math.min(start + maxLines, lines.length);
    if (end < lines.length) {
      let bestSplit = end;
      for (let i = end; i > end - 30 && i > start; i--) {
        const line = lines[i]?.trim();
        if (line === '' || line === '}' || line === '};' || line === ')') { bestSplit = i + 1; break; }
      }
      end = bestSplit;
    }
    
    const subContent = lines.slice(start, end).join('\n');
    const subLineStart = chunk.lineStart + start;
    const subLineEnd = chunk.lineStart + end - 1;
    const partLabel = subChunks.length + 1;
    
    subChunks.push({
      ...chunk, content: subContent,
      contextualizedContent: `# File: ${chunk.filepath}\n# ${chunk.entityType}: ${chunk.entityName} (part ${partLabel}, lines ${subLineStart}-${subLineEnd})\n# Signature: ${chunk.signature}\n\n${subContent}`,
      lineStart: subLineStart, lineEnd: subLineEnd,
    });
    
    start = end - overlapLines;
    if (start >= lines.length - overlapLines) break;
  }
  return subChunks;
}

// D. FALLBACK SEMANTIC CHUNKER
function fallbackSemanticChunk(filepath: string, content: string): any[] {
  const ext = filepath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'md': case 'mdx': return chunkByHeadings(filepath, content);
    case 'json': return chunkJSON(filepath, content);
    case 'yml': case 'yaml': return chunkYAML(filepath, content);
    default: return chunkByParagraphs(filepath, content, { maxLines: 100, overlap: 15, splitOn: /\n\s*\n/ });
  }
}

// E. AST WALK WITH PARENT PROPAGATION
function walkAST(node: any, language: string, sourceLines: string[], filepath: string, imports: any[], parentName?: string, parentType?: string): any[] {
  const chunks: any[] = [];
  const boundaryTypes = SEMANTIC_BOUNDARIES[language] || [];
  const containerTypes = CONTAINER_TYPES[language] || [];
  
  if (boundaryTypes.includes(node.type)) {
    const entityName = extractEntityName(node, language);
    const signature = extractSignature(node, language, sourceLines);
    const content = sourceLines.slice(node.startPosition.row, node.endPosition.row + 1).join('\n');
    
    const contextParts = [
      `# File: ${filepath}`,
      parentName ? `# Scope: ${parentType || 'class'} ${parentName}` : null,
      `# Defines: ${signature || entityName}`,
      imports.length > 0 ? `# Imports: ${imports.map(i => i.names.join(', ')).join('; ')}` : null,
    ].filter(Boolean).join('\n');
    
    chunks.push({
      content, contextualizedContent: `${contextParts}\n\n${content}`,
      filepath, lineStart: node.startPosition.row + 1, lineEnd: node.endPosition.row + 1,
      entityType: mapNodeType(node.type, language), entityName: entityName,
      signature, parentEntity: parentName,
      imports: imports.map(i => ({ path: i.path, names: i.names })),
    });
  }
  
  const isContainer = containerTypes.includes(node.type);
  const currentName = isContainer ? extractEntityName(node, language) : parentName;
  const currentType = isContainer ? mapNodeType(node.type, language) : parentType;
  for (const child of node.children) {
    chunks.push(...walkAST(child, language, sourceLines, filepath, imports, currentName, currentType));
  }
  return chunks;
}

// F. IMPORT RESOLUTION AT INGEST TIME
function resolveImportPath(importPath: string, currentFilePath: string, knownPaths: Set<string>): string | null {
  if (!importPath.startsWith('.')) return null;
  const currentDir = currentFilePath.split('/').slice(0, -1).join('/');
  
  // Resolve relative mechanics matching standard node conventions
  const segments = [...currentDir.split('/'), ...importPath.split('/')];
  const resolved: string[] = [];
  for (const seg of segments) {
    if (seg === '.') continue;
    if (seg === '..') { resolved.pop(); continue; }
    resolved.push(seg);
  }
  let base = resolved.join('/');
  
  const candidates = [
    base,
    `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, `${base}.py`, `${base}.go`,
    `${base}/index.ts`, `${base}/index.tsx`, `${base}/index.js`, `${base}/__init__.py`,
  ];
  for (const c of candidates) {
    if (knownPaths.has(c)) return c;
  }
  return null;
}
```

```typescript
// G. ATOMIC SWAP WITH ORG/PACK SCOPING (in scripts/reindex-orgs.ts)
const newGeneration = crypto.randomUUID();
const packId = "TARGET_PACK_ID"; 

// 1. INSERT all new chunks with generation_id = newGeneration
// (Remember: Use redactSecrets() on BOTH content and contextualized_content before storage)
await insertRedactedChunks(org.id, packId, chunks, newGeneration);

// 2. ONLY THEN update Active Generation reference (marking the new generation active)
await supabase.from('pack_active_generation').upsert({
   org_id: org.id, pack_id: packId, active_generation_id: newGeneration 
});

// 3. Deletion and Maintenance
await supabase.from('knowledge_chunks')
    .delete()
    .eq('org_id', org.id)
    .eq('pack_id', packId)
    .or(`generation_id.neq.${newGeneration},generation_id.is.null`);

// 4. OPERATIONAL: Update query planner
await supabase.rpc('run_analyze', { table_name: 'knowledge_chunks' });
```

---

## Phase 2: Hybrid Index (Vector + BM25 Search + Graph)
**Duration estimate**: 1 week
**Database Migrations**: `20260318000000_hybrid_search_rpc.sql`
```sql
-- Include explicit `p_org_id` parameters and native `pack_active_generation` filtering
CREATE OR REPLACE FUNCTION hybrid_search_v2(
  p_org_id UUID, p_pack_id UUID, p_query_embedding VECTOR(1536), p_query_text TEXT, 
  p_vector_weight FLOAT DEFAULT 0.55, p_keyword_weight FLOAT DEFAULT 0.45, 
  p_top_k INT DEFAULT 20, p_expand_graph BOOLEAN DEFAULT TRUE
) RETURNS TABLE ( chunk_id UUID, path TEXT, entity_type TEXT, entity_name TEXT, signature TEXT, content TEXT, contextualized_content TEXT, line_start INT, line_end INT, rrf_score FLOAT, match_type TEXT ) AS $$
BEGIN
  RETURN QUERY WITH
  active_gen AS (
    SELECT active_generation_id
    FROM pack_active_generation
    WHERE org_id = p_org_id AND pack_id = p_pack_id
  ),
  vector_hits AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> p_query_embedding) AS rank
    FROM knowledge_chunks 
    WHERE pack_id = p_pack_id AND org_id = p_org_id 
      AND (
        (SELECT active_generation_id FROM active_gen) IS NULL
        OR generation_id = (SELECT active_generation_id FROM active_gen)
      )
    ORDER BY embedding <=> p_query_embedding LIMIT p_top_k * 3
  ),
  keyword_hits AS (
    SELECT kc.id, ROW_NUMBER() OVER (ORDER BY ts_rank_cd(kc.fts, query) DESC) AS rank
    FROM knowledge_chunks kc, plainto_tsquery('simple', p_query_text) query 
    WHERE kc.pack_id = p_pack_id AND kc.org_id = p_org_id 
      AND (
        (SELECT active_generation_id FROM active_gen) IS NULL
        OR generation_id = (SELECT active_generation_id FROM active_gen)
      )
      AND kc.fts @@ query ORDER BY ts_rank_cd(kc.fts, query) DESC LIMIT p_top_k * 3
  ),
  rrf_fused AS (
    SELECT COALESCE(v.id, k.id) AS id,
      (p_vector_weight * COALESCE(1.0 / (60 + v.rank), 0) + p_keyword_weight * COALESCE(1.0 / (60 + k.rank), 0)) AS rrf_score,
      CASE WHEN v.id IS NOT NULL AND k.id IS NOT NULL THEN 'hybrid' WHEN v.id IS NOT NULL THEN 'vector' ELSE 'keyword' END AS match_type
    FROM vector_hits v FULL OUTER JOIN keyword_hits k ON v.id = k.id
  ),
  graph_expanded AS (
    SELECT DISTINCT related.id, 0.3 / (60 + ROW_NUMBER() OVER ()) AS rrf_score, 'graph'::TEXT AS match_type
    FROM ( 
      SELECT id, imports FROM knowledge_chunks 
      WHERE id IN (SELECT id FROM rrf_fused ORDER BY rrf_score DESC LIMIT 5)
        AND (
          (SELECT active_generation_id FROM active_gen) IS NULL
          OR generation_id = (SELECT active_generation_id FROM active_gen)
        )
    ) top_hits,
    LATERAL (
      SELECT kc.id FROM knowledge_chunks kc, jsonb_array_elements(top_hits.imports) AS imp
      WHERE kc.path = imp->>'path' AND kc.pack_id = p_pack_id AND kc.org_id = p_org_id AND kc.id != top_hits.id 
        AND (
          (SELECT active_generation_id FROM active_gen) IS NULL
          OR kc.generation_id = (SELECT active_generation_id FROM active_gen)
        )
      LIMIT 10
    ) related
    WHERE NOT EXISTS (SELECT 1 FROM rrf_fused WHERE rrf_fused.id = related.id) AND p_expand_graph = TRUE
    LIMIT 15 -- Cap explosion
  ),
  all_results AS ( SELECT * FROM rrf_fused UNION ALL SELECT * FROM graph_expanded )
  SELECT kc.id, kc.path, kc.entity_type, kc.entity_name, kc.signature, kc.content, kc.contextualized_content, kc.line_start, kc.line_end, ar.rrf_score, ar.match_type
  FROM all_results ar JOIN knowledge_chunks kc ON kc.id = ar.id ORDER BY ar.rrf_score DESC LIMIT p_top_k;
END;
$$ LANGUAGE plpgsql;
```

---

## Phase 3: Reranking (Relevance Gate)
**Changes**: Includes robust error handling mitigating unstructured LLM arrays outputting. 

```typescript
// In ai-task-router/reranker.ts
function parseBatchScores(raw: string, expectedCount: number): number[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === expectedCount) return parsed.map(s => typeof s === 'number' ? s : 0);
  } catch {}
  
  const arrayMatch = raw.match(/\[[\d\s,.]+\]/);
  if (arrayMatch) {
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) return parsed.slice(0, expectedCount).map(s => typeof s === 'number' ? s : 0);
    } catch {}
  }
  
  console.warn('Batch reranking failed to parse LLM response, skipping reranking');
  return new Array(expectedCount).fill(5); // neutral fallback
}

// Ensure "timeout" helper exported accurately from Rocketboard utilities
async function batchRerankWithLLM(query: string, chunks: any[]): Promise<any[]> {
  try {
    const prompt = `Rate each document's relevance to the query on a scale of 0-10.\nQuery: "${query}"\n${chunks.map((c, i) => `[DOC_${i}]: ${c.contextualized_content?.slice(0, 300) || c.content.slice(0, 300)}`).join('\n\n')}\nReply with ONLY a JSON array of scores, e.g., [8, 3, 9, 1, ...]`;
    const response = await Promise.race([ callPlatformAI(prompt), timeout(5000) ]); 
    
    let scores = parseBatchScores(response.content, chunks.length);
    
    // Normalize array length (pad or truncate)
    if (scores.length < chunks.length) {
      scores = [...scores, ...new Array(chunks.length - scores.length).fill(5)];
    } else if (scores.length > chunks.length) {
      scores = scores.slice(0, chunks.length);
    }

    return chunks
      .map((chunk, i) => ({ ...chunk, relevance_score: scores[i] / 10 }))
      .filter(c => c.relevance_score >= 0.35)
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, 10);
      
  } catch (error) {
    console.warn('Reranking failed/timed out, falling back to raw retrieval scores:', error);
    return chunks.slice(0, 10);
  }
}
```

---

## Phase 4: Citation Verification (Post-Generation)
**Changes**: Explodes explicitly implemented 4-step logic stripping malicious hallucinations forcefully instead of passively flagging logic.

```typescript
// In ai-task-router/citation-verifier.ts
// External utilities resolving grouping and distances matching standard node implementation:
// parseCitations(), groupBy(), levenshteinDistance(), extractCodeBlockAfterCitation()

function fuzzyCodeMatch(generated: string, source: string, threshold: number): boolean {
  const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
  const gen = normalize(generated); const src = normalize(source);
  if (src.includes(gen) || gen.includes(src)) return true;
  const maxLen = Math.max(gen.length, src.length);
  if (maxLen === 0) return true;
  return (1 - levenshteinDistance(gen, src) / maxLen) >= threshold;
}

function findUncitedCodeBlocks(response: string): string[] {
  const codeBlockRegex = /```[\s\S]*?```/g;
  const uncited: string[] = []; let match;
  while ((match = codeBlockRegex.exec(response)) !== null) {
    const textBefore = response.slice(Math.max(0, match.index - 200), match.index);
    if (!/\[SOURCE:/.test(textBefore)) uncited.push(match[0]); // Full block
  }
  return uncited;
}

// VERIFY CITATIONS (Before yielding to UI)
export function verifyCitations(llmResponse: string, evidenceChunks: any[]): any {
  const citations = parseCitations(llmResponse);
  const results: any[] = [];
  const evidenceByPath = groupBy(evidenceChunks, c => c.path);
  let verifiedResponse = llmResponse;
  
  for (const citation of citations) {
    // 1. File exists
    const fileChunks = evidenceByPath[citation.filepath];
    if (!fileChunks) { results.push({ ...citation, status: 'FAILED', reason: 'file_not_in_evidence' }); continue; }
    
    // 2. Lines overlap
    if (citation.lineStart && citation.lineEnd) {
      const hasOverlap = fileChunks.some((c: any) => c.line_start != null && c.line_end != null && citation.lineStart <= c.line_end && citation.lineEnd >= c.line_start);
      if (!hasOverlap) { results.push({ ...citation, status: 'FAILED', reason: 'lines_not_in_evidence' }); continue; }
    }
    
    // 3. Fuzzy Match Output. If failed -> Explicitly Strip code block.
    const codeBlock = extractCodeBlockAfterCitation(verifiedResponse, citation);
    if (codeBlock) {
      const matchingChunk = fileChunks.find((c: any) => fuzzyCodeMatch(codeBlock, c.content, 0.85));
      if (!matchingChunk) { 
          results.push({ ...citation, status: 'FAILED', reason: 'code_content_mismatch' }); 
          // STRIP MALICIOUS CODEBLOCKS:
          while (verifiedResponse.includes(codeBlock)) {
            verifiedResponse = verifiedResponse.replace(codeBlock, "\n\nRemoved unverified code block (failed verification).\n\n");
          }
          continue; 
      }
    }
    results.push({ ...citation, status: 'VERIFIED' });
  }
  
  const uncitedCodeBlocks = findUncitedCodeBlocks(verifiedResponse);
  const warnings: string[] = [];
  if (uncitedCodeBlocks.length > 0) {
    warnings.push(`${uncitedCodeBlocks.length} code block(s) have no source citation and may be fabricated.`);
    // STRIP UNCITED CODEBLOCKS:
    for (const block of uncitedCodeBlocks) {
      while (verifiedResponse.includes(block)) {
        verifiedResponse = verifiedResponse.replace(block, "\n\nRemoved uncited code block.\n\n");
      }
    }
  }
  
  const failedCitations = results.filter(r => r.status === 'FAILED');
  if (failedCitations.length > 0) {
    const warningBlock = failedCitations.map(f => `- ⚠️ Unverified: ${f.raw} (${f.reason})`).join('\n');
    verifiedResponse += `\n\n---\n**⚠️ Verification Notes:**\n${warningBlock}`;
  }
  
  const score = citations.length > 0 ? results.filter(r => r.status === 'VERIFIED').length / citations.length : 0;
  return { verifiedResponse, score, failedCitations, warnings, citationsFound: citations.length };
}
```

```typescript
// RETRY-ON-LOW-VERIFICATION (In ai-task-router/index.ts)
let verification = await verifyCitations(llmResponse, evidence);
if (verification.score < 0.6 && verification.citationsFound > 0) {
  const retryResponse = await groundedGenerate(
    `${query}\n\nIMPORTANT: Your previous answer contained unverifiable citations.
     Only cite from the exact sources provided. Failed citations were:
     ${verification.failedCitations.map((f:any) => f.raw).join(', ')}`,
    evidence, aiConfig
  );
  verification = await verifyCitations(retryResponse, evidence);
}
```

---

## Phase 5: Agentic Retrieval Loop
**Changes**: Execute the loop explicitly providing tool structures for BYOK models safely matching limits.

```typescript
// In ai-task-router/agentic-retriever.ts

const HYBRID_SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'hybrid_search',
    description: 'Search the codebase and documentation using hybrid vector+keyword search',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query — rewrite for better results if needed' },
        vector_weight: { type: 'number', minimum: 0, maximum: 1, description: 'Weight for semantic similarity. Use HIGH (0.7+) for conceptual questions, LOW (0.2) for exact identifiers' },
        keyword_weight: { type: 'number', minimum: 0, maximum: 1, description: 'Weight for keyword matching. Use HIGH (0.7+) for function/class name search' },
        file_filter: { type: 'string', description: 'Optional: restrict search to files under this path prefix (e.g., "src/auth/")' },
      },
      required: ['query', 'vector_weight', 'keyword_weight'],
    },
  },
};

const RETRIEVAL_AGENT_PROMPT = `You are a retrieval agent. Your job is to find the EXACT source code and documentation needed to answer the user's question.
After each search, evaluate:
- Are the results relevant to the question?
- Do I have complete functions (not fragments)?
- Do I need related files (imports, callers)?
If insufficient, search again with a DIFFERENT query strategy.
After at most 2 searches, respond with your assessment.`;

export async function agenticRetrieve(userQuery: string, orgId: string, setupId: string, aiConfig: any): Promise<any> {
  const allEvidence = new Map<string, any>();
  const searchLog: any[] = [];
  const MAX_ITERATIONS = 2;
  
  const messages: any[] = [
    { role: 'system', content: RETRIEVAL_AGENT_PROMPT },
    { role: 'user', content: `Find evidence to answer: "${userQuery}"` },
  ];
  
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await callAI(aiConfig, messages, { tools: [HYBRID_SEARCH_TOOL], tool_choice: i === 0 ? 'required' : 'auto' });
    if (response.finish_reason === 'stop') break;
    
    if (response.tool_calls) {
      for (const call of response.tool_calls) {
        const params = JSON.parse(call.function.arguments);
        const results = await hybridSearch(orgId, setupId, params);
        const reranked = await batchRerankWithLLM(params.query, results);
        
        for (const chunk of reranked) allEvidence.set(chunk.chunk_id, chunk);
        searchLog.push({ iteration: i, query: params.query, vectorWeight: params.vector_weight, keywordWeight: params.keyword_weight, resultsCount: reranked.length });
        
        messages.push({
          role: 'tool', tool_call_id: call.id,
          content: JSON.stringify({
            results_count: reranked.length,
            chunks: reranked.slice(0, 5).map((c:any) => ({ filepath: c.path, entity: c.entity_name, lines: `${c.line_start}-${c.line_end}`, preview: c.content.slice(0, 200) }))
          }),
        });
      }
    }
  }
  return { evidence: Array.from(allEvidence.values()), searchLog, confidence: allEvidence.size >= 3 ? 'high' : allEvidence.size >= 1 ? 'medium' : 'insufficient' };
}
```

---

## Phase 6: Observability & Evaluation
**Database Migrations**: `20260320000000_rag_metrics.sql`
```sql
CREATE TABLE rag_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL, user_id UUID NOT NULL, query TEXT NOT NULL,
  retrieval_method TEXT, chunks_retrieved INT, chunks_after_rerank INT, avg_relevance_score FLOAT, retrieval_latency_ms INT,
  model_used TEXT, provider_used TEXT, generation_latency_ms INT,
  citations_found INT, citations_verified INT, citations_failed INT, verification_score FLOAT,
  search_iterations INT, agent_confidence TEXT, total_latency_ms INT, created_at TIMESTAMPTZ DEFAULT now()
);

-- Protect metrics table bounds explicitly
ALTER TABLE rag_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rag_metrics_select" ON rag_metrics FOR SELECT USING ( org_id IN ( SELECT org_id FROM org_members WHERE user_id = auth.uid() ) );
-- (Inserts are restricted to service role only, no client policy needed)
```
**Changes**:
- Pipe metadata components wrapping the output schema explicitly into `rag_metrics` payload records. Setup cron automation running `scripts/generate-eval-dataset.ts` pulling sampled random identifier metrics globally tracking historical relevancy deviations autonomously.
