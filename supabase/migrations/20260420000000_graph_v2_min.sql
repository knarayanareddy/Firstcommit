-- Migration: Graph v2 Minimal
-- Description: Stores minimal semantic graph (definitions and references) for better dependency following.

-- 1. symbol_definitions table
CREATE TABLE IF NOT EXISTS public.symbol_definitions (
    pack_id UUID NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES public.pack_sources(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    chunk_id TEXT NOT NULL,
    path TEXT NOT NULL,
    line_start INT,
    line_end INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (pack_id, symbol, chunk_id)
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_symbol_definitions_pack_symbol ON public.symbol_definitions(pack_id, symbol);
CREATE INDEX IF NOT EXISTS idx_symbol_definitions_pack_source ON public.symbol_definitions(pack_id, source_id);

-- 2. symbol_references table
CREATE TABLE IF NOT EXISTS public.symbol_references (
    pack_id UUID NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
    source_id UUID NOT NULL REFERENCES public.pack_sources(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    from_chunk_id TEXT NOT NULL,
    from_path TEXT NOT NULL,
    from_line_start INT,
    from_line_end INT,
    confidence NUMERIC(4,3) DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (pack_id, symbol, from_chunk_id)
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_symbol_references_pack_symbol ON public.symbol_references(pack_id, symbol);
CREATE INDEX IF NOT EXISTS idx_symbol_references_pack_source ON public.symbol_references(pack_id, source_id);

-- 3. RLS Policies
ALTER TABLE public.symbol_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symbol_references ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- Read allowed for pack members (learner+)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'symbol_definitions' AND policyname = 'Allow members to read definitions') THEN
        CREATE POLICY "Allow members to read definitions"
        ON public.symbol_definitions
        FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM public.pack_members
                WHERE pack_id = symbol_definitions.pack_id
                AND user_id = auth.uid()
            )
            OR auth.role() = 'service_role'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'symbol_references' AND policyname = 'Allow members to read references') THEN
        CREATE POLICY "Allow members to read references"
        ON public.symbol_references
        FOR SELECT
        USING (
            EXISTS (
                SELECT 1 FROM public.pack_members
                WHERE pack_id = symbol_references.pack_id
                AND user_id = auth.uid()
            )
            OR auth.role() = 'service_role'
        );
    END IF;

    -- Write allowed for service_role only
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'symbol_definitions' AND policyname = 'Allow service_role to manage definitions') THEN
        CREATE POLICY "Allow service_role to manage definitions"
        ON public.symbol_definitions
        FOR ALL
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'symbol_references' AND policyname = 'Allow service_role to manage references') THEN
        CREATE POLICY "Allow service_role to manage references"
        ON public.symbol_references
        FOR ALL
        USING (auth.role() = 'service_role')
        WITH CHECK (auth.role() = 'service_role');
    END IF;
END $$;

-- 4. RPCs

-- find_definitions_v1
DROP FUNCTION IF EXISTS public.find_definitions_v1(UUID, TEXT[], INT);
CREATE OR REPLACE FUNCTION public.find_definitions_v1(
    p_pack_id UUID,
    p_symbols TEXT[],
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    chunk_id TEXT,
    path TEXT,
    line_start INT,
    line_end INT,
    symbol TEXT,
    is_redacted BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Authorization: restricted to service_role (Edge Functions)
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: find_definitions_v1 is restricted to service_role.';
    END IF;

    RETURN QUERY
    SELECT 
        sd.chunk_id,
        sd.path,
        sd.line_start,
        sd.line_end,
        sd.symbol,
        kc.is_redacted
    FROM public.symbol_definitions sd
    JOIN public.knowledge_chunks kc ON kc.pack_id = sd.pack_id AND kc.chunk_id = sd.chunk_id
    WHERE sd.pack_id = p_pack_id
      AND sd.symbol = ANY(p_symbols)
      AND kc.is_redacted = false
    ORDER BY sd.symbol, sd.path
    LIMIT LEAST(p_limit, 50);
END;
$$;

-- find_references_v1
DROP FUNCTION IF EXISTS public.find_references_v1(UUID, TEXT, INT);
CREATE OR REPLACE FUNCTION public.find_references_v1(
    p_pack_id UUID,
    p_symbol TEXT,
    p_limit INT DEFAULT 20
)
RETURNS TABLE (
    chunk_id TEXT,
    path TEXT,
    line_start INT,
    line_end INT,
    confidence NUMERIC(4,3),
    is_redacted BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Authorization: restricted to service_role (Edge Functions)
    IF auth.role() != 'service_role' THEN
        RAISE EXCEPTION 'Unauthorized: find_references_v1 is restricted to service_role.';
    END IF;

    RETURN QUERY
    SELECT 
        sr.from_chunk_id AS chunk_id,
        sr.from_path AS path,
        sr.from_line_start AS line_start,
        sr.from_line_end AS line_end,
        sr.confidence,
        kc.is_redacted
    FROM public.symbol_references sr
    JOIN public.knowledge_chunks kc ON kc.pack_id = sr.pack_id AND kc.chunk_id = sr.from_chunk_id
    WHERE sr.pack_id = p_pack_id
      AND sr.symbol = p_symbol
      AND kc.is_redacted = false
    ORDER BY sr.confidence DESC, sr.from_path
    LIMIT LEAST(p_limit, 50);
END;
$$;

-- Revoke public access
REVOKE EXECUTE ON FUNCTION public.find_definitions_v1(UUID, TEXT[], INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_definitions_v1(UUID, TEXT[], INT) TO service_role;

REVOKE EXECUTE ON FUNCTION public.find_references_v1(UUID, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_references_v1(UUID, TEXT, INT) TO service_role;
