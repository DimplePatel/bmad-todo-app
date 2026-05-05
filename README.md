# Todo App — BMAD Project

This repository follows the **BMAD-METHOD** (Breakthrough Method for Agile AI-Driven Development) for spec-driven delivery. The goal is to apply Spec-Driven Development to build a complete, well-tested, and deployable Todo application.

## Tech direction (locked in Step 1)

- **Frontend:** React 18 (Vite, TypeScript)
- **Backend:** Node.js 20 + Express (TypeScript)
- **Database:** SQLite via `better-sqlite3` (file-backed; trivial migration path to Postgres)
- **Packaging / Deploy:** Docker + Docker Compose (named volume for SQLite); deployable to any cloud
- **E2E testing:** **Playwright** (mandatory)
- **Unit/Integration testing:** Vitest, React Testing Library, Supertest, MSW
- **A11y verification:** axe-playwright

## BMAD workflow & artifacts

| Phase | Persona | Output | Status |
|---|---|---|---|
| 1.1 Analysis | Analyst | [`docs/project-brief.md`](docs/project-brief.md) | Done |
| 1.2 Product | PM | [`docs/prd.md`](docs/prd.md) | Done |
| 1.3 Architecture | Architect | [`docs/architecture.md`](docs/architecture.md) | Done |
| 1.4 Story sharding | SM | [`docs/epics/`](docs/epics/), [`docs/stories/`](docs/stories/) | Done |
| 1.5 Test strategy | QA | [`docs/test-strategy.md`](docs/test-strategy.md) | Done |
| 2 Implementation | Dev + QA | source code + tests | Pending |

## Folder layout

```
BMAD/
├── README.md                        # This file
├── docs/
│   ├── project-brief.md             # Analyst output — strategic context
│   ├── prd.md                       # PM output — refined product requirements
│   ├── architecture.md              # Architect output — system design + contracts
│   ├── test-strategy.md             # QA output — pyramid, tooling, traceability
│   ├── architecture/                # (room for sharded architecture docs later)
│   ├── epics/
│   │   ├── E1-foundation.md
│   │   ├── E2-backend-crud.md
│   │   ├── E3-frontend-experience.md
│   │   └── E4-polish-deploy.md
│   └── stories/
│       ├── E1.S1-init-monorepo.md
│       ├── E1.S2-express-skeleton-health.md
│       ├── E1.S3-react-skeleton.md
│       ├── E1.S4-docker-compose.md
│       ├── E2.S1-sqlite-schema-repo.md
│       ├── E2.S2-get-todos.md
│       ├── E2.S3-post-todos.md
│       ├── E2.S4-patch-todo.md
│       ├── E2.S5-delete-todo.md
│       ├── E2.S6-bulk-delete-completed.md
│       ├── E2.S7-persistence-test.md
│       ├── E3.S1-fetch-render-list.md
│       ├── E3.S2-add-todo-optimistic.md
│       ├── E3.S3-toggle-completion.md
│       ├── E3.S4-delete-with-undo.md
│       ├── E3.S5-filter-persistence.md
│       ├── E3.S6-counter-clear-completed.md
│       ├── E3.S7-error-toast-retry.md
│       ├── E4.S1-responsive-layout.md
│       ├── E4.S2-a11y-pass.md
│       ├── E4.S3-backend-hardening.md
│       ├── E4.S4-readme-deploy-docs.md
│       └── E4.S5-final-integration-e2e.md
└── (source code added in Step 2)
```

## Story map

| Epic | Stories |
|---|---|
| **E1 Foundation** | S1 monorepo & tooling · S2 Express + `/api/health` · S3 React skeleton · S4 Docker Compose |
| **E2 Backend CRUD** | S1 schema + repo · S2 GET · S3 POST · S4 PATCH · S5 DELETE · S6 bulk delete · S7 persistence test |
| **E3 Frontend UX** | S1 list/empty/loading/error · S2 add (optimistic) · S3 toggle · S4 delete + undo · S5 filter persistence · S6 counter + clear completed · S7 toast/retry |
| **E4 Polish & Deploy** | S1 responsive · S2 a11y · S3 hardening · S4 README/deploy · S5 final integration + Playwright E2E |

Total: **23 stories** across **4 epics**.

## How to continue (Step 2)

The application code is now in place. Folder layout:

```
backend/    # Express + SQLite API (TypeScript)
frontend/   # React 18 + Vite app (TypeScript)
packages/shared/   # Shared Todo types
e2e/        # Playwright suite
docker-compose.yml
docker-compose.override.yml
```

### Quick start

Prerequisites: Node 20+, npm, Docker (optional).

```bash
# Install everything (one shot, root)
npm install

# Run unit + integration tests
npm run test:backend     # Vitest + Supertest
npm run test:frontend    # Vitest + RTL + MSW

# Run dev servers (two terminals)
npm run dev:backend      # http://localhost:3001
npm run dev:frontend     # http://localhost:5173 (proxied to backend)

# Run E2E (assumes both dev servers are reachable; or let Playwright start them)
npx playwright install chromium    # one-time
npm run e2e

# Or, one-command Docker stack (dev profile, ports exposed)
cp .env.example .env
docker compose up --build          # http://localhost:5173, data in volume todo-db

# Production-shaped run (no override, only frontend port published)
docker compose -f docker-compose.yml up --build -d

# Run the backend test suite in a container (one-shot)
docker compose --profile test run --rm backend-test

# Tail logs across services
docker compose logs -f backend frontend

# Tear down (preserves the named volume)
docker compose down

# Tear down INCLUDING the data volume (destroys todos)
docker compose down -v
```

### Configuration

Environment variables (see `.env.example`):

| Var | Default | Used by | Notes |
|---|---|---|---|
| `PORT` | `3001` | backend | Bind port inside the container |
| `NODE_ENV` | `development` | backend | `production` rejects `CORS_ORIGIN=*` |
| `DATABASE_PATH` | `./data/todos.db` (host) / `/data/todos.db` (container) | backend | Container path is on the named volume `todo-db` |
| `CORS_ORIGIN` | `http://localhost:5173` | backend | Comma-separated allowlist |
| `BACKEND_PORT` | `3001` | compose (dev override) | Host port mapped to backend in dev |
| `FRONTEND_PORT` | `5173` | compose | Host port mapped to nginx (8080 in container) |

### Compose profiles

| Profile | Purpose | How to run |
|---|---|---|
| _(default)_ | Application stack: backend + frontend with healthchecks and a named volume. Override file layers in dev conveniences (NODE_ENV=development, backend port published). | `docker compose up` |
| `test` | One-shot run of the backend Vitest suite inside a container, using an ephemeral SQLite file. | `docker compose --profile test run --rm backend-test` |

### Container hardening

Both images run as **non-root**:
- backend → `USER node` (UID 1000) with `tini` as PID 1 for clean SIGTERM forwarding.
- frontend → `nginxinc/nginx-unprivileged:alpine` (UID 101) listening on port `8080` (mapped to host `5173`).

Both containers expose **HEALTHCHECK** instructions; Compose waits for the backend to report `service_healthy` before starting the frontend, and the stack's status is visible via `docker compose ps`.

### Verification status

- Backend unit tests (schema + config): **13/13 passing**
- Frontend unit + integration tests: **17/17 passing** (6 spec files)
- Frontend coverage: **87.08% lines / 84.12% functions**
- Backend, frontend, and e2e workspaces all **type-check clean** under `strict + exactOptionalPropertyTypes`
- Backend integration + persistence tests and the Playwright E2E suite are wired and ready; run them locally with `npm install && npm test --workspace=backend && npm run e2e`

### QA artifacts (Step 4)

- [docs/qa/README.md](docs/qa/README.md) — index of QA outputs
- [docs/qa/coverage.md](docs/qa/coverage.md) — coverage numbers + remaining gaps
- [docs/qa/security-review.md](docs/qa/security-review.md) — XSS / SQLi / CSRF / CORS / containers / deps
- [docs/qa/performance.md](docs/qa/performance.md) — static review + live-audit procedure
- [docs/ai-integration-log.md](docs/ai-integration-log.md) — how AI was used across Steps 1–4 (agents, MCPs, test generation, debugging, limitations)

QA headlines:
- **Coverage:** Frontend 87.08% lines (target ≥ 70%); backend coverage gate set to ≥ 80% lines in `backend/vitest.config.ts`.
- **Security:** 0 high / 0 critical findings; 2 informational items.
- **Accessibility:** new `e2e/tests/a11y.spec.ts` runs axe-core over empty / populated / filtered states + a keyboard-only flow.
- **Performance:** meets NFR1/NFR3/NFR7 by design; live Lighthouse + autocannon procedure documented.

### What's next

After running the full local suite, follow the BMAD post-Step-4 workflow (CI gating, deploy) using the per-story Definition-of-Done items in `docs/stories/` and the action list in `docs/qa/README.md`.
