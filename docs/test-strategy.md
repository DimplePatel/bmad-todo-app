# Todo App — Test Strategy

**First written:** 2026-05-01
**Last refreshed:** 2026-05-12 — corrects stale claims, adds POM architecture + caught-bug log, removes aspirational items that were never wired, reflects CI + NFR7 `.env` self-provisioning
**Author:** BMAD QA persona (in collaboration with Architect)
**Status:** v1.1 — applies to v1 release

This document defines the overall testing approach across unit, integration, and E2E layers, the tooling, the coverage gates, and a traceability matrix from PRD requirements to story-level tests. Per-story scenarios live in each `docs/stories/*.md` file.

Every claim below is backed by a grep of the current code; the commands are listed in §10 so anyone can re-verify after a change.

---

## 1. Testing Pyramid

```
                       /\
                      /E2\        ← Playwright (mandatory, serial)
                     /----\          smoke, happy-path, filter-persistence,
                    / Int  \         undo-delete, error-rollback (500 + 404),
                   /--------\        delete-to-empty, responsive (5 viewports),
                  /  Unit    \         a11y (axe + keyboard)
                 /____________\   ← Vitest (backend + frontend)
```

Headline counts:

| Layer | Tool | Files | Cases |
|---|---|---:|---:|
| Backend unit | Vitest | 3 | 25 |
| Backend integration | Vitest + Supertest | 3 | 32 |
| Frontend (unit + integration) | Vitest + RTL + MSW | 11 | 53 |
| E2E (real browser) | Playwright + axe-playwright | 8 | 19 |
| **Total** | — | **25** | **129** |

Per-test → PRD requirement mapping lives in §11 of this document.

Source-code coverage numbers (per-file %s, remaining gaps, how to regenerate) live in [`docs/qa/coverage.md`](qa/coverage.md). Headline: **90.28% frontend lines** measured, **≥ 80% backend lines** enforced by `backend/vitest.config.ts` + CI.

---

## 2. Tooling

| Concern | Tool | Why |
|---|---|---|
| Test runner (both workspaces) | **Vitest** | Fast, ESM-native, TypeScript out of the box, same DX in both workspaces |
| Coverage | **`@vitest/coverage-v8`** | V8 native coverage, low overhead |
| HTTP integration (backend) | **Supertest** | In-process Express testing without a port; tests run against the real Express app, real middleware chain, real repository + temp SQLite file |
| Frontend rendering | **React Testing Library** | A11y-first queries (roles/names) align with our accessibility goals |
| HTTP mocking (frontend tests) | **MSW** | Realistic mocking at the network layer; the same handlers can be used in Node tests and (if we ever want it) in the browser |
| E2E | **Playwright** | First-class TS support, axe integration, video/screenshot artifacts, deterministic locators |
| E2E accessibility | **axe-playwright** | Runs axe-core inside the page during E2E; the toughest WCAG rules (color contrast, ARIA validity) are checked here |
| E2E architecture | **POM + fixtures** | `e2e/pages/TodoPage.ts` + `e2e/tests/_fixtures.ts` — see §6 |
| Locator hierarchy | **role > label > data-testid > CSS** | Playwright's recommended ordering; CSS only as last resort. `data-testid` on `EmptyState`, `TodoInput`'s error, `Footer`'s counter |
| Agent debug (optional) | **Playwright MCP** | Live browser-driving channel for Claude during failure triage — structured aria-snapshots, click/type/inspect, network introspection. Not part of the regression suite or CI; the e2e gate above remains the source of truth. See `docs/ai-integration-log.md` §2 for the comparison. |

---

## 3. Test Data & Isolation Rules

1. **No shared state across tests.** Every backend test that touches the DB uses a fresh temp file under `/tmp/todo-test-*/`, created in `beforeEach` and torn down in `afterEach`. Implemented by `backend/tests/helpers.ts:createTestContext()`.
2. **Frontend tests never call the real backend.** All HTTP is intercepted via MSW handlers in `frontend/src/test/server.ts`. The store starts empty unless explicitly seeded with `resetStore(...)`.
3. **E2E tests reset state in `beforeEach`** via `resetServerState(request)` (`e2e/tests/_helpers.ts`):
   1. `GET /api/todos`
   2. For each todo, `PATCH /api/todos/:id { completed: true }`
   3. `DELETE /api/todos?completed=true`

   This works because the bulk-delete endpoint only takes completed rows, and we don't have a "delete all" endpoint (it was deliberately not built). Trade-off: O(n) PATCH calls per reset, but for v1 there are never more than a handful of leftover rows.
4. **E2E tests run serially** (`fullyParallel: false`, `workers: 1` in `playwright.config.ts`) because v1 has no per-user data isolation. Concurrent tests against a single SQLite backend race on the shared store. When v2 adds auth + per-user partitioning, this can flip back to parallel.
5. **Time control.** `vi.useFakeTimers()` for tests that exercise time-sensitive logic (toast auto-dismiss, 5-second undo timer in `pendingDeletes`). Real timers are used in the E2E `undo-delete` spec because fake timers + React Query's microtask flush are unreliable in JSDOM (this gap is one of the documented misses in `docs/ai-integration-log.md` D5).

---

## 4. CI Flow

GitHub Actions workflow: [`.github/workflows/test.yml`](../.github/workflows/test.yml). Runs on every push to `main` and on every PR. Two jobs run in parallel — neither depends on the other, which keeps total wall-clock time short:

```
┌─────────────────────────────────────────────┐       ┌────────────────────────────┐
│ test  (runs-on: ubuntu-latest, ≤ 15 min)    │       │ nfr7  (runs-on: ubuntu-    │
│                                              │       │       latest, ≤ 3 min)     │
│  1. checkout + Node 20 + npm ci             │       │                            │
│  2. eslint                                   │       │  bash scripts/             │
│  3. tsc --noEmit  (backend / frontend / e2e)│       │    test-compose-up-time.sh │
│  4. vitest --coverage  (backend → GATE)     │       │                            │
│  5. vitest --coverage  (frontend, measured) │       │  docker compose up --build │
│  6. playwright install --with-deps chromium │       │    --wait --wait-timeout 60│
│     (cached at ~/.cache/ms-playwright)      │       │                            │
│  7. npm run e2e   (Playwright Chromium)     │       │  Self-provisions .env from │
│  8. upload playwright-report (7d retention) │       │    .env.example if missing │
│  9. upload coverage-reports (7d retention)  │       │                            │
└─────────────────────────────────────────────┘       └────────────────────────────┘
```

A failure at any step fails the build. Coverage thresholds in `backend/vitest.config.ts` (≥ 80% lines / functions / statements, ≥ 75% branches) trip on every `--coverage` run — closing **NFR6**. The `nfr7` job closes **NFR7** by failing if `docker compose up --wait` doesn't reach healthy within 60 s.

**Notes for anyone extending the workflow:**

- `better-sqlite3` is a native module. GitHub Actions' `ubuntu-latest` has a working compiler out of the box; other runners may need `node-gyp`'s build deps or network access to fetch prebuilt binaries.
- Playwright pulls ~250 MB of browser binaries on first install. The workflow caches them by `~/.cache/ms-playwright` keyed on `package-lock.json`.
- The `nfr7` job runs in parallel with `test`, in a separate runner, because both compete for ports/Docker on a single runner. If you want to merge them, run the NFR7 check **after** the Playwright step (Playwright's `webServer` ties up 5173/3001).

---

## 5. Traceability Matrix

Every PRD requirement traces to at least one test scenario. Reading: **U** = unit, **I** = integration, **E2E** = end-to-end.

### Functional requirements

| Req | Description | Covered by |
|---|---|---|
| FR1 | Add a todo | Backend `todos.test.ts` (I), frontend `App.test.tsx` (U/I), E2E `happy-path`, `delete-to-empty`, `filter-persistence` |
| FR2 | Reject empty title | Backend `schema.test.ts` (U), `todos.test.ts` (I), frontend `App.test.tsx` |
| FR3 | List todos newest-first | Backend `repository.test.ts` (U), `todos.test.ts` (I); implicitly E2E |
| FR4 | Toggle completion | Backend `todos.test.ts` (I), frontend `App.test.tsx` (U/I), E2E `happy-path` |
| FR5 | Visual differentiation of completed | Frontend `TodoItem.test.tsx` "visual differentiation (FR5)" pins the `is-completed` class flip at unit level; E2E `a11y.spec.ts` populated-list axe scan caught the original color-contrast bug |
| FR6 | Delete with undo | Frontend `TodoItem.test.tsx` (U, undo-within-window), E2E `undo-delete` (both branches incl. 5 s elapsed) |
| FR7 | Filter with localStorage persistence | Frontend `filterStore.test.ts` + `Filters.test.tsx` (U), E2E `filter-persistence` |
| FR8 | Clear completed | Backend `todos.test.ts` (I), frontend `mutations.test.tsx` (U/I 500-rollback), E2E `happy-path` |
| FR9 | Empty state | Frontend `App.test.tsx` (U), E2E `delete-to-empty`, `a11y` empty-state |
| FR10 | Loading state on initial fetch | Frontend `App.test.tsx` |
| FR11 | Non-blocking error toast + retry + rollback | Frontend `mutations.test.tsx` (U/I 500 + 404 toggle), E2E `error-rollback` (500 on create + 404 on toggle) |
| FR12 | REST API for CRUD + bulk delete | Backend `todos.test.ts` (I, 27 cases covering every method × path combination, plus B5 oversized body, B2 race, no-op PATCH, combined-field PATCH, helmet headers, and CORS allowlist — see §11.2 for the per-test breakdown) |
| FR13 | Input validation + structured errors | Backend `schema.test.ts` (U, 9 cases), `todos.test.ts` (I, every 400 path), `health.test.ts` (notFoundHandler) |
| FR14 | Persistent SQLite on volume | Backend `persistence.test.ts` (I — boot, write, dispose, re-boot, read) |
| FR15 | Items-left counter | Frontend `Footer.test.tsx` (U), E2E `happy-path` |

### Non-functional requirements

| Req | Description | Covered by | Notes |
|---|---|---|---|
| NFR1 | Optimistic UI < 100 ms | Frontend `mutations.test.tsx` (I, rollback verifies optimism is wired) | Not directly measured; verified by behaviour |
| NFR2 | Durability across restart | `persistence.test.ts` (I) | Real test that disposes the app and rebuilds against the same DB file |
| NFR3 | Responsive 320–1920 px | E2E `responsive.spec.ts` — 5 viewports, each asserts no horizontal scroll + axe-clean | Closes Story E4.S1's Verification step |
| NFR4 | A11y WCAG 2.1 AA | E2E `a11y.spec.ts` (7 axe scans + keyboard-reachable), frontend `App.test.tsx` explicit tab-order test, plus role/name queries across frontend unit tests | Confirmed real-bug catcher: the `--completed` color-contrast violation. Story E4.S2 I1 (explicit Tab-order sweep) is now covered. |
| NFR5 | Maintainability (TS strict, lint) | All tests typed; `tsc --noEmit` clean across all 3 workspaces | Strict mode + `exactOptionalPropertyTypes` caught the `UpdateTodoBody` controller bug at compile time |
| NFR6 | Coverage ≥ 80% backend | `backend/vitest.config.ts` thresholds + **enforced in CI** via `.github/workflows/test.yml`; frontend at ~89% (measured, not gated) | Backend gate trips on every CI run; frontend is monitored |
| NFR7 | Compose-up < 60 s | `scripts/test-compose-up-time.sh` — invokes `docker compose up --wait --wait-timeout 60`, times the wall-clock, fails if exceeded. Self-provisions `.env` from `.env.example` if missing (and removes it again on cleanup). Run with `npm run test:nfr7` | **Wired in CI** — `.github/workflows/test.yml` runs it in the `nfr7` job on every push |
| NFR8 | Extensible for `userId` | Repository signature passes opaque options; documented in architecture §5.4 | No test; verified by code review |
| NFR9 | Security baseline | Backend `todos.test.ts` "helmet headers" case (I); CORS prod guard in `config.test.ts` (U); structured greps in `docs/qa/security-review.md` | |
| NFR10 | Structured request logs | `health.test.ts` (I) "requestLogger (NFR10) > emits exactly one JSON line per request with required fields" — spies on `process.stdout.write`, asserts shape: `{ts, level, method, path, status, duration_ms}`. | |

---

## 6. POM Architecture (E2E)

Tests live in `e2e/tests/*.spec.ts`. They import a single fixture and don't reach into low-level locators directly.

```
e2e/
├── pages/
│   └── TodoPage.ts         # POM: TodoPage + TodoRow classes
└── tests/
    ├── _fixtures.ts        # extended test() with auto-provided todoPage
    ├── _helpers.ts         # resetServerState only
    └── *.spec.ts
```

### Philosophy

- **POM exposes locators and intent-named actions.** No assertions inside the POM (those live in specs).
- **`goto()` and `addTodo()` perform synchronization-style waits.** These look like assertions but they're action contracts: when the method returns, the post-condition is true (page loaded, row reconciled to a server ID). Tests don't need to re-verify them.
- **Row-scoped locators survive state changes.** `TodoRow` matches `<li>` by visible text via `getByRole("listitem").filter({ hasText: title })`, so the locator still resolves after the row's `aria-label` flips between "...as complete" and "...as active".
- **`addTodo()` waits for cache reconciliation.** After the optimistic temp-id row is created, React Query's `onSuccess` swaps it for the server-issued UUID-keyed row. `addTodo` waits for `input[type="checkbox"][id^="cb-temp-"]` to disappear from the DOM before returning. Without this, subsequent actions (toggle, delete) capture the temp ID and 404 against the server.

### Locator hierarchy

```
1. role + name        (getByRole, getByLabel, getByPlaceholder)
2. data-testid        (getByTestId — for elements without strong semantic identity
                       or where role/name would be ambiguous)
3. CSS classes        (avoided)
```

The shift from CSS to testid happened on 2026-05-11; three elements got `data-testid`: `empty-state`, `input-error`, `items-left`. Each was previously identified via `.class` or `getByText(/.../)`.

---

## 7. What the test suite has actually caught

Real bugs the test layers have found, with the layer that caught them. This is the answer to "are we getting our money's worth from the tests?"

| Layer | Bug | Where it surfaced |
|---|---|---|
| TypeScript strict (`tsc --noEmit`) | `service.update(id, parsed)` failed under `exactOptionalPropertyTypes: true` — Zod's `string \| undefined` didn't fit the service signature | Build time, in CI-equivalent type-check |
| E2E axe (`a11y.spec.ts`, populated list) | `.is-completed .todo-title` color contrast 2.5:1 on `#f7f7f8` background — well below WCAG AA 4.5:1 | First real Playwright run after color choice |
| E2E undo-delete | **Real product bug.** `TodoItem.onDeleteClick` scheduled `setTimeout(remove, 5000)` and stored the handle in component state; the optimistic cache filter unmounted the row, `useEffect` cleanup cleared the timer, and the DELETE never fired. The bug was discovered when the test "undo-me deletion sticks after reload" failed reliably. | After multiple wrong hypotheses (parallelism, locator staleness), traced via the unmount lifecycle. Fixed by moving timer state into a module-level `pendingDeletes` registry. See `docs/ai-integration-log.md` D12. |
| Production Docker container | `@todo/shared` shipped its `main` as a `.ts` file; Node 20 ESM loader refused to load it in production (`ERR_UNKNOWN_FILE_EXTENSION`). Dev (Vite/tsx) handled it transparently. | First `docker compose up --build` — backend container was unhealthy on startup |
| Dockerfile review | `npm ci || npm install` fallback silently masked lockfile drift; production runtime re-installed deps from `package.json` ranges instead of the lockfile | Static review during Step 3 optimisation pass |

Things the suite did **not** catch (yet) — see "Gaps" in §9.

---

## 8. What "good" looks like

- A new contributor can clone, run `npm install && npm test --workspaces && npm run e2e`, and see a green build in under 5 minutes locally.
- Each PR includes the story ID(s) it touches and the new/updated test scenarios; the PR template (`.github/PULL_REQUEST_TEMPLATE.md`) already prompts for both.
- The Playwright HTML report (uploaded as a CI artifact when CI lands) makes failures self-explanatory via screenshots + traces.
- Coverage is enforced where it matters: backend gate trips on `--coverage` runs at 80% lines. Frontend is monitored but not gated.

---

## 9. Out of scope for v1 testing — and known gaps

**Out of scope by design:**
- Load / performance benchmarking beyond an autocannon smoke (recorded in `docs/qa/performance.md`).
- Cross-browser matrix beyond Chromium. Playwright supports Firefox/WebKit; defer until v2 if needed.
- Visual regression beyond axe + Lighthouse screenshots.
- Mutation testing.
- Real screen-reader (NVDA / VoiceOver) verification.

**Known gaps (would be worth closing for a defensible v1 ship):**
- **No write-path API benchmark.** Autocannon was run only against `GET /api/todos`. `POST/PATCH/DELETE` haven't been benched — relevant once write contention on SQLite's single-writer model is possible.

**Recently closed:**
- ~~NFR3 (Responsive 320–1920 px) has no automated test~~ — closed by `e2e/tests/responsive.spec.ts` (5 viewports, no-overflow + axe at each).
- ~~Explicit Tab-order test for NFR4 / E4.S2 I1~~ — closed by the tab-order test in `frontend/src/__tests__/App.test.tsx`.
- ~~CI is not wired~~ — closed by `.github/workflows/test.yml` (test + nfr7 jobs).
- ~~Backend coverage gate isn't enforced in CI~~ — closed; the CI runs `npm test --workspace=backend -- --coverage` which trips the thresholds in `backend/vitest.config.ts`.

---

## 10. Method (so this strategy stays accurate)

Re-run these from the repo root after any test-related change. If a number in §1 or §5 changes, refresh this document.

```bash
# Test file inventory
find backend/tests frontend/src/__tests__ e2e/tests \
  \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.spec.ts' \) | sort

# Per-file case counts (unit + integration)
for f in $(find backend/tests frontend/src/__tests__ \
  -name '*.test.ts' -o -name '*.test.tsx'); do
  echo "$(grep -cE '^\s+(it|test)\(' "$f")  $f"
done

# E2E case counts
grep -hE '^(\s*)?test\(' e2e/tests/*.spec.ts | wc -l

# Playwright parallelism / retry config
grep -E 'fullyParallel|workers|retries' e2e/playwright.config.ts

# Backend coverage thresholds
grep -A4 'thresholds' backend/vitest.config.ts

# CI presence
ls -la .github/workflows .gitlab-ci.yml .circleci 2>&1 | head
```

If a teammate adds a new test, the case counts in §1 **and the per-test mapping in §11** should be updated. If a teammate adds a CI workflow, §4's "no CI is wired" note should be removed.

---

## 11. Test-by-test traceability

§5 is the forward map: PRD requirement → which test files cover it. §11 is the **inverse**: every individual test case → which PRD requirement(s) it verifies. Reading order is layer (backend → frontend → E2E) then file, then describe-block.

The PRD requirement IDs referenced below are defined in [`docs/prd.md`](../docs/prd.md) §2:

- **FR1**–**FR15**: functional requirements (add/complete/delete/filter/etc.)
- **NFR1**–**NFR10**: non-functional (perf, durability, a11y, security, etc.)

Some tests are flagged "Defensive" or "Plumbing" — they verify implementation invariants that protect a requirement rather than testing the requirement directly (e.g., `pendingDeletes` is plumbing for FR6).

### 11.1 Backend — unit

#### `backend/tests/unit/config.test.ts` — 5 cases

| Test | Requirements |
|---|---|
| `loadConfig > returns defaults when env is empty` | NFR5 |
| `loadConfig > parses CORS_ORIGIN as a comma-separated allowlist` | NFR9 |
| `loadConfig > rejects '*' in production` | NFR9 |
| `loadConfig > rejects empty CORS_ORIGIN in production (B1)` | NFR9 |
| `loadConfig > rejects invalid PORT` | NFR5, NFR9 |

#### `backend/tests/unit/schema.test.ts` — 9 cases

| Test | Requirements |
|---|---|
| `CreateTodoBody > trims and accepts a valid title` | FR1, FR2 |
| `CreateTodoBody > rejects empty title` | FR2 |
| `CreateTodoBody > rejects whitespace-only title` | FR2 |
| `CreateTodoBody > rejects 201-char title` | FR1, FR13 |
| `CreateTodoBody > rejects non-string title` | FR13 |
| `UpdateTodoBody > accepts completed only` | FR4 |
| `UpdateTodoBody > accepts title only` | FR4 (forward-compat) |
| `UpdateTodoBody > accepts both` | FR4 |
| `UpdateTodoBody > rejects empty body` | FR13 |

#### `backend/tests/unit/repository.test.ts` — 11 cases

| Test | Requirements |
|---|---|
| `SqliteTodoRepository > list() > returns empty array on empty DB` | FR3, FR12 |
| `SqliteTodoRepository > list() > returns rows ordered by createdAt desc` | FR3 |
| `SqliteTodoRepository > create() > generates UUID, ISO timestamps, and completed=false` | FR1, FR12 |
| `SqliteTodoRepository > update() > updates title and refreshes updatedAt` | FR4 |
| `SqliteTodoRepository > update() > toggles completed` | FR4 |
| `SqliteTodoRepository > update() > returns null when id missing` | FR13 |
| `SqliteTodoRepository > update() > returns null when the row vanishes between findById and UPDATE (B2)` | FR4, FR13 (concurrent-delete race) |
| `SqliteTodoRepository > delete() > returns true on hit` | FR6 |
| `SqliteTodoRepository > delete() > returns false on miss` | FR13 |
| `SqliteTodoRepository > deleteCompleted() > deletes only completed rows and returns the count` | FR8 |
| `SqliteTodoRepository > deleteCompleted() > returns 0 when no rows are completed` | FR8 |

### 11.2 Backend — integration

#### `backend/tests/integration/health.test.ts` — 4 cases

| Test | Requirements |
|---|---|
| `GET /api/health > returns 200 and {status:'ok'}` | NFR7 (Docker healthcheck endpoint) |
| `notFoundHandler (unknown routes) > GET /api/bogus returns 404 with {error:'Not found'}` | FR13 |
| `notFoundHandler (unknown routes) > POST to an unknown route also yields 404` | FR13 |
| `requestLogger (NFR10) > emits exactly one JSON line per request with required fields` | NFR10 |

#### `backend/tests/integration/todos.test.ts` — 27 cases (+ 2 in the sibling CORS describe — see below)

| Test | Requirements |
|---|---|
| `GET /api/todos > returns [] when empty` | FR3, FR9, FR12 |
| `GET /api/todos > returns todos sorted by createdAt desc` | FR3, FR12 |
| `POST /api/todos > creates a todo and trims the title (201)` | FR1, FR12 |
| `POST /api/todos > rejects empty title (400)` | FR2, FR13 |
| `POST /api/todos > rejects whitespace-only title (400)` | FR2, FR13 |
| `POST /api/todos > rejects > 200 chars (400)` | FR1, FR13 |
| `POST /api/todos > rejects non-JSON body (400)` | FR13, NFR9 |
| `POST /api/todos > rejects oversized JSON body with 413 (B5)` | FR13, NFR9 |
| `PATCH /api/todos/:id > toggles completion (200)` | FR4, FR12 |
| `PATCH /api/todos/:id > updates title (200)` | FR4, FR12 (forward-compat) |
| `PATCH /api/todos/:id > updates both title and completed in one request (200)` | FR4, FR12 |
| `PATCH /api/todos/:id > no-op PATCH still advances updated_at (documents current behavior)` | FR4 (contract pin) |
| `PATCH /api/todos/:id > returns 404 when the row vanishes between findById and UPDATE (B2 / HTTP layer)` | FR4, FR13 (concurrent-delete race) |
| `PATCH /api/todos/:id > 404 on unknown id` | FR13 |
| `PATCH /api/todos/:id > 400 on non-UUID id` | FR13 |
| `PATCH /api/todos/:id > 400 on empty body` | FR13 |
| `DELETE /api/todos/:id > deletes and returns 204` | FR6, FR12 |
| `DELETE /api/todos/:id > 404 on miss` | FR13 |
| `DELETE /api/todos/:id > 400 on non-UUID` | FR13 |
| `DELETE /api/todos?completed=true > removes only completed rows and reports count` | FR8, FR12 |
| `DELETE /api/todos?completed=true > returns 0 when nothing completed` | FR8 |
| `DELETE /api/todos?completed=true > 400 when ?completed is missing` | FR13 |
| `DELETE /api/todos?completed=true > 400 when ?completed=false` | FR13 |
| `security headers > sets helmet defaults on /api/health` | NFR9 |
| `security headers > sets helmet defaults on /api/todos` | NFR9 |
| `CORS allowlist (NFR9, B1) > reflects an allowed origin on a preflight request` | NFR9 |
| `CORS allowlist (NFR9, B1) > does NOT echo an Allow-Origin header for a disallowed origin` | NFR9 |

#### `backend/tests/integration/persistence.test.ts` — 1 case

| Test | Requirements |
|---|---|
| `persistence across app restart > data survives a rebuild against the same DB file` | NFR2, FR14 |

### 11.3 Frontend

#### `frontend/src/__tests__/App.test.tsx` — 11 cases

| Test | Requirements |
|---|---|
| `App > renders the heading and empty state when no todos exist` | FR9, FR10 |
| `App > creates a todo and reconciles the temp id to the server-issued id` | FR1, NFR1 |
| `App > shows the optimistic row immediately while the POST is in flight` | NFR1 |
| `App > toggles a todo's completion (optimistic)` | FR4, FR5, NFR1 |
| `App > shows an inline error when the title is empty` | FR2 |
| `App > rejects titles longer than 200 characters with an inline error` | FR1, FR2 |
| `App > tab order traverses controls in visual order (NFR4 / Story E4.S2 I1)` | NFR4 |
| `App > shows an error toast with Retry on POST failure (then succeeds)` | FR11 |
| `App > shows the loading skeleton while the initial fetch is in flight (E3.S1 I1)` | FR10 |
| `App > renders three pre-existing todos by accessible name (E3.S1 I3)` | FR3, FR9 (populated path), NFR4 (role/name queries) |
| `App > filtering by Active hides completed rows in the list (E3.S5 I1)` | FR7 |

#### `frontend/src/__tests__/Filters.test.tsx` — 2 cases

| Test | Requirements |
|---|---|
| `<Filters /> > marks the current value with aria-pressed=true` | FR7, NFR4 |
| `<Filters /> > invokes onChange when a chip is clicked` | FR7 |

#### `frontend/src/__tests__/Footer.test.tsx` — 3 cases

| Test | Requirements |
|---|---|
| `<Footer /> > renders pluralised counter and hides Clear completed when none completed` | FR15, FR8 |
| `<Footer /> > shows '1 item left' for a single active item` | FR15 |
| `<Footer /> > shows Clear completed when at least one completed` | FR8 |

#### `frontend/src/__tests__/TodoItem.test.tsx` — 3 cases

| Test | Requirements |
|---|---|
| `<TodoItem /> delete-with-undo > undo within the window restores the row and never sends DELETE` | FR6 |
| `<TodoItem /> multiple deletes (Story E3.S4 AC5) > queues independent toasts; undoing one restores only that row` | FR6 |
| `<TodoItem /> visual differentiation (FR5) > toggling a row adds the is-completed class to its <li>` | FR5 |

#### `frontend/src/__tests__/filterStore.test.ts` — 5 cases

| Test | Requirements |
|---|---|
| `filterStore > defaults to 'all' when nothing is stored` | FR7 |
| `filterStore > round-trips a valid value` | FR7 |
| `filterStore > ignores invalid stored values` | FR7, NFR9 (input validation from storage) |
| `filterStore > readFilter falls back to 'all' when localStorage.getItem throws (e.g. private-browsing)` | FR7 (defensive) |
| `filterStore > writeFilter swallows exceptions when localStorage.setItem throws` | FR7 (defensive) |

#### `frontend/src/__tests__/mutations.test.tsx` — 5 cases

| Test | Requirements |
|---|---|
| `Mutations: rollback + retry > toggle: server 500 reverts the optimistic state and offers Retry` | FR4, FR11, NFR1 |
| `Mutations: rollback + retry > toggle: server 404 on a stale row reverts the optimistic state and offers Retry` | FR4, FR11 |
| `Mutations: rollback + retry > clear completed: optimistic removal + 500 rollback + retry succeeds` | FR8, FR11, NFR1 |
| `App error state > shows error banner with Retry when initial fetch fails` | FR10, FR11 |
| `App error state > Retry button re-runs the query and clears the banner on success (E3.S1 I4)` | FR10, FR11 |

#### `frontend/src/__tests__/pendingDeletes.test.ts` — 8 cases (all plumbing for FR6)

| Test | Requirements |
|---|---|
| `pendingDeletes > fires the callback after the delay elapses` | FR6 (timer plumbing) |
| `pendingDeletes > does not fire if cancel() is called before the timer elapses` | FR6 |
| `pendingDeletes > cancel() on an unknown id is a safe no-op (no throw, no side effects)` | FR6 (defensive) |
| `pendingDeletes > scheduling the same id again replaces the prior handle (only the new one fires)` | FR6 |
| `pendingDeletes > clearAll() cancels every in-flight handle` | FR6 (test helper integrity) |
| `pendingDeletes > after firing, the same id can be scheduled again` | FR6 |
| `pendingDeletes > handles for different ids are independent` | FR6 (multi-delete; Story E3.S4 AC5) |
| `pendingDeletes > cancelling one id does not affect another` | FR6 |

#### `frontend/src/__tests__/ToastHost.test.tsx` — 11 cases

| Test | Requirements |
|---|---|
| `<ToastHost /> > auto-dismisses after 5 seconds` | FR11 |
| `<ToastHost /> > hovering pauses the auto-dismiss timer; mouseLeave resumes it` | FR11, NFR4 |
| `<ToastHost /> > focus also pauses the timer (keyboard equivalent of hover)` | FR11, NFR4 |
| `<ToastHost /> > stacks multiple toasts and dismisses each on its own timer` | FR11 |
| `<ToastHost /> > hovering one toast does not pause the others` | FR11 |
| `<ToastHost /> > clicking the action calls onRetry and dismisses the toast` | FR11 |
| `<ToastHost /> > uses the provided actionLabel (e.g. 'Undo') instead of the default 'Retry'` | FR6, FR11 |
| `<ToastHost /> > falls back to 'Retry' when no actionLabel is provided` | FR11 |
| `<ToastHost /> > uses role='alert' when an action is offered (assertive), 'status' otherwise` | FR11, NFR4 |
| `<ToastHost /> > uses role='alert' for actionable toasts` | FR11, NFR4 |
| `<ToastHost /> > Dismiss button removes the toast immediately` | FR11, NFR4 |

#### `frontend/src/__tests__/api.test.ts` — 3 cases

| Test | Requirements |
|---|---|
| `api client — handle() error branches > falls back to 'Request failed with status N' when the error body isn't JSON` | FR11 |
| `api client — handle() error branches > uses the server's structured error message when present` | FR11 |
| `api client — handle() error branches > api.remove returns undefined when the server replies 204 No Content` | FR6, FR12 |

#### `frontend/src/__tests__/EmptyState.test.tsx` — 1 case

| Test | Requirements |
|---|---|
| `<EmptyState /> (E3.S1 U1) > renders the hint text and announces it as a live status region` | FR9, NFR4 (live region for SR announcement) |

#### `frontend/src/__tests__/Skeleton.test.tsx` — 1 case

| Test | Requirements |
|---|---|
| `<Skeleton /> (E3.S1 U2) > renders an aria-busy list with three placeholder rows` | FR10, NFR4 (`aria-busy` for SR loading announcement) |

### 11.4 E2E (Playwright)

#### `e2e/tests/smoke.spec.ts` — 1 case

| Test | Requirements |
|---|---|
| `smoke: app loads and health endpoint responds` | NFR7 |

#### `e2e/tests/happy-path.spec.ts` — 1 case (covers many FRs)

| Test | Requirements |
|---|---|
| `happy path: create, complete, delete, clear completed` | FR1, FR3, FR4, FR5, FR6, FR8, FR14, FR15 |

#### `e2e/tests/filter-persistence.spec.ts` — 1 case

| Test | Requirements |
|---|---|
| `active filter persists across page reload` | FR7, NFR2 |

#### `e2e/tests/undo-delete.spec.ts` — 1 case

| Test | Requirements |
|---|---|
| `undo within 5s restores the row; otherwise deletion sticks` | FR6, NFR2 |

#### `e2e/tests/delete-to-empty.spec.ts` — 1 case

| Test | Requirements |
|---|---|
| `deleting the only todo reveals the empty state` | FR6, FR9 |

#### `e2e/tests/error-rollback.spec.ts` — 2 cases

| Test | Requirements |
|---|---|
| `server 500 on create rolls back optimistic UI and toast retries successfully` | FR1, FR11, NFR1 |
| `server 404 on toggle (stale row) reverts the optimistic UI and shows an error toast` | FR4, FR11 |

#### `e2e/tests/responsive.spec.ts` — 5 cases

| Test | Requirements |
|---|---|
| `Responsive layout (NFR3, Story E4.S1) > mobile-narrow (320×640): no horizontal scroll + axe-clean` | NFR3, NFR4 |
| `Responsive layout (NFR3, Story E4.S1) > mobile (375×812): no horizontal scroll + axe-clean` | NFR3, NFR4 |
| `Responsive layout (NFR3, Story E4.S1) > tablet (768×1024): no horizontal scroll + axe-clean` | NFR3, NFR4 |
| `Responsive layout (NFR3, Story E4.S1) > desktop (1280×800): no horizontal scroll + axe-clean` | NFR3, NFR4 |
| `Responsive layout (NFR3, Story E4.S1) > wide (1920×1080): no horizontal scroll + axe-clean` | NFR3, NFR4 |

#### `e2e/tests/a11y.spec.ts` — 7 cases

| Test | Requirements |
|---|---|
| `Accessibility (axe-core, WCAG 2.1 AA) > empty state has no serious/critical violations` | FR9, NFR4 |
| `Accessibility (axe-core, WCAG 2.1 AA) > populated list has no serious/critical violations` | FR5, NFR4 |
| `Accessibility (axe-core, WCAG 2.1 AA) > active filter view has no serious/critical violations` | FR7, NFR4 |
| `Accessibility (axe-core, WCAG 2.1 AA) > primary flow is keyboard-reachable` | NFR4 |
| `Accessibility (axe-core, WCAG 2.1 AA) > undo toast (action toast) has no serious/critical violations` | FR6, FR11, NFR4 |
| `Accessibility (axe-core, WCAG 2.1 AA) > inline form error has no serious/critical violations` | FR2, NFR4 |
| `Accessibility — loading state > loading skeleton has no serious/critical violations` | FR10, NFR4 |

### 11.5 Totals

| Layer | Files | Test cases |
|---|---:|---:|
| Backend unit | 3 | 25 |
| Backend integration | 3 | 32 |
| Frontend | 11 | 53 |
| E2E | 8 | 19 |
| **Total** | **25** | **129** |

### 11.6 Requirements with no direct test

For honesty, the following requirements are **not directly covered by an automated test** — they're enforced by code review, type system, build configuration, or operational tooling:

| Requirement | Verification | Notes |
|---|---|---|
| **NFR5** Maintainability (TS strict, lint) | `tsc --noEmit` clean in all 3 workspaces; `eslint` config in place | Not a runtime test; enforced at build time. |
| **NFR6** Coverage thresholds | `backend/vitest.config.ts` thresholds + CI workflow always passes `--coverage` | Enforced on every CI run. |
| **NFR8** Extensible for `userId` | Repository takes `RepoContext`; documented in `docs/architecture.md` §5.4 | Verified by code shape, not by test. |

### 11.7 Tests with no direct PRD requirement

A few tests verify implementation invariants rather than PRD requirements directly. They protect a requirement transitively. Already tagged in the tables above as "defensive" or "plumbing":

- All 8 `pendingDeletes.test.ts` cases — module-level plumbing for FR6 (delete-with-undo).
- `filterStore.test.ts` last 2 cases — defensive against browser storage exceptions; protects FR7.
- `api.test.ts` first 2 cases — `handle()` error-message construction; protects FR11 by ensuring error toasts get readable text.
