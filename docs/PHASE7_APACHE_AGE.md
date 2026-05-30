# Phase 7 (optional/experimental) — Apache AGE graph

The native knowledge graph uses array-overlap heuristics over `symbol_definitions` /
`symbol_references`. Apache AGE adds a real openCypher graph **inside the same Postgres**
(coexists with pgvector), enabling richer multi-hop traversal — without leaving the DB or
changing the interaction schema.

## How it's wired (schema-preserving)
- `detective-retrieval.ts` now resolves traversal RPC names through `kgFn()`:
  `KG_ENGINE=age` → `*_age` variants; default `native` → unchanged. Same call sites, same
  signatures, same return shape, same `[SOURCE]`/span contract.
- The AGE graph + `*_age` RPCs are provided as an **opt-in manual script**
  (`scripts/enable-age-graph.sql`), NOT an auto-migration (AGE isn't universally installed;
  a `CREATE EXTENSION age` in migrations would break `supabase db reset`).

## Enable
```bash
# on an AGE-enabled Postgres 15/16:
psql "$DB_URL" -f scripts/enable-age-graph.sql
psql "$DB_URL" -c "SELECT public.sync_age_graph('<pack-uuid>');"   # after ingestion
# edge runtime:
KG_ENGINE=age
```

## Status — EXPERIMENTAL
This ships the wiring + graph schema + a worked `definition_search_v1_age`. The remaining
`*_age` variants (`find_references_v1_age`, `kg_expand_v1_age`) follow the same pattern and
must be validated on a live AGE instance (not available in the build sandbox). Until then,
leave `KG_ENGINE` unset (native default). Treat this as a feature branch to validate, not a
production default.

## Why not Graphiti / Microsoft GraphRAG / LlamaIndex
They impose external orchestration/storage and would break the Postgres-native, schema-
preserving constraint. AGE keeps everything in the DB you already run.
