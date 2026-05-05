# syntax=docker/dockerfile:1.7

#
# Stage 1: install deps.
#
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY frontend/package.json frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --workspaces --include-workspace-root || npm install

#
# Stage 2: build the static SPA bundle.
#
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.base.json ./
COPY packages packages
COPY frontend frontend
RUN npm run build --workspace=frontend

#
# Stage 3: serve via nginx-unprivileged (runs as UID 101, listens on 8080).
#
FROM nginxinc/nginx-unprivileged:alpine AS runtime

# nginx-unprivileged ships without curl/wget; install wget for HEALTHCHECK.
USER root
RUN apk add --no-cache wget
USER nginx

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
    CMD wget -q --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
