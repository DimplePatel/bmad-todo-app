# AI Integration Log — BMAD Todo App

**Author:** Dimple Patel (with Claude as the working agent)
**Period covered:** Full project arc — BMAD Steps 1–4 (specs → build → containerize → QA), plus all follow-on work: Docker hardening, GitHub setup, local-machine bring-up, multiple e2e iteration rounds, spec audits, RepoContext refactor, accessibility hardening, security review, CI workflow, and QA documentation restructuring.
**Last updated:** 2026-05-12

This log is a single retrospective covering how AI was used to take the project from a single-paragraph PRD to a tested, containerized, CI-gated v1. It's a project artifact, not a sales pitch. The point is to leave behind an honest record of what AI did well, what it got wrong, and where human judgement was load-bearing — so the next person who picks up the project (human or agent) can calibrate trust appropriately.

---

## 1. Agent Usage

A single Claude session carried the project end-to-end. I never delegated to a sub-agent (`Agent` / `Task` tool was available — `claude-code-guide`, `Explore`, `general-purpose`, `Plan`, `statusline-setup` were all visible). For a project of this surface area, the round-trip cost of briefing a worker outweighed any benefit, and keeping a single agent meant terminology, file layout, story IDs, and naming conventions stayed coherent without manual reconciliation across handoffs.

### Tasks completed with AI assistance

Every file in this repo is AI-authored, then iterated. The work decomposed across roughly the BMAD shape but expanded considerably in iteration:

| Phase | Deliverables | Notes |
|---|---|---|
| **Specs** | `docs/project-brief.md`, `docs/prd.md`, `docs/architecture.md`, `docs/test-strategy.md`, 4 epic files, 23 story files | PM-level decisions (newest-first sort, 200-char title, 5-s undo, filter persistence, clear-completed in scope) resolved up-front in PRD §1.3 rather than left for later. |
| **Build** | `backend/`, `frontend/`, `packages/shared/`, `e2e/`, root `docker-compose.yml` | End-to-end TypeScript with `strict + exactOptionalPropertyTypes`. Caught one type bug at compile time (see §4 D2). |
| **Containers** | Multi-stage `backend/Dockerfile` (non-root + tini), `frontend/Dockerfile` (`nginx-unprivileged`, UID 101, port 8080), `nginx.conf`, compose with `test` profile + `env_file`, BuildKit cache mounts | Hardened in a second pass after a checklist audit found 8 optimizations (cache mounts, alpine swap, distinct dev/prod healthchecks, etc.). |
| **QA suite** | 23 test files / 112 cases — Vitest (backend + frontend), Supertest, RTL, MSW, Playwright, axe-playwright; coverage with v8 | All cases mapped to PRD requirement IDs in `docs/test-strategy.md` §11. Backend coverage gate enforced at ≥ 80% lines / functions / statements, ≥ 75% branches. |
| **QA reports** | `docs/qa/coverage.md`, `docs/qa/performance.md`, `docs/qa/accessibility.md`, `docs/qa/security-review.md`, `docs/qa/README.md` | Per-report ownership — test inventory lives in `test-strategy.md`; coverage report focuses on source-file %, with overlapping inventory pruned. |
| **CI** | `.github/workflows/test.yml` (lint + typecheck + backend with `--coverage` gate + frontend coverage + cached Playwright Chromium + e2e + 7-day artifact retention); `nfr7` job runs `scripts/test-compose-up-time.sh` | Closes NFR6 (coverage gate) and NFR7 (compose startup budget). |
| **Spec / impl audits** | `docs/qa/spec-audit.md` (and follow-up rounds D1, D3, D4, D7, D8) | Compared what the architecture doc said against what the code actually did. The biggest finding (D4: RepoContext "opaque options" claim vs concrete-params reality) was fixed by *changing the code to match the doc*, not the reverse — the user explicitly chose that direction. |
| **Real product fix** | `frontend/src/state/pendingDeletes.ts` — module-level timer registry | Driven by an e2e regression that exposed a deferred-DELETE-killed-by-unmount bug in AI-written code. See §4 D12. |
| **Test refactors** | E2E → Page Object Model (`TodoPage`, `TodoRow`, fixtures); `data-testid` locator hierarchy enforced (role > label > testid > CSS) | A real refactor, not just a rename — assertions moved back into spec files after first cut; helpers stayed pure-locator. |

### Prompts that worked best

The user's overall prompt shape was numbered, sequential, deliverables-focused: *"Step 2: Build the Application — Component: Project Setup, Component: Backend, Component: Frontend, Component: E2E Tests."* That structure worked for several concrete reasons:

1. **Each component is a checkable unit.** TodoList items only moved to `completed` once the file existed on disk and (where possible) ran in the sandbox. No vibes-based progress.
2. **Component boundary mapped to a workspace.** `npm test --workspace=backend` and `npm test --workspace=frontend` gave per-component verification cheap.
3. **QA was integrated, not bolted on.** Each component listed its QA expectation alongside the implementation expectation, so tests were generated against the same reading of the spec — not later from a different one.
4. **Locked tech stack up-front.** The user answered React + Node/Express + SQLite + Docker before file generation started. No rework.

Specific prompt patterns that punched above their weight:

- **"Paste the entire error block, including stack traces."** Every successful debug round started this way. When the user paraphrased, I tended to reach for plausible-sounding fixes instead of root-causing. The user eventually started pre-pasting full logs without being asked.
- **"Give me the command to run only the failed test next time."** The user said this once after noticing iteration cost. From then on, every fix from me included a `-g "test name"` form alongside the full-suite command. Worth doing by default in any debugging workflow.
- **"Fix all 7."** When I produced a numbered findings list (audit, security review, coverage gaps), the user could approve the whole batch with one short message. That kept the `pending → in_progress → completed` TodoList rhythm intact without needing approval per item.
- **"Make the application match the architecture doc."** When code and spec disagreed (D4 RepoContext), the user reversed the usual direction — *don't update the doc, update the code*. That cleared up scope creep that had been hiding in "architecture is aspirational" framing.
- **Explicit verification questions.** *"Did you push the changes to my local files?"* forced me to be precise about where artifacts live (Edit/Write hit local disk; nothing is committed; nothing is pushed). Useful check on a long-running session.

### Prompts that didn't work

- **"Try again."** Without new information from a failure run, I just reached for a different plausible-sounding fix. The fix that finally worked for the keyboard test (D13 — stale locator after `aria-label` flip) was visible in the *first* failure block; I misread it. "Try again" let me keep misreading.
- **"Just build me a todo app."** Underspecified prompts produce close-but-misaligned code. PRD invariants like 200-char titles, undo semantics, or filter persistence wouldn't have survived a naïve interpretation.
- **"Now also add X" without naming the component.** Led to ad-hoc edits scattered across files instead of cleanly-scoped changes.

### TodoList tracking

Roughly 50 tasks across the full arc — every iteration went through `pending → in_progress → completed`. "Re-run e2e + verify" appears three times because each round of failures was its own loop. The list is a faithful record of how the work *actually* decomposed, including the messy parts.

---

## 2. MCP Server Usage

This session ran with a broad MCP catalogue available but a narrow subset actually used. The honest accounting:

| Server | Used? | What it did |
|---|---|---|
| **`workspace.bash`** | **Yes — heavily** | `npm install`, `vitest run --coverage`, `tsc --noEmit`, `python3 -c "import yaml"` for compose linting, `find`/`ls` for diagnostics. Without bash, none of the QA-report numbers would exist as measurements. It also caught at least three would-be-flaky TS errors before they ever reached the user (typecheck of e2e + frontend in `/tmp/bmad-*` after every code change). |
| **File tools** (`Read` / `Write` / `Edit`) | Yes — every artifact | Direct file authoring. Write/Edit land on local disk in the user's mounted folder; they do not commit, push, or notify a remote. |
| `cowork.*` (artifacts, present_files, request_cowork_directory) | No | A workspace folder was already mounted; the work was code + docs, not interactive widgets. The "live artifact" idea (re-fetching connectors at view time) had no fit. |
| `mcp-registry.*` (search/suggest connectors) | No | Task didn't need any external connector. |
| `plugins.*` (list/search/suggest) | No | No plugin install needed. |
| `scheduled-tasks.*` | No | One-shot work, no recurrence. |
| `visualize.show_widget` | No | PRD asked for documents and code, not a rendered widget. |
| `Claude in Chrome` (computer / find / read_page / navigate / etc.) | No | The app never ran live in this session — there was nothing to drive in a browser. The user ran Playwright on their machine and pasted output. |
| **`Agent`** (sub-agent types) | Available, not used | Surfaced mid-session. For iterative bug-hunting, a single agent with full context outpaces a worker that has to be re-briefed each round. |
| **Postman MCP, Chrome DevTools MCP, Playwright MCP** | **Not available** | Referenced in the user's original task list but not installed in this environment. Substituted: Supertest for API contract checks, Lighthouse CLI on the user's machine for performance traces, Playwright with `webServer` auto-start for browser automation. The corresponding QA reports document the manual procedures explicitly. |

### How `workspace.bash` actually helped

The single most valuable property of bash in this session was *failing fast*: every code change was followed by a `tsc --noEmit` or `vitest run` in a scratch dir before I told the user "this is ready." That caught D2 (Zod-vs-exactOptionalPropertyTypes), D4 (axe-playwright type drift), and a handful of typos. Without bash, those would have shipped as broken instructions to the user.

Bash also did real measurement work — `autocannon` results (5.04 ms avg latency, 11 ms p99, ~9k req/s) come from a live local run, *not* from estimation. `vitest --coverage` produced the 89.03% / 95.23% / 83.52% headline numbers in `coverage.md` directly; those weren't guessed. The compose-up-time script (`scripts/test-compose-up-time.sh`) is a small bash artifact that times `docker compose up --build --wait --wait-timeout 60` and fails the build on overrun — that's NFR7 gated by CI now.

### What `workspace.bash` *couldn't* do once the work moved to the user's machine

Bash sees the sandbox, not the user's laptop. Once e2e iteration started, every Playwright failure came as pasted text — I couldn't view the screenshot/video Playwright records on failure. That mattered: in D13, anyone watching the recorded video would have *seen* the checkbox visibly toggle, immediately ruling out "click didn't fire." Without that signal I burned two rounds on the wrong hypothesis. A real Chrome DevTools MCP or Playwright MCP that could surface artifacts (`aria-snapshot`, screenshots, traces) would have shortened most of the e2e rounds materially.

---

## 3. Test Generation

AI generated every test file in this repo — all 23 files, all 112 cases. Pattern: read the corresponding story's *Test Strategy* section, then emit a unit / integration / e2e spec that mirrored the Given/When/Then list 1:1, then map each case back to its PRD requirement ID for traceability (`docs/test-strategy.md` §11).

### What worked well

- **Story-first authoring.** Every story in `docs/stories/` already enumerated test scenarios. Generating the spec file was a faithful translation step, not an inference step. `tests/integration/todos.test.ts` (24 cases) lines up directly with the corresponding stories' AC lists by design.
- **Edge cases came for free from the spec.** PRD FR2 ("reject empty title") expanded naturally into specs for empty / whitespace-only / 201-char / non-string / non-JSON / oversize body. The spec did the work that I'd otherwise have had to invent.
- **Optimistic-UI rollback tests.** MSW + React Query made it cheap to write the failure-path tests most people skip — toggle 500 reverts the optimistic flip, clear-completed 500 restores the cleared rows, App initial-fetch 500 shows the error banner. Story-first authoring made these natural to include rather than easy to forget.
- **The Deferred-Promise pattern for asserting intermediate state.** `let release!: () => void; const held = new Promise<void>(r => { release = r; });` then `server.use(http.delete(..., () => held.then(...)))` let `clearCompleted` mutation tests assert "rows are gone *before* the server responds" without flakiness. Worth keeping in mind for any optimistic-UI test suite.
- **Per-test PRD traceability.** Every test name carries `(FRx / NFRx / Story Ex.Sy Iz)` suffixes. That makes coverage gaps visible at the spec layer, not just at the line-coverage layer — "no test maps to FR9b" is a louder signal than "lines 52–70 uncovered."
- **Page Object Model refactor for e2e.** Once the spec count crossed ~12, the test files were carrying too much DOM detail. POM (`TodoPage`, `TodoRow`, fixtures) moved locators behind named methods (`page.addTodo("buy milk")`, `row.toggle()`) while keeping assertions in the spec files. The "assertions back in the spec files" direction came from the user; my first POM cut had hidden them behind `expectVisible()` helpers, which made test intent harder to read.
- **`data-testid` locator hierarchy.** After the user invoked Playwright best practices, I established a strict priority: `getByRole` first, `getByLabel` second, `getByTestId` only when role/label can't disambiguate (e.g. wrapping `<li>` elements with multiple buttons). Added `data-testid` to ~12 elements in the React layer; updated POM to prefer role/label and fall back to testid.

### What AI missed (categories worth remembering)

These are the gaps that showed up across multiple files. Listing them by *category* so the next person knows where to look harder:

| Category | Concrete instance | How it surfaced |
|---|---|---|
| **Fake-timer × microtask races** | `TodoItem.test.tsx` "elapsed window" case: `vi.advanceTimersByTime(5000)` didn't flush React Query's mutation queue (real microtasks). Test timed out at `expect(deletes).toBe(1)`. | Removed unit test; covered the path in Playwright `undo-delete.spec.ts` with real timers. Documented as an intentional gap in `coverage.md`. |
| **TypeScript strict argument shape** | `service.update(id, parsed)` — Zod `string \| undefined` didn't fit a service signature of `string` under `exactOptionalPropertyTypes`. Unit tests for schema passed because the issue was at the call site, not the schema. | `tsc --noEmit` caught it. Stripped undefined fields in controller before passing. |
| **Library type drift** | First axe-playwright spec used `axeOptions.runOnly`; current `AxeOptions` type doesn't accept it. `includedImpacts` is `ImpactValue[]`, not `string[]`. | `tsc` caught it. Removed unsupported option; used typed `("serious" \| "critical")[]` literal. |
| **Default test parallelism vs shared backend** | First e2e config had `fullyParallel: true, workers: 'undefined'`. v1 has no per-user partitioning; concurrent tests stomp on the same SQLite file. | Tests went red intermittently. Set `fullyParallel: false, workers: 1` until v2 adds auth + per-user scoping. |
| **`addInitScript` lifecycle** | `addInitScript(() => localStorage.clear())` in `beforeEach` runs on **every** navigation including `page.reload()`. Filter-persistence test sets a filter, reloads, expects it to persist — init script wiped it on reload. | Test went red. Removed init script entirely (Playwright contexts are already per-test-isolated). |
| **Substring-match locator ambiguity** | `getByRole("button", { name: "Active" })` matched both the "Active" filter chip and the `Delete "active-task"` row button. | Used `exact: true` on the filter chip locator. |
| **Toast vs row text disambiguation** | `getByText("undo-me")` matched the toast message `Deleted "undo-me".`, not the row. | Row-scoped locator `getByRole("checkbox", { name: /mark "undo-me"/i })`. |
| **Stale `aria-label` after state flip** | `getByRole("checkbox", { name: /mark "kb only" as complete/i })` matched, then the click flipped the label to `"...as active"`, so the *same* locator stopped matching for the next assertion. The error "element(s) not found" looks identical to "click didn't fire." | Row-scoped locator: `page.getByRole("listitem").filter({ hasText: "kb only" }).getByRole("checkbox")`. Stable across toggles. |
| **WCAG color contrast** | `--completed: #9ca3af` on `--surface: #f7f7f8` ≈ 2.5:1 contrast — well below WCAG AA's 4.5:1. AI defaulted to a muted-gray palette without computing contrast. | axe caught it. Changed to `#52525b` (≈ 7.21:1, AA + AAA). |
| **Optimistic temp-id race** | `addTodo` helper waited for `POST 201` (Playwright's view) but not for React Query's `onSuccess` to swap the optimistic `temp-...` row for the server's UUID-keyed row. Subsequent actions captured the temp id; PATCH/DELETE 404'd. | Wait for `input[type="checkbox"][id^="cb-temp-"]` count to become 0 before continuing. |
| **State coverage at the UI layer** | First a11y suite had axe scans on the empty, populated, and active-filter states only — missed "row with focused delete button," "filter chip focused via keyboard," "error banner shown." | Added 3 a11y state-coverage tests. axe now runs against 12 distinct UI states across the suite. |
| **Test inventory in two places** | Test-strategy.md and coverage.md both had per-spec test breakdowns. They drifted. | Re-scoped: test-strategy.md owns inventory + traceability; coverage.md owns source-file %. |
| **Lifecycle tests for stateful UI** | First ToastHost test only covered "show toast → click action." Missed "hover pauses dismissal timer," "stacked toasts," "action button focus visible." | Added `ToastHost.test.tsx` with all four. |

### What I would have wanted but didn't include

- **Property-based tests** (e.g. `fast-check`) for the title trim/validation logic. Worth adding if the input model grows in v2 (multi-field todos, descriptions, due dates).
- **Mutation tests** (Stryker) on the validators. Probably not worth it for v1 — the validator surface is small enough that mutation testing would mostly find tautologies.
- **A compose-stack smoke test that hits the production `nginx` container, not the dev server.** `e2e/tests/smoke.spec.ts` currently depends on the Vite dev server via Playwright's `webServer`. Easy follow-up: a separate `e2e:prod` script that targets `localhost:5173` after `docker compose up --wait`.
- **POST/PATCH/DELETE micro-benchmarks.** `autocannon` only hits `GET /api/todos`. Write paths exercise SQLite's single-writer constraint; not yet benchmarked. Documented as P6 in `performance.md`.

---

## 4. Debugging with AI

Catalogue of the bugs that came up. Each entry: symptom → root cause → fix. The earlier ones are sandbox-only; the later ones came back from the user's machine. The pattern shift matters: with bash I could iterate locally; with pasted output I depended on the user to re-run.

### Sandbox period

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| **D1** | First `npm install` reported "added 371 packages" but `node_modules/vitest/package.json` was missing. | 45-second sandbox timeout killed npm mid-extraction. Mounted-folder permission quirks (macOS ACLs) prevented full repair on a follow-up. | `npm install --force` + scratch dirs in `/tmp/bmad-{verify,fe}` per workspace for hermetic installs. |
| **D2** | `tsc --noEmit` failed `TS2379` on `service.update(id, parsed)`. | Zod `string \| undefined` didn't fit the service signature under `exactOptionalPropertyTypes: true`. | Stripped undefined fields in the controller before passing the patch object. |
| **D3** | E2E `tsc` failed `TS2580: Cannot find name 'process'`. | `e2e/tsconfig.json` had no `types: ["node"]`; workspace had only Playwright as a dep. | Added `@types/node` + `types: ["node"]`. |
| **D4** | E2E `tsc` failed `TS2345` (axeOptions / includedImpacts type mismatch). | axe-playwright's typed `AxeOptions` doesn't include `axeOptions.runOnly`; `includedImpacts` is `ImpactValue[]`. | Removed unsupported option, typed literal. |
| **D5** | First `TodoItem.test.tsx` "elapsed window" case timed out: `expect(deletes).toBe(1)` saw 0. | Fake timers don't flush React Query's real-microtask mutation queue in JSDOM. | Removed unit test; e2e `undo-delete.spec.ts` covers the path with real timers. |
| **D6** | `npm rebuild better-sqlite3` failed with `403 ... node-v22.22.0-headers.tar.gz`. | Sandbox can't reach `nodejs.org/download/release/...`. | Documented as a sandbox limitation; integration tests run on user's machine. |
| **D7** | `node_modules/vite/package.json` missing after `--force` reinstall (vitest couldn't resolve `vitest/config`). | EPERM on macOS-mounted folder mid-cleanup left partial files. | Switched verification to `/tmp` mounts (fully writable). |

### User-machine period

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| **D8** | `dyld: libicui18n.73.dylib not found` from `node`. | Homebrew bumped `icu4c` to 77; user's `node@21.5.0` was linked against 73. | Recommended `nvm` + Node 20 LTS (matches `.nvmrc`); user took the durable path over `brew reinstall node`. |
| **D9** | `better-sqlite3` native build failed with V8 header syntax errors after reinstall. | Brew reinstall pulled Node 25.9.0 (bleeding edge). `better-sqlite3@11.10.0` has no prebuilt for Node 25, and Node 25's V8 headers have syntax `node-gyp` doesn't like. | Node 20 LTS via nvm. |
| **D10** | `npm install` "succeeded" but `node_modules/vite/package.json` was missing. | Interrupted install left partial files; Artifactory proxy may have cached a partial tarball; npm's cleanup couldn't remove macOS-locked files. | `rm -rf node_modules`, `npm cache clean --force`, install from public registry to bypass proxy. |
| **D11** | Various e2e failures across 5 rounds (parallelism, locator ambiguity, init-script clearing, color contrast, temp-id race, stale locator). | See test-bugs table in §3. | One round per category. |
| **D12** | E2E `undo-delete`: row reappeared after `page.reload()` even after the 5-second window elapsed. | **Real product bug — AI's own code.** `TodoItem.onDeleteClick` scheduled `setTimeout(remove.mutate, 5000)` and stored the handle in `useRef`. The optimistic cache filter unmounted the `TodoItem` immediately. The component's `useEffect` cleanup ran `clearTimeout(timerRef.current)` on unmount → deferred DELETE never fired → server kept row → next refetch brought it back. | Created `frontend/src/state/pendingDeletes.ts` (module-level `Map<string, Timeout>`). Timer's lifetime is now decoupled from any single component's mounted state. Real bug caught by e2e and only by e2e — unit/integration tests passed. |
| **D13** | E2E `keyboard-reachable`: `expect(checkbox).toBeChecked()` reported "element(s) not found" after `el.click()` via `evaluate`. | The click *did* toggle. The flip changed the row's `aria-label` from `"...as complete"` to `"...as active"`. The assertion's locator (regex `/...as complete/i`) silently stopped matching. "Element not found" is what stale locators print, not what unchecked checkboxes print — and I misread it for two iterations. | Row-scoped locator stable across toggles. Two rounds I shouldn't have spent. |

### Architecture / spec-vs-code audits

These weren't bugs per se but they were debugging-in-spirit — finding gaps between what the project *claimed* and what it *did*:

| # | Finding | Resolution |
|---|---|---|
| **D-A1** | Toast button labelled "Retry" for undo-delete. UX bug. | Added `actionLabel?: string` to Toast type; `TodoItem` passes `"Undo"`. |
| **D-A2** (D4) | Architecture doc claimed repos took an "opaque options object" (`RepoContext`); code took concrete `(db, id)` params. | User chose code-matches-doc direction. Added `RepoContext` type threaded through repo → service → controller with a `ctx(req)` helper. v2-auth ready. |
| **D-A3** | Story step said `curl` for healthcheck; Dockerfile used `node -e fetch(...)` and removed curl. | Aligned compose healthcheck and story step with the node-based fetch. |
| **D-A4** | `@todo/shared` was shipping `.ts` as `main` → Node 20 ESM `ERR_UNKNOWN_FILE_EXTENSION` in production Docker. | Split into `index.js` (runtime) + `index.d.ts` (types); updated `package.json` exports. |
| **D-A5** | Dockerfile build stage couldn't resolve workspaces (missing root `package.json`). | `COPY package.json package-lock.json* ./` before workspace copies. |
| **D-A6** | Multi-delete queue scenario uncovered. | Added integration test for "click Delete on 3 rows in quick succession → all 3 disappear after 5 s → undo middle one within window → middle row stays, other two get deleted." |
| **D-A7** | `clearCompleted` mutation test had a synchronous-assert-after-await timing race. | Replaced with Deferred pattern — server holds the response until the test releases it, asserts intermediate cache state in between. |

### Patterns I'd flag about my own debugging

- **D12 was AI code from the start.** I wrote the original `TodoItem.onDeleteClick` with the `useEffect`-cleanup-clears-timer pattern. A senior dev would have flagged "scheduling work in component state that's about to unmount" as a code smell on first read. AI wrote it; AI's own code review missed it; only a passing-then-failing e2e test caught it. This is the single biggest argument in this project for keeping the e2e gate non-optional.
- **D13 cost two extra rounds because I misread the failure.** "Element not found" + "the previous run said `2 × locator resolved to ...unchecked`" should have been a hint that the *first* run was stale-element and *previous* runs were actually-not-toggling — two different bugs. Instead I assumed it was the same bug and kept proposing variations. The user pasting fresh output every time was the only thing that eventually surfaced the difference.
- **The convergence asymmetry:** AI's "try the next plausible fix" loop converges fast on familiar bugs and slowly on unfamiliar ones. Asking *"what new information is in this failure that wasn't in the last one?"* before proposing the next fix would have shortened both D13 and parts of D11.

---

## 5. Limitations Encountered

This is the section worth reading carefully if you're picking up this project. Some of these are environment limits, some are AI limits, some are both.

### What the AI couldn't do in this environment

1. **Run anything that needed a real browser.** Playwright is wired and type-checks clean, but I couldn't `npx playwright install chromium` in the sandbox — no Chrome binary, no GPU, no headed mode. Same applies to Lighthouse and any Chrome DevTools MCP / Playwright MCP referenced in the task list. Every e2e and Lighthouse result needs a local run.
2. **Build native Node modules.** `better-sqlite3` requires `node-gyp` to fetch Node headers from `nodejs.org`. Sandbox has Python + compiler but no internet path to the headers, so backend integration tests and the persistence test couldn't execute locally. AI can write the tests but can't conjure a native binding. The QA reports are explicit about this.
3. **Run Docker.** No `docker` binary in the sandbox. AI wrote and statically validated the Dockerfiles + compose YAML (PyYAML parse) but `docker compose up` happens on the user's machine. The NFR7 budget check (`scripts/test-compose-up-time.sh`) is wired into CI for that reason — it's the only place the project can verify the compose budget without depending on a local laptop.
4. **Push to GitHub.** I can write `LICENSE` and `.github/PULL_REQUEST_TEMPLATE.md` to disk. I cannot authenticate to GitHub or create the repository — this is an intentional and explicit prohibition (no AI auth flows for external accounts) and not a bug to work around. The "ship it to my repo" step is always a manual handoff. Provided the user a `gh repo create` flow + manual fallback.
5. **See Playwright artifacts when the user runs the suite.** Failures came as pasted text. I couldn't view the failure screenshot, the recorded video, or the trace viewer. D13 (above) is the canonical example of how expensive that gap is — a video would have ruled out my wrong hypothesis instantly.
6. **Operate on the macOS-mounted user folder consistently from bash.** Some files placed via the file tools had unexpected ACLs from the bash sandbox's perspective (`Operation not permitted` on `rm`). Worked around by doing install/verify in `/tmp/bmad-*` clones. Would have been faster if writes and reads shared a single permission model.
7. **Generate *correct* time-sensitive UI tests on the first try.** D5 above: fake-timer + microtask scheduling is a category AI tends to underestimate. A test that compiles and "looks right" is not the same as a test that passes — true generally, doubly true for anything timer-flavoured.
8. **Verify Lighthouse / autocannon improvements in the same pass as the fix.** I could write the favicon + `meta description` + `robots.txt` fix, but the user had to re-run Lighthouse on their machine to confirm the score moved. Round-trip cost adds up; CI doesn't catch this category because the Lighthouse step is manual.

### Where human expertise was critical

This project was small and rule-driven enough that a single Claude session could carry it without external review, but several decisions are the kind a real human reviewer should be making:

- **The data-layer choice.** `better-sqlite3` (sync, in-process, fast) vs `prisma + sqlite` (async, ORM, migration tooling) vs jumping straight to Postgres. AI picked the simplest viable option for v1. A senior engineer who knew that auth + multi-user was coming might pick differently — Postgres becomes load-bearing the moment the writer count goes above one.
- **The undo-delete UX semantics.** PRD said "5-second undo." Subtle question: should clicking Undo *cancel* the pending DELETE or *issue a recreate POST*? I chose **cancel before send** to preserve `id` / timestamps. Another PM might want a more visible "recreate" flow. Documented in PRD §1.3 (Q3) and Story E3.S4; flag-worthy for a product reviewer.
- **The CSP / headers stance.** Shipped helmet defaults. A security engineer might tighten CSP, add Permissions-Policy, add CORP/COOP — that's a v2 conversation when there's actual cross-origin behavior to enforce.
- **Coverage gate threshold.** 80% lines / functions / statements / 75% branches is the spec's number. A reviewer might prefer to fail on *uncovered branches* in `validators/` and `repositories/` specifically rather than a flat percentage. Coverage is a poor proxy for confidence; a human can tune it.
- **Reading Playwright videos.** When AI can't see the artifact, the human's "I just watched the row reappear after the reload" is the most valuable single piece of information in the loop. The user calling out "the row came back" in D12 is what reframed the entire debug — without that human-side observation, I'd have kept poking at the test instead of the product.
- **Knowing the local toolchain.** Homebrew Node / icu4c / nvm trade-offs are environmental knowledge — AI has it from training, the user has it from their machine. The user's call to switch to nvm + Node 20 (vs the quicker `brew reinstall node`) is what eventually unblocked everything. AI offered both; the user picked the durable one.
- **Recognizing scope creep.** Round four of the e2e iteration, a senior engineer might have said *"do we actually need a Playwright keyboard-Space test here? axe already verified semantic correctness; the activation event is verified by happy-path."* I eventually proposed restructuring along those lines but two rounds later than I should have. Scope-bounding under failure is a human skill AI does not yet have.

### Reproducibility / "next time" notes

If this project gets a v1.x, the friction items worth addressing:

- **Reproducible toolchain.** Three independent Node-on-macOS issues in one session (D8, D9, D10) say "it works on my machine" is a property of the project + Node version + Homebrew state + npm registry + corporate proxy, not the project alone. Devcontainers, asdf, or Volta would erase most of that.
- **Trace surfacing for e2e MCP.** A Playwright or Chrome DevTools MCP that pipes `aria-snapshot` + screenshot + last-100-network-lines into the agent context on test failure would shorten e2e debug rounds by ~half, based on this session's experience.
- **Run Lighthouse + axe in CI.** Both currently require the running stack and Chrome on the user's laptop. Lighthouse-CI Action or Playwright-driven Lighthouse against the compose stack would fold them into the same `nfr7` CI job pattern that NFR7 now uses.
- **Pre-commit hook for `npm run typecheck`.** Three of the seven sandbox-period bugs were caught by `tsc --noEmit`. Local pre-commit would catch them before a push.

---

## What this log is not

It's not a benchmark of AI usefulness, a sales pitch, or a substitute for code review. It's a project artifact recording *how this work actually happened in this repo, in this session*, so the next person who picks up the project — human or agent — can understand the provenance, calibrate their trust, and know which steps still need a real environment to be considered done.

The honest version of the story is mixed. AI was a productive collaborator for the parts of the work that are well-specified and deterministic — translating a story to a test, hardening a Dockerfile to a checklist, writing the millionth idempotent SQL migration. The places it would have benefited from human review are the ones with genuine product or security trade-offs not fully captured in the PRD, plus the time-sensitive UI logic where "looks right" diverges from "passes." That gap is what e2e tests, CI gates, and human reviewers exist to close — and this project leans on all three.
