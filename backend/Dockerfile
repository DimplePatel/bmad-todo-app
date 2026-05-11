# syntax=docker/dockerfile:1.7

# Pinned base image for reproducibility. To upgrade: pull the new tag, grab
# its sha256, and bump the digest here. This way `docker compose build`
# produces the same image today as it does in six months unless we say
# otherwise.
ARG NODE_BASE=node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293

#
# Stage 1: full workspace deps (for building TypeScript + running tests in CI).
#
FROM ${NODE_BASE} AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY backend/package.json backend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --workspaces --include-workspace-root --no-audit --no-fund

#
# Stage 2: production-only deps — the runtime image copies node_modules from
# here instead of re-running npm at runtime build time.
#
FROM ${NODE_BASE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY backend/package.json backend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --omit=dev --workspaces --include-workspace-root --no-audit --no-fund

#
# Stage 3: compile TypeScript.
#
FROM ${NODE_BASE} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages packages
COPY backend backend
RUN npm run build --workspace=backend

#
# Stage 4: runtime — slim, non-root, with a healthcheck.
#
FROM ${NODE_BASE} AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    DATABASE_PATH=/data/todos.db
WORKDIR /app

# tini as PID 1 for proper SIGTERM forwarding. We deliberately do NOT install
# curl — the HEALTHCHECK uses the node binary that's already in the image.
RUN apk add --no-cache tini

# Pre-resolved production dependencies (no npm runs at runtime build time —
# faster image build, smaller layer count, reproducible against lockfile).
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./
COPY backend/package.json backend/package.json
COPY packages/shared/package.json packages/shared/package.json

# Compiled output and runtime resources.
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/src/db/migrations backend/dist/db/migrations
# Only the runtime JS from the shared package; the .d.ts and the legacy
# index.ts stub are type-only and unused at runtime.
COPY --from=build /app/packages/shared/src/index.js packages/shared/src/index.js

# Persistent data dir (named volume mounts here).
RUN mkdir -p /data && chown -R node:node /app /data

USER node

EXPOSE 3001

# Node-based healthcheck — uses Node 20's global `fetch`, so we don't have
# to install curl in the runtime image. Saves ~1 MB and one apk layer.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD ["node", "-e", "fetch('http://localhost:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "backend/dist/index.js"]
