-- Migration: 20260320162800_pack_docs_v1.sql
-- Description: Core tables and RLS for Docs in Platform v1

--------------------------------------------------------------------------------
-- 1) pack_docs
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pack_docs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_id UUID NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NULL,
    content_plain TEXT NOT NULL,
    content_render TEXT NULL,
    format TEXT NOT NULL DEFAULT 'txt' CHECK (format IN ('txt', 'md')),
    source_path TEXT NULL,
    source_type TEXT NOT NULL DEFAULT 'repo_import',
    version INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    tags TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
    category TEXT NULL,
    owner_user_id UUID NULL REFERENCES auth.users(id),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (pack_id, slug)
);

CREATE INDEX ON public.pack_docs(pack_id, updated_at DESC);
CREATE INDEX pack_docs_tags_idx ON public.pack_docs USING GIN (tags);

ALTER TABLE public.pack_docs ENABLE ROW LEVEL SECURITY;

-- SELECT: pack members can read published docs
CREATE POLICY "Pack members can view published docs" ON public.pack_docs
    FOR SELECT TO authenticated
    USING (
        status = 'published' AND
        is_pack_member(auth.uid(), pack_id)
    );

-- SELECT: authors can read all docs (including drafts)
CREATE POLICY "Authors can view all docs" ON public.pack_docs
    FOR SELECT TO authenticated
    USING (
        has_pack_access(auth.uid(), pack_id, 'author')
    );

-- INSERT/UPDATE/DELETE: authors only
CREATE POLICY "Authors can insert docs" ON public.pack_docs
    FOR INSERT TO authenticated
    WITH CHECK (has_pack_access(auth.uid(), pack_id, 'author'));

CREATE POLICY "Authors can update docs" ON public.pack_docs
    FOR UPDATE TO authenticated
    USING (has_pack_access(auth.uid(), pack_id, 'author'));

CREATE POLICY "Authors can delete docs" ON public.pack_docs
    FOR DELETE TO authenticated
    USING (has_pack_access(auth.uid(), pack_id, 'author'));


--------------------------------------------------------------------------------
-- 2) pack_doc_blocks
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pack_doc_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID NOT NULL REFERENCES public.pack_docs(id) ON DELETE CASCADE,
    block_order INT NOT NULL,
    block_type TEXT NOT NULL CHECK (block_type IN ('heading','paragraph','callout','checklist','code','mermaid','table','link','divider')),
    payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON public.pack_doc_blocks(doc_id, block_order);

ALTER TABLE public.pack_doc_blocks ENABLE ROW LEVEL SECURITY;

-- Because RLS cannot easily do JOINs without performance hits or infinite recursion, 
-- we map the policy by joining pack_docs to get the pack_id.
CREATE POLICY "Pack members can view blocks for published docs" ON public.pack_doc_blocks
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.pack_docs d
            WHERE d.id = pack_doc_blocks.doc_id
              AND d.status = 'published'
              AND is_pack_member(auth.uid(), d.pack_id)
        )
    );

CREATE POLICY "Authors can view all blocks" ON public.pack_doc_blocks
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.pack_docs d
            WHERE d.id = pack_doc_blocks.doc_id
              AND has_pack_access(auth.uid(), d.pack_id, 'author')
        )
    );

CREATE POLICY "Authors can insert blocks" ON public.pack_doc_blocks
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.pack_docs d
            WHERE d.id = doc_id
              AND has_pack_access(auth.uid(), d.pack_id, 'author')
        )
    );

CREATE POLICY "Authors can update blocks" ON public.pack_doc_blocks
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.pack_docs d
            WHERE d.id = pack_doc_blocks.doc_id
              AND has_pack_access(auth.uid(), d.pack_id, 'author')
        )
    );

CREATE POLICY "Authors can delete blocks" ON public.pack_doc_blocks
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.pack_docs d
            WHERE d.id = pack_doc_blocks.doc_id
              AND has_pack_access(auth.uid(), d.pack_id, 'author')
        )
    );


--------------------------------------------------------------------------------
-- 3) pack_doc_progress
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pack_doc_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID NOT NULL REFERENCES public.pack_docs(id) ON DELETE CASCADE,
    pack_id UUID NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'done')),
    last_viewed_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    checklist_state JSONB NOT NULL DEFAULT '{}'::JSONB,
    notes TEXT NULL,
    UNIQUE (doc_id, user_id)
);

CREATE INDEX ON public.pack_doc_progress(pack_id, user_id);

ALTER TABLE public.pack_doc_progress ENABLE ROW LEVEL SECURITY;

-- Users can manage their own progress
CREATE POLICY "Users can view their own doc progress" ON public.pack_doc_progress
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own doc progress" ON public.pack_doc_progress
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own doc progress" ON public.pack_doc_progress
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own doc progress" ON public.pack_doc_progress
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- Authors can view progress for packs they manage
CREATE POLICY "Authors can view progress for their packs" ON public.pack_doc_progress
    FOR SELECT TO authenticated
    USING (has_pack_access(auth.uid(), pack_id, 'author'));


--------------------------------------------------------------------------------
-- 4) pack_doc_edges
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pack_doc_edges (
    from_doc_id UUID NOT NULL REFERENCES public.pack_docs(id) ON DELETE CASCADE,
    to_doc_id UUID NOT NULL REFERENCES public.pack_docs(id) ON DELETE CASCADE,
    edge_type TEXT NOT NULL DEFAULT 'references' CHECK (edge_type IN ('references', 'prerequisite', 'related')),
    PRIMARY KEY (from_doc_id, to_doc_id, edge_type)
);

ALTER TABLE public.pack_doc_edges ENABLE ROW LEVEL SECURITY;

-- Readable by pack members
CREATE POLICY "Pack members can view doc edges" ON public.pack_doc_edges
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.pack_docs d
            WHERE d.id = from_doc_id 
              AND is_pack_member(auth.uid(), d.pack_id)
        )
    );

-- Writable by authors
CREATE POLICY "Authors can edit doc edges" ON public.pack_doc_edges
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.pack_docs d
            WHERE d.id = from_doc_id 
              AND has_pack_access(auth.uid(), d.pack_id, 'author')
        )
    );


--------------------------------------------------------------------------------
-- Triggers
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pack_docs_modtime BEFORE UPDATE ON public.pack_docs FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_pack_doc_blocks_modtime BEFORE UPDATE ON public.pack_doc_blocks FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
