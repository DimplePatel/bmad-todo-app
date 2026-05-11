#!/usr/bin/env bash
#
# NFR7: `docker compose up --wait` should bring the stack to healthy in
# under 60 seconds on a developer-grade machine.
#
# This script enforces it: it builds the images (so the first run reflects a
# realistic cold-start time), brings the stack up with --wait-timeout=60, and
# times the whole thing. Docker's --wait-timeout 60 causes the command itself
# to fail if healthchecks aren't green within the budget; we additionally
# print the elapsed time so the CI log carries the number.
#
# Usage:
#     scripts/test-compose-up-time.sh
#
# Exits non-zero on:
#   - Docker daemon not reachable
#   - Build failure
#   - Healthcheck not green within 60s
#
# Tear-down: always runs `docker compose down -v` (preserves named volumes
# would defeat the cold-start measurement, so this run wipes them).

set -euo pipefail

# Anchor to the repo root regardless of where the script is invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

BUDGET_SECONDS=60
CREATED_ENV=0

cleanup() {
  echo
  echo "--- tearing down ---"
  docker compose down -v --remove-orphans 2>&1 | sed 's/^/  /' || true
  if [ "${CREATED_ENV}" = "1" ] && [ -f .env ]; then
    rm -f .env
  fi
}
trap cleanup EXIT

# docker-compose.yml has `env_file: .env` on the shared service block, which
# Compose treats as required. On a fresh checkout (CI in particular) the file
# doesn't exist yet — copy from the committed template so the script is
# self-sufficient. We remember we created it so cleanup() removes it again,
# leaving the developer's local config untouched if they ever had one.
if [ ! -f .env ]; then
  if [ ! -f .env.example ]; then
    echo "FAIL: neither .env nor .env.example exists at the repo root"
    exit 1
  fi
  echo "--- no .env found; copying .env.example -> .env for this run ---"
  cp .env.example .env
  CREATED_ENV=1
fi

echo "--- pre-check: Docker daemon reachable? ---"
if ! docker version --format '{{.Server.Version}}' >/dev/null 2>&1; then
  echo "FAIL: cannot reach the Docker daemon. Start Docker Desktop / OrbStack / Colima first."
  exit 1
fi

echo "--- starting stack with --wait-timeout=${BUDGET_SECONDS} ---"
START=$(date +%s)

docker compose up --build --detach --wait --wait-timeout "${BUDGET_SECONDS}"

END=$(date +%s)
ELAPSED=$((END - START))

echo
echo "Stack reached healthy in ${ELAPSED}s (NFR7 budget: ${BUDGET_SECONDS}s)"

# Even though --wait-timeout above would have failed the command, double-check
# the elapsed wall-clock so the number lands in the log unambiguously.
if [ "${ELAPSED}" -gt "${BUDGET_SECONDS}" ]; then
  echo "FAIL: exceeded NFR7's ${BUDGET_SECONDS}s budget"
  exit 1
fi

echo "PASS: NFR7 budget met"
