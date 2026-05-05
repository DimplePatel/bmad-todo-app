# Todo App — Product Requirements Document (PRD)

**Authored by:** BMAD PM persona
**Date:** 2026-05-01
**Status:** Draft v1.0 — ready for Architect handoff
**Inputs:** `docs/project-brief.md` (Analyst) + original PRD from Dimple Patel
**Stack (locked):** React + Node.js/Express + SQLite, packaged via Docker

---

## 1. Goals and Background Context

### 1.1 Goals
- Deliver a single-user Todo app that supports create, list, complete, and delete with zero onboarding.
- Persist data durably across refreshes, restarts, and redeploys.
- Provide a fast, responsive, polished UX (mobile + desktop) with empty / loading / error states.
- Ship a small, well-defined REST API with documented contracts.
- Package the full stack with Docker so it runs anywhere with one command.
- Maintain a clean, typed, well-tested codebase that future iterations (auth, multi-user) can extend without rework.

### 1.2 Background context
This PRD refines the original product description into testable requirements and Dev-ready stories. The Analyst's project brief established scope discipline (no auth, no collaboration, no priorities/deadlines in v1) and a risk register highlighting Docker volume durability, optimistic-UI desync, and scope creep. The PM persona's job here is to lock requirements, resolve ambiguities, and shape epics that can be sharded into stories by the Scrum Master.

### 1.3 Decisions resolved from the brief's open questions
| # | Question | PM Decision |
|---|---|---|
| Q1 | Default sort order? | Newest-first by `createdAt desc`. Completed items remain in place (not sunk). |
| Q2 | Max title length? | 200 characters; enforced client- and server-side. |
| Q3 | Deletion behaviour? | Immediate delete with a 5-second toast offering "Undo". |
| Q4 | Inline edit of titles? | **Out of scope for v1.** Tracked in v2 backlog. |
| Q5 | Persist filter state? | Yes — store the active filter in `localStorage`. |
| Q6 | "Clear completed" bulk action? | **In scope for v1.** Single button visible when ≥ 1 completed todo exists; confirms with a toast. |

### 1.4 Change Log
| Date | Version | Description | Author |
|---|---|---|---|
| 2026-05-01 | 1.0 | Initial PRD from project brief | PM |

---

## 2. Requirements

Requirements are numbered for traceability. **FR** = functional, **NFR** = non-functional. Every FR/NFR must trace to at least one acceptance criterion in §6.

### 2.1 Functional Requirements

- **FR1** The system shall allow a user to create a todo by entering a title (1–200 characters) and submitting.
- **FR2** The system shall reject empty or whitespace-only titles, both client- and server-side, with a clear inline error.
- **FR3** The system shall display all todos on app open, sorted by `createdAt` descending.
- **FR4** The system shall allow toggling a todo's completion state with a single click/tap on a checkbox or row affordance.
- **FR5** The system shall visually differentiate completed todos (strikethrough + reduced contrast) from active ones.
- **FR6** The system shall allow deleting a todo with a single click/tap, surfacing a 5-second toast with an "Undo" affordance that restores the todo if pressed.
- **FR7** The system shall provide a filter control with three states: **All / Active / Completed**, and persist the selected filter to `localStorage`.
- **FR8** The system shall provide a "Clear completed" action, visible only when at least one completed todo exists, that deletes all completed todos in a single API call.
- **FR9** The system shall show a friendly empty state when no todos exist (after loading completes).
- **FR10** The system shall show a loading state on the initial fetch only; subsequent mutations are optimistic.
- **FR11** The system shall show a non-blocking error notification when an API call fails, with a "Retry" affordance, and shall roll back any optimistic UI change.
- **FR12** The backend shall expose a REST API for CRUD on todos and a bulk delete-completed endpoint (see §5).
- **FR13** The backend shall validate all inputs and return appropriate HTTP status codes and error bodies.
- **FR14** The backend shall persist todos to a SQLite database file mounted on a Docker volume so data survives container restarts and rebuilds.
- **FR15** The system shall display the count of remaining (active) todos somewhere persistent in the UI (e.g., footer: "3 items left").

### 2.2 Non-Functional Requirements

- **NFR1 — Performance:** UI shall reflect user actions within 100 ms (optimistic). API p95 latency < 300 ms on a developer-grade machine for all endpoints.
- **NFR2 — Reliability:** Zero todo loss across refresh, container restart, or redeploy. Verified by an integration test that restarts the backend and re-reads the list.
- **NFR3 — Responsiveness:** UI is fully usable and readable on viewports from 320 px to 1920 px wide; touch targets ≥ 44 × 44 px on mobile.
- **NFR4 — Accessibility:** Keyboard-operable for all flows; semantic HTML; WCAG 2.1 AA color contrast on all text and controls.
- **NFR5 — Maintainability:** TypeScript end-to-end; ESLint + Prettier configured; clear module boundaries (`frontend/`, `backend/`, shared types optional).
- **NFR6 — Test coverage:** ≥ 80% line coverage on backend; happy-path + key error-path integration tests on the frontend.
- **NFR7 — Portability:** `docker compose up` from a clean checkout produces a working app within 60 seconds on broadband.
- **NFR8 — Extensibility:** Data model and API designed so a `userId` column / scope can be added without breaking changes to the public API shape.
- **NFR9 — Security baseline:** Input length and type validation; CORS configured; no secrets in source; helmet-style HTTP headers; no SQL injection (parameterized queries only).
- **NFR10 — Observability (light):** Backend logs each request with method, path, status, and duration to stdout in a format suitable for container log aggregation.

---

## 3. UI Design Goals

### 3.1 Overall UX vision
A single-screen, calm, instantly-usable list view. No marketing chrome, no onboarding, no modals for primary flows. The interface should feel like a native app on first paint and remain readable on a 320 px phone.

### 3.2 Key interaction principles
- **One-screen primary flow.** Everything for managing todos is on the main view.
- **Optimistic and forgiving.** Every mutation appears instant; failures are recoverable, not destructive.
- **Quiet by default.** Errors surface as non-blocking toasts, not modals.
- **Keyboard-friendly.** Enter submits a new todo from the input; Tab order matches visual order.

### 3.3 Core screens / views (v1)
- **Main Todo View** — input field at top, list of todos, footer with count + filter chips + "Clear completed".
- **Empty state** — soft illustration or icon + "Add your first todo" hint.
- **Loading state** — list-skeleton or subtle spinner on initial fetch only.
- **Error state** — toast with message + Retry; no full-screen errors.

### 3.4 Branding / aesthetic
- Neutral, minimal palette; one accent color for primary actions and the completion check.
- System font stack (no web-font request blocking first paint).
- Light mode in v1; dark mode is a v2 candidate.

### 3.5 Target devices and platforms
Modern evergreen browsers (last 2 versions) on desktop, tablet, and mobile. No native apps in v1.

### 3.6 Accessibility target
WCAG 2.1 AA where reasonably achievable in v1 (color contrast, keyboard nav, semantic markup, visible focus rings, accessible names on icon buttons).

---

## 4. Technical Assumptions

These constrain the Architect's design decisions.

### 4.1 Stack
- **Frontend:** React 18+ with Vite, TypeScript, function components + hooks. Lightweight state via React Query (or equivalent) for server state; component state for UI.
- **Backend:** Node.js 20+ with Express 4 (or 5 if stable) in TypeScript. Routes layered as `controller → service → repository`.
- **Database:** SQLite via `better-sqlite3` (synchronous, simple, durable). Schema versioned via lightweight migration scripts.
- **Container:** Multi-stage Dockerfiles for frontend and backend; `docker-compose.yml` orchestrates both, with a named volume for the SQLite file.

### 4.2 Repository structure
- **Monorepo** (single Git repo) with `frontend/` and `backend/` workspaces. Optional shared `packages/types` for the Todo TypeScript types.

### 4.3 Service architecture
- **Two services**, one frontend (static-built and served by nginx in prod) and one backend (Express). Frontend talks to backend via `/api/*` proxied in dev and same-origin or env-configured base URL in prod.

### 4.4 Testing strategy
- **Backend:** Vitest or Jest for unit tests; Supertest for HTTP integration tests against an in-process Express app + a temp SQLite file.
- **Frontend:** Vitest + React Testing Library for component tests; **Playwright (mandatory)** for E2E covering happy path, filter persistence, undo-delete, error rollback, accessibility (axe), and responsive viewports.
- **CI-friendly:** All tests run via `npm test` at each workspace; root-level script runs both.

### 4.5 Other assumptions
- No analytics, telemetry, or third-party tracking in v1.
- No CI/CD provider is mandated; project must be CI-friendly (deterministic tests, no manual steps).
- Configuration via environment variables only (12-factor): `PORT`, `DATABASE_PATH`, `CORS_ORIGIN`.

---

## 5. API Contract (preliminary)

The Architect persona will finalize this; the PM locks the shape so stories are testable.

| Method | Path | Purpose | Body | 200 / 201 Response | Notable errors |
|---|---|---|---|---|---|
| GET | `/api/todos` | List all todos | — | `Todo[]` sorted by `createdAt desc` | 500 |
| POST | `/api/todos` | Create a todo | `{ title: string }` | `Todo` (201) | 400 if title invalid |
| PATCH | `/api/todos/:id` | Update completion (and, future-proof, title) | `{ completed?: boolean, title?: string }` | `Todo` | 400, 404 |
| DELETE | `/api/todos/:id` | Delete a single todo | — | `204 No Content` | 404 |
| DELETE | `/api/todos?completed=true` | Bulk delete completed | — | `{ deleted: number }` | 500 |
| GET | `/api/health` | Liveness probe | — | `{ status: "ok" }` | — |

**Todo type:**
```ts
type Todo = {
  id: string;          // uuid v4
  title: string;       // 1..200 chars
  completed: boolean;
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
};
```

---

## 6. Epic List

The work is organized into four epics, each independently shippable and each delivering observable user or developer value. Stories within each epic are sequenced so a Dev agent can complete them in order.

| # | Epic | Goal | User-visible outcome |
|---|---|---|---|
| **E1** | Project Foundation & Health | Bootstrap the monorepo, tooling, Docker, and a `/api/health` endpoint. | A Dev can `docker compose up` and hit a working health endpoint from a browser. |
| **E2** | Backend CRUD API & Persistence | Implement the `/api/todos` endpoints backed by SQLite with full validation and tests. | A user (or curl) can create, list, update, and delete todos that survive container restarts. |
| **E3** | Frontend Todo Experience | Build the main view: list, add, complete, delete, filter, clear-completed, plus empty/loading/error states. | A user opens the app and manages tasks end-to-end on desktop and mobile. |
| **E4** | Polish, A11y & Deploy Readiness | Tighten responsiveness, accessibility, optimistic UI reconciliation, observability, and deploy docs. | The app feels finished; README explains run + deploy; CI-friendly tests pass. |

---

## 7. Epic Details

Each story below uses the form **As a [actor], I want [capability], so that [outcome]** with explicit acceptance criteria. ACs map back to FR/NFR IDs from §2.

### Epic E1 — Project Foundation & Health

**Epic goal:** Establish a runnable, testable, containerized skeleton so all subsequent stories have a stable base.

#### Story E1.S1 — Initialize monorepo & tooling
*As a developer, I want a typed monorepo with linting, formatting, and test runners wired up, so that all subsequent stories build on consistent tooling.*

**Acceptance criteria:**
1. Monorepo created with `frontend/` and `backend/` workspaces.
2. TypeScript configured in both workspaces with strict mode.
3. ESLint + Prettier configured with shared root config; `npm run lint` succeeds.
4. Vitest (or Jest) installed in both workspaces; a placeholder test passes.
5. Root `README.md` describes how to install, run, lint, and test.

#### Story E1.S2 — Express backend skeleton with `/api/health`
*As a developer, I want a minimal Express server in TypeScript with a health endpoint, so that I can verify the backend boots correctly.*

**Acceptance criteria:**
1. `backend/` runs on `PORT` (default `3001`) via `npm run dev`.
2. `GET /api/health` returns `200` with `{ "status": "ok" }`.
3. Each request logs method, path, status, and duration to stdout (NFR10).
4. A Supertest integration test asserts the health endpoint contract.

#### Story E1.S3 — React frontend skeleton
*As a developer, I want a Vite-based React app in TypeScript, so that I have a place to build the Todo UI.*

**Acceptance criteria:**
1. `frontend/` boots with `npm run dev`, serving on `PORT` (default `5173`).
2. The app renders a placeholder "Todo App" header.
3. Vite dev-server proxies `/api` → `http://localhost:3001` for local dev.
4. A React Testing Library smoke test renders the root component without crashing.

#### Story E1.S4 — Dockerfiles + docker-compose
*As a developer, I want one-command local startup, so that anyone can run the app from a clean checkout.*

**Acceptance criteria:**
1. Multi-stage `Dockerfile` for `backend/` produces a small production image.
2. Multi-stage `Dockerfile` for `frontend/` produces a static build served by nginx.
3. `docker-compose.yml` brings up both services; frontend reaches backend at the documented base URL.
4. A named Docker volume (`todo-db`) is mounted to the backend so the SQLite file persists across `docker compose down && up`.
5. `docker compose up` from a clean checkout produces a working app in < 60 s on a typical machine (NFR7).

---

### Epic E2 — Backend CRUD API & Persistence

**Epic goal:** Implement and harden the REST API with SQLite persistence, full validation, and tests.

#### Story E2.S1 — SQLite schema + repository
*As a developer, I want a typed repository with a versioned schema, so that data access is consistent and migrations are explicit.*

**Acceptance criteria:**
1. SQLite database file path is configurable via `DATABASE_PATH` env var (default `./data/todos.db`).
2. A migration on startup creates the `todos` table with columns: `id TEXT PRIMARY KEY`, `title TEXT NOT NULL`, `completed INTEGER NOT NULL DEFAULT 0`, `created_at TEXT NOT NULL`, `updated_at TEXT NOT NULL`.
3. A `TodoRepository` exposes `list()`, `create()`, `update()`, `delete()`, `deleteCompleted()` with parameterized queries (NFR9).
4. A migration also adds an index on `created_at DESC` for list ordering.
5. Unit tests cover each repository method against a temp SQLite file.

#### Story E2.S2 — `GET /api/todos`
*As a user, I want to retrieve all my todos in newest-first order, so that the frontend can render the list.*

**Acceptance criteria (FR3):**
1. Returns `200` with a JSON array of `Todo` sorted by `createdAt desc`.
2. Returns `[]` when the table is empty.
3. Integration test asserts ordering with seeded data.

#### Story E2.S3 — `POST /api/todos`
*As a user, I want to create a todo, so that I can capture a task.*

**Acceptance criteria (FR1, FR2, FR13):**
1. Body schema validated; `title` must be a string of length 1–200 after trim.
2. On success, returns `201` with the new `Todo` (server-generated `id`, `createdAt`, `updatedAt`; `completed=false`).
3. Empty/whitespace-only or oversized titles return `400` with `{ error: "..." }`.
4. Integration tests cover success and each validation failure.

#### Story E2.S4 — `PATCH /api/todos/:id`
*As a user, I want to toggle a todo's completion (and, future-proof, edit its title), so that I can track progress.*

**Acceptance criteria (FR4, FR13, NFR8):**
1. Accepts `{ completed?: boolean, title?: string }`; at least one field required.
2. Returns the updated `Todo` with refreshed `updatedAt`.
3. `404` if `id` does not exist.
4. `400` if body is empty or fields fail validation.
5. Integration tests cover success, 404, and 400 paths.

#### Story E2.S5 — `DELETE /api/todos/:id`
*As a user, I want to delete a todo, so that I can remove it from my list.*

**Acceptance criteria (FR6):**
1. Returns `204 No Content` on success.
2. `404` if `id` does not exist.
3. Integration tests cover both paths.

#### Story E2.S6 — Bulk delete completed
*As a user, I want to clear all completed todos in one action, so that I can tidy my list quickly.*

**Acceptance criteria (FR8):**
1. `DELETE /api/todos?completed=true` removes all rows with `completed=1` and returns `{ deleted: <count> }`.
2. With no completed rows, returns `{ deleted: 0 }`.
3. Integration test asserts the count and that active todos are untouched.

#### Story E2.S7 — Persistence across restart
*As a developer, I want a test that proves data survives a backend restart, so that NFR2 is verified.*

**Acceptance criteria (NFR2):**
1. Integration test creates todos, restarts the backend (or re-instantiates the app against the same DB file), and asserts the same todos are returned.

---

### Epic E3 — Frontend Todo Experience

**Epic goal:** Deliver the user-facing app: list, add, complete, delete, filter, clear-completed, and the required empty/loading/error states.

#### Story E3.S1 — Fetch and render the todo list
*As a user, I want to see my todos when I open the app, so that I know what's on my plate.*

**Acceptance criteria (FR3, FR9, FR10):**
1. On mount, the app calls `GET /api/todos` and renders the result.
2. While loading, a skeleton/spinner is shown (initial fetch only).
3. When the list is empty, an empty state component is shown with a hint to add the first todo.
4. Component test covers all three states with mocked fetch.

#### Story E3.S2 — Add a todo (with optimistic UI)
*As a user, I want to type a task and press Enter to add it, so that capture is instant.*

**Acceptance criteria (FR1, FR2, NFR1):**
1. The input accepts 1–200 characters; submitting empty/whitespace shows an inline error and does not call the API.
2. On submit, the UI optimistically adds the new todo at the top.
3. On API success, the optimistic entry is replaced with the server's response (true `id`, timestamps).
4. On API failure, the optimistic entry is removed and an error toast with "Retry" appears (FR11).
5. Component test covers happy path and failure rollback.

#### Story E3.S3 — Toggle completion
*As a user, I want to mark a todo done with one click, so that I can update status quickly.*

**Acceptance criteria (FR4, FR5, NFR1):**
1. A checkbox toggles `completed`; the row updates optimistically (strikethrough + dimmed text).
2. On API success, the response replaces the optimistic state.
3. On API failure, the toggle reverts and an error toast is shown.
4. Component test covers happy path and failure rollback.

#### Story E3.S4 — Delete with undo
*As a user, I want to delete a todo and have a brief undo window, so that mistakes are recoverable.*

**Acceptance criteria (FR6):**
1. Clicking delete optimistically removes the row.
2. A toast appears for 5 s with an "Undo" button. If pressed, the todo is restored locally and a fresh `POST` is issued **only if the original DELETE has already been confirmed**; otherwise the pending DELETE is cancelled.
3. After 5 s, the DELETE is committed (if not already cancelled).
4. On API failure, the row is restored and an error toast is shown.
5. Component test covers undo, no-undo, and failure paths.

#### Story E3.S5 — Filter (All / Active / Completed) with persistence
*As a user, I want to focus on active or completed todos, so that I can declutter my view.*

**Acceptance criteria (FR7):**
1. Three filter chips: All, Active, Completed; the current filter is visually emphasized.
2. The filter selection is persisted to `localStorage` and restored on next load.
3. Filtering is purely client-side over the already-fetched list (no extra API call in v1).
4. Component test covers persistence and switching.

#### Story E3.S6 — Items-left counter and "Clear completed"
*As a user, I want a count of remaining tasks and a quick way to clear finished ones, so that the list stays focused.*

**Acceptance criteria (FR8, FR15):**
1. A footer shows "N items left" where N is the count of `completed=false` todos.
2. A "Clear completed" button is visible only when ≥ 1 completed todo exists.
3. Clicking the button calls the bulk-delete endpoint and optimistically removes all completed rows; on failure they are restored and an error toast is shown.
4. Component test covers visibility, click, and failure rollback.

#### Story E3.S7 — Error toast + retry pattern
*As a user, I want clear, non-blocking feedback when something goes wrong, so that I can keep working.*

**Acceptance criteria (FR11):**
1. A reusable toast component is available app-wide.
2. All API failures surface a toast with a human-readable message and a "Retry" affordance that reissues the failed request.
3. Toasts auto-dismiss after 5 s unless interacted with.
4. Component test covers display, retry, and dismissal.

---

### Epic E4 — Polish, A11y & Deploy Readiness

**Epic goal:** Make the app feel finished and ready to hand off.

#### Story E4.S1 — Responsive layout (320 px → 1920 px)
**Acceptance criteria (NFR3):**
1. The list renders cleanly at 320 px wide; touch targets are ≥ 44 × 44 px.
2. At desktop widths, the content is constrained to a readable column (max width ~640 px) and centered.
3. Visual regression test or manual checklist captured in the story.

#### Story E4.S2 — Keyboard & accessibility pass
**Acceptance criteria (NFR4):**
1. All interactive elements are reachable and operable via keyboard with visible focus rings.
2. Icon-only buttons (delete, clear) have accessible names via `aria-label`.
3. Color contrast on text and primary actions meets WCAG 2.1 AA (verified with a contrast checker).
4. List items use semantic markup (`<ul><li>` or appropriate roles).

#### Story E4.S3 — Backend hardening (security baseline + observability)
**Acceptance criteria (NFR9, NFR10):**
1. `helmet` middleware enabled with sensible defaults.
2. CORS configured via `CORS_ORIGIN` env var; `*` not allowed in production.
3. Request logger middleware in place (method, path, status, duration).
4. A unit test confirms helmet is wired and an integration test confirms CORS behaviour.

#### Story E4.S4 — README + deploy docs
**Acceptance criteria:**
1. Root `README.md` covers: prerequisites, local dev (without Docker), local dev (with Docker), running tests, env vars, and a "Deploy anywhere" section explaining the named volume and image build.
2. A `.env.example` is provided for both workspaces.
3. The README includes a one-paragraph "Architecture at a glance" with a small ASCII diagram.

#### Story E4.S5 — Final integration test pass
**Acceptance criteria (NFR2, NFR6):**
1. Backend coverage report shows ≥ 80% line coverage.
2. A persistence test brings the backend up, writes data, brings it down, brings it back up, and asserts the data is still there.
3. A frontend happy-path test (Playwright optional but encouraged) creates, completes, and deletes a todo.

---

## 8. Out-of-Scope (v1) — explicit list

- Authentication, authorization, accounts of any kind.
- Multi-user data partitioning, sharing, or collaboration.
- Real-time updates (websockets, server-sent events).
- Inline title editing of an existing todo.
- Tags, projects, sub-tasks, attachments, descriptions.
- Priorities, deadlines, reminders, recurring tasks, notifications (push or email).
- Server-side pagination, search, or sort beyond `createdAt desc`.
- Offline-first sync.
- i18n / localization.
- Analytics / telemetry.

These are tracked as candidates for v2 in `docs/project-brief.md` §6.

---

## 9. Definition of Done (v1)

The release is shippable when **all** are true:
1. All FR and NFR have at least one passing acceptance criterion in code.
2. `docker compose up` from a clean checkout produces a working app in < 60 s.
3. Backend line coverage ≥ 80%; frontend key flows covered.
4. Persistence integration test passes (NFR2).
5. README explains how to run, test, and deploy; `.env.example` files exist.
6. No `TODO`/`FIXME` markers in production paths without an associated issue.
7. PM and (later) Architect have reviewed and signed off on the artifacts.

---

## 10. Checklist — PM Self-Review

- [x] Goals are concrete and measurable.
- [x] Every FR is testable; every NFR has a measurable target.
- [x] Open questions from the brief are resolved (§1.3).
- [x] Out-of-scope list is explicit and complete (§8).
- [x] Epics are independently shippable and ordered for incremental value.
- [x] Stories are sized to fit a single Dev agent run with clear ACs.
- [x] API contract is locked enough for the Architect to refine without breaking changes.
- [x] Risks from the brief have at least one mitigation reflected in stories or NFRs.

---

## 11. Next Step (BMAD handoff)

Hand this PRD to the **Architect persona** to produce `docs/architecture.md`, covering:
1. System diagram (frontend ⇄ backend ⇄ SQLite + Docker boundaries).
2. Backend module layout (`controllers`, `services`, `repositories`, `validators`, `db/migrations`).
3. Frontend component tree, state model, and data-fetching pattern.
4. Test strategy by layer.
5. Deployment topology (Compose for local; image-based deploy for any cloud), including the SQLite volume contract.
6. Migration path documentation for adding a `userId` column without breaking the public API (NFR8).
