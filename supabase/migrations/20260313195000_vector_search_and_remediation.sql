-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Add an embedding column to knowledge_chunks. We use 1536 dimensions as standard for OpenAI's text-embedding-3-small
ALTER TABLE "public"."knowledge_chunks" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- Create an HNSW index to dramatically speed up approximate nearest neighbor (ANN) searches
-- Requires creating the vector extension first.
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_hnsw ON "public"."knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);

-- Create module_remediations table for AI drafted updates
CREATE TABLE IF NOT EXISTS "public"."module_remediations" (
    "id" uuid not null default gen_random_uuid(),
    "module_key" text not null,
    "section_id" text not null,
    "original_content" text not null,
    "proposed_content" text not null,
    "diff_summary" text not null,
    "status" text not null default 'pending', -- pending, accepted, rejected
    "created_at" timestamp with time zone not null default now()
);

-- Ensure updated_at exists (as it was added in this migration version)
ALTER TABLE "public"."module_remediations" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone not null default now();

-- Ensure primary key exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'module_remediations_pkey') THEN
        ALTER TABLE "public"."module_remediations" ADD CONSTRAINT "module_remediations_pkey" PRIMARY KEY ("id");
    END IF;
END $$;

-- Basic RLS for remediations
ALTER TABLE "public"."module_remediations" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable full access for authors to remediations" ON "public"."module_remediations";
CREATE POLICY "Enable full access for authors to remediations" ON "public"."module_remediations"
    for all using (
        exists (
            select 1 from public.generated_modules gm
            join public.packs p on p.id = gm.pack_id
            join public.pack_members pr on pr.pack_id = p.id
            where gm.module_key = module_remediations.module_key
            and pr.user_id = auth.uid()
            and pr.access_level = 'author'
        )
    );

-- Drop existing function if return type has changed (to avoid OVERLOAD conflicts or signature mismatch)
DROP FUNCTION IF EXISTS public.match_chunks_hybrid(vector, text, int, uuid, text);

-- Hybrid Search Function (Vector Similarity + Full-Text Search + Source Weighting)
-- Concept: Reciprocal Rank Fusion (RRF)
create or replace function match_chunks_hybrid(
  query_embedding vector(1536),
  query_text text,
  match_count int,
  target_pack_id uuid,
  path_filter text default null
) returns table (
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
language sql stable as $$
  with semantic_search as (
    select
      knowledge_chunks.id,
      rank() over (order by knowledge_chunks.embedding <=> query_embedding) as rank
    from
      knowledge_chunks
    where
      knowledge_chunks.pack_id = target_pack_id
      and knowledge_chunks.is_redacted = false
      and (path_filter is null or knowledge_chunks.path ilike path_filter)
    order by
      knowledge_chunks.embedding <=> query_embedding
    limit match_count * 2
  ),
  keyword_search as (
    select
      knowledge_chunks.id,
      rank() over (order by ts_rank_cd(knowledge_chunks.fts, to_tsquery('english', query_text)) desc) as rank
    from
      knowledge_chunks
    where
      knowledge_chunks.pack_id = target_pack_id
      and knowledge_chunks.is_redacted = false
      and knowledge_chunks.fts @@ to_tsquery('english', query_text)
      and (path_filter is null or knowledge_chunks.path ilike path_filter)
    order by
      ts_rank_cd(knowledge_chunks.fts, to_tsquery('english', query_text)) desc
    limit match_count * 2
  )
  select
    kc.id,
    kc.chunk_id,
    kc.path,
    kc.start_line,
    kc.end_line,
    kc.content,
    kc.metadata,
    kc.source_id,
    -- Reciprocal Rank Fusion: 1 / (k + rank)
    -- We use k=60 as standard in RRF literature
    -- Finally, multiply the fused score by the source weight to enforce author priorities
    (
      (coalesce(1.0 / (60 + ss.rank), 0.0)) +
      (coalesce(1.0 / (60 + ks.rank), 0.0))
    ) * coalesce(ps.weight, 1.0) as rrf_score
  from
    semantic_search ss
    full outer join keyword_search ks on ss.id = ks.id
    join knowledge_chunks kc on kc.id = coalesce(ss.id, ks.id)
    left join pack_sources ps on ps.id = kc.source_id
  order by rrf_score desc
  limit match_count;
$$;
