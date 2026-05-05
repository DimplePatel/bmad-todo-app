# Epic E3 — Frontend Todo Experience

**Status:** Ready
**Owner:** Dev (with QA)
**Source:** `docs/prd.md` §7 — Epic E3; `docs/architecture.md` §7

## Goal
Deliver the user-facing app: list, add, complete, delete (with undo), filter, clear-completed, and the required empty/loading/error states — all with optimistic updates and rollback on failure.

## Scope (in)
- Main view with `TodoInput`, `TodoList`/`TodoItem`, `Filters`, `Footer`, `EmptyState`, `Skeleton`, `ToastHost`.
- React Query-based data layer (`useTodos`, `useTodoMutations`).
- `localStorage`-backed filter persistence.
- Reusable error toast with Retry.
- Items-left counter and "Clear completed" action.

## Scope (out)
- Inline title editing.
- Tags, priorities, deadlines, accounts.
- Real-time sync.
- Dark mode.

## Stories
| ID | Title | Status |
|---|---|---|
| E3.S1 | Fetch and render the todo list | Ready |
| E3.S2 | Add a todo (optimistic) | Ready |
| E3.S3 | Toggle completion (optimistic) | Ready |
| E3.S4 | Delete with undo | Ready |
| E3.S5 | Filter (All/Active/Completed) with persistence | Ready |
| E3.S6 | Items-left counter and "Clear completed" | Ready |
| E3.S7 | Error toast + retry pattern | Ready |

## Acceptance criteria roll-up
- All FRs in `docs/prd.md` §2.1 except FR12–FR14 (backend) and FR15 (counter, also covered here) are satisfied by code.
- Every mutation rolls back on API failure and shows a Retry toast.
- Filter selection survives page reload.
- Initial fetch shows a skeleton; subsequent mutations are optimistic.

## Dependencies
- Upstream: E1 (skeleton), E2 (working API).
- Downstream: E4 (polish, a11y, deploy).

## Definition of Done
1. All seven stories' ACs are satisfied.
2. `npm test --workspace=frontend` is green.
3. Manual exercise of the app on a 320 px viewport and a 1920 px viewport works (full a11y/responsive pass is in E4).
4. No `console.error` in normal happy-path operation.
