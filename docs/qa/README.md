# QA Reports

**Last updated:** 2026-05-12

This folder contains the four standing QA test reports for the Todo App. Each is **regenerable from automated tests** — every claim traces back to a script that can be re-run.

| Report | What it covers | Headline |
|---|---|---|
| [coverage.md](./coverage.md) | What % of source code is exercised by tests | **Frontend 89.03% lines / 95.23% functions**; backend gated at ≥ 80% lines (CI-enforced) |
| [performance.md](./performance.md) | NFR1, NFR3, NFR7 — UI/API latency, responsive layout, container startup | Backend p99 = **11 ms** (autocannon 50c/30s); Lighthouse Performance 85 (dev), 95+ expected on prod build; NFR7 now CI-gated |
| [accessibility.md](./accessibility.md) | WCAG 2.1 AA conformance via axe + Lighthouse + RTL keyboard tests | **Lighthouse Accessibility = 100**; **0 serious/critical axe violations** across **11 distinct UI states** (+ 1 keyboard-reachability test) |
| [security-review.md](./security-review.md) | XSS, SQL injection, CSRF, CORS, secrets, container hardening, dependencies | **0 high / 0 critical**; 7 informational items (F1–F7) all in the "v2 polish" bucket |

For test design and strategy (pyramid, tooling, isolation rules, traceability), see [`docs/test-strategy.md`](../test-strategy.md). For the AI-collaboration retrospective behind these tests, see [`docs/ai-integration-log.md`](../ai-integration-log.md).

## Quick re-verification

```bash
cd /Users/dimple/Documents/Claude/Projects/BMAD

# 1. Unit + integration with coverage (regenerates docs/qa/coverage.md numbers)
npm test --workspace=backend  -- --coverage
npm test --workspace=frontend -- --coverage

# 2. E2E (Playwright Chromium — 19 cases including 11 axe scans)
npx playwright install --with-deps chromium      # one-time
npm run e2e

# 3. NFR7 budget check (regenerates docs/qa/performance.md Compose-startup row)
npm run test:nfr7

# 4. Lighthouse (regenerates docs/qa/performance.md + docs/qa/accessibility.md scores)
docker compose up --build -d
until curl -fsS http://localhost:5173 >/dev/null 2>&1; do sleep 1; done
npx lighthouse http://localhost:5173 --preset=desktop --output=html --output-path=./lighthouse.html

# 5. API micro-bench (regenerates docs/qa/performance.md backend row)
npx autocannon -c 50 -d 30 http://localhost:3001/api/todos

# 6. Security greps (regenerates docs/qa/security-review.md §14 baseline)
# Commands are listed inline at the bottom of security-review.md.
```

Steps 1–3 also run automatically in CI on every push (`.github/workflows/test.yml`). Steps 4–5 are manual because they need the running stack and Chrome.

## Maintenance contract

When a test or source file changes that would shift one of the headline numbers above, the relevant report should be refreshed. The two reports most sensitive to drift:

- **coverage.md** drifts whenever new code or tests land. Re-measure after any PR touching `frontend/src/` or `backend/src/`.
- **accessibility.md** drifts whenever UI components or styling change. Re-measure after CSS or component edits.

`performance.md` and `security-review.md` are more stable — they need a refresh only when there's a known architectural change (e.g., adding rate-limiting would update performance + security; adding auth would update security).
