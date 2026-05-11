# Accessibility Test Report

**First written:** 2026-05-12
**Last updated:** 2026-05-12 — added `EmptyState.test.tsx` + `Skeleton.test.tsx` unit-level a11y assertions; closed the B6 stale-alert finding
**Scope:** entire `frontend/` UI as rendered in production-build mode
**Target:** WCAG 2.1 AA (PRD NFR4)
**Method:** axe-core via `axe-playwright` + Lighthouse + RTL + manual code review. Every assertion is automated; nothing in this report relies on "trust me."

---

## Headline

| Measurement | Result | Source |
|---|---|---|
| **Lighthouse Accessibility score** | **100** | `lighthouse http://localhost:5173 --preset=desktop` |
| **axe scans, serious/critical violations** | **0** across **11 scans** of 11 distinct UI states (+ 1 keyboard-reachability test in the same suite) | `e2e/tests/a11y.spec.ts` + `e2e/tests/responsive.spec.ts` |
| **Keyboard-only flow** | Passes — Tab reaches every focusable control; explicit tab-order verified | `App.test.tsx` "tab order traverses controls in visual order"; `a11y.spec.ts` "primary flow is keyboard-reachable" |
| **WCAG 2.1 AA criteria** | All AA criteria applicable to a single-page form-driven app are met | See §6 below |

No high or critical findings. No medium findings open.

---

## 1. Automated scans

### 1.1 axe-core scans (11 total, 6 + 5 responsive)

axe runs inside a real Chromium browser at the end of each scenario. Failures threshold is `serious` or `critical` impact only — minor/cosmetic violations are reported via the detailed HTML output but don't fail the build.

| Spec file | State scanned |
|---|---|
| `a11y.spec.ts` | Empty state |
| `a11y.spec.ts` | Populated list (one active + one completed; covers strikethrough contrast) |
| `a11y.spec.ts` | Active filter view (with `aria-pressed=true` chip) |
| `a11y.spec.ts` | Undo toast visible (`role="alert"` live region + Undo button) |
| `a11y.spec.ts` | Inline form error (`role="alert"` + `aria-invalid` + `aria-describedby` linkage) |
| `a11y.spec.ts` | Loading skeleton (`aria-busy="true"`) |
| `responsive.spec.ts` | 320 × 640 (mobile-narrow) |
| `responsive.spec.ts` | 375 × 812 (mobile) |
| `responsive.spec.ts` | 768 × 1024 (tablet) |
| `responsive.spec.ts` | 1280 × 800 (desktop) |
| `responsive.spec.ts` | 1920 × 1080 (wide) |

The 5 responsive scans also assert `document.documentElement.scrollWidth ≤ clientWidth` so no horizontal overflow can occur at any tested width. The `a11y.spec.ts` "primary flow is keyboard-reachable" test lives in the same suite but does not run axe — it's a Tab-navigation test covered in §1.2 below.

### 1.2 Keyboard accessibility

| Test | What it verifies |
|---|---|
| `App.test.tsx` "tab order traverses controls in visual order" | Simulates 10 `user.tab()` presses through a seeded list (1 active + 1 completed) and asserts focus order: input → Add → All / Active / Completed → row checkboxes + delete buttons → Clear completed. Closes PRD NFR4 / Story E4.S2 I1. |
| `a11y.spec.ts` "primary flow is keyboard-reachable" | Real-browser equivalent: Tab into the input, Enter to submit, `focus()` reaches the row's checkbox. |
| `ToastHost.test.tsx` "focus also pauses the timer" | The toast auto-dismiss is paused by `:focus` too, not just hover — relevant for keyboard users who can't hover. |

### 1.3 Unit-level a11y assertions

Component unit tests reach for ARIA roles and accessible names. **16+ such queries** are spread across the frontend suite — they're not labelled "a11y tests" but they enforce a11y contracts.

| File | Implicit a11y check |
|---|---|
| `Filters.test.tsx` | `aria-pressed` toggles correctly between filter chips |
| `Footer.test.tsx` | Counter is text-discoverable |
| `App.test.tsx` | Heading is reachable by role; input by label; checkbox by `aria-label`; tab-order verified explicitly; populated list rendered by accessible name (E3.S1 I3); filter chip clicks change the rendered list (E3.S5 I1) |
| `TodoItem.test.tsx` | Delete button is reachable by its `aria-label` |
| `mutations.test.tsx` | Retry toast is role-reachable; error-banner Retry re-runs the query (E3.S1 I4) |
| `ToastHost.test.tsx` | Action toasts use `role="alert"`; informational toasts use `role="status"` |
| `EmptyState.test.tsx` | EmptyState has `role="status"` so SRs announce it when the list transitions to empty (E3.S1 U1) |
| `Skeleton.test.tsx` | Loading skeleton has `aria-busy="true"` + accessible name; placeholder rows are `aria-hidden="true"` so SRs don't read them (E3.S1 U2) |

A regression that removed a label, changed a role, or broke an ARIA attribute would fail multiple unit tests before the e2e suite even runs.

---

## 2. Manual verification (Lighthouse)

Run against the production-build Docker stack:

```bash
docker compose up --build -d
until curl -fsS http://localhost:5173 >/dev/null 2>&1; do sleep 1; done
npx lighthouse http://localhost:5173 \
  --preset=desktop \
  --only-categories=accessibility \
  --output=html --output-path=./lighthouse-a11y.html --view
```

**Recorded result (2026-05-11):** Lighthouse Accessibility = **100 / 100**.

---

## 3. WCAG 2.1 AA criterion-by-criterion verification

For a single-page form-driven app, the AA criteria split into automated (verified by axe) and structural (verified by code or test).

| Criterion | Coverage | How verified |
|---|---|---|
| **1.3.1** Info and Relationships | axe + code | semantic `<ul>`/`<li>`, real `<input type="checkbox">`, `<label htmlFor>` |
| **1.3.2** Meaningful Sequence | code + tab-order test | DOM order matches visual order |
| **1.4.1** Use of Color | code | completion uses strikethrough **and** color — not color alone |
| **1.4.3** Contrast (Minimum) | axe (caught the original `--completed` violation) | 11 axe scans across viewports |
| **1.4.4** Resize Text up to 200 % | Lighthouse + manual | container uses `clamp()` / `min()`, no fixed font sizes |
| **1.4.10** Reflow (no horizontal scroll at 320 px) | `responsive.spec.ts` | viewport sweep asserts `scrollWidth ≤ clientWidth` |
| **1.4.11** Non-text Contrast | axe | UI components ≥ 3:1 |
| **1.4.13** Content on Hover or Focus | code + ToastHost.test.tsx | toasts pause on hover, pause on focus (keyboard-equivalent), dismissable, persistent |
| **2.1.1** Keyboard | tab-order test + e2e | Tab reaches input, Enter submits, focus + click toggles |
| **2.4.3** Focus Order | tab-order test | natural source order matches visual order |
| **2.4.6** Headings and Labels | axe | `<h1>Todo App</h1>`; all form fields labelled |
| **2.4.7** Focus Visible | code | `:focus-visible` outline rule in `frontend/src/styles/index.css` |
| **3.1.1** Language of Page | code | `<html lang="en">` in `frontend/index.html` |
| **3.2.1 / 3.2.2** On Focus / On Input | code | no unexpected context changes; form requires explicit submit |
| **3.3.1** Error Identification | axe + code + a11y inline-error scan | `<p role="alert" data-testid="input-error">`; input has `aria-invalid="true"`; alert is cleared on the next keystroke so SRs don't keep announcing a stale error (B6 fix) |
| **3.3.2** Labels or Instructions | axe | placeholder + accessible name on input |
| **3.3.3** Error Suggestion | code | "Please enter a task description" / "Maximum 200 characters." |
| **4.1.1** Parsing | axe | no duplicate IDs |
| **4.1.2** Name, Role, Value | axe | ARIA validity across all toasts and rows |
| **4.1.3** Status Messages | axe + ToastHost.test.tsx | toasts use `role="status"` / `role="alert"`; items-left counter has `aria-live="polite"` |

**N/A criteria:** 1.1.1 (no images), 1.4.2 (no audio), 2.4.4 (no links beyond the heading), 2.5.x (touch-target AAA), 3.3.4 (no high-stakes inputs).

---

## 4. Findings

### Closed

| When | Finding | Resolution |
|---|---|---|
| Initial Lighthouse run | `--completed` color on `--surface` = 2.5:1, **below WCAG AA's 4.5:1** | Darkened to `#52525b` = **7.21:1** (AA + AAA); the original axe scan that caught this is in `a11y.spec.ts` "populated list" |
| Initial Lighthouse run | Missing favicon → 404 in console → Best Practices docked | Added `frontend/public/favicon.svg` |
| Initial Lighthouse run | Missing `<meta name="description">` → SEO docked | Added to `frontend/index.html` |
| Post-implementation code review (B6) | `TodoInput`'s inline `role="alert"` persisted until the next submit attempt; a screen reader would keep announcing a validation error even after the user resumed typing | `onChange` now calls `setError(null)` as soon as the user types — see `frontend/src/components/TodoInput.tsx`. Affects WCAG 3.3.1 / 4.1.3. |
| Post-implementation code review (B3) | Temp-id rows (during the optimistic-create → server-id reconcile window) accepted toggle/delete events but the server 404'd on the temp id, producing a confusing announce-then-rollback sequence for SR users | `<TodoItem>` now sets `disabled={isPending}` on both the checkbox and delete button while `todo.id.startsWith("temp-")`; SRs announce the disabled state correctly. |

### Open

None at serious/critical impact.

---

## 5. What is NOT covered (and why)

- **Real screen-reader testing (NVDA / VoiceOver)** — axe can verify the ARIA structure is correct; it can't verify a screen-reader actually *announces* the structure helpfully. Manual SR testing is out of scope per `docs/test-strategy.md` §9. Recommend a 30-minute VoiceOver pass before any public release.
- **High-contrast / forced-colors mode** — not exercised by tests. The CSS uses `currentColor`-friendly tokens, so it should adapt, but unverified.
- **Reduced-motion preference (`prefers-reduced-motion`)** — the skeleton has a `keyframes` animation; `prefers-reduced-motion: reduce` isn't honoured. Out of scope for v1.
- **WCAG AAA criteria** — not targeted. WCAG 2.5.5 Target Size (44×44 px AAA) would require enlarging the checkbox; v1 uses 22×22 with a label-extended click area that's much larger in practice.
- **Screen-magnification (250 % +)** — Lighthouse covers 100 % zoom; deep magnification is browser/OS responsibility.

---

## 6. Re-running the report

```bash
# 1. Run the automated suite (11 axe scans + tab-order + keyboard tests)
npm test --workspace=frontend          # 52 cases including tab-order
npm run e2e                            # 19 cases including 11 axe scans

# 2. Lighthouse against production build
docker compose up --build -d
until curl -fsS http://localhost:5173 >/dev/null 2>&1; do sleep 1; done
npx lighthouse http://localhost:5173 \
  --preset=desktop \
  --only-categories=accessibility \
  --output=html --output-path=./lighthouse-a11y.html

# 3. (Manual) 30-minute VoiceOver / NVDA pass focusing on:
#    - toast announcements
#    - error announcements  
#    - filter-chip state changes
```

If any of those steps fail, this report is out of date.
