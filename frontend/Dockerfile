# syntax=docker/dockerfile:1.7

# Pinned base images for reproducibility. Bump the digests deliberately.
ARG NODE_BASE=node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293
ARG NGINX_BASE=nginxinc/nginx-unprivileged:alpine@sha256:0c79d56aee561a1d81c63f00eee5fb5fe29279560cdc55e91425133104c7fbe6

#
# Stage 1: install deps.
#
FROM ${NODE_BASE} AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY frontend/package.json frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --workspaces --include-workspace-root --no-audit --no-fund

#
# Stage 2: build the static SPA bundle.
#
FROM ${NODE_BASE} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY packages packages
COPY frontend frontend
RUN npm run build --workspace=frontend

#
# Stage 3: serve via nginx-unprivileged (UID 101, listens on 8080).
#
FROM ${NGINX_BASE} AS runtime

# nginx-unprivileged is built on nginx:alpine-slim which strips busybox
# utilities; we add a tiny wget back just for the HEALTHCHECK. Node isn't
# available in this image, so wget is the lightest option (~500 KB).
USER root
RUN apk add --no-cache wget
USER nginx

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
    CMD wget -q --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
