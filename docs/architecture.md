# Todo App — Architecture Document

**Authored by:** BMAD Architect persona
**Date:** 2026-05-01
**Status:** Draft v1.0 — ready for SM/Dev handoff
**Inputs:** `docs/project-brief.md`, `docs/prd.md`
**Stack (locked):** React + Node.js/Express + SQLite, packaged via Docker

---

## 1. Architectural Goals & Principles

1. **Simplicity over cleverness.** The shape of the code should match the shape of the PRD — small surface area, no premature abstraction.
2. **Typed end-to-end.** TypeScript on both sides; share a single `Todo` type so the client and server never disagree.
3. **Layered backend.** `controller → service → repository`. Each layer has one responsibility and is independently testable.
4. **Optimistic, reconciled frontend.** UI mutates immediately and reconciles against server responses; failures roll back without surprise.
5. **Durable persistence by default.** SQLite file lives on a named Docker volume; no ephemeral storage in the hot path.
6. **Future-proof for auth.** Data model, repository signatures, and API shape are designed so a `userId` scope can be added without a breaking change (NFR8). Repository methods already take an opaque `RepoContext` options object that's empty in v1; auth lands by adding `userId` to that type, not by changing method arity.
7. **Observable in containers.** Structured logs to stdout; health endpoint exposed; no surprise dependencies.

---

## 2. System Context

```
┌──────────────────────┐     HTTP / JSON      ┌──────────────────────┐
│  Browser (React SPA) │ ───────────────────▶ │  Express API (Node)  │
│  Vite dev / nginx    │ ◀─────────────────── │   controller layer   │
└──────────────────────┘     /api/*           │   service layer      │
                                              │   repository layer   │
                                              └─────────┬────────────┘
                                                        │ better-sqlite3
                                                        ▼
                                              ┌──────────────────────┐
                                              │  SQLite file (vol.)  │
                                              │  /data/todos.db      │
                                              └──────────────────────┘
```

**Trust boundaries:** the only network boundary is browser ⇄ backend over HTTP. SQLite is in-process to the backend; no remote DB.

**Containers:**
- `frontend` — nginx serving the static build of the Vite app on port `80` (mapped to host `5173` in dev override).
- `backend` — Node 20 running the compiled Express app on port `3001`.
- `todo-db` — named volume mounted at `/data` inside `backend`.

---

## 3. Repository Layout

```
todo-app/
├── package.json                # workspaces root
├── tsconfig.base.json
├── docker-compose.yml
├── docker-compose.override.yml # dev-only volumes/ports
├── .env.example                # documents PORT, DATABASE_PATH, CORS_ORIGIN
├── README.md
├── packages/
│   └── shared/
│       ├── package.json
│       └── src/
│           └── todo.ts          # exported `Todo` and DTO types
├── e2e/                         # Playwright E2E suite (mandatory)
│   ├── package.json
│   ├── playwright.config.ts
│   ├── tests/
│   │   ├── happy-path.spec.ts
│   │   ├── filter-persistence.spec.ts
│   │   ├── undo-delete.spec.ts
│   │   └── error-rollback.spec.ts
│   └── fixtures/
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── src/
│   │   ├── index.ts             # bootstraps app + starts server
│   │   ├── app.ts               # builds the Express app (testable)
│   │   ├── config.ts            # env parsing
│   │   ├── logger.ts            # request logger middleware
│   │   ├── controllers/
│   │   │   ├── todos.controller.ts
│   │   │   └── health.controller.ts
│   │   ├── services/
│   │   │   └── todos.service.ts
│   │   ├── repositories/
│   │   │   └── todos.repository.ts
│   │   ├── validators/
│   │   │   └── todos.schema.ts  # zod schemas
│   │   ├── db/
│   │   │   ├── connection.ts
│   │   │   └── migrations/
│   │   │       └── 001_init.sql
│   │   └── errors/
│   │       └── http-error.ts
│   └── tests/
│       ├── unit/
│       ├── integration/
│       └── fixtures/
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── Dockerfile
    ├── nginx.conf
    ├── index.html
    ├── vite.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api/
        │   └── todos.ts          # typed fetchers
        ├── hooks/
        │   ├── useTodos.ts       # react-query: list
        │   └── useTodoMutations.ts
        ├── components/
        │   ├── TodoInput.tsx
        │   ├── TodoList.tsx
        │   ├── TodoItem.tsx
        │   ├── Filters.tsx
        │   ├── Footer.tsx
        │   ├── EmptyState.tsx
        │   ├── Toast.tsx
        │   └── Skeleton.tsx
        ├── state/
        │   └── filterStore.ts    # localStorage-backed filter
        └── styles/
            └── index.css
```

---

## 4. Backend Architecture

### 4.1 Layering

| Layer | Responsibility | Knows about |
|---|---|---|
| **Controller** | HTTP concerns: parse params, validate request body, call service, map results to status codes. | Express, validators, services. |
| **Service** | Business rules: trim title, build timestamps, orchestrate repository calls. | Repository, domain types. |
| **Repository** | SQL only. Parameterized queries. Returns plain objects mapped to domain types. | `better-sqlite3`. |

Controllers never touch SQL; repositories never touch HTTP. This makes each layer trivially testable.

### 4.2 Express app composition (`app.ts`)

```ts
export function buildApp(deps: { repo: TodoRepository }): Express {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: "16kb" }));
  app.use(requestLogger);

  app.use("/api/health", healthController());
  app.use("/api/todos", todosController(new TodosService(deps.repo)));

  app.use(notFoundHandler);
  app.use(errorHandler); // maps HttpError → JSON, logs unknown errors
  return app;
}
```

`index.ts` wires the real repository (against the configured SQLite file) and starts listening. Tests build the app with an in-memory or temp-file repository.

### 4.3 Validation

All request bodies and params validate through **Zod** schemas in `validators/todos.schema.ts`:

```ts
export const CreateTodoBody = z.object({
  title: z.string().trim().min(1).max(200),
});
export const UpdateTodoBody = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  completed: z.boolean().optional(),
}).refine(v => v.title !== undefined || v.completed !== undefined,
  { message: "At least one of title or completed is required" });
export const IdParam = z.object({ id: z.string().uuid() });
```

Failures throw `HttpError(400, message, issues)` which the central error handler renders as `{ error, issues? }`.

### 4.4 Error model

| HTTP | When | Body |
|---|---|---|
| 400 | Validation failure | `{ "error": "Invalid request", "issues": [...] }` |
| 404 | Resource not found | `{ "error": "Todo not found" }` |
| 500 | Unexpected | `{ "error": "Internal server error" }` (details only logged) |

A single `errorHandler` middleware is the only path that emits errors. Controllers throw; they don't `res.send` errors.

### 4.5 Repository contract

```ts
// Opaque options object threaded through every call. Empty in v1 — fields
// (userId, request id, etc.) get added here without changing method arity.
export type RepoContext = {
  /* no fields in v1 */
};

export interface TodoRepository {
  list(ctx?: RepoContext): Todo[];                          // ordered by createdAt DESC
  findById(id: string, ctx?: RepoContext): Todo | null;
  create(input: { title: string }, ctx?: RepoContext): Todo;
  update(
    id: string,
    patch: { title?: string; completed?: boolean },
    ctx?: RepoContext,
  ): Todo | null;
  delete(id: string, ctx?: RepoContext): boolean;           // true if a row was deleted
  deleteCompleted(ctx?: RepoContext): number;               // count deleted
}
```

`SqliteTodoRepository` implements it with parameterized SQL. Time and `id` are generated in the repository (UUID v4, `new Date().toISOString()`).

### 4.6 Logging & observability

`requestLogger` writes one JSON line per request:

```json
{"ts":"2026-05-01T12:00:00.000Z","level":"info","method":"POST","path":"/api/todos","status":201,"duration_ms":7}
```

No PII is logged. `console.error` is used for unexpected exceptions inside the error handler.

### 4.7 Security baseline

- `helmet()` defaults.
- `express.json({ limit: "16kb" })` to bound request size.
- CORS allowlist via `CORS_ORIGIN` env var (comma-separated). `*` rejected when `NODE_ENV=production`.
- No cookies, no sessions in v1 → no CSRF surface.
- Parameterized queries everywhere; ESLint rule blocks string concatenation in repository files.
- No secrets in source; `.env.example` documents required env vars.

---

## 5. Data Model

### 5.1 Schema (`db/migrations/001_init.sql`)

```sql
CREATE TABLE IF NOT EXISTS todos (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  completed   INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos (created_at DESC);
```

### 5.2 Migration runner

A tiny synchronous runner reads `migrations/*.sql` in lexicographic order and applies any not yet recorded in a `schema_migrations` table. This keeps schema evolution explicit and reviewable.

### 5.3 Domain ↔ row mapping

| DB column | Domain field | Notes |
|---|---|---|
| `id` (TEXT) | `id` (string) | UUID v4 |
| `title` (TEXT) | `title` (string) | trimmed, 1–200 chars |
| `completed` (INTEGER 0/1) | `completed` (boolean) | mapped both ways |
| `created_at` (TEXT) | `createdAt` (string) | ISO 8601 |
| `updated_at` (TEXT) | `updatedAt` (string) | ISO 8601 |

### 5.4 Future-proofing for auth (NFR8)

Adding a `userId` later is non-breaking because:
- `Todo` is a closed shape today; adding a field is additive.
- The repository methods take an opaque `RepoContext` options object (defined in `backend/src/repositories/todos.repository.ts`) that's threaded through every call. The type is empty in v1 — adding `userId` to it then propagates through the entire stack via TypeScript without any method arity change. Controllers build the context via a `ctx(req)` helper that today returns `{}` and will return `{ userId: req.user.id }` once an auth middleware populates `req.user`.
- The matching service-layer signatures also accept `RepoContext` and pass it through unchanged.
- A migration `002_add_user_id.sql` would add a nullable `user_id` column and an index `(user_id, created_at DESC)`. A backfill is unnecessary in v1 because there are no users yet.

In other words: the v1 plumbing for per-user scoping is in place. The v2 work is (a) populate the context from auth, (b) add `WHERE user_id = ?` predicates inside the repository's SQL — both purely additive.

---

## 6. API Contract (final)

Base path: `/api`

| Method | Path | Purpose | Request | Success | Errors |
|---|---|---|---|---|---|
| GET | `/health` | Liveness | — | `200 { "status": "ok" }` | — |
| GET | `/todos` | List todos | — | `200 Todo[]` (newest first) | 500 |
| POST | `/todos` | Create | `{ title: string }` | `201 Todo` | 400 |
| PATCH | `/todos/:id` | Update | `{ title?, completed? }` | `200 Todo` | 400, 404 |
| DELETE | `/todos/:id` | Delete one | — | `204` | 404 |
| DELETE | `/todos?completed=true` | Bulk delete completed | — | `200 { "deleted": number }` | 400 (if `completed!=true`), 500 |

`Todo`:

```ts
type Todo = {
  id: string;        // uuid v4
  title: string;     // 1..200 chars
  completed: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
};
```

---

## 7. Frontend Architecture

### 7.1 State model

There are three kinds of state:

| State | Where it lives | Why |
|---|---|---|
| **Server state** (the todo list) | React Query cache | Caching, background refetch, optimistic updates with rollback. |
| **Form/UI state** (input value, toast queue) | Component `useState` | Trivial, local. |
| **Persistent UI choice** (active filter) | `localStorage` via small store | Survives refresh; only one value to keep. |

### 7.2 Component tree

```
<App>
  <Header />
  <TodoInput />               ← create
  <Filters />                 ← All / Active / Completed
  <TodoList>
    <TodoItem />*             ← toggle, delete
  </TodoList>
  <Footer />                  ← items-left counter, Clear completed
  <ToastHost />               ← stacked, auto-dismissing
</App>
```

### 7.3 Data fetching

`useTodos()` wraps `useQuery(["todos"], api.list)` with `staleTime: Infinity` (no background refetch needed for v1; user actions invalidate explicitly).

`useTodoMutations()` exposes `create`, `toggle`, `remove`, `clearCompleted`, each implemented with React Query's `onMutate` for optimistic updates and `onError` for rollback. The toast host renders an error toast with a `Retry` action that re-runs the mutation on click.

### 7.4 Optimistic UI rules

1. `onMutate` mutates the `["todos"]` cache to reflect the intended new state and returns the previous snapshot in `context`.
2. `onError` restores `context.previous`.
3. `onSuccess` reconciles by replacing the optimistic entry (where applicable) with the server's authoritative version.
4. The undo flow for delete is implemented as **deferred dispatch**: clicking delete schedules the `DELETE` for 5 s; clicking `Undo` cancels the timer; the row stays optimistically removed during the window and is restored on undo.

### 7.5 Accessibility

- Use `<form>` for the input so Enter submits naturally.
- Use `<ul>`/`<li>` for the list; checkboxes for completion (real `<input type="checkbox">`, not a styled div).
- Icon-only buttons get `aria-label`s ("Delete todo: <title>").
- Focus rings remain visible (no `outline: none` without a replacement).
- Color is never the only completion signal — strikethrough is also applied.

### 7.6 Styling

Plain CSS modules or a single global stylesheet (designer's choice). One accent color token for primary actions and the completion check; one surface color; one text color with reduced contrast for completed items. No web-fonts in v1.

---

## 8. Testing Strategy (by layer)

| Layer | Tool | What we test |
|---|---|---|
| **Unit (backend)** | Vitest | Service rules (trimming, validation propagation), repository against a temp SQLite file, error mapping. |
| **Integration (backend)** | Vitest + Supertest | Each route end-to-end against a real Express app and a temp DB, including failure paths. |
| **Persistence (backend)** | Vitest | Boot app, write data, dispose, re-instantiate against the same file, assert data survives. |
| **Unit (frontend)** | Vitest + RTL | Each component in isolation with mocked hooks. |
| **Integration (frontend)** | Vitest + RTL | App renders with React Query + MSW (mock service worker) covering happy-path and key failure paths (rollback). |
| **E2E (mandatory)** | **Playwright** | Full happy-path plus filter persistence and error-rollback scenarios; runs against the Docker-composed stack in CI. |

**Coverage targets (NFR6):** ≥ 80% line coverage on backend; key flows covered on frontend.

**Test data:** every test that touches the DB uses a fresh temp file (`tmp/todos-<rand>.db`) created in `beforeAll` and deleted in `afterAll`. No shared state between test files.

**Playwright setup (E2E):**
- Lives in `e2e/` at the monorepo root with its own `package.json` and `playwright.config.ts`.
- Targets the Compose stack: `webServer` config runs `docker compose up --build` (or assumes it is already up in CI) and waits for `http://localhost:5173` and `http://localhost:3001/api/health`.
- Resets state by calling the bulk delete endpoint in `beforeEach` so each test starts from a clean list.
- Runs in CI with `--reporter=html,line`; the HTML report is uploaded as an artifact.
- Tests are written against ARIA roles and accessible names (no fragile CSS selectors).

The full strategy with traceability to FR/NFR IDs lives in `docs/test-strategy.md`.

---

## 9. Deployment

### 9.1 Local (one command)

```
docker compose up --build
```

- `frontend` available at `http://localhost:5173`.
- `backend` available at `http://localhost:3001`.
- SQLite file lives in the named volume `todo-db` so `docker compose down && up` preserves data.

### 9.2 Any cloud

Both images are vanilla Linux containers with no cloud-specific dependencies. The deploy contract is:

1. Build and push `frontend` and `backend` images.
2. Deploy `backend` with a writable volume mounted at `/data` (the SQLite file). The volume is the unit of durability.
3. Deploy `frontend` (nginx) and route `/api/*` to the backend service.
4. Set `CORS_ORIGIN` on the backend to the public frontend origin.

This works on AWS ECS + EFS, Fly.io with a volume, Render with a persistent disk, a self-hosted VM with Docker, etc.

### 9.3 Configuration matrix

| Variable | Default | Required in prod | Notes |
|---|---|---|---|
| `PORT` (backend) | `3001` | no | Server bind port. |
| `DATABASE_PATH` | `/data/todos.db` (in container) | yes | Must point inside a persistent volume. |
| `CORS_ORIGIN` | `http://localhost:5173` | yes | Comma-separated; `*` rejected in production. |
| `NODE_ENV` | `development` | yes (`production`) | Controls log verbosity & CORS strictness. |

---

## 10. Key Architectural Decisions (ADRs, in brief)

| # | Decision | Why | Trade-off |
|---|---|---|---|
| ADR-1 | SQLite via `better-sqlite3` | Synchronous, zero-config, durable; fits single-user v1. | Single-writer; mitigated by Postgres migration path. |
| ADR-2 | Layered backend (controller/service/repo) | Testability, swap-friendliness for future auth. | Slightly more files than a "router-only" approach. |
| ADR-3 | React Query for server state | Built-in optimistic updates + rollback + retry. | New dependency; learning cost is small. |
| ADR-4 | Zod for validation | Single source of truth for runtime + types. | Adds a dep; worth it for the safety. |
| ADR-5 | Monorepo with shared `Todo` type | Eliminates client/server type drift. | Slightly more build wiring. |
| ADR-6 | Static frontend behind nginx | Smallest, fastest deploy; no Node in the public path. | A second container; trivial overhead. |
| ADR-7 | Docker named volume for the DB | Durable across restart/rebuild without bind-mount fragility. | Volume must be backed up out-of-band in prod. |

---

## 11. Risks Carried Forward

The brief's risk register applies. Mitigations are now reflected in concrete components:

- **R1 (Postgres migration):** repository abstraction (§4.5) + ADR-1 + the documented future migration in §5.4.
- **R2 (optimistic desync):** §7.4 mandates `onError` rollback and `onSuccess` reconciliation in every mutation.
- **R5 (volume → data loss):** §9 mandates a named volume; a persistence integration test verifies this (Story E2.S7).

---

## 12. Handoff to SM/Dev

The architecture is locked enough to begin implementation. Next steps:

1. **Scrum Master persona** turns the PRD epics + this architecture into per-story files under `docs/stories/` (already produced alongside this doc) and confirms ordering.
2. **Dev persona** implements stories E1.S1 → E4.S5 in order, using the Definition of Done in `docs/prd.md` §9.
3. **QA persona** reviews each completed story against the test scenarios defined in its story file.
