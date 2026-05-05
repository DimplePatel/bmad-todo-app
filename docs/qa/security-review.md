# Security Review (v1)

**Date:** 2026-05-01
**Scope:** entire `BMAD/` codebase: `backend/`, `frontend/`, `e2e/`, `packages/shared`, `docker-compose.yml`, Dockerfiles.
**Reviewer:** BMAD QA / Architect personas, AI-assisted static review.
**Threat model:** v1 is single-user, no auth, deployed behind a TLS terminator. Threats considered: untrusted browser input, malicious request bodies, SQL injection, XSS, header/CSRF abuse, secret leakage, container escape, denial of service via oversized payloads, insecure deserialization, and dependency CVEs.

---

## Summary

| Class | Status | Notes |
|---|---|---|
| Input validation | **OK** | Zod schemas on every body, path, and query param. |
| SQL injection | **OK** | `better-sqlite3` parameterized queries throughout. |
| XSS | **OK** | React auto-escapes; no `dangerouslySetInnerHTML`, no `innerHTML` writes. |
| CSRF | **N/A** | No cookies, no sessions. CORS allowlist controls cross-origin write access. |
| Auth / accounts | **N/A** | Out of scope per PRD. Architecture documents the migration path. |
| Secrets | **OK** | None in source. `.env.example` is documentation. |
| Error info leakage | **OK** | Internal exceptions render `{error:"Internal server error"}`; stack only to stderr. |
| Headers | **OK** | `helmet` enabled with defaults. `x-powered-by` disabled. |
| CORS | **OK** | Env-driven allowlist; `*` rejected when `NODE_ENV=production`. |
| Body size DoS | **OK** | `express.json({ limit: "16kb" })`. |
| Container hardening | **OK** | Both images run as non-root with HEALTHCHECK + tini. |
| Dependency posture | **CAUTION** | One transitive deprecation warning for `glob@10.5.0` via `@vitest/coverage-v8`. Test-only path; no runtime risk. |
| File system / SSRF | **OK** | Backend never reads from a user-controlled path or makes outbound HTTP. |
| Prototype pollution | **OK** | Zod strips unknown keys; no merge-style assignment from request bodies. |

No high or critical findings. Two low / informational items below.

---

## Per-class detail

### 1. Input validation (Zod)

Every request boundary parses through a Zod schema before reaching business logic:

- `CreateTodoBody` — `title: string` trimmed, length 1..200.
- `UpdateTodoBody` — at least one of `{ title?, completed? }`; same title rules.
- `IdParam` — UUID v4.
- `BulkDeleteQuery` — `completed=true` literal (any other value → 400).

Tested by `tests/unit/schema.test.ts` (9 cases) and `tests/integration/todos.test.ts` (24 cases incl. all 400 paths).

### 2. SQL injection

`SqliteTodoRepository` uses `better-sqlite3` prepared statements with bound parameters everywhere. No string-concatenated SQL. Sample:

```ts
this.db.prepare("INSERT INTO todos (id, title, completed, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
       .run(todo.id, todo.title, 0, todo.createdAt, todo.updatedAt);
```

Recommendation (already noted in arch doc): add an ESLint rule (or CI grep) that fails on string concatenation inside `repositories/` to prevent regressions.

### 3. Cross-site scripting

- React 18 escapes all child text by default; we only render `{todo.title}` as a child of `<label>` and never pipe untrusted strings into an attribute that would execute (no `href`, no `srcDoc`, no `style` interpolation).
- No use of `dangerouslySetInnerHTML`, `eval`, `Function(...)`, or `innerHTML` writes anywhere in `frontend/`.
- `helmet` adds a default CSP. The Vite dev server uses inline scripts, but production nginx serves only the prebuilt static bundle.

Verified by `grep -R "dangerouslySetInnerHTML\|innerHTML\|eval(" frontend/src` → no matches.

### 4. CSRF

No cookies, no sessions, no `Authorization` headers. The browser's same-origin policy plus the explicit CORS allowlist prevents a hostile origin from issuing state-changing requests. When auth is added in v2, switch to `SameSite=Lax` cookies plus a CSRF token, or stay token-bearer and never store tokens in cookies.

### 5. Secrets / configuration

- `.env.example` documents env vars; **no real secrets in source**.
- `loadConfig()` rejects `NODE_ENV=production` + `CORS_ORIGIN=*` at startup.
- `helmet` + `disable("x-powered-by")` reduce leaked metadata.

### 6. Error / log hygiene

- `errorHandler` returns generic `Internal server error` on unknown exceptions and writes the stack to **stderr** only. No stack ever reaches the client.
- The structured request logger emits `{ts, level, method, path, status, duration_ms}` — no headers, no bodies, no PII.

### 7. CORS

Configured via `CORS_ORIGIN` (comma-separated allowlist). The compose dev override forces `NODE_ENV=development` to allow loose values; production deploys must set an explicit origin. The startup guard rejects `*` in production with a fatal error.

### 8. Body size / DoS

- `express.json({ limit: "16kb" })` — oversize JSON returns `400`.
- Title field is bounded at 200 chars; even at the max it's far below the body limit.
- No client-controlled pagination is exposed (so no `limit=10000000` fan-out risk).

Future: rate-limiting (e.g., `express-rate-limit`) is not required for single-user v1 but should be added behind any auth surface in v2.

### 9. Container hardening

- **Backend:** `node:20-alpine` runtime, `USER node` (UID 1000), `tini` as PID 1 for clean SIGTERM, `HEALTHCHECK` against `/api/health`. No build tools in the runtime image.
- **Frontend:** `nginxinc/nginx-unprivileged:alpine` runs as UID 101, listens on 8080, with `wget --spider` HEALTHCHECK.
- `.dockerignore` keeps `.env`, `node_modules`, `coverage`, etc. out of build context.
- Compose: explicit private bridge network `todo-net`; backend is `expose:` only (not published) in the production-shaped run; only the frontend port is published to the host.

### 10. Dependencies

Run `npm audit --omit=dev` periodically. The build emitted one notable warning:
- `glob@10.5.0` (transitive via `@vitest/coverage-v8`) — test-time only, no runtime exposure. Resolves with a coverage-tool upgrade in a follow-up.
- `prebuild-install@7.1.3` — also test-time.

---

## Findings

| # | Severity | Finding | Remediation |
|---|---|---|---|
| **F1** | Low | Test-time transitive deprecation of `glob` and `prebuild-install`. | Bump `@vitest/coverage-v8` and `better-sqlite3` to latest patches in a maintenance PR. |
| **F2** | Informational | The structured request logger does not include a request id / trace id. | Add `nanoid()`-based correlation id middleware before introducing observability tooling. |

No high or critical issues. Re-review when adding auth (v2): CSRF, password storage, session cookie attributes, JWT key management, brute-force protection.
