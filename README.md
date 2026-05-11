# Todo App — BMAD Project

A single-user Todo app built spec-first via the **BMAD-METHOD** (Breakthrough Method for Agile AI-Driven Development). The codebase is a working reference for what spec-driven delivery looks like end-to-end: PRD → architecture → sharded stories → implementation → QA — with every claim traceable to a test.

## Tech stack

- **Frontend:** React 18 + Vite + TypeScript, React Query for server state, MSW for tests
- **Backend:** Node 20 + Express 4 + TypeScript, Zod validation, helmet/cors, `better-sqlite3`
- **Database:** SQLite on a named Docker volume (`todo-db`)
- **Containers:** Multi-stage Dockerfiles, BuildKit cache mounts, non-root users (`node` UID 1000 / `nginx` UID 101), digest-pinned base images
- **E2E:** Playwright + axe-playwright, organised via a Page Object Model. Companion **Playwright MCP** (`@playwright/mcp`) available for agent-driven debug sessions — see [`docs/ai-integration-log.md`](docs/ai-integration-log.md) §2.
- **Unit / integration:** Vitest + RTL + Supertest

## Project layout

```
BMAD/
├── README.md                        # This file
├── package.json                     # npm workspaces root
├── tsconfig.base.json               # strict + exactOptionalPropertyTypes
├── eslint.config.mjs
├── docker-compose.yml               # backend + frontend + named volume
├── docker-compose.override.yml      # dev conveniences (NODE_ENV=development, port-publishing)
├── .env.example
│
├── backend/                         # Express + SQLite REST API
│   ├── src/
│   │   ├── controllers/             # health + todos
│   │   ├── services/                # business layer (passes RepoContext through)
│   │   ├── repositories/            # SqliteTodoRepository — parameterized SQL
│   │   ├── validators/              # Zod schemas
│   │   ├── middleware/              # error handler + 404 + structured logger
│   │   ├── db/                      # connection + migration runner
│   │   ├── errors/
│   │   ├── app.ts                   # buildApp(deps) factory (testable)
│   │   ├── config.ts                # env parsing + prod CORS guard
│   │   ├── logger.ts                # structured JSON request logger
│   │   └── index.ts
│   ├── tests/
│   │   ├── unit/                    # config, schema, repository
│   │   └── integration/             # health, todos, persistence
│   └── Dockerfile
│
├── frontend/                        # React SPA
│   ├── index.html                   # incl. favicon + meta description
│   ├── public/
│   │   ├── favicon.svg
│   │   └── robots.txt
│   ├── src/
│   │   ├── api/                     # typed fetchers
│   │   ├── components/              # TodoInput, TodoList, TodoItem, Filters, Footer,
│   │   │                            # EmptyState, Skeleton, ToastHost — all with
│   │   │                            # data-testid hooks for stable e2e locators
│   │   ├── hooks/                   # useTodos + useTodoMutations
│   │   ├── state/                   # filterStore (localStorage) + pendingDeletes
│   │   │                            #   (module-level registry for deferred deletes)
│   │   ├── test/                    # MSW handlers + render helpers
│   │   ├── __tests__/               # 9 Vitest + RTL spec files (46 cases)
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── styles/
│   ├── Dockerfile                   # nginx-unprivileged, listens on 8080
│   └── nginx.conf                   # proxies /api/* → backend:3001
│
├── packages/
│   └── shared/                      # @todo/shared — Todo type + TODO_TITLE_MAX
│       ├── package.json
│       └── src/
│           ├── index.js             # runtime values (Node ESM can load this)
│           └── index.d.ts           # types
│
├── e2e/                             # Playwright suite
│   ├── pages/
│   │   └── TodoPage.ts              # POM: TodoPage + TodoRow
│   ├── tests/
│   │   ├── _fixtures.ts             # extended test() with auto-provided todoPage
│   │   ├── _helpers.ts              # resetServerState
│   │   └── *.spec.ts                # 8 spec files, 19 test cases
│   └── playwright.config.ts         # workers: 1 (single-user data isolation)
│
├── scripts/
│   └── test-compose-up-time.sh      # NFR7 budget check (60 s) — gated in CI
│
├── .github/
│   ├── workflows/test.yml           # CI: lint + tsc + coverage gate + e2e + NFR7
│   └── PULL_REQUEST_TEMPLATE.md     # BMAD story-traceability checklist
│
└── docs/
    ├── project-brief.md             # Analyst persona
    ├── prd.md                       # PM persona — 15 FRs + 10 NFRs
    ├── architecture.md              # Architect persona
    ├── test-strategy.md             # QA persona (incl. §11 per-test traceability)
    ├── ai-integration-log.md        # How AI was used + lessons
    ├── epics/                       # E1–E4 sharded
    ├── stories/                     # 23 story files (E1.S1 … E4.S5)
    └── qa/
        ├── README.md                # QA artefact index
        ├── coverage.md              # source-file % + remaining gaps
        ├── performance.md           # NFR1 / NFR3 / NFR7 evidence
        ├── accessibility.md         # WCAG 2.1 AA criterion-by-criterion
        └── security-review.md       # static review + greps for re-verification
```

## Story map

| Epic | Stories |
|---|---|
| **E1 Foundation** | S1 monorepo · S2 Express + `/api/health` · S3 React skeleton · S4 Docker Compose |
| **E2 Backend CRUD** | S1 schema + repo · S2 GET · S3 POST · S4 PATCH · S5 DELETE · S6 bulk delete · S7 persistence |
| **E3 Frontend UX** | S1 list/empty/loading/error · S2 add (optimistic) · S3 toggle · S4 delete + undo · S5 filter persistence · S6 counter + clear completed · S7 toast/retry |
| **E4 Polish & Deploy** | S1 responsive · S2 a11y · S3 hardening · S4 README/deploy · S5 final integration + Playwright |

**23 stories** across **4 epics**.

## Quick start

Prerequisites: Node 20 (LTS), npm, Docker Desktop / OrbStack / Colima.

```bash
# Install all workspaces in one shot
npm install

# Run unit + integration tests
npm run test:backend         # Vitest + Supertest — 57 cases
npm run test:frontend        # Vitest + RTL + MSW — 46 cases

# Coverage (frontend uses @vitest/coverage-v8)
npm test --workspace=frontend -- --coverage
npm test --workspace=backend -- --coverage   # enforces 80% threshold

# Run dev servers (two terminals)
npm run dev:backend          # http://localhost:3001
npm run dev:frontend         # http://localhost:5173 (proxies /api → backend)

# E2E (Playwright auto-starts dev servers via webServer config)
npx playwright install --with-deps chromium   # one-time
npm run e2e                  # 19 cases incl. 11 axe scans + responsive viewports

# NFR7 budget check — boots the full Docker stack and fails if Compose
# doesn't reach healthy within 60 s
npm run test:nfr7

# One-command Docker stack (dev profile: ports exposed, NODE_ENV=development)
cp .env.example .env
docker compose up --build

# Production-shaped run (no override; only frontend port published)
docker compose -f docker-compose.yml up --build -d

# Run the backend test suite in a container (CI-friendly)
docker compose --profile test run --rm backend-test

# Tail logs
docker compose logs -f backend frontend

# Tear down (preserves the todo-db volume — your data survives)
docker compose down

# Tear down INCLUDING the volume (wipes all todos)
docker compose down -v
```

## Configuration

Environment variables (see `.env.example`):

| Var | Default | Used by | Notes |
|---|---|---|---|
| `PORT` | `3001` | backend | Bind port inside the container |
| `NODE_ENV` | `development` | backend | `production` rejects `CORS_ORIGIN=*` at startup |
| `DATABASE_PATH` | `./data/todos.db` (host) / `/data/todos.db` (container) | backend | Container path is on the `todo-db` named volume |
| `CORS_ORIGIN` | `http://localhost:5173` | backend | Comma-separated allowlist |
| `BACKEND_PORT` | `3001` | compose dev override | Host port mapped to the backend container |
| `FRONTEND_PORT` | `5173` | compose | Host port mapped to nginx (8080 in container) |

## Compose profiles

| Profile | Purpose | Command |
|---|---|---|
| _(default)_ | App stack with healthchecks and named volume. Override layers in dev conveniences. | `docker compose up` |
| `test` | One-shot backend Vitest run inside a container against an ephemeral SQLite file. | `docker compose --profile test run --rm backend-test` |

## Container hardening

- **Backend**: `node:20-alpine` digest-pinned, `USER node` (UID 1000), `tini` as PID 1, dedicated `prod-deps` stage with `npm ci --omit=dev`, Node-based HEALTHCHECK (no curl in the image), BuildKit `--mount=type=cache` for npm.
- **Frontend**: `nginxinc/nginx-unprivileged:alpine` digest-pinned (UID 101, listens on 8080), multi-stage with the SPA bundle copied into nginx.
- `docker compose` uses an explicit private network (`todo-net`); the backend is `expose:` only — the frontend is the only published service in the prod-shaped run.

## Documentation

| Doc | What it is |
|---|---|
| [`docs/project-brief.md`](docs/project-brief.md) | Analyst output — problem, scope, risks, open questions |
| [`docs/prd.md`](docs/prd.md) | PM output — 15 FRs + 10 NFRs, API contract, 23 stories |
| [`docs/architecture.md`](docs/architecture.md) | Architect output — system diagram, layered backend, RepoContext, deployment topology |
| [`docs/test-strategy.md`](docs/test-strategy.md) | QA output — pyramid, tooling, **§11 per-test → PRD requirement traceability (122 mappings)** |
| [`docs/epics/`](docs/epics/) + [`docs/stories/`](docs/stories/) | E1–E4 sharded; 23 Dev-ready stories |
| [`docs/qa/README.md`](docs/qa/README.md) | QA report index with quick re-verification commands |
| [`docs/qa/coverage.md`](docs/qa/coverage.md) | Source-file % + remaining gaps (gate enforced in CI) |
| [`docs/qa/performance.md`](docs/qa/performance.md) | Lighthouse + autocannon numbers; NFR7 now CI-gated |
| [`docs/qa/accessibility.md`](docs/qa/accessibility.md) | WCAG 2.1 AA criterion-by-criterion conformance |
| [`docs/qa/security-review.md`](docs/qa/security-review.md) | Evidence-based static review (greps included for re-verification) |
| [`docs/ai-integration-log.md`](docs/ai-integration-log.md) | How AI was used through the project — agent usage, MCP servers, test generation, debugging (D1–D13 + D-A1–D-A7), limitations |

## Test suite at a glance

```
Layer                       Files   Tests   Notes
-------------------------- ------- ------- -----------------------------------------
Backend unit                  3      25     config, schema, repository
Backend integration           3      32     health (+ notFoundHandler + NFR10 logger),
                                            todos (+ B2 race, no-op timestamp,
                                            combined PATCH, CORS allowlist,
                                            helmet on /api/todos), persistence
Frontend (Vitest + RTL)       9      46     incl. ToastHost, pendingDeletes, api client,
                                            tab-order (NFR4), 3 state-coverage a11y tests
E2E (Playwright)              8      19     smoke, happy-path, filter-persistence,
                                            undo-delete, delete-to-empty, error-rollback,
                                            responsive (NFR3), a11y (11 axe scans)
                              ---    ---
Total                         23     122
```

Every test case is mapped to its PRD FR/NFR ID in [`docs/test-strategy.md`](docs/test-strategy.md) **§11**. The forward map (requirement → tests) is in §5 of the same doc.

## Notable design decisions

- **Optimistic UI everywhere**: every mutation does `onMutate → setQueryData → server confirms → onSuccess reconciles`. Failures roll back via `context.previous` and surface a non-blocking error toast with a Retry/Undo affordance.
- **Deferred deletes survive component unmount**: `frontend/src/state/pendingDeletes.ts` is a module-level `Map<id, Timeout>` so the 5-second undo timer doesn't die when the optimistic cache filter unmounts the row. (Real bug we hit during e2e; see `docs/ai-integration-log.md` D12.)
- **Page Object Model for E2E**: locators + actions in `e2e/pages/TodoPage.ts`; assertions in spec files. Row-scoped locators use `getByRole("listitem").filter({ hasText: title })` so they survive `aria-label` toggles between "complete" and "active".
- **Data-testid hooks** for elements without strong semantic identity (`empty-state`, `input-error`, `items-left`). Other locators use roles + accessible names first.
- **`RepoContext` is threaded** through repository + service + controller — empty in v1, gains `userId` in v2 when auth lands. No method-arity changes needed.
- **Test serialization in E2E**: `playwright.config.ts` runs `workers: 1`, `fullyParallel: false` because v1 has no per-user data isolation. Switches back to parallel when auth + scoping land.

## Known gaps (deliberately deferred)

| Gap | Where it's documented |
|---|---|
| No write-path API benchmark (autocannon only runs GET) | `docs/qa/performance.md` (P6) |
| No production-build Lighthouse number yet (only dev-server scan) | `docs/qa/performance.md` |
| No server-side pagination (acceptable for v1 single-user) | `docs/qa/performance.md` (P2) |
| No backend rate limiting (acceptable for v1 single-user) | `docs/qa/performance.md` (P3) |
| No screen-reader manual pass (NVDA / VoiceOver) | `docs/qa/accessibility.md` |
| No service worker / offline cache (out of v1 scope per PRD) | `docs/qa/performance.md` (P4) |

Each gap is small and intentionally left for a v1.1 polish pass or v2 feature work.

## What's next

The natural follow-ups, in priority order:

1. **Run a production-build Lighthouse** and fill in the comparison table in `docs/qa/performance.md`. Current dev-server score is 85; the production build should land ≥ 95.
2. **Write-path API benchmark.** Run `autocannon` against `POST /api/todos` with a JSON body to verify single-writer SQLite holds up under v2-shaped traffic.
3. **Fold Lighthouse + axe into CI.** Both currently require the running stack on a laptop. Lighthouse-CI Action or Playwright-driven Lighthouse against the compose stack would fold them into the same `nfr7` CI pattern.
4. **v2 prep**: auth + multi-user. The `RepoContext` plumbing is in place; the architecture doc §5.4 has the migration path. Switch Playwright back to `fullyParallel: true` once data is per-user-scoped.
