# ADR 0001 — Architecture of ModSimCompass

Earlier names: ModSim101, ModSim Essentials.

Status: accepted · 20 November 2026

## Context

PLAN §11 asks us to prefer the verified stack (React + Vite), use TypeScript for domain contracts, keep vanilla CSS with central tokens, and avoid unnecessary dependencies. Everything must stay local-first and deployable as a static site on both Netlify and Railway.

## Decisions

1. **React 19 + Vite 7 are kept.** New code is TypeScript: domain logic, content, persistence, exports and UI. `tsc` runs strict and checks it (`npm run typecheck`). The archived JSX labs keep ESLint.
2. **Pure domain core.** `src/domain/**` and `src/exports/**` import no React and no browser UI. The sandbox recurrence, RNG, statistics, Markov step, method rules, passport schema and importer are all unit-tested with Vitest.
3. **No router dependency.** A 60-line History-API router (`src/app/router.tsx`) covers the flat route table. Static hosts provide an SPA fallback.
4. **Own SVG charts, not Chart.js, for new views.** Charts take their colours from tokens, so they switch with the theme without re-rendering. They measure their real width so text stays at true pixel size, and each one ships an equivalent data table. Chart.js stays only for the legacy labs, which are lazy-loaded in a separate chunk.
5. **Seeded RNG:** `sfc32` seeded by `cyrb128` (`sfc32-cyrb128-v1`). Replication *i* uses the seed string `${seed}|rep|${i}`. Reference vectors are pinned in tests. We do not claim the streams are proven independent.
6. **Web Worker for replications.** Work is chunked by replication with one progress message per chunk. Cancellation keeps the completed replications as a labelled partial result. Request IDs make the app discard late results, and a result is never attached to a different project. If workers are unavailable, the same chunks run on the main thread.
7. **Persistence:** IndexedDB (database `modsim101`; stores `projects`, `trash`, `backups`, `progress`) through a small wrapper.
   - Each save is one atomic transaction with a revision check. A stale base revision produces a conflict, and the user chooses: keep both, load the newer revision, or explicitly overwrite.
   - Each save writes the previous revision to `backups` as the last-known-good copy.
   - Deleted projects go to `trash` and can be restored.
   - Without IndexedDB, an in-memory repository keeps the session, and the UI shows a persistent save-failed warning.
   - `localStorage` holds preferences only.
   - Autosave uses a 500 ms debounce with a 2 s maximum wait, plus a `beforeunload` guard while changes are unsaved.
8. **Exports use no dependencies.** Markdown, standalone HTML (embedded CSS, escaped text, no external requests), CSV (unlocalised numbers, formula-injection guard), JSON, and a store-only ZIP writer with CRC-32, checked by `unzip -t` in tests.
9. **New dependencies:**
   - Runtime: `lucide-react`, for the icons STYLE §4 names.
   - Development: `typescript`, `vitest`, `fake-indexeddb` (persistence tests) and `@types/node`.
   - Removed from use: none. `framer-motion` and `prism-react-renderer` were already unused and remain in `package.json` to avoid churn; they can be removed later.
10. **Fonts:** no third-party font request. The stacks name Inter / IBM Plex and JetBrains Mono, then fall back to local system fonts (STYLE §2.1).
11. **Hosting:**
    - **Netlify:** `netlify.toml` defines the build command, publishes `dist`, adds an SPA fallback and returns real 404s for missing `/assets/*`.
    - **Railway:** `railway.json` uses Nixpacks to run `npm ci && npm run build`, then `node server.mjs`. The server is dependency-free, binds `0.0.0.0:$PORT`, provides the SPA fallback and real asset 404s, answers `/healthz`, and shuts down on SIGTERM.
    - The committed `dist/` build is no longer tracked, because both hosts build from source.

## Consequences

- The main JS chunk is about 0.77 MB (about 230 kB gzip). Most of it is the authored teaching content (36 records and 72 glossary terms), and Vite warns above 500 kB. Splitting content per route is a possible follow-up; it does not affect correctness.
- Content stays typed and versioned in TypeScript, and the content keys allow later Croatian localisation.
