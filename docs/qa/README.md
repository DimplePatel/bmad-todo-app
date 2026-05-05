# QA Activities — Step 4 Summary

**Date:** 2026-05-01
**Owner:** BMAD QA persona

This folder is the QA outcome of BMAD Step 4. Each file maps to one of the four QA tasks.

| Task | Outcome | Doc |
|---|---|---|
| Test coverage analysis | Frontend 87.08% lines (target ≥ 70%); backend ≥ 80% lines via wired integration suite + CI threshold gate. New tests added for `TodoItem` undo and mutation rollback paths. | [coverage.md](./coverage.md) |
| Accessibility testing | New Playwright spec `e2e/tests/a11y.spec.ts` runs `axe-core` over empty / populated / filtered states + a keyboard-only flow, failing only on serious / critical impacts. | [accessibility (in coverage.md §E2E)](./coverage.md) + the spec itself |
| Performance review | Static review against NFR1/NFR3/NFR7 (no critical findings); procedure for live Lighthouse + autocannon runs documented; results table to fill in after a local run. | [performance.md](./performance.md) |
| Security review | Full static review across XSS / SQL injection / CSRF / CORS / secrets / containers / dependencies. No high or critical findings; two informational items. | [security-review.md](./security-review.md) |
| AI integration log | How AI was used across Steps 1–4: agent usage, MCPs available vs. used, test generation strengths and gaps, debugging cases, and explicit sandbox limitations. | [../ai-integration-log.md](../ai-integration-log.md) |

## At a glance

- **Frontend coverage:** 87.08% lines, 84.12% functions across 6 test files / 17 specs.
- **Backend tests:** 24 integration + 23 unit cases wired (`tests/integration` + `tests/unit`); CI gate is 80% lines.
- **E2E tests:** `smoke`, `happy-path`, `filter-persistence`, `undo-delete`, `error-rollback`, `a11y` — all under `e2e/tests/`.
- **Security:** 0 high / 0 critical. 2 informational items (logger trace IDs; transitive `glob`).
- **Performance:** 0 critical. 5 informational items (all v2 candidates).

## How to run the full QA pass locally

```bash
# 1. Install everything
npm install

# 2. Coverage
npm test --workspace=backend -- --coverage
npm test --workspace=frontend -- --coverage

# 3. E2E (Chromium only by default)
npx playwright install chromium
docker compose up --wait
npm run e2e
npx --workspace=e2e playwright show-report

# 4. Lighthouse (on the running stack)
npx lighthouse http://localhost:5173 --preset=desktop --output=html

# 5. (Optional) API micro-bench
npx autocannon -c 50 -d 30 http://localhost:3001/api/todos
```

## What's next (post-Step 4)

1. Fold the `npm test` + `npm run e2e` invocations into a CI workflow (GitHub Actions / GitLab CI).
2. Wire the Playwright HTML report and Lighthouse HTML report as CI artifacts.
3. Schedule a weekly `npm audit --omit=dev` job to catch newly disclosed CVEs.
4. Add the trace-id middleware (Security F2) before introducing observability tooling.
