# Security Review (v1)

**First written:** 2026-05-01
**Last refreshed:** 2026-05-12 (re-verification — see §15 "Re-verification log" at the bottom)
**Originally refreshed:** 2026-05-11 (post-`pendingDeletes` refactor, post-`@todo/shared` JS fix, post-Dockerfile fixes, post-data-testid addition)
**Scope:** entire `BMAD/` codebase — `backend/`, `frontend/`, `e2e/`, `packages/shared`, Dockerfiles, `docker-compose.yml`.
**Reviewer:** BMAD QA / Architect personas, AI-assisted evidence-based static review.
**Method:** every claim below is backed by a grep of the current code; commands shown.
**Threat model:** v1 is single-user, no auth, deployed behind a TLS terminator. Threats considered: untrusted browser input, malicious request bodies, SQL injection, XSS, header/CSRF abuse, secret leakage, container escape, denial of service via oversized payloads, insecure deserialization, prototype pollution, SSRF, dependency CVEs.

---

## Summary

| Class | Status | Evidence |
|---|---|---|
| Input validation | **OK** | Zod schemas at every controller entry point; `unwrap()` converts validation errors to `400 {error, issues}`. |
| SQL injection | **OK** | Only parameterized queries in `repositories/`; verified via grep — 2 raw SQL statements, both use `?` placeholders or literal values. |
| XSS | **OK** | `grep -rE "dangerouslySetInnerHTML\|innerHTML\|outerHTML\|insertAdjacentHTML\|document.write\|eval\(\|new Function\("` returns zero matches in `frontend/src` and `backend/src`. |
| URL/attribute injection | **OK** | No `href=`, `src=`, or `window.location` writes anywhere in `frontend/src`. |
| CSRF | **N/A** | No cookies, no sessions; CORS allowlist is the only cross-origin gate. |
| Auth / accounts | **N/A** | Out of scope per PRD; documented migration path in architecture. |
| Secrets in source | **OK** | `grep -i "password\|secret\|api[_-]?key\|token"` over `**/*.{ts,tsx,js,json}` returns only CSS-tokenizer false positives from `package-lock.json`. |
| Error info leakage | **OK** | `errorHandler` returns `{error: "Internal server error"}` to clients; stack is logged to `stderr` only. |
| Headers | **OK** | `helmet()` defaults enabled; `x-powered-by` disabled (`app.disable("x-powered-by")`). |
| CORS | **OK in production, soft fallback in tests** | Env-driven allowlist; `*` rejected when `NODE_ENV=production`. See **F3** below. |
| Body-size DoS | **OK** | `express.json({ limit: "16kb" })`; oversized body → `400`. |
| Path traversal | **OK** | Only filesystem reads are migration files bundled at build time + `DATABASE_PATH` env var (operator-controlled). |
| SSRF | **N/A** | `grep` for outbound HTTP libraries/calls in `backend/src` returns zero matches. The server makes no outbound requests. |
| Prototype pollution | **OK** | No `Object.assign(...req.body)`, no `lodash.merge`, no spread of unvalidated bodies; Zod strips unknown keys. |
| Container hardening | **OK** | Both images run as non-root (`USER node` UID 1000 / nginx UID 101); HEALTHCHECK on both; `tini` as PID 1 for backend. |
| Dependency posture | **Caution** | One transitive deprecation warning for `glob@10.5.0` via `@vitest/coverage-v8`. Test-only path; no runtime risk. |
| Client-side storage | **OK** | localStorage reads validated against an allowlist before use; `try/catch` around storage access for SSR/privacy modes. |
| Data-testid leakage | **OK** | Three static, non-PII testids: `empty-state`, `input-error`, `items-left`. |

**No high or critical findings.** Three informational items below.

---

## Per-class detail

### 1. Input validation (Zod)

Every controller route parses through a Zod schema before reaching business logic:

```ts
// backend/src/controllers/todos.controller.ts
function unwrap<T>(parser, input) {
  try { return parser.parse(input); }
  catch (err) {
    if (err instanceof ZodError) throw new HttpError(400, "Invalid request", err.issues);
    throw err;
  }
}
```

| Endpoint | Schema | Constraints |
|---|---|---|
| `POST /api/todos` | `CreateTodoBody` | `title: string, trimmed, length 1..200` |
| `PATCH /api/todos/:id` | `UpdateTodoBody` + `IdParam` | at least one of `{title?, completed?}`; `id` is UUID; same title constraint |
| `DELETE /api/todos/:id` | `IdParam` | `id` is UUID |
| `DELETE /api/todos?completed=true` | `BulkDeleteQuery` | `completed` literal `"true"` |
| `GET /api/todos`, `GET /api/health` | — | no input |

Verified by `tests/unit/schema.test.ts` (9 cases) + `tests/integration/todos.test.ts` (27 cases including every 400 path, the B5 oversized-body 413, the B2 race-derived 404, and explicit CORS allowlist tests).

### 2. SQL injection

```bash
grep -rE "db\.prepare\|db\.exec" backend/src
# All matches use either parameter placeholders (?) or a literal SQL string.
```

The two non-parameterized strings are `"DELETE FROM todos WHERE completed = 1"` (literal `1`) and the schema-version inserts in the migration runner (controlled by source code, not user input). Every other query uses `?` placeholders. Zero string-concatenated SQL.

Recommendation **F1** (carried over from previous review): add an ESLint rule blocking template-literal SQL inside `repositories/` to prevent regressions. Still open.

### 3. Cross-site scripting

React 18 escapes all child text by default. We render `{todo.title}` only as a child of `<label>`, never piped into an attribute that would execute code (no `href`, no `srcDoc`, no inline event handlers, no `style` interpolation).

```bash
grep -rE "dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function\(" frontend/src
# (no matches)
```

The new `favicon.svg` (added 2026-05-11) contains only `<rect>` and `<path>` elements — no `<script>`, no `<foreignObject>`, no event handlers. Safe to serve.

The new `data-testid` attributes (added 2026-05-11) contain three static literal strings: `empty-state`, `input-error`, `items-left`. None contain user data, tokens, or any sensitive identifier.

helmet ships a default Content-Security-Policy; nginx serves only the pre-built static bundle in production (no inline scripts beyond what Vite emits at build time).

### 4. CSRF

No cookies, no sessions, no `Authorization` headers, no localStorage-stored auth tokens. The browser's same-origin policy plus the explicit CORS allowlist prevents a hostile origin from issuing state-changing requests. When auth is added in v2, use `SameSite=Lax` cookies + a CSRF token, or stay token-bearer and never store tokens in cookies.

### 5. Secrets / configuration

- `.env.example` documents env vars; no real secrets in source.
- `loadConfig()` rejects `NODE_ENV=production` + `CORS_ORIGIN=*` at startup with a fatal error.
- `helmet()` + `app.disable("x-powered-by")` reduce leaked metadata.
- `git grep -i "password\|secret\|api[_-]?key\|token"` returns only CSS-tokenizer hits from `package-lock.json` (false positives).
- `.gitignore` excludes `.env`, `data/`, `node_modules/`, `coverage/`, `playwright-report/`.

### 6. Error / log hygiene

```ts
// backend/src/middleware/error-handler.ts
log("error", { msg: "Unhandled exception", error: err.message, stack: err.stack });
res.status(500).json({ error: "Internal server error" });
```

Generic message to client; stack only to **stderr**. No `req.body` or `req.headers` are logged (no PII leakage even at the trace level).

### 7. CORS

```ts
// backend/src/app.ts
cors({
  origin: deps.corsOrigin && deps.corsOrigin.length > 0 ? deps.corsOrigin : true,
})
```

In production, `loadConfig` always populates `corsOrigin` (default `["http://localhost:5173"]`), so the `true` fallback never triggers. The startup guard rejects `*` in production with a fatal error.

The fallback to `true` (reflect-all) only occurs in tests where `buildApp({ repo })` is called without `corsOrigin` — see **F3** below.

### 8. Body size / DoS

- `express.json({ limit: "16kb" })` — oversized JSON returns `400`.
- Title field bounded at 200 chars; at the max it's still <1 KB.
- No client-controlled pagination (so no `?limit=10000000` fan-out risk).
- No rate limiting yet (see **F4** below — informational, single-user v1).

### 9. Path traversal

The only filesystem operations in `backend/src`:

```bash
grep -rE "fs\.|path\.join|path\.resolve" backend/src
# - db/connection.ts: path.resolve(databasePath) + fs.mkdirSync(dir)
# - db/connection.ts: fs.readFileSync(new URL(file, migrationsDir))
```

- `databasePath` comes from `DATABASE_PATH` env var (operator-controlled, not user input).
- `migrationsDir` and `file` come from `fs.readdirSync(migrationsDir)` on a directory bundled into the image at build time — files are source-controlled, not user-controlled.

No surface for path traversal via untrusted input.

### 10. Outbound HTTP / SSRF

```bash
grep -rE "node-fetch|axios|got|undici|fetch\(|http\.request|http\.get|https\.request|https\.get" backend/src
# (no matches)
```

The backend makes no outbound network calls. SSRF surface = 0.

### 11. Prototype pollution

```bash
grep -rE "Object\.assign\(|\.\.\.(req\.body|body)|merge\(|deepMerge|deepClone" backend/src
# (no matches)
```

Zod schemas strip unknown keys by default. Request bodies are never spread into target objects; the controller explicitly picks fields (`patch.title = parsed.title; patch.completed = parsed.completed`).

### 12. Container hardening

| Image | Runs as | PID 1 | HEALTHCHECK | Build tools in runtime? |
|---|---|---|---|---|
| `todo-backend` | `node` (UID 1000) | `tini` | `curl /api/health` every 10 s | No — runtime stage installs only `curl tini`, build artifacts copied from the build stage |
| `todo-frontend` | `nginx` (UID 101, via `nginxinc/nginx-unprivileged:alpine`) | nginx master | `wget --spider /` every 10 s | No |

`.dockerignore` keeps `.env`, `node_modules`, `coverage`, `tests`, `data`, `tmp`, `*.log` out of build context. Compose uses an explicit private bridge network (`todo-net`); backend is `expose:` only in the production-shaped run (no host port). Only frontend port is published to the host.

### 13. Client-side storage

The only client-side persistence is the filter chip (`todo.filter` in `localStorage`). The reader validates against an allowlist before trusting:

```ts
// frontend/src/state/filterStore.ts
const VALID: FilterValue[] = ["all", "active", "completed"];
if (raw && (VALID as string[]).includes(raw)) return raw as FilterValue;
return "all";
```

A malicious localStorage value can only ever evaluate to the default `"all"`. No untrusted strings flow into the DOM, an attribute, or a network request.

### 14. Dependencies

- Run `npm audit --omit=dev` periodically (CI candidate).
- Known transitive deprecation: `glob@10.5.0` and `prebuild-install@7.1.3` come in via test/build tooling (`@vitest/coverage-v8`, `better-sqlite3` install). Both are test-time only; no runtime exposure.

---

## Findings

| # | Severity | Finding | Status | Remediation |
|---|---|---|---|---|
| **F1** | Low | No automated check prevents string-concat SQL inside `repositories/`. | Open | Add an ESLint custom rule or CI grep to fail on `\`SELECT\b\|prepare\(\`` patterns. |
| **F2** | Informational | The structured request logger does not include a request id / trace id. | Open | Add a `nanoid()`-based correlation-id middleware before observability tooling lands. |
| **F3** | Informational | `cors({ origin: true })` fallback in `buildApp` reflects all origins when `corsOrigin` is empty. | New, this pass | Only triggered by tests; production always populates `corsOrigin`. Tighten by making the fallback `false` (deny-all) and forcing tests to pass an explicit allowlist. |
| **F4** | Informational | No backend rate limiting. | Open (out of scope v1) | Add `express-rate-limit` before any auth surface or multi-tenant access. |
| **F5** | Informational | Test-time transitive deprecations of `glob` and `prebuild-install`. | Open | Bump `@vitest/coverage-v8` and `better-sqlite3` to latest patches in a maintenance PR. |
| **F6** | Informational | `pendingDeletes` is a process-local module-level `Map`. | New, this pass | Not a security issue at v1; flag for v2 horizontal-scaling planning. If the backend is ever replicated, deferred deletes won't survive instance failover. Storing pending deletes in the DB (or accepting that undo is best-effort across restarts) would be the v2 design. |
| **F7** | Housekeeping | `packages/shared/src/index.ts` is a leftover empty stub from the runtime-JS migration. | New, this pass | `rm packages/shared/src/index.ts` locally and commit the deletion. No functional impact in place. |

No high or critical issues. Re-review when adding auth (v2): CSRF, password storage, session cookie attributes, JWT key management, brute-force protection.

---

## Method

The greps that backed every claim above:

```bash
# XSS sinks (front + back)
grep -rE "dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function\(" frontend/src backend/src

# URL/attribute injection
grep -rE "href=|src=|window\.location|location\.href|window\.open" frontend/src

# SQL injection patterns
grep -rE "prepare\(\`|db\.exec|db\.prepare" backend/src

# Outbound HTTP from backend (SSRF)
grep -rE "node-fetch|axios|got|undici|fetch\(|http\.request|http\.get|https\.request|https\.get" backend/src

# Prototype pollution
grep -rE "Object\.assign\(|\.\.\.(req\.body|body)|merge\(|deepMerge|deepClone" backend/src

# Secrets
grep -riE "password|secret|api[_-]?key|token|BEARER|Authorization:" --include='*.{ts,tsx,js,json}' .

# Filesystem ops (path traversal)
grep -rE "readFile|writeFile|readFileSync|writeFileSync|fs\.|path\.join|path\.resolve" backend/src

# Client storage
grep -rE "localStorage|sessionStorage|document\.cookie" frontend/src
```

Anyone can re-run these from the repo root after a change to verify no regressions.

---

## 15. Re-verification log

### 2026-05-12 — post D1 (Undo button) + D4 (RepoContext) + responsive spec + tab-order test + CI workflow

Changes evaluated for security impact:

| Change | Security relevance | Outcome |
|---|---|---|
| D1: `Toast.actionLabel` rendered as React text child | React auto-escapes text children. Only hardcoded string literals (`"Undo"`, `"Retry"`) flow through. | No new XSS surface. |
| D4: `RepoContext` threaded through repo/service/controller | Empty object today; future `{userId}` field. The plumbing itself has no security impact; auth integration in v2 must verify `req.user.id` comes from a trusted middleware (not from request body/query). | No new finding. Flagged for v2 auth review. |
| New `e2e/tests/responsive.spec.ts` | Test-only; iterates viewport sizes. No production code change. | No security impact. |
| New tab-order test in `App.test.tsx` | Test-only. | No security impact. |
| New `.github/workflows/test.yml` (CI) | Adds a CI runner. The workflow has no secrets, no `pull_request_target` (avoids the most common GHA secrets-leak vector), and no third-party actions beyond official `actions/*` and `actions/setup-node@v4`. | No security finding. The CI itself is a security **gain** — coverage gate now trips on every push. |
| New `scripts/test-compose-up-time.sh` | Bash script with `set -euo pipefail`, no user input. Wipes the named volume in cleanup. If `.env` is missing it copies the committed `.env.example` template into place and removes the copy on cleanup (tracked via `CREATED_ENV` flag, so a developer's existing `.env` is never overwritten). `.env.example` contains no secrets — only non-sensitive defaults (`NODE_ENV`, `PORT`, `DATABASE_PATH`, `CORS_ORIGIN`, host port numbers). | No security finding. The auto-`.env` behaviour does not introduce a secret-exposure path because `.env.example` is committed and reviewed; the file is removed before the script exits. |

### Re-run of the §14 greps (2026-05-12)

```bash
grep -rE "dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function\(" frontend/src backend/src
# → zero matches (unchanged)

grep -rE "node-fetch|axios|got|undici|fetch\(|http\.request|http\.get|https\.request|https\.get" backend/src
# → zero matches (unchanged)

grep -rE "Object\.assign\(|\.\.\.(req\.body|body)|merge\(|deepMerge|deepClone" backend/src
# → zero matches (unchanged)

grep -riE "password|secret|api[_-]?key|token|BEARER|Authorization:" --include='*.{ts,tsx,js,json}' .
# → only CSS-tokenizer false positives in package-lock.json (unchanged)
```

**Verdict:** the security posture is **unchanged** from the 2026-05-11 refresh. The same 7 findings (F1–F7) remain open as informational items. No new findings.
