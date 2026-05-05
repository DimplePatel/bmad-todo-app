# Project Brief: Todo App

**Authored by:** BMAD Analyst persona
**Date:** 2026-05-01
**Status:** Draft v1.0 — ready for PM refinement
**Owner:** Dimple Patel (dimple.patel@nearform.com)

---

## 1. Executive Summary

Build a deliberately minimal, single-user **Todo application** as a full-stack reference product. The system will let an individual create, view, complete, and delete personal tasks with a fast, responsive UI and a small, well-defined REST API persisting to a durable store. The first release intentionally excludes accounts, collaboration, prioritization, deadlines, and notifications. Success is measured by an unguided user being able to perform every core task-management action, by stability across refreshes/sessions, and by overall UX clarity. The stack chosen for delivery is **React (frontend) + Node.js/Express (backend) + SQLite (storage)**, packaged with **Docker** for portable deployment.

## 2. Problem Statement

Individuals need a clear, no-friction way to capture and manage day-to-day personal tasks. Existing tools either over-serve the use case (heavyweight project managers, team collaboration suites) or are inconsistent across devices and sessions. There is value in a focused, instantly-usable, single-purpose Todo experience that is also a clean technical foundation engineers can extend.

**Why now / why this:**
- Serves as a reference implementation of Spec-Driven Development via BMAD.
- Establishes a lightweight, durable baseline that future iterations (auth, multi-user, deadlines) can build on without rework.
- Demonstrates a complete delivery loop: PRD → Architecture → Stories → Tested code → Deployable artifact.

## 3. Vision & Goals

**Vision:** A clean, fast, single-user Todo app that feels finished despite its small surface area, and that any developer can read, run, and extend in under 10 minutes.

**Primary Goals (v1):**
1. Let a user manage personal tasks (create, list, complete, delete) without onboarding.
2. Persist tasks reliably across refreshes and restarts.
3. Deliver a polished UX with empty / loading / error states across desktop and mobile.
4. Ship as a Docker-packaged full-stack app that runs anywhere.
5. Keep the codebase simple, well-tested, and extensible.

**Non-Goals (v1):**
- User accounts, login, or any auth.
- Multi-user / sharing / collaboration.
- Task prioritization, deadlines, reminders, or notifications.
- Tags, projects, sub-tasks, attachments.
- Real-time sync across devices.

## 4. Target Users

**Primary persona — "Solo Sam":** An individual who wants to track their own short-lived tasks with zero setup. Needs the app to "just work," be accessible from phone or laptop, and feel instantaneous.

- **Tech savvy:** low to medium.
- **Devices:** mobile and desktop browsers.
- **Frequency:** opens the app multiple times per day.
- **Tolerance for friction:** very low — onboarding flows, account walls, or laggy interactions will cause abandonment.

**Secondary persona — "Extender Erin":** A developer evaluating the codebase as a starting point for a richer product. Cares about clean architecture, tests, and clear extension points (especially for adding auth and multi-user support later).

## 5. Success Metrics

| Metric | Target |
|---|---|
| First-time task creation without guidance | ≥ 95% of users complete on first try (usability test) |
| Perceived latency for add/toggle/delete | UI reflects change in < 100 ms; server round-trip < 300 ms p95 on broadband |
| Data durability | 0 task loss across refresh, restart, redeploy (verified by tests) |
| Cross-device usability | App is fully functional and readable on viewports 320 px–1920 px wide |
| Test coverage | ≥ 80% line coverage on backend; key UI flows covered by integration tests |
| Container startup | `docker compose up` produces a working app in < 60 s on a clean machine |

## 6. Scope

### In scope (v1)
- **CRUD for todos** (create, read list, update completion, delete).
- **Todo entity** with: `id`, `title` (short text), `completed` (boolean), `createdAt` (timestamp), `updatedAt` (timestamp).
- **Visual differentiation** of completed vs. active tasks.
- **Empty, loading, error states** in the UI.
- **Responsive layout** for mobile + desktop.
- **REST API** with documented endpoints + JSON contract.
- **Persistent storage** (SQLite file mounted as a Docker volume).
- **Dockerfile + docker-compose.yml** for one-command run.
- **Automated tests** (unit + integration) and CI-friendly scripts.
- **README** with setup, run, and deploy instructions.

### Out of scope (v1)
- Authentication / authorization.
- Multi-user data partitioning.
- Real-time updates (websockets).
- Server-side pagination / search / filtering beyond simple list.
- Push notifications, reminders, recurring tasks.
- Internationalization, theming, accessibility certification (basic a11y still expected).

### Future (post-v1, candidates)
- User accounts (email/password or OAuth) and per-user task isolation.
- Task descriptions, priorities, due dates.
- Tags / lists / projects.
- Sync + offline-first mode.
- Sharing / collaboration.

## 7. Key Functional Requirements (high-level)

1. User can add a todo by typing a short description and submitting.
2. User can see all todos on app open, in stable order (newest first by default).
3. User can toggle a todo's completion state in one tap/click.
4. User can delete a todo.
5. Completed todos are visually distinct (e.g., struck-through, dimmed).
6. The app shows a friendly empty state when there are no todos.
7. The app shows a non-blocking error state when the API fails, with retry guidance.
8. The app shows a loading indicator on initial fetch only (subsequent updates are optimistic).

## 8. Non-Functional Requirements (high-level)

- **Performance:** UI updates feel instant (optimistic); API p95 < 300 ms locally.
- **Reliability:** No data loss on refresh, restart, or redeploy. Graceful API error handling on both ends.
- **Maintainability:** Clear module boundaries (frontend / backend / data); typed code (TypeScript) end-to-end.
- **Portability:** Runs anywhere Docker runs; no cloud-vendor lock-in.
- **Extensibility:** Architecture must not block adding auth and multi-user later (i.e., a `userId` column can be added without redesign).
- **Security (basic):** Input validation, CORS configured, no secrets in source, OWASP top-10 awareness even in single-user mode.
- **Accessibility:** Keyboard-operable, semantic HTML, sufficient color contrast.

## 9. Constraints & Assumptions

**Constraints**
- Solo developer / small team; v1 should be deliverable in a small number of focused sprints.
- Stack is locked: **React + Node/Express + SQLite + Docker**.
- No paid services required to run v1.

**Assumptions**
- A single SQLite file is sufficient for v1 (single-user, low write volume).
- Browser environment is modern (last 2 versions of evergreen browsers).
- Network is generally available; offline mode is not required for v1.
- BMAD personas (Analyst → PM → Architect → SM → Dev → QA) will produce subsequent artifacts in order.

## 10. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | SQLite limits become a problem when auth/multi-user is added | Med | Med | Abstract data access (repository pattern); design migration path to Postgres documented in architecture step. |
| R2 | Optimistic UI desyncs from server on errors | Med | Med | Reconcile on every API response; show non-blocking error toast and rollback on failure. |
| R3 | Scope creep ("just one more feature") erodes simplicity goal | High | High | Hold the line on out-of-scope list; defer all non-CRUD features to v2 backlog. |
| R4 | Insufficient testing of failure paths | Med | Med | Require error-state tests in PRD acceptance criteria; QA persona checklist in story DoD. |
| R5 | Docker volume not configured → data loss on container rebuild | Low | High | Architecture doc must specify named volume for `db.sqlite`; integration test verifies persistence across restart. |
| R6 | A11y / mobile gaps discovered late | Med | Low | Bake responsive + a11y checks into UI stories' acceptance criteria. |

## 11. Dependencies

- **None external** for v1 (no third-party APIs, no paid services).
- Tooling: Node.js 20+, npm/pnpm, Docker, modern browser.

## 12. Open Questions for PM

1. Should the list default to newest-first, or should completed items sink to the bottom?
2. Maximum length of a todo title? (Suggest 200 chars.)
3. Should deletion be immediate, or with a brief undo affordance?
4. Should we support inline editing of a todo's title in v1?
5. Should the app remember filter state (all / active / completed) across reloads via `localStorage`?
6. Is a basic "clear completed" bulk action in or out of v1?

## 13. Inputs Used

- Original PRD provided by Dimple Patel on 2026-05-01 (single-paragraph product description; preserved verbatim in conversation history).
- BMAD-METHOD analyst conventions (problem framing, scope discipline, risk register, open questions).

## 14. Recommended Next Step

Hand this brief to the **PM persona** to produce a refined PRD (`docs/prd.md`) with: explicit FR/NFR list, UI/UX goals, technical assumptions, epic list, and per-epic stories with acceptance criteria.
