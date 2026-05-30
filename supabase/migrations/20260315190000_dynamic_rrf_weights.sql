-- Phase 2: Dynamic RRF weights for match_chunks_hybrid
-- Replaces the fixed-weight version with a parameterized one.
-- vector_weight=1.0, keyword_weight=1.0 is equivalent to the original behavior.
-- Increase keyword_weight for exact-match queries (e.g. env vars, function names).
-- Increase vector_weight for conceptual queries (e.g. "how does auth work?").

CREATE OR REPLACE FUNCTION match_chunks_hybrid(
  query_embedding vector(1536),
  query_text text,
  match_count int,
  target_pack_id uuid,
  path_filter text default null,
  vector_weight float default 1.0,
  keyword_weight float default 1.0
) RETURNS TABLE (
  id uuid,
  chunk_id text,
  path text,
  start_line integer,
  end_line integer,
  content text,
  metadata jsonb,
  source_id uuid,
  rrf_score float
)
LANGUAGE sql STABLE AS $$
  WITH semantic_search AS (
    SELECT
      knowledge_chunks.id,
      rank() OVER (ORDER BY knowledge_chunks.embedding <=> query_embedding) AS rank
    FROM knowledge_chunks
    WHERE
      knowledge_chunks.pack_id = target_pack_id
      AND knowledge_chunks.is_redacted = false
      AND (path_filter IS NULL OR knowledge_chunks.path ILIKE path_filter)
    ORDER BY knowledge_chunks.embedding <=> query_embedding
    LIMIT match_count * 2
  ),
  keyword_search AS (
    SELECT
      knowledge_chunks.id,
      rank() OVER (ORDER BY ts_rank_cd(knowledge_chunks.fts, to_tsquery('english', query_text)) DESC) AS rank
    FROM knowledge_chunks
    WHERE
      knowledge_chunks.pack_id = target_pack_id
      AND knowledge_chunks.is_redacted = false
      AND knowledge_chunks.fts @@ to_tsquery('english', query_text)
      AND (path_filter IS NULL OR knowledge_chunks.path ILIKE path_filter)
    ORDER BY ts_rank_cd(knowledge_chunks.fts, to_tsquery('english', query_text)) DESC
    LIMIT match_count * 2
  )
  SELECT
    kc.id,
    kc.chunk_id,
    kc.path,
    kc.start_line,
    kc.end_line,
    kc.content,
    kc.metadata,
    kc.source_id,
    -- Weighted RRF: apply caller-supplied weights to each component
    (
      (vector_weight  * COALESCE(1.0 / (60 + ss.rank), 0.0)) +
      (keyword_weight * COALESCE(1.0 / (60 + ks.rank), 0.0))
    ) * COALESCE(ps.weight, 1.0) AS rrf_score
  FROM
    semantic_search ss
    FULL OUTER JOIN keyword_search ks ON ss.id = ks.id
    JOIN knowledge_chunks kc ON kc.id = COALESCE(ss.id, ks.id)
    LEFT JOIN pack_sources ps ON ps.id = kc.source_id
  ORDER BY rrf_score DESC
  LIMIT match_count;
$$;
