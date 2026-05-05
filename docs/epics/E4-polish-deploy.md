# Epic E4 — Polish, A11y & Deploy Readiness

**Status:** Ready
**Owner:** Dev (with QA)
**Source:** `docs/prd.md` §7 — Epic E4; `docs/architecture.md` §7.5, §8, §9

## Goal
Make the app feel finished and ready to hand off: responsive across phone-to-desktop, accessible, securely configured, observable, fully Playwright-covered for E2E, and documented for deployment to any cloud.

## Scope (in)
- Responsive pass (320 px → 1920 px) including touch targets ≥ 44 × 44 px.
- Keyboard & accessibility pass (WCAG 2.1 AA basics).
- Backend security baseline: `helmet`, CORS allowlist enforcement in production, request logging.
- README + `.env.example` + deployment notes.
- Final integration + Playwright E2E suite.
- Coverage gate (≥ 80% backend line coverage; key frontend flows).

## Scope (out)
- Dark mode, theming.
- Multi-language / i18n.
- Auth or user accounts.

## Stories
| ID | Title | Status |
|---|---|---|
| E4.S1 | Responsive layout (320 → 1920 px) | Ready |
| E4.S2 | Keyboard & accessibility pass | Ready |
| E4.S3 | Backend hardening (security baseline + observability) | Ready |
| E4.S4 | README + deploy docs | Ready |
| E4.S5 | Final integration + Playwright E2E suite | Ready |

## Acceptance criteria roll-up
- App is fully usable at 320 px wide; touch targets meet 44 × 44 px minimum.
- Tab order matches visual order; all icon buttons have `aria-label`.
- WCAG 2.1 AA color contrast verified.
- `helmet` and CORS allowlist enforced in production; CORS `*` rejected.
- README covers local dev, Compose, env vars, and a "Deploy anywhere" section.
- Playwright suite (in `e2e/`) passes against the Compose stack.
- Backend line coverage ≥ 80%; persistence test green.

## Dependencies
- Upstream: E1, E2, E3.
- Downstream: this epic completes v1.

## Definition of Done
1. All five stories' ACs are satisfied.
2. `npm run lint && npm test && npm run e2e` is green at root.
3. README has been used by a teammate (or QA persona) to bring the app up on a clean machine.
4. Final v1 release tag is ready (no `TODO`/`FIXME` in production paths without a tracked issue).
