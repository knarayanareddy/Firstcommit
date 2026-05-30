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

CREATE INDEX IF NOT EXISTS idx_symbol_references_pack_symbol ON public.symbol_references(pack_id, symbol);
CREATE INDEX IF NOT EXISTS idx_symbol_references_pack_source ON public.symbol_references(pack_id, source_id);

-- 3. RLS Policies
ALTER TABLE public.symbol_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symbol_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow members to read definitions" ON public.symbol_definitions FOR SELECT TO authenticated
USING (public.is_pack_member(auth.uid(), pack_id));

CREATE POLICY "Allow service_role to manage definitions" ON public.symbol_definitions FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE POLICY "Allow members to read references" ON public.symbol_references FOR SELECT TO authenticated
USING (public.is_pack_member(auth.uid(), pack_id));

CREATE POLICY "Allow service_role to manage references" ON public.symbol_references FOR ALL TO service_role
USING (true) WITH CHECK (true);