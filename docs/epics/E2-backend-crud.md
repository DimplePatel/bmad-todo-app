# Epic E2 — Backend CRUD API & Persistence

**Status:** Ready
**Owner:** Dev (with QA)
**Source:** `docs/prd.md` §7 — Epic E2; `docs/architecture.md` §4, §5, §6

## Goal
Implement and harden the REST API with SQLite persistence, full validation, and tests so todos can be reliably created, listed, updated, deleted, and bulk-cleared.

## Scope (in)
- SQLite schema + migration runner (`001_init.sql`).
- `TodoRepository` with parameterized queries and a temp-file backed test setup.
- Routes:
  - `GET /api/todos`
  - `POST /api/todos`
  - `PATCH /api/todos/:id`
  - `DELETE /api/todos/:id`
  - `DELETE /api/todos?completed=true`
- Zod validators, central error handler, structured request logging.
- Persistence-across-restart integration test (NFR2).

## Scope (out)
- Any UI (E3).
- Authentication, `userId` scoping (future).
- Pagination, search, server-side filtering beyond `completed=true` bulk delete.

## Stories
| ID | Title | Status |
|---|---|---|
| E2.S1 | SQLite schema + repository | Ready |
| E2.S2 | `GET /api/todos` | Ready |
| E2.S3 | `POST /api/todos` | Ready |
| E2.S4 | `PATCH /api/todos/:id` | Ready |
| E2.S5 | `DELETE /api/todos/:id` | Ready |
| E2.S6 | Bulk delete completed | Ready |
| E2.S7 | Persistence across restart | Ready |

## Acceptance criteria roll-up
- All routes match the contract in `docs/architecture.md` §6 exactly.
- All inputs validated; 400/404 errors are structured JSON.
- Backend line coverage ≥ 80%.
- Persistence test green: data written, backend torn down and re-created against the same DB file, data still present.

## Dependencies
- Upstream: E1 (skeleton + Compose).
- Downstream: E3 consumes the API; E4 hardens it.

## Definition of Done
1. All seven stories' ACs are satisfied.
2. `npm test --workspace=backend` is green; coverage report ≥ 80% line coverage.
3. Manual smoke via `curl` against the running backend exercises every endpoint.
4. SQL is parameterized everywhere; ESLint rule (or grep check) confirms no string-concatenated queries.
