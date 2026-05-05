# Todo App — Test Strategy

**Authored by:** BMAD QA persona (in collaboration with Architect)
**Date:** 2026-05-01
**Status:** v1.0 — applies to v1 release

This document defines the overall testing approach across unit, integration, and E2E layers, the tooling, the coverage gates, and a traceability matrix from PRD requirements to story-level tests. Per-story scenarios live in each `docs/stories/*.md` file.

---

## 1. Testing Pyramid

```
                       /\
                      /E2\        ← Playwright (mandatory)
                     /----\          full happy path, filter persistence,
                    / Int  \         undo-delete, error rollback, a11y, responsive
                   /--------\
                  /  Unit    \   ← Vitest (backend + frontend)
                 /____________\
```

| Layer | Tool | Scope | Speed | Where |
|---|---|---|---|---|
| Unit (backend) | Vitest | Pure functions, schemas, repository against temp DB, controller/service in isolation | < 1 s/test | `backend/tests/unit` |
| Unit (frontend) | Vitest + RTL | Single components with mocked hooks | < 1 s/test | `frontend/src/**/__tests__` |
| Integration (backend) | Vitest + Supertest | Full Express app against a temp-file SQLite repo | < 2 s/test | `backend/tests/integration` |
| Integration (frontend) | Vitest + RTL + MSW | App-level flows with mocked HTTP | 1–3 s/test | `frontend/src/__tests__` |
| Persistence | Vitest | Boot, write, dispose, re-boot, read | < 2 s | `backend/tests/integration/persistence.test.ts` |
| E2E (mandatory) | **Playwright** | Real browser against Compose stack | 5–15 s/test | `e2e/tests/*.spec.ts` |

**Coverage targets (NFR6):** backend ≥ 80% line coverage; frontend key flows. Coverage is enforced in CI via `vitest --coverage` thresholds.

---

## 2. Tooling

| Concern | Tool | Why |
|---|---|---|
| Test runner | **Vitest** | Fast, ESM-native, TypeScript out of the box, same DX in both workspaces. |
| HTTP integration | **Supertest** | In-process Express testing without a port. |
| Frontend rendering | **React Testing Library** | A11y-first queries (roles/names) align with our a11y goals. |
| HTTP mocking | **MSW** | Realistic mocking at the network layer; works in Node + browser. |
| E2E | **Playwright** | First-class TS support, axe integration, video/screenshot artifacts, parallel browsers. |
| Accessibility | **axe-playwright** | Catches obvious violations as part of E2E. |
| Markdown lint | **markdownlint-cli2** | Keeps `docs/` tidy. |
| Dockerfile lint | **hadolint** | Catches common image issues. |

---

## 3. Test Data & Isolation Rules

1. **No shared state.** Every backend test that touches the DB uses a fresh temp file under `backend/tmp/` named with a random suffix; cleaned up in `afterAll`.
2. **Frontend tests never call the real backend.** All HTTP is mocked via MSW.
3. **E2E tests reset state in `beforeEach`** by calling `DELETE /api/todos?completed=true` and then deleting any remaining todos via the API. This is faster and more reliable than tearing the volume down between tests.
4. **Time control.** Use `vi.useFakeTimers()` where the test exercises the 5-second undo window or toast auto-dismiss.

---

## 4. CI Flow

Suggested CI job graph:

```
┌──────────────┐   ┌────────────────────┐   ┌──────────────────┐
│ install +    │ → │ lint + typecheck   │ → │ unit + integ.    │
│ cache deps   │   │ (lint, tsc, axe)   │   │ (vitest)         │
└──────────────┘   └────────────────────┘   └──────────────────┘
                                                       │
                                                       ▼
                                          ┌──────────────────────┐
                                          │ docker compose up    │
                                          │ --wait               │
                                          └──────────────────────┘
                                                       │
                                                       ▼
                                          ┌──────────────────────┐
                                          │ playwright run       │
                                          │ (HTML report uploaded)│
                                          └──────────────────────┘
```

A failure at any stage fails the build. Coverage thresholds are enforced in the `unit + integ.` step.

---

## 5. Traceability Matrix

Every PRD requirement traces to at least one story-level test scenario.

### Functional requirements

| Req | Description | Covered by (story → test layer) |
|---|---|---|
| FR1 | Add a todo | E3.S2 (U/I/E2E), E2.S3 (U/I) |
| FR2 | Reject empty title | E3.S2 (U/I), E2.S3 (U/I) |
| FR3 | List todos newest-first | E2.S2 (I), E3.S1 (I/E2E) |
| FR4 | Toggle completion | E3.S3 (U/I/E2E), E2.S4 (I) |
| FR5 | Visual differentiation of completed | E3.S3 (U), E4.S2 (E2E a11y) |
| FR6 | Delete with undo | E3.S4 (U/I/E2E), E2.S5 (I) |
| FR7 | Filter with localStorage persistence | E3.S5 (U/I/E2E) |
| FR8 | Clear completed | E3.S6 (U/I), E2.S6 (I) |
| FR9 | Empty state | E3.S1 (I) |
| FR10 | Loading state on initial fetch | E3.S1 (I) |
| FR11 | Non-blocking error toast + retry + rollback | E3.S2/S3/S4/S6/S7 (I), E2E error-rollback |
| FR12 | REST API for CRUD + bulk delete | E2.S2/S3/S4/S5/S6 (I) |
| FR13 | Input validation + structured errors | E2.S3/S4 (U/I) |
| FR14 | Persistent SQLite on volume | E2.S1, E2.S7 (I), E1.S4 (I) |
| FR15 | Items-left counter | E3.S6 (U/I) |

### Non-functional requirements

| Req | Description | Covered by |
|---|---|---|
| NFR1 | Optimistic UI < 100 ms | E3.S2/S3/S4/S6 (I) |
| NFR2 | Durability across restart | E2.S7 (I), E1.S4 (volume), E2E reload checks |
| NFR3 | Responsive 320–1920 px | E4.S1 (E2E) |
| NFR4 | A11y WCAG 2.1 AA | E4.S2 (U/I/E2E with axe) |
| NFR5 | Maintainability (TS strict, lint) | E1.S1 (CI lint/test), all stories typed |
| NFR6 | Coverage ≥ 80% backend | E4.S5 (CI gate) |
| NFR7 | Compose-up < 60 s | E1.S4 (I) |
| NFR8 | Extensible for `userId` | Architecture §5.4 + repo signature in E2.S1 |
| NFR9 | Security baseline | E4.S3 (U/I) |
| NFR10 | Structured request logs | E1.S2 (U/I), E4.S3 (U) |

---

## 6. What "good" looks like

- A new contributor can run `npm test --workspaces && npm run e2e` and see a green build in under 5 minutes locally.
- Each PR includes the story ID(s) it touches and the new/updated test scenarios.
- The Playwright HTML report makes failures self-explanatory (screenshots + traces).
- Coverage is enforced, not aspirational; the gate fails the build.

---

## 7. Out of scope for v1 testing

- Load / performance benchmarking (manual smoke is enough at v1 traffic).
- Cross-browser matrix beyond Chromium (Playwright supports it; defer to v2 if needed).
- Visual regression beyond responsive screenshots in CI.
- Mutation testing.
