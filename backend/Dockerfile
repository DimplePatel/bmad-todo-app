# syntax=docker/dockerfile:1.7

#
# Stage 1: install workspace deps (including dev) for the build.
#
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY backend/package.json backend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --workspaces --include-workspace-root || npm install

#
# Stage 2: compile TypeScript.
#
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.base.json ./
COPY packages packages
COPY backend backend
RUN npm run build --workspace=backend

#
# Stage 3: runtime — slim, non-root, with a healthcheck.
#
FROM node:20-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    DATABASE_PATH=/data/todos.db
WORKDIR /app

# curl for HEALTHCHECK; tini as PID 1 for proper SIGTERM forwarding.
RUN apk add --no-cache curl tini

# Production-only deps.
COPY package.json ./
COPY backend/package.json backend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install --omit=dev --workspaces --include-workspace-root

# Compiled output and runtime resources.
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/src/db/migrations backend/dist/db/migrations
COPY --from=build /app/packages/shared/src packages/shared/src

# Persistent data dir (the named volume mounts here).
RUN mkdir -p /data && chown -R node:node /app /data

USER node

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
    CMD curl -fsS http://localhost:3001/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "backend/dist/index.js"]
