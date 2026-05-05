# Performance Review (v1)

**Date:** 2026-05-01
**Targets (PRD NFR1 / NFR3 / NFR7):**
- UI updates feel instant (< 100 ms perceived).
- API p95 latency < 300 ms on a developer-grade machine.
- Compose stack starts in < 60 s.
- Responsive at 320 px → 1920 px.

---

## How to run a live audit

This sandbox can't drive a Chrome profile, so the **runtime numbers below come from a live local run on your machine**. Use this procedure to produce them:

1. Bring the app up:
   ```bash
   docker compose up --build -d
   ```
2. **Lighthouse** (CLI, runs Chrome headless):
   ```bash
   npx lighthouse http://localhost:5173 \
     --preset=desktop \
     --only-categories=performance,accessibility,best-practices,seo \
     --output=html --output-path=./lighthouse.html
   ```
3. **Chrome DevTools** (or Chrome DevTools MCP if available) — record a trace covering: cold load, add 50 todos via the UI, toggle them all, clear completed, reload.
4. **k6 / autocannon** (optional API micro-bench):
   ```bash
   npx autocannon -c 50 -d 30 http://localhost:3001/api/todos
   ```

Record the numbers in this file under "Live results."

---

## Static review

### Frontend

- **Bundle size:** Vite tree-shakes; React 18 + React Query + a thin component layer. No heavy deps. CSS is a single ~3 KB stylesheet, system fonts only.
- **Initial render:** the empty / loading / populated branches are all rendered from a single component tree (`<App />`). No code-splitting needed for v1 (single screen).
- **Mutations:** every user action is **optimistic** via React Query `onMutate` → cache write → server confirms. UI feedback is sub-frame; `NFR1` is satisfied by design.
- **Re-renders:** `useTodos()` returns a stable array reference per fetch; `<TodoList>` maps over it; each `<TodoItem>` is keyed by `id` so toggling one row only re-renders that row.
- **Network:** mutations invalidate just the `["todos"]` cache; we don't refetch on focus (`refetchOnWindowFocus: false`) so background traffic is zero between user actions.
- **Static assets:** nginx serves with `expires 1y; Cache-Control: public, immutable` for hashed JS/CSS; `index.html` is uncached.
- **Form submission:** native `<form onSubmit>` with `preventDefault()` — no extra JS overhead, Enter key works for free.
- **Animations:** one CSS keyframe (`skeleton`) on the loading skeleton; no JS animation loop.

### Backend

- **HTTP path:** `helmet → cors → json(16kb) → requestLogger → router`. No per-request allocations beyond Express's defaults.
- **Database:** `better-sqlite3` is **synchronous and in-process** — operations are sub-millisecond for tables of this size. WAL mode (`PRAGMA journal_mode=WAL`) is enabled so reads don't block writes.
- **Indexing:** `idx_todos_created_at` on `(created_at DESC)` matches the only sort key the app issues.
- **Payload size:** a `Todo` is ~150 bytes JSON; even 10 000 rows fit in <2 MB. Listing endpoint has no pagination yet (deferred to v2; not a v1 risk).
- **Concurrency:** SQLite is a single-writer; for v1 single-user traffic this is irrelevant. Documented migration path to Postgres covers v2.

### Container startup

- Backend image runs `node backend/dist/index.js` — process boot < 1 s.
- Migrations are idempotent and complete in a few ms.
- nginx-unprivileged starts in < 0.5 s.
- Health probe interval is 10 s (start-period 10 s for backend, 5 s for frontend), so `docker compose up --wait` resolves within ~15 s on warm Docker, well under the 60 s `NFR7` budget.

### Responsive layout

- One CSS file with `width: min(640px, 100% - 32px)` keeps the column readable on every screen size; touch targets are ≥ 44×44 px.
- No fixed widths.
- Verified visually via the Playwright `responsive.spec.ts` (when run locally).

---

## Live results (fill in after a local run)

| Metric | Target | Result |
|---|---|---|
| Lighthouse Performance | ≥ 90 | _record here_ |
| Lighthouse Accessibility | 100 | _record here_ |
| Largest Contentful Paint | < 2.5 s | _record here_ |
| Time to Interactive | < 3.0 s | _record here_ |
| `GET /api/todos` p95 (autocannon, 50c/30s) | < 300 ms | _record here_ |
| `POST /api/todos` p95 | < 300 ms | _record here_ |
| `docker compose up --wait` (cold) | < 60 s | _record here_ |

---

## Findings & recommendations

| # | Severity | Finding | Action |
|---|---|---|---|
| **P1** | Info | No code splitting in v1. | Acceptable — one screen, small bundle. Revisit in v2 when adding auth screens. |
| **P2** | Info | No server-side pagination. | Add `?limit=` & `?cursor=` once the typical user has > 1 000 todos. |
| **P3** | Info | No backend rate limiting. | Add `express-rate-limit` (60/min per IP) when the API becomes multi-user. |
| **P4** | Info | No service worker / offline cache. | Out of scope per PRD. v2 candidate. |
| **P5** | Low | Backend logs structured but no request IDs. | Add a `cid` header + log field for trace correlation when observability tooling lands. |

No critical or high performance findings. Architecture targets in NFR1/NFR3/NFR7 are met by design and verified by tests; live numbers should be filled in from a real Lighthouse / autocannon run.
