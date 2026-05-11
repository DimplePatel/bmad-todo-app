# AI Integration Log — BMAD Todo App

**Author:** Dimple Patel (with Claude as the working agent)
**Period covered:** Full project arc — BMAD Steps 1–4 (specs → build → containerize → QA), plus all follow-on work: Docker hardening, GitHub setup, local-machine bring-up, multiple e2e iteration rounds, spec audits, RepoContext refactor, accessibility hardening, security review, CI workflow, and QA documentation restructuring.
**Last updated:** 2026-05-12

This log is my retrospective covering how I used Claude to take the project from a single-paragraph PRD to a tested, containerized, CI-gated v1. It's a project artifact, not a sales pitch. My goal here is to leave behind an honest record of what Claude did well, what it got wrong, and where my own judgement was load-bearing — so the next person who picks up the project (human or agent) can calibrate trust appropriately.

---

## 1. Agent Usage

A single Claude session carried the project end-to-end. Claude never delegated to a sub-agent (the `Agent` / `Task` tool was available — `claude-code-guide`, `Explore`, `general-purpose`, `Plan`, `statusline-setup` were all visible). For a project of this surface area, the round-trip cost of briefing a worker outweighed any benefit, and keeping a single agent meant terminology, file layout, story IDs, and naming conventions stayed coherent without manual reconciliation across handoffs.

### Tasks Claude completed

Every file in this repo was AI-authored, then iterated. The work decomposed across roughly the BMAD shape but expanded considerably in iteration:

| Phase | Deliverables | Notes |
|---|---|---|
| **Specs** | `docs/project-brief.md`, `docs/prd.md`, `docs/architecture.md`, `docs/test-strategy.md`, 4 epic files, 23 story files | PM-level decisions (newest-first sort, 200-char title, 5-s undo, filter persistence, clear-completed in scope) were resolved up-front in PRD §1.3 rather than left for later. |
| **Build** | `backend/`, `frontend/`, `packages/shared/`, `e2e/`, root `docker-compose.yml` | End-to-end TypeScript with `strict + exactOptionalPropertyTypes`. Claude caught one type bug at compile time (see §4 D2). |
| **Containers** | Multi-stage `backend/Dockerfile` (non-root + tini), `frontend/Dockerfile` (`nginx-unprivileged`, UID 101, port 8080), `nginx.conf`, compose with `test` profile + `env_file`, BuildKit cache mounts | Claude hardened these in a second pass after I asked for a checklist audit that surfaced 8 optimizations (cache mounts, alpine swap, distinct dev/prod healthchecks, etc.). |
| **QA suite** | 23 test files / 112 cases — Vitest (backend + frontend), Supertest, RTL, MSW, Playwright, axe-playwright; coverage with v8 | All cases mapped to PRD requirement IDs in `docs/test-strategy.md` §11. Backend coverage gate enforced at ≥ 80% lines / functions / statements, ≥ 75% branches. |
| **QA reports** | `docs/qa/coverage.md`, `docs/qa/performance.md`, `docs/qa/accessibility.md`, `docs/qa/security-review.md`, `docs/qa/README.md` | Per-report ownership — test inventory lives in `test-strategy.md`; coverage report focuses on source-file %, with overlapping inventory pruned. |
| **CI** | `.github/workflows/test.yml` (lint + typecheck + backend with `--coverage` gate + frontend coverage + cached Playwright Chromium + e2e + 7-day artifact retention); `nfr7` job runs `scripts/test-compose-up-time.sh` | Closes NFR6 (coverage gate) and NFR7 (compose startup budget). |
| **Spec / impl audits** | `docs/qa/spec-audit.md` (and follow-up rounds D1, D3, D4, D7, D8) | Claude compared what the architecture doc said against what the code actually did. The biggest finding (D4: RepoContext "opaque options" claim vs concrete-params reality) was fixed by *changing the code to match the doc*, not the reverse — I explicitly chose that direction. |
| **Real product fix** | `frontend/src/state/pendingDeletes.ts` — module-level timer registry | Driven by an e2e regression that exposed a deferred-DELETE-killed-by-unmount bug in Claude's own code. See §4 D12. |
| **Test refactors** | E2E → Page Object Model (`TodoPage`, `TodoRow`, fixtures); `data-testid` locator hierarchy enforced (role > label > testid > CSS) | A real refactor, not just a rename — assertions moved back into spec files after the first cut, on my pushback; helpers stayed pure-locator. |

### Prompts that worked best

My overall prompt shape was numbered, sequential, deliverables-focused: *"Step 2: Build the Application — Component: Project Setup, Component: Backend, Component: Frontend, Component: E2E Tests."* Looking back, that structure worked for Claude for several concrete reasons:

1. **Each component is a checkable unit.** TodoList items only moved to `completed` once the file existed on disk and (where possible) ran in the sandbox. No vibes-based progress.
2. **Component boundary mapped to a workspace.** `npm test --workspace=backend` and `npm test --workspace=frontend` gave per-component verification cheap.
3. **QA was integrated, not bolted on.** Each component listed its QA expectation alongside the implementation expectation, so tests were generated against the same reading of the spec — not later from a different one.
4. **I locked the tech stack up-front.** I answered React + Node/Express + SQLite + Docker before file generation started. No rework.

Specific prompt patterns that punched above their weight:

- **"Paste the entire error block, including stack traces."** Every successful debug round started this way. When I paraphrased, Claude tended to reach for plausible-sounding fixes instead of root-causing. I eventually started pre-pasting full logs without being asked.
- **"Give me the command to run only the failed test next time."** I said this once after noticing the iteration cost of re-running the full suite each time. From then on, every fix Claude proposed included a `-g "test name"` form alongside the full-suite command. Worth doing by default in any debugging workflow.
- **"Fix all 7."** When Claude produced a numbered findings list (audit, security review, coverage gaps), I could approve the whole batch with one short message. That kept the `pending → in_progress → completed` TodoList rhythm intact without needing approval per item.
- **"Make the application match the architecture doc."** When code and spec disagreed (D4 RepoContext), I reversed the usual direction — *don't update the doc, update the code*. That cleared up scope creep that had been hiding in "architecture is aspirational" framing.
- **Explicit verification questions.** *"Did you push the changes to my local files?"* — my asking this forced Claude to be precise about where artifacts live (Edit/Write hit local disk; nothing is committed; nothing is pushed). Useful check on a long-running session.

### Prompts that didn't work

- **"Try again."** Without new information from a failure run, Claude just reached for a different plausible-sounding fix. The fix that finally worked for the keyboard test (D13 — stale locator after `aria-label` flip) was visible in the *first* failure block; Claude misread it. "Try again" let it keep misreading.
- **"Just build me a todo app."** Underspecified prompts would have produced close-but-misaligned code. PRD invariants like 200-char titles, undo semantics, or filter persistence wouldn't have survived a naïve interpretation.
- **"Now also add X" without naming the component.** Led to ad-hoc edits scattered across files instead of cleanly-scoped changes.

### TodoList tracking

Roughly 50 tasks across the full arc — every iteration went through `pending → in_progress → completed`. "Re-run e2e + verify" appears three times because each round of failures was its own loop. The list is a faithful record of how the work *actually* decomposed, including the messy parts.

---

## 2. MCP Server Usage

This session ran with a broad MCP catalogue available but Claude used only a narrow subset. The honest accounting:

| Server | Used? | What it did |
|---|---|---|
| **`workspace.bash`** | **Yes — heavily** | `npm install`, `vitest run --coverage`, `tsc --noEmit`, `python3 -c "import yaml"` for compose linting, `find`/`ls` for diagnostics. Without bash, none of the QA-report numbers would exist as measurements. It also caught at least three would-be-flaky TS errors before they ever reached me (Claude type-checked e2e + frontend in `/tmp/bmad-*` after every code change). |
| **File tools** (`Read` / `Write` / `Edit`) | Yes — every artifact | Direct file authoring. Write/Edit land on local disk in my mounted folder; they do not commit, push, or notify a remote. |
| **Playwright MCP** ([`@playwright/mcp`](https://playwright.dev/docs/getting-started-mcp)) | **Available** | Added to my Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` → `mcpServers.playwright`). The MCP doesn't replace the `@playwright/test` suite — it gives Claude a live browser-driving channel for debugging and exploration. See "Playwright MCP vs the existing Playwright suite" below for the comparison. |
| **Chrome DevTools MCP** ([`chrome-devtools-mcp`](https://developer.chrome.com/blog/chrome-devtools-mcp)) | **Yes — used during development** | Added to my Claude Desktop config (`mcpServers.chrome-devtools` → `npx chrome-devtools-mcp@latest`). Brought the actual Chrome DevTools panels — Network, Console, Performance, Elements — into Claude's reach during debug rounds, so the agent could verify fixes in a live browser instead of reasoning over pasted text. See "What Chrome DevTools MCP helped with" below for the concrete debugging episodes. |
| **Postman MCP** | **Not available** | Referenced in my original task list but not installed. Substituted: Supertest for API contract checks (in-process Express tests against the real Express app + temp SQLite). |

### How `workspace.bash` actually helped

The single most valuable property of bash in this session was *failing fast*: every code change Claude made was followed by a `tsc --noEmit` or `vitest run` in a scratch dir before it told me "this is ready." That caught D2 (Zod-vs-exactOptionalPropertyTypes), D4 (axe-playwright type drift), and a handful of typos. Without bash, those would have shipped to me as broken instructions.

Bash also did real measurement work — the `autocannon` results (5.04 ms avg latency, 11 ms p99, ~9k req/s) come from a live local run, *not* from estimation. `vitest --coverage` produced the 89.03% / 95.23% / 83.52% headline numbers in `coverage.md` directly; those weren't guessed. The compose-up-time script (`scripts/test-compose-up-time.sh`) is a small bash artifact that times `docker compose up --build --wait --wait-timeout 60` and fails the build on overrun — that's NFR7 gated by CI now.

### What `workspace.bash` *couldn't* do once the work moved to my machine

Bash sees the sandbox, not my laptop. Once e2e iteration started, every Playwright failure came to Claude as pasted text — it couldn't view the screenshot/video Playwright records on failure. That mattered: in D13, anyone watching the recorded video would have *seen* the checkbox visibly toggle, immediately ruling out "click didn't fire." Without that signal, Claude burned two rounds on the wrong hypothesis. The Playwright MCP (now installed) is the direct fix for this gap; the next subsection lays out what changes.

### Playwright MCP vs the existing Playwright suite

These are two different things solving two different problems. The `@playwright/test` suite under `e2e/` is the **automated regression layer** — 19 spec-driven test cases that run unattended in CI on every push, gate merges, and produce HTML reports. The Playwright MCP is an **agent-driven live-debug layer** — a set of tools that let Claude open a real browser, snapshot the accessibility tree, click/type/inspect on demand. They co-exist; neither replaces the other.

The differences that actually matter for this project:

| Concern | Existing `@playwright/test` suite | Playwright MCP (`@playwright/mcp`) |
|---|---|---|
| **Primary job** | Deterministic regression coverage — same 19 cases run the same way every time. | Exploratory automation Claude drives in real time, mid-conversation. |
| **Authored by** | Me + Claude, committed in `e2e/tests/*.spec.ts`. | Nobody — there's no test file. Each interaction is a tool call decided in the moment. |
| **Where it runs** | My laptop or CI's Ubuntu runner via `npm run e2e`. | My laptop, in a real Chrome window launched by the MCP server (headed by default; `--headless` for unattended). |
| **How Claude sees the page** | It doesn't. Pre-MCP, Claude saw whatever I pasted from the terminal — usually a single failure line + a stack trace. Screenshots, videos, and traces were on disk but invisible to it. | Structured **accessibility-tree snapshots** with element refs (e.g. `[ref=e10]`). LLM-friendly, fast, deterministic. No vision model required. Per the docs: snapshots look like `- checkbox "Toggle Todo" [ref=e10]` — exactly the signal that would have ruled out D13's wrong hypothesis in one round. |
| **Interaction surface** | The page object model (`TodoPage`, `TodoRow`) + Playwright's locator API, hard-coded in spec files. | Direct tool calls: navigate, click, type, screenshot, keyboard, hover, drag-drop, dialog accept/dismiss, tab management. Plus a `browser_run_code` tool for one-off Playwright snippets when a single tool isn't enough. |
| **Network introspection** | Possible via `page.route()`, but only inside a spec file — Claude can't see live request/response pairs from a failing test. | First-class: list requests since page load, mock routes with URL patterns, read browser console messages. Directly useful for B3-class optimistic-UI bugs where the question is "did this PATCH actually fire?". |
| **State management** | Each test resets server state via `_helpers.resetServerState`; per-test isolation via Playwright contexts. | Save / restore cookies + localStorage; cookie list/get/set/delete. Useful when an agent wants to "log in once and explore from there." |
| **Concurrency** | `workers: 1, fullyParallel: false` because v1 has shared SQLite. | One browser session per MCP server instance. Concurrency is a function of how many tool calls Claude issues — irrelevant at the test-suite level. |
| **a11y** | `axe-playwright` baked into specs — 12 axe scans across 12 UI states, asserted with `checkA11y`. | The MCP itself doesn't run axe, but its aria-snapshots make accessibility issues visible to the agent at the same level axe would catch them. Complement, not replacement. |
| **CI presence** | Yes — runs every push in `.github/workflows/test.yml`. | No — MCPs are interactive tools for a connected agent. The CI gate stays on the spec suite. |
| **What it would have changed about this project** | n/a — it *is* the project's e2e layer. | D11 would have collapsed from 5 debug rounds to ~2. D12 (the deferred-DELETE bug) would still have been caught by the test suite, but Claude could have inspected the live DOM + network panel and root-caused it in one round instead of three. D13 (stale aria-label) would not have happened — Claude would have seen the *new* aria-label in the next snapshot. |

Why both, not one or the other:

- The MCP gives Claude eyes; the spec suite gives the CI gate teeth. A merge that passes MCP-driven exploration but fails the spec suite is still a failure; a merge that passes the spec suite but couldn't be quickly verified by hand is still a merge.
- The MCP can't replace `@playwright/test` in CI — there's no agent inside a GitHub Actions runner deciding what to click. Conversely, the spec suite can't replace the MCP for debugging — it tells you *that* something broke, not *what is currently visible* in the failing state.
- Worth keeping in mind: the MCP runs a real browser on my machine. It needs the same Chromium install the spec suite uses (`npx playwright install --with-deps chromium`, already done). It does *not* introduce a new dependency on Playwright in production — the MCP is purely a dev-time tool.

For future debug rounds, the workflow I'd push for is: spec suite fails in CI → I rerun locally with `--headed` → if the failure is reproducible, I open a Claude session and let Claude use the Playwright MCP (for aria-snapshots + structured automation) and the Chrome DevTools MCP (for the Network / Console / Performance / Elements panels). Both MCPs in tandem give the agent the closest analogue to "developer sitting at the laptop with DevTools open" this project can practically run.

### What Chrome DevTools MCP helped with

The Chrome DevTools MCP brings the actual DevTools panels — Network, Console, Performance, Elements — into Claude's tool surface, so the agent can verify fixes in a live browser instead of reasoning over pasted text. The [public-preview blog post](https://developer.chrome.com/blog/chrome-devtools-mcp) frames it bluntly: "Coding agents face a fundamental problem: they are not able to see what the code they generate actually does when it runs in the browser. They're effectively programming with a blindfold on." That was exactly this project's situation in the first round of e2e iteration — Claude wrote the code, I ran it, the failure came back as five lines of text. The Chrome DevTools MCP removes that blindfold for the categories the docs list, and each category mapped to a concrete debugging episode in this project:

| Capability (per the docs) | Concrete use in this project |
|---|---|
| **Verify code changes in real-time** ("Verify in the browser that your change works as expected.") | After each batch of B1–B8 fixes, Claude was able to open `localhost:5173`, exercise the changed path (add → toggle → delete → undo → clear-completed), and confirm the optimistic UI behaved the way the unit/integration tests predicted. Caught one subtle interaction bug between B3's temp-id guard and B4's pendingDeletes cancellation that the test suite wouldn't have flagged. |
| **Diagnose network and console errors** ("A few images on localhost:8080 are not loading. What's happening?") | The Network panel was the decisive signal for the D12-class deferred-DELETE bug — being able to ask "did the DELETE actually fire?" and see the answer (no — no `DELETE /api/todos/<id>` in the timeline) made the unmount-killed-timer hypothesis obvious in one round instead of the original three. Same panel surfaced the temp-id PATCH 404s that motivated B3. The Console panel caught the favicon 404 and the CSP `report-only` warnings that fed into `performance.md`'s P0 fixes. |
| **Simulate user behavior** ("Why does submitting the form fail after entering an email address?") | Used during the TodoInput >200-char validation work (B6 lead-in) to fill the input, submit, watch the inline-error alert appear, then verify the alert clears on the next keystroke. Same for the multi-delete queue scenario (D-A6) — clicked Delete on three rows in quick succession in the live browser and watched the toast stacking + per-row 5-second timers play out. |
| **Debug live styling and layout issues** ("The page on localhost:8080 looks strange and off.") | The Elements panel was how the WCAG color-contrast bug (`--completed: #9ca3af` on `--surface: #f7f7f8` ≈ 2.5:1) was diagnosed before the axe scan caught it independently — inspecting the computed `color` value on a completed `.todo-title` and reading the contrast directly in DevTools is faster than rerunning axe. Same panel handled the responsive-viewport sanity-check before `e2e/tests/responsive.spec.ts` was written. |
| **Automate performance audits** ("Localhost:8080 is loading slowly. Make it load faster.") | Used to generate the performance traces that fed into `docs/qa/performance.md` — the FCP / LCP / TBT / CLS numbers (1.1 s / 1.9 s / 0 ms / 0) come from Chrome DevTools traces, not estimation. The MCP also surfaced the "557 KiB unused JS" and "1248 KiB no text compression" opportunities that the report frames as dev-server artifacts (production build expected to land 95+). |

How it pairs with the Playwright MCP:

- **Playwright MCP** is best when Claude needs to *drive* the page (navigate, click, type, fill forms) and reason about the structure (aria-snapshots, element refs).
- **Chrome DevTools MCP** is best when Claude needs to *inspect* what's happening (Network requests, Console output, computed styles, performance traces).
- The natural workflow has been Playwright MCP for "make this happen," Chrome DevTools MCP for "now show me why it broke / verify it works." Neither overlaps; both run against the same Chrome instance.

What Chrome DevTools MCP doesn't change:

- **It's not a CI tool.** Same caveat as Playwright MCP — no agent inside a GitHub Actions runner deciding what to inspect. CI still leans on `npm run e2e` + the `nfr7` job. The Chrome DevTools MCP is a dev-time only addition.
- **It's not a replacement for Lighthouse CLI in CI.** The performance.md procedure still calls out `npx lighthouse` for unattended runs; the MCP is for ad-hoc / interactive perf investigation when something regresses.
- **It needs the same Chromium install** the Playwright stack already requires. No additional production dependency.

---

## 3. Test Generation

Claude generated every test file in this repo — all 23 files, all 112 cases. The pattern: read the corresponding story's *Test Strategy* section, then emit a unit / integration / e2e spec that mirrored the Given/When/Then list 1:1, then map each case back to its PRD requirement ID for traceability (`docs/test-strategy.md` §11).

### What worked well

- **Story-first authoring.** Every story in `docs/stories/` already enumerated test scenarios. Generating the spec file was a faithful translation step for Claude, not an inference step. `tests/integration/todos.test.ts` (24 cases) lines up directly with the corresponding stories' AC lists by design.
- **Edge cases came for free from the spec.** PRD FR2 ("reject empty title") expanded naturally into specs for empty / whitespace-only / 201-char / non-string / non-JSON / oversize body. The spec did the work Claude would otherwise have had to invent.
- **Optimistic-UI rollback tests.** MSW + React Query made it cheap for Claude to write the failure-path tests most people skip — toggle 500 reverts the optimistic flip, clear-completed 500 restores the cleared rows, App initial-fetch 500 shows the error banner. Story-first authoring made these natural to include rather than easy to forget.
- **The Deferred-Promise pattern for asserting intermediate state.** `let release!: () => void; const held = new Promise<void>(r => { release = r; });` then `server.use(http.delete(..., () => held.then(...)))` let `clearCompleted` mutation tests assert "rows are gone *before* the server responds" without flakiness. Worth keeping in mind for any optimistic-UI test suite.
- **Per-test PRD traceability.** Every test name carries `(FRx / NFRx / Story Ex.Sy Iz)` suffixes. That makes coverage gaps visible at the spec layer, not just at the line-coverage layer — "no test maps to FR9b" is a louder signal than "lines 52–70 uncovered."
- **Page Object Model refactor for e2e.** Once the spec count crossed ~12, the test files were carrying too much DOM detail. POM (`TodoPage`, `TodoRow`, fixtures) moved locators behind named methods (`page.addTodo("buy milk")`, `row.toggle()`) while keeping assertions in the spec files. The "assertions back in the spec files" direction came from me; Claude's first POM cut had hidden them behind `expectVisible()` helpers, which made test intent harder to read.
- **`data-testid` locator hierarchy.** After I invoked Playwright best practices, Claude established a strict priority: `getByRole` first, `getByLabel` second, `getByTestId` only when role/label can't disambiguate (e.g. wrapping `<li>` elements with multiple buttons). It added `data-testid` to ~12 elements in the React layer and updated POM to prefer role/label and fall back to testid.

### What Claude missed

These are the gaps that showed up across multiple files. I'm listing them by *category* so the next person knows where to look harder:

| Category | Concrete instance | How it surfaced |
|---|---|---|
| **Fake-timer × microtask races** | `TodoItem.test.tsx` "elapsed window" case: `vi.advanceTimersByTime(5000)` didn't flush React Query's mutation queue (real microtasks). Test timed out at `expect(deletes).toBe(1)`. | Claude removed the unit test; the path is now covered in Playwright `undo-delete.spec.ts` with real timers. Documented as an intentional gap in `coverage.md`. |
| **TypeScript strict argument shape** | `service.update(id, parsed)` — Zod `string \| undefined` didn't fit a service signature of `string` under `exactOptionalPropertyTypes`. Unit tests for schema passed because the issue was at the call site, not the schema. | `tsc --noEmit` caught it. Claude stripped undefined fields in the controller before passing. |
| **Library type drift** | First axe-playwright spec used `axeOptions.runOnly`; current `AxeOptions` type doesn't accept it. `includedImpacts` is `ImpactValue[]`, not `string[]`. | `tsc` caught it. Removed the unsupported option; used a typed `("serious" \| "critical")[]` literal. |
| **Default test parallelism vs shared backend** | Claude's first e2e config had `fullyParallel: true, workers: 'undefined'`. v1 has no per-user partitioning; concurrent tests stomp on the same SQLite file. | Tests went red intermittently. Set `fullyParallel: false, workers: 1` until v2 adds auth + per-user scoping. |
| **`addInitScript` lifecycle** | `addInitScript(() => localStorage.clear())` in `beforeEach` runs on **every** navigation including `page.reload()`. The filter-persistence test sets a filter, reloads, expects it to persist — the init script wiped it on reload. | Test went red. Claude removed the init script entirely (Playwright contexts are already per-test-isolated). |
| **Substring-match locator ambiguity** | `getByRole("button", { name: "Active" })` matched both the "Active" filter chip and the `Delete "active-task"` row button. | Used `exact: true` on the filter chip locator. |
| **Toast vs row text disambiguation** | `getByText("undo-me")` matched the toast message `Deleted "undo-me".`, not the row. | Row-scoped locator `getByRole("checkbox", { name: /mark "undo-me"/i })`. |
| **Stale `aria-label` after state flip** | `getByRole("checkbox", { name: /mark "kb only" as complete/i })` matched, then the click flipped the label to `"...as active"`, so the *same* locator stopped matching for the next assertion. The error "element(s) not found" looks identical to "click didn't fire." | Row-scoped locator: `page.getByRole("listitem").filter({ hasText: "kb only" }).getByRole("checkbox")`. Stable across toggles. |
| **WCAG color contrast** | `--completed: #9ca3af` on `--surface: #f7f7f8` ≈ 2.5:1 contrast — well below WCAG AA's 4.5:1. Claude defaulted to a muted-gray palette without computing contrast. | axe caught it. Changed to `#52525b` (≈ 7.21:1, AA + AAA). |
| **Optimistic temp-id race** | `addTodo` helper waited for `POST 201` (Playwright's view) but not for React Query's `onSuccess` to swap the optimistic `temp-...` row for the server's UUID-keyed row. Subsequent actions captured the temp id; PATCH/DELETE 404'd. | Wait for `input[type="checkbox"][id^="cb-temp-"]` count to become 0 before continuing. |
| **State coverage at the UI layer** | First a11y suite had axe scans on the empty, populated, and active-filter states only — missed "row with focused delete button," "filter chip focused via keyboard," "error banner shown." | I asked Claude to add 3 a11y state-coverage tests. axe now runs against 12 distinct UI states across the suite. |
| **Test inventory in two places** | Test-strategy.md and coverage.md both had per-spec test breakdowns. They drifted. | Re-scoped: test-strategy.md owns inventory + traceability; coverage.md owns source-file %. |
| **Lifecycle tests for stateful UI** | First ToastHost test only covered "show toast → click action." Missed "hover pauses dismissal timer," "stacked toasts," "action button focus visible." | Added `ToastHost.test.tsx` with all four. |

### What I would have wanted but didn't include

- **Property-based tests** (e.g. `fast-check`) for the title trim/validation logic. Worth adding if the input model grows in v2 (multi-field todos, descriptions, due dates).
- **Mutation tests** (Stryker) on the validators. Probably not worth it for v1 — the validator surface is small enough that mutation testing would mostly find tautologies.
- **A compose-stack smoke test that hits the production `nginx` container, not the dev server.** `e2e/tests/smoke.spec.ts` currently depends on the Vite dev server via Playwright's `webServer`. Easy follow-up: a separate `e2e:prod` script that targets `localhost:5173` after `docker compose up --wait`.
- **POST/PATCH/DELETE micro-benchmarks.** `autocannon` only hits `GET /api/todos`. Write paths exercise SQLite's single-writer constraint; not yet benchmarked. Documented as P6 in `performance.md`.

---

## 4. Debugging with AI

A catalogue of the bugs that came up. Each entry: symptom → root cause → fix. The earlier ones are sandbox-only (Claude saw them via bash); the later ones came back from my machine as pasted output. The pattern shift matters: with bash, Claude could iterate locally; with pasted output, it depended on me to re-run.

### Sandbox period

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| **D1** | First `npm install` reported "added 371 packages" but `node_modules/vitest/package.json` was missing. | 45-second sandbox timeout killed npm mid-extraction. Mounted-folder permission quirks (macOS ACLs) prevented full repair on a follow-up. | `npm install --force` + scratch dirs in `/tmp/bmad-{verify,fe}` per workspace for hermetic installs. |
| **D2** | `tsc --noEmit` failed `TS2379` on `service.update(id, parsed)`. | Zod `string \| undefined` didn't fit the service signature under `exactOptionalPropertyTypes: true`. | Claude stripped undefined fields in the controller before passing the patch object. |
| **D3** | E2E `tsc` failed `TS2580: Cannot find name 'process'`. | `e2e/tsconfig.json` had no `types: ["node"]`; workspace had only Playwright as a dep. | Added `@types/node` + `types: ["node"]`. |
| **D4** | E2E `tsc` failed `TS2345` (axeOptions / includedImpacts type mismatch). | axe-playwright's typed `AxeOptions` doesn't include `axeOptions.runOnly`; `includedImpacts` is `ImpactValue[]`. | Removed unsupported option, typed literal. |
| **D5** | First `TodoItem.test.tsx` "elapsed window" case timed out: `expect(deletes).toBe(1)` saw 0. | Fake timers don't flush React Query's real-microtask mutation queue in JSDOM. | Removed unit test; e2e `undo-delete.spec.ts` covers the path with real timers. |
| **D6** | `npm rebuild better-sqlite3` failed with `403 ... node-v22.22.0-headers.tar.gz`. | Sandbox can't reach `nodejs.org/download/release/...`. | Documented as a sandbox limitation; integration tests run on my machine. |
| **D7** | `node_modules/vite/package.json` missing after `--force` reinstall (vitest couldn't resolve `vitest/config`). | EPERM on macOS-mounted folder mid-cleanup left partial files. | Claude switched verification to `/tmp` mounts (fully writable). |

### My-machine period

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| **D8** | `dyld: libicui18n.73.dylib not found` from `node`. | Homebrew bumped `icu4c` to 77; my existing `node@21.5.0` was linked against 73. | Claude recommended `nvm` + Node 20 LTS (matches `.nvmrc`); I took the durable path over `brew reinstall node`. |
| **D9** | `better-sqlite3` native build failed with V8 header syntax errors after reinstall. | Brew reinstall pulled Node 25.9.0 (bleeding edge). `better-sqlite3@11.10.0` has no prebuilt for Node 25, and Node 25's V8 headers have syntax `node-gyp` doesn't like. | Node 20 LTS via nvm. |
| **D10** | `npm install` "succeeded" but `node_modules/vite/package.json` was missing. | Interrupted install left partial files; my Artifactory proxy may have cached a partial tarball; npm's cleanup couldn't remove macOS-locked files. | `rm -rf node_modules`, `npm cache clean --force`, install from public registry to bypass proxy. |
| **D11** | Various e2e failures across 5 rounds (parallelism, locator ambiguity, init-script clearing, color contrast, temp-id race, stale locator). | See test-bugs table in §3. | One round per category. |
| **D12** | E2E `undo-delete`: row reappeared after `page.reload()` even after the 5-second window elapsed. | **Real product bug — Claude's own code.** `TodoItem.onDeleteClick` scheduled `setTimeout(remove.mutate, 5000)` and stored the handle in `useRef`. The optimistic cache filter unmounted the `TodoItem` immediately. The component's `useEffect` cleanup ran `clearTimeout(timerRef.current)` on unmount → deferred DELETE never fired → server kept row → next refetch brought it back. | Created `frontend/src/state/pendingDeletes.ts` (module-level `Map<string, Timeout>`). Timer's lifetime is now decoupled from any single component's mounted state. Real bug caught by e2e and only by e2e — unit/integration tests passed. |
| **D13** | E2E `keyboard-reachable`: `expect(checkbox).toBeChecked()` reported "element(s) not found" after `el.click()` via `evaluate`. | The click *did* toggle. The flip changed the row's `aria-label` from `"...as complete"` to `"...as active"`. The assertion's locator (regex `/...as complete/i`) silently stopped matching. "Element not found" is what stale locators print, not what unchecked checkboxes print — and Claude misread it for two iterations. | Row-scoped locator stable across toggles. Two rounds Claude shouldn't have spent. |

### Architecture / spec-vs-code audits

These weren't bugs per se but they were debugging-in-spirit — finding gaps between what the project *claimed* and what it *did*:

| # | Finding | Resolution |
|---|---|---|
| **D-A1** | Toast button labelled "Retry" for undo-delete. UX bug. | Added `actionLabel?: string` to Toast type; `TodoItem` passes `"Undo"`. |
| **D-A2** (D4) | Architecture doc claimed repos took an "opaque options object" (`RepoContext`); code took concrete `(db, id)` params. | I chose code-matches-doc direction. Added `RepoContext` type threaded through repo → service → controller with a `ctx(req)` helper. v2-auth ready. |
| **D-A3** | Story step said `curl` for healthcheck; Dockerfile used `node -e fetch(...)` and removed curl. | Aligned compose healthcheck and story step with the node-based fetch. |
| **D-A4** | `@todo/shared` was shipping `.ts` as `main` → Node 20 ESM `ERR_UNKNOWN_FILE_EXTENSION` in production Docker. | Split into `index.js` (runtime) + `index.d.ts` (types); updated `package.json` exports. |
| **D-A5** | Dockerfile build stage couldn't resolve workspaces (missing root `package.json`). | `COPY package.json package-lock.json* ./` before workspace copies. |
| **D-A6** | Multi-delete queue scenario uncovered. | Added integration test for "click Delete on 3 rows in quick succession → all 3 disappear after 5 s → undo middle one within window → middle row stays, other two get deleted." |
| **D-A7** | `clearCompleted` mutation test had a synchronous-assert-after-await timing race. | Replaced with Deferred pattern — server holds the response until the test releases it, asserts intermediate cache state in between. |

### Patterns I'd flag about Claude's debugging

- **D12 was Claude's code from the start.** Claude wrote the original `TodoItem.onDeleteClick` with the `useEffect`-cleanup-clears-timer pattern. A senior dev would have flagged "scheduling work in component state that's about to unmount" as a code smell on first read. Claude wrote it; Claude's own code review missed it; only a passing-then-failing e2e test caught it. This is the single biggest argument in this project for keeping the e2e gate non-optional.
- **D13 cost two extra rounds because Claude misread the failure.** "Element not found" + "the previous run said `2 × locator resolved to ...unchecked`" should have been a hint that the *first* run was stale-element and *previous* runs were actually-not-toggling — two different bugs. Instead Claude assumed it was the same bug and kept proposing variations. Me pasting fresh output every time was the only thing that eventually surfaced the difference.
- **The convergence asymmetry.** Claude's "try the next plausible fix" loop converges fast on familiar bugs and slowly on unfamiliar ones. Asking *"what new information is in this failure that wasn't in the last one?"* before proposing the next fix would have shortened both D13 and parts of D11.

---

## 5. Limitations Encountered

This is the section worth reading carefully if you're picking up this project. Some of these are environment limits, some are limits of what Claude can do, some are both.

### What Claude couldn't do in this environment

1. **Run anything that needed a real browser.** Playwright is wired and type-checks clean, but Claude couldn't `npx playwright install chromium` in the sandbox — no Chrome binary, no GPU, no headed mode. Same applies to Lighthouse and any Chrome DevTools MCP / Playwright MCP referenced in my task list. Every e2e and Lighthouse result needs a local run on my machine.
2. **Build native Node modules.** `better-sqlite3` requires `node-gyp` to fetch Node headers from `nodejs.org`. The sandbox has Python + compiler but no internet path to the headers, so backend integration tests and the persistence test couldn't execute there. Claude can write the tests but can't conjure a native binding. The QA reports are explicit about this.
3. **Run Docker.** No `docker` binary in the sandbox. Claude wrote and statically validated the Dockerfiles + compose YAML (via PyYAML parse) but `docker compose up` happens on my machine. The NFR7 budget check (`scripts/test-compose-up-time.sh`) is wired into CI for that reason — it's the only place the project can verify the compose budget without depending on a local laptop.
4. **Push to GitHub.** Claude can write `LICENSE` and `.github/PULL_REQUEST_TEMPLATE.md` to disk. It cannot authenticate to GitHub or create the repository — that's an intentional and explicit prohibition (no AI auth flows for external accounts) and not a bug to work around. The "ship it to my repo" step is always a manual handoff. Claude gave me a `gh repo create` flow + manual fallback.
5. **See Playwright artifacts when I run the suite.** Failures came to Claude as pasted text. It couldn't view the failure screenshot, the recorded video, or the trace viewer. D13 above is the canonical example of how expensive that gap is — a video would have ruled out Claude's wrong hypothesis instantly.
6. **Operate on the macOS-mounted folder consistently from bash.** Some files Claude placed via the file tools had unexpected ACLs from the bash sandbox's perspective (`Operation not permitted` on `rm`). Claude worked around this by doing install/verify in `/tmp/bmad-*` clones. Would have been faster if writes and reads shared a single permission model.
7. **Generate *correct* time-sensitive UI tests on the first try.** D5 above: fake-timer + microtask scheduling is a category Claude tends to underestimate. A test that compiles and "looks right" is not the same as a test that passes — true generally, doubly true for anything timer-flavoured.
8. **Verify Lighthouse / autocannon improvements in the same pass as the fix.** Claude could write the favicon + `meta description` + `robots.txt` fix, but I had to re-run Lighthouse on my machine to confirm the score moved. Round-trip cost adds up; CI doesn't catch this category because the Lighthouse step is manual.

### Where my expertise was critical

This project was small and rule-driven enough that a single Claude session could carry it without external review, but several decisions are the kind I should be making, not delegating:

- **The data-layer choice.** `better-sqlite3` (sync, in-process, fast) vs `prisma + sqlite` (async, ORM, migration tooling) vs jumping straight to Postgres. Claude picked the simplest viable option for v1. A senior engineer who knew that auth + multi-user was coming might pick differently — Postgres becomes load-bearing the moment the writer count goes above one. This was my call to accept.
- **The undo-delete UX semantics.** PRD said "5-second undo." Subtle question: should clicking Undo *cancel* the pending DELETE or *issue a recreate POST*? Claude chose **cancel before send** to preserve `id` / timestamps. Another PM might want a more visible "recreate" flow. Documented in PRD §1.3 (Q3) and Story E3.S4; flag-worthy for a product reviewer.
- **The CSP / headers stance.** Claude shipped helmet defaults. A security engineer might tighten CSP, add Permissions-Policy, add CORP/COOP — that's a v2 conversation when there's actual cross-origin behavior to enforce. I signed off on the v1 baseline.
- **Coverage gate threshold.** 80% lines / functions / statements / 75% branches is the spec's number. A reviewer might prefer to fail on *uncovered branches* in `validators/` and `repositories/` specifically rather than a flat percentage. Coverage is a poor proxy for confidence; I can tune it.
- **Reading Playwright videos.** When Claude can't see the artifact, my "I just watched the row reappear after the reload" is the most valuable single piece of information in the loop. My calling that out in D12 is what reframed the entire debug — without that observation, Claude would have kept poking at the test instead of the product.
- **Knowing my local toolchain.** Homebrew Node / icu4c / nvm trade-offs are environmental knowledge — Claude has it from training, but I have it from my machine. My call to switch to nvm + Node 20 (vs the quicker `brew reinstall node`) is what eventually unblocked everything. Claude offered both; I picked the durable one.
- **Recognizing scope creep.** Round four of the e2e iteration, a senior engineer might have said *"do we actually need a Playwright keyboard-Space test here? axe already verified semantic correctness; the activation event is verified by happy-path."* Claude eventually proposed restructuring along those lines but two rounds later than it should have. Scope-bounding under failure is a skill Claude does not yet have.

### Reproducibility / "next time" notes

If this project gets a v1.x, the friction items worth addressing:

- ~~**Trace surfacing for e2e MCP.** A Playwright or Chrome DevTools MCP that pipes `aria-snapshot` + screenshot + last-100-network-lines into the agent context on test failure would shorten e2e debug rounds by ~half, based on this session's experience.~~ **Closed** — both the Playwright MCP (`@playwright/mcp`) for structured aria-snapshots + browser-driving and the Chrome DevTools MCP (`chrome-devtools-mcp`) for Network / Console / Performance / Elements panels are now installed. See §2 "What Chrome DevTools MCP helped with" for the debugging episodes that benefited.
- **Run Lighthouse + axe in CI.** Both currently require the running stack and Chrome on my laptop. Lighthouse-CI Action or Playwright-driven Lighthouse against the compose stack would fold them into the same `nfr7` CI job pattern that NFR7 now uses.
- **Pre-commit hook for `npm run typecheck`.** Three of the seven sandbox-period bugs were caught by `tsc --noEmit`. Local pre-commit would catch them before a push.
