# Epic E1 — Project Foundation & Health

**Status:** Ready
**Owner:** Dev (with SM)
**Source:** `docs/prd.md` §7 — Epic E1; `docs/architecture.md` §3, §4, §9

## Goal
Establish a runnable, testable, containerized skeleton so all subsequent stories build on a stable base.

## Scope (in)
- Monorepo layout with `frontend/`, `backend/`, `packages/shared`, `e2e/`.
- Tooling: TypeScript, ESLint, Prettier, Vitest, React Testing Library, Supertest, Playwright.
- Express skeleton with `/api/health`, structured request logging.
- React skeleton with Vite dev-server proxy to the backend.
- Multi-stage Dockerfiles for both services + `docker-compose.yml` with a named volume for the SQLite file.

## Scope (out)
- Any todo CRUD (covered by E2/E3).
- Auth, multi-user, observability beyond stdout request logs.

## Stories
| ID | Title | Status |
|---|---|---|
| E1.S1 | Initialize monorepo & tooling | Ready |
| E1.S2 | Express backend skeleton with `/api/health` | Ready |
| E1.S3 | React frontend skeleton | Ready |
| E1.S4 | Dockerfiles + docker-compose | Ready |

## Acceptance criteria roll-up
- `npm install && npm run lint && npm test` succeeds at the root and in each workspace.
- `npm run dev` brings up backend (`:3001`) and frontend (`:5173`) locally; the frontend's "Todo App" header renders.
- `GET /api/health` returns `{ "status": "ok" }`.
- `docker compose up --build` produces a working stack in < 60 s on a clean machine; data volume `todo-db` exists.
- Playwright is installed, `npx playwright test --list` succeeds (even with zero tests yet).

## Dependencies
None upstream. E2 and E3 depend on E1.

## Definition of Done
1. All four stories' ACs are satisfied.
2. Lint and tests are green.
3. README quick-start section exists and works on a clean machine.
4. The Compose stack starts; the health endpoint is reachable from the browser.
