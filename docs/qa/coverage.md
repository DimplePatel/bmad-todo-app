# Test Coverage Report

**Last measured:** 2026-05-12
**Target:** ≥ 80% lines, ≥ 80% functions, ≥ 75% branches on backend (NFR6, enforced by CI); ≥ 70% on frontend (measured, not gated).
**Scope:** what % of the **source** code is exercised by the test suite. Test inventory and per-test mapping live in [`docs/test-strategy.md`](../test-strategy.md) §1 + §11.

---

## Headline

| Layer | Lines | Functions | Branches | Statements | Gate? |
|---|---:|---:|---:|---:|---|
| **Frontend** | **89.03%** | **95.23%** | **83.52%** | **89.03%** | Measured in CI, no failing threshold |
| **Backend** | **≥ 80%** (enforced) | ≥ 80% (enforced) | ≥ 75% (enforced) | ≥ 80% (enforced) | **Yes** — `backend/vitest.config.ts` thresholds + CI runs `--coverage` |
| E2E | n/a | n/a | n/a | n/a | Journey coverage, not line coverage. 19 cases across 8 spec files map to FRs in test-strategy §11. |

Both gates pass on every CI run (`.github/workflows/test.yml`). Coverage reports are uploaded as build artifacts and retained for 7 days.

---

## Frontend — per-source-file breakdown

```
File                          % Stmts  % Branch  % Funcs  % Lines   Uncovered
─────────────────────────────────────────────────────────────────────────────
All files                       89.03     83.52    95.23    89.03
 src
  App.tsx                       86.04     69.23    50.00    86.04   39–44
  main.tsx                       0.00      0.00     0.00     0.00   1–23 (intentional)
 src/api
  todos.ts                     100.00    100.00   100.00   100.00
 src/components
  EmptyState.tsx               100.00    100.00   100.00   100.00
  Filters.tsx                  100.00    100.00   100.00   100.00
  Footer.tsx                   100.00    100.00   100.00   100.00
  Skeleton.tsx                 100.00    100.00   100.00   100.00
  ToastHost.tsx                100.00     96.15   100.00   100.00   line 33 branch
  TodoInput.tsx                100.00    100.00   100.00   100.00
  TodoItem.tsx                  76.62     78.57   100.00    76.62   52–70 (deferred-delete fail path)
  TodoList.tsx                 100.00    100.00   100.00   100.00
 src/hooks
  useTodoMutations.ts          100.00     71.79   100.00   100.00   defensive `?? []` branches
  useTodos.ts                  100.00    100.00   100.00   100.00
 src/state
  filterStore.ts                92.30     80.00   100.00    92.30   15, 24 (empty catch bodies)
  pendingDeletes.ts            100.00    100.00   100.00   100.00
```

Backend per-file numbers vary by run (the local SQLite tests use temp paths); the gate ensures **every** run is ≥ 80%.

## Remaining intentional gaps

| File / lines | Why uncovered | Where it IS covered |
|---|---|---|
| `frontend/src/main.tsx` (0%) | Bootstrap entry — runs against the real DOM only, no value in instrumenting. | n/a (intentional) |
| `frontend/src/App.tsx:39–44` | The `Retry` button click handler inside the error banner. | Indirect: `mutations.test.tsx` asserts the banner appears; click path is sandbox-flaky. Caught by e2e if it ever broke. |
| `frontend/src/components/TodoItem.tsx:52–70` | The `api.remove` **failure path** inside the deferred-delete scheduled callback. Requires advancing fake timers across React Query's mutation queue, which races in JSDOM. | `e2e/tests/undo-delete.spec.ts` runs with real timers against a real browser. |
| `frontend/src/components/ToastHost.tsx:33` | Branch — the `Omit<Toast,"id">` spread where no `actionLabel` is provided. The other branch (with `actionLabel`) is covered. | n/a — defensive branch. |
| `frontend/src/hooks/useTodoMutations.ts:55, 63, 77, 79, 84` | Defensive `?? []` fallbacks for the case where React Query returns `undefined` data. In practice this only happens before the first load. | n/a — defensive code; trying to contort tests to hit it isn't worth the noise. |
| `frontend/src/state/filterStore.ts:15, 24` | V8 coverage quirk — empty catch bodies (no executable statements) aren't credited even when entered. The tests **do** exercise them (`filterStore.test.ts` "readFilter falls back" / "writeFilter swallows"). | `filterStore.test.ts` — verified the catch path runs without crashing. |
| `frontend/src/test/server.ts` (~71%) | MSW handler implementation for tests. Not production code; not all 400/404 branches are exercised by every spec. | n/a — defensive test scaffolding. |

The most consequential gap is `TodoItem.tsx:52–70`, the deferred-delete failure path. That code IS exercised end-to-end (Playwright `undo-delete.spec.ts`), just not at the unit layer. We accepted this trade-off when documenting D5 in [`docs/ai-integration-log.md`](../ai-integration-log.md).

---

## How to run coverage

### Locally

```bash
# Frontend (Vitest + @vitest/coverage-v8)
npm test --workspace=frontend -- --coverage
# Opens `frontend/coverage/` — open `index.html` for the interactive HTML report.

# Backend (will fail the build if thresholds drop below 80%)
npm test --workspace=backend -- --coverage
# Opens `backend/coverage/`.
```

### In CI

`.github/workflows/test.yml` runs both with `--coverage` on every push to `main` and every PR. Both coverage directories are uploaded as the `coverage-reports` artifact and retained for 7 days. To pull a specific run's coverage report:

1. Open the PR / commit in GitHub Actions.
2. Find the **Test** job's "Upload coverage reports" step.
3. Download the `coverage-reports` artifact.
4. Unzip and open `frontend/coverage/index.html` or `backend/coverage/index.html`.

---

## Maintenance contract

When adding a new test or refactoring, this report should be refreshed by re-running `npm test --workspace=frontend -- --coverage` and updating the per-file table above. The headline number changes whenever new files are added to `src/`; new tests should drive the same or higher number, never lower.
