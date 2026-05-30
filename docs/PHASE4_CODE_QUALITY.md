# Phase 4 — Code quality & maintainability

Build-preserving wins (no behavior change to features):

- **Route-level code splitting**: all ~40 page routes are now `React.lazy` + `<Suspense>`,
  instead of 40 eager imports in one chunk — large initial-bundle win.
- **Top-level error boundary** (`src/components/ErrorBoundary.tsx`): the app had ZERO
  boundaries; any render error blanked the whole tree. Now contained with a recovery action.
- **Sane TanStack Query defaults**: `staleTime` was 0 (refetch on every navigation). Now
  `staleTime 60s`, `gcTime 5m`, `retry 2`, `refetchOnWindowFocus off`.
- **Opt-in strict TypeScript**: `tsconfig.strict.json` + `npm run typecheck:strict` to drive
  the 356-`any` cleanup incrementally WITHOUT breaking the current build (main tsconfig
  unchanged). Promote flags into `tsconfig.app.json` as areas are fixed.
- **Dead code removed**: `src/App.tsx.bak`.

## Deferred (need a local TS/Deno compiler to do safely — documented, not blind-edited)
- **Split the 4,231-line `ai-task-router/index.ts`** into per-task handler modules. Map:
  `handlers/{chat,global_chat,module_planner,generate_module,generate_quiz,generate_glossary,
  generate_paths,generate_ask_lead,refine_module,simplify_section,create_template,
  refine_template,generate_exercises,verify_exercise}.ts` + `shared/{prompts,ai-call,
  config,metrics}.ts`, keeping the same dispatch switch + exported contract. Extract the
  `EvidenceSpan` type to a `types.ts` so `verifier.ts`/`faithfulness.ts` stop importing
  `index.ts` (unblocks their unit tests + the Phase 3 faithfulness wiring).
- **Decompose `ModuleView.tsx` (1,485 lines)** into tab sub-components.
- **xlsx@0.18.5 (CVE-2023-30533)**: swap the dynamic import in `file-extractors.ts` for the
  maintained CDN build (`https://cdn.sheetjs.com/xlsx-latest/...`) or migrate to `exceljs`;
  add `npm audit`/osv-scan in CI (Phase 5).
- **Single package manager**: keep `package-lock.json`, remove `bun.lock*`, CI uses `npm ci`
  (handled in Phase 5 CI changes).
