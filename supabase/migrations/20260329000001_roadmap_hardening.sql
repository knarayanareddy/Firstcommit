-- YYYYMMDDHHMMSS_roadmap_hardening.sql
-- Roadmap Hardening: Indexes, Cycle Prevention, and Status Validation

-- 1) INDEXES FOR PERFORMANCE
-- playlist_assignments
CREATE INDEX IF NOT EXISTS idx_playlist_assignments_pack_learner_status 
ON public.playlist_assignments(pack_id, learner_user_id, status);

-- playlist_items
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_sort 
ON public.playlist_items(playlist_id, sort_order);

-- playlist_item_progress
CREATE INDEX IF NOT EXISTS idx_playlist_item_progress_assignment_status 
ON public.playlist_item_progress(assignment_id, status);

CREATE INDEX IF NOT EXISTS idx_playlist_item_progress_learner_last_event 
ON public.playlist_item_progress(learner_user_id, last_event_at DESC);

-- playlist_item_dependencies
CREATE INDEX IF NOT EXISTS idx_playlist_item_deps_depends_on 
ON public.playlist_item_dependencies(depends_on_item_id);

CREATE INDEX IF NOT EXISTS idx_playlist_item_deps_item 
ON public.playlist_item_dependencies(item_id);


-- 2) DEPENDENCY INTEGRITY + CYCLE PREVENTION
CREATE OR REPLACE FUNCTION public.check_roadmap_dependency_cycle()
RETURNS TRIGGER AS $$
DECLARE
    found_cycle BOOLEAN;
BEGIN
    -- 2.1 Prevent self-dependency
    IF NEW.item_id = NEW.depends_on_item_id THEN
        RAISE EXCEPTION 'An item cannot depend on itself.';
    END IF;

    -- 2.2 Prevent cross-playlist dependency
    -- Ensure both items belong to the same playlist
    IF EXISTS (
        SELECT 1 
        FROM public.playlist_items i1, public.playlist_items i2
        WHERE i1.id = NEW.item_id 
        AND i2.id = NEW.depends_on_item_id
        AND i1.playlist_id != i2.playlist_id
    ) THEN
        RAISE EXCEPTION 'Dependencies must be between items in the same playlist.';
    END IF;

    -- 2.3 Prevent cycles using a recursive CTE
    WITH RECURSIVE dependency_chain AS (
        -- Start with the item we are about to depend on
        SELECT depends_on_item_id
        FROM public.playlist_item_dependencies
        WHERE item_id = NEW.depends_on_item_id
        
        UNION ALL
        
        -- Follow the chain upwards
        SELECT d.depends_on_item_id
        FROM public.playlist_item_dependencies d
        INNER JOIN dependency_chain dc ON d.item_id = dc.depends_on_item_id
    )
    SELECT EXISTS (
        SELECT 1 FROM dependency_chain WHERE depends_on_item_id = NEW.item_id
    ) INTO found_cycle;

    IF found_cycle THEN
        RAISE EXCEPTION 'Circular dependency detected in roadmap.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_playlist_item_deps_cycle_prevention
BEFORE INSERT OR UPDATE ON public.playlist_item_dependencies
FOR EACH ROW EXECUTE FUNCTION public.check_roadmap_dependency_cycle();


-- 3) STATUS TRANSITION VALIDATION
-- Enforces allowed status paths
CREATE OR REPLACE FUNCTION public.validate_roadmap_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle the Case: New row insertion
    IF TG_OP = 'INSERT' THEN
        -- Initial status must be valid
        IF NEW.status NOT IN ('blocked', 'available', 'skipped', 'in_progress', 'done') THEN
            RAISE EXCEPTION 'Invalid initial status: %', NEW.status;
        END IF;
        RETURN NEW;
    END IF;

    -- Handle the Case: Update
    -- If status hasn't changed, allow it (e.g. updating progress_metadata)
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Transition rules:
    -- blocked -> available (handled by view usually, but if manual progress exists)
    IF OLD.status = 'blocked' AND NEW.status != 'available' THEN
        RAISE EXCEPTION 'Blocked items can only transition to available.';
    END IF;

    -- available -> in_progress | skipped | done
    IF OLD.status = 'available' AND NEW.status NOT IN ('in_progress', 'skipped', 'done') THEN
        RAISE EXCEPTION 'Available items cannot transition to %.', NEW.status;
    END IF;

    -- in_progress -> done | skipped
    IF OLD.status = 'in_progress' AND NEW.status NOT IN ('done', 'skipped') THEN
        RAISE EXCEPTION 'In-progress items cannot transition to %.', NEW.status;
    END IF;

    -- done stays done
    IF OLD.status = 'done' THEN
        RAISE EXCEPTION 'Completed items cannot be changed.';
    END IF;

    -- skipped can move back to available or in_progress if allowed
    IF OLD.status = 'skipped' AND NEW.status NOT IN ('available', 'in_progress') THEN
         RAISE EXCEPTION 'Skipped items can only be moved back to available or in-progress.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_playlist_item_progress_status_validation
BEFORE INSERT OR UPDATE ON public.playlist_item_progress
FOR EACH ROW EXECUTE FUNCTION public.validate_roadmap_status_transition();
