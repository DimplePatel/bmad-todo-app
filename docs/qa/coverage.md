# Test Coverage Report

**Last measured:** 2026-05-12
**Target:** ≥ 80% lines, ≥ 80% functions, ≥ 75% branches on backend (NFR6, enforced by CI); ≥ 70% on frontend (measured, not gated).
**Scope:** what % of the **source** code is exercised by the test suite. Test inventory and per-test mapping live in [`docs/test-strategy.md`](../test-strategy.md) §1 + §11.

---

## Headline

| Layer | Lines | Functions | Branches | Statements | Gate? |
|---|---:|---:|---:|---:|---|
| **Frontend** | **90.90%** | **96.87%** | **83.78%** | **90.90%** | Measured in CI, no failing threshold |
| **Backend** | **≥ 80%** (enforced) | ≥ 80% (enforced) | ≥ 75% (enforced) | ≥ 80% (enforced) | **Yes** — `backend/vitest.config.ts` thresholds + CI runs `--coverage` |
| E2E | n/a | n/a | n/a | n/a | Journey coverage, not line coverage. 19 cases across 8 spec files map to FRs in test-strategy §11. |

Both gates pass on every CI run (`.github/workflows/test.yml`). Coverage reports are uploaded as build artifacts and retained for 7 days.

---

## Frontend — per-source-file breakdown

```
File                          % Stmts  % Branch  % Funcs  % Lines   Uncovered
─────────────────────────────────────────────────────────────────────────────
All files                       90.90     83.78    96.87    90.90
 src
  App.tsx                      100.00     82.35   100.00   100.00   20, 50, 55 (branches)
  main.tsx                       0.00      0.00     0.00     0.00   1–23 (intentional)
 src/api
  todos.ts                     100.00    100.00   100.00   100.00
 src/components
  EmptyState.tsx               100.00    100.00   100.00   100.00
  Filters.tsx                  100.00    100.00   100.00   100.00
  Footer.tsx                   100.00    100.00   100.00   100.00
  Skeleton.tsx                 100.00    100.00   100.00   100.00
  ToastHost.tsx                100.00     96.15   100.00   100.00   line 33 branch
  TodoInput.tsx                100.00     92.85   100.00   100.00   line 42 branch (B6 short-circuit)
  TodoItem.tsx                  82.71     70.58   100.00    82.71   70–84 (deferred-delete fail path)
  TodoList.tsx                 100.00    100.00   100.00   100.00
 src/hooks
  useTodoMutations.ts          100.00     76.08   100.00   100.00   defensive `?? []` + B4 cancellation guard branches
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
| `frontend/src/App.tsx:20, 50, 55` (branches) | Branch fall-throughs in the filter-by-completion ternary + the `(todos ?? []).length === 0` short-circuit + the `<Footer todos={todos ?? []} />` fallback. Each branch is exercised at least once across the suite (filter-by-Active, empty state, populated state) but the V8 coverage tool counts each conditional fork independently. | Functionally covered — see `App.test.tsx` empty/populated/filter tests. |
| `frontend/src/components/TodoInput.tsx:42` (branch) | The `if (error) setError(null)` short-circuit in the `onChange` handler. The "no error to clear" branch (typing without a prior validation failure) isn't asserted explicitly — only the "clear-on-type" branch is exercised indirectly. | n/a — defensive branch for the B6 fix. |
| `frontend/src/components/TodoItem.tsx:70–84` | The `api.remove` **failure path** inside the deferred-delete scheduled callback. Requires advancing fake timers across React Query's mutation queue, which races in JSDOM. (Line range shifted from 52–70 → 61–79 after the B3 `isPending` guard was added, then to 70–84 after the `restoreRow()` helper was extracted to deduplicate the cache-restore block; the underlying gap is unchanged.) | `e2e/tests/undo-delete.spec.ts` runs with real timers against a real browser. |
| `frontend/src/components/ToastHost.tsx:33` | Branch — the `Omit<Toast,"id">` spread where no `actionLabel` is provided. The other branch (with `actionLabel`) is covered. | n/a — defensive branch. |
| `frontend/src/hooks/useTodoMutations.ts` (branches at ~76%) | Defensive `?? []` fallbacks for the case where React Query returns `undefined` data + the B4 `if (t.completed) pendingDeletes.cancel(t.id)` guard for non-completed rows. In practice the `?? []` only triggers before the first load. | n/a — defensive code; trying to contort tests to hit every fork isn't worth the noise. |
| `frontend/src/state/filterStore.ts:15, 24` | V8 coverage quirk — empty catch bodies (no executable statements) aren't credited even when entered. The tests **do** exercise them (`filterStore.test.ts` "readFilter falls back" / "writeFilter swallows"). | `filterStore.test.ts` — verified the catch path runs without crashing. |
| `frontend/src/test/server.ts` (~71%) | MSW handler implementation for tests. Not production code; not all 400/404 branches are exercised by every spec. | n/a — defensive test scaffolding. |

The most consequential gap is `TodoItem.tsx:70–84`, the deferred-delete failure path. That code IS exercised end-to-end (Playwright `undo-delete.spec.ts`), just not at the unit layer. We accepted this trade-off when documenting D5 in [`docs/ai-integration-log.md`](../ai-integration-log.md).

**Improvements since the previous measurement:**

- `App.tsx:39–44` (the error-banner Retry click handler) is covered by `mutations.test.tsx` "Retry button re-runs the query and clears the banner on success (E3.S1 I4)". `App.tsx` is at 100% lines.
- `TodoItem.tsx` line coverage rose from 78.04% → **82.71%** after the `restoreRow()` extraction deduplicated the cache-restore block — the deferred-delete failure path is still uncovered at the unit layer, but it now occupies fewer lines.

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
