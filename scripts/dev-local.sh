#!/usr/bin/env bash
#
# The environment below is the same block `.github/workflows/ci.yml` gives its
# e2e job. Keeping one list means a local run and CI fail in the same places.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

PRISMA_SERVER=my-expenses
SHIM_PORT=51230
MOCK_MODEL_PORT=51231
EXTRACTION_PORT=51232
APP_PORT=3000

BIN=./node_modules/.bin
LOG_DIR=.dev-local
PRISMA_LOG="$LOG_DIR/prisma-dev.log"
SERVE_LOG="$LOG_DIR/serve.log"
NEXT_LOG="$LOG_DIR/next-dev.log"

export JWT_SECRET=e2e-test-secret
export REDIS_URL="http://127.0.0.1:$SHIM_PORT"
export REDIS_TOKEN=e2e
export AI_PROVIDER=chatgpt
export OPENAI_API_KEY=e2e
export ASSISTANT_MODEL_URL="http://127.0.0.1:$MOCK_MODEL_PORT/v1"
export CRON_SECRET=e2e
# Test-only key; production uses its own secret.
export PRISMA_FIELD_ENCRYPTION_KEY=k1.aesgcm256.oAsfUHjnw25v7kaFzQXGAG24LEhRlt8Ow6cjjc5s3bE=
export WEBSITE_URL="http://127.0.0.1:$APP_PORT"
export EXCEL_EXTRACTION_AGENT_URL="http://127.0.0.1:$EXTRACTION_PORT"
export EXCEL_EXTRACTION_AGENT_WEBHOOK_SECRET=e2e-extraction-secret
export IMPORTS_S3_BUCKET=dev-local-imports
export IMPORTS_S3_REGION=us-east-1
export IMPORTS_S3_ACCESS_KEY_ID=dev
export IMPORTS_S3_SECRET_ACCESS_KEY=dev
# With no token the bot code no-ops instead of opening sockets to Telegram.
unset TELEGRAM_BOT_TOKEN

SERVE_PID=
NEXT_PID=
TAIL_PID=

# npm and tsx both run the real server as a child, so killing the pid this
# script holds leaves the listener bound.
stop_tree() {
  local pid=$1
  if [ -n "$pid" ]; then
    pkill -P "$pid" 2>/dev/null || true
    kill "$pid" 2>/dev/null || true
  fi
}

cleanup() {
  kill "$TAIL_PID" 2>/dev/null || true
  stop_tree "$NEXT_PID"
  stop_tree "$SERVE_PID"
}
trap cleanup EXIT INT TERM

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

die() {
  local message=$1
  shift
  printf '\n\033[31m%s\033[0m\n' "$message" >&2
  for log in "$@"; do
    if [ -f "$log" ]; then
      printf '\n--- %s ---\n' "$log" >&2
      tail -n 40 "$log" >&2
    fi
  done
  exit 1
}

# node rather than nc or lsof: it is the one dependency this repo already
# guarantees on every platform.
require_free_ports() {
  local busy
  busy=$(node -e '
    const net = require("net");
    const check = (port) => new Promise((resolve) => {
      const socket = net.connect({ host: "127.0.0.1", port: +port });
      const done = (inUse) => { socket.destroy(); resolve(inUse ? port : null); };
      socket.setTimeout(1000);
      socket.on("connect", () => done(true));
      socket.on("timeout", () => done(false));
      socket.on("error", () => done(false));
    });
    Promise.all(process.argv.slice(1).map(check)).then((ports) =>
      console.log(ports.filter(Boolean).join(" ")),
    );
  ' "$@")
  if [ -n "$busy" ]; then
    die "already in use: port(s) $busy — stop the previous dev:local run, npm run test:e2e:api, or stray dev server"
  fi
}

wait_for() {
  local tries=$1
  shift
  for _ in $(seq 1 "$tries"); do
    if "$@"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

mkdir -p "$LOG_DIR"

if [ ! -d node_modules ]; then
  step 'Installing dependencies (npm ci)'
  npm ci
fi

# Before anything is torn down: `prisma dev stop` below would drop the shared
# database out from under a run already using it, and aborting afterwards
# leaves that run pointed at a dead server.
require_free_ports "$SHIM_PORT" "$MOCK_MODEL_PORT" "$EXTRACTION_PORT" "$APP_PORT"

step 'Starting local Prisma Postgres'
# Restarted rather than reused. prisma dev fronts Postgres with a pooler, and
# the query engine left from the previous run holds a session carrying its
# prepared statements; `migrate deploy` is handed that session and dies on
# "prepared statement s0 already exists". Stopping drops the sessions — the
# data lives on disk and survives.
"$BIN/prisma" dev stop "$PRISMA_SERVER" >/dev/null 2>&1 || true
"$BIN/prisma" dev --detach --name "$PRISMA_SERVER" >"$PRISMA_LOG" 2>&1 ||
  die 'prisma dev failed to start' "$PRISMA_LOG"

# Ports are whatever prisma dev picked, so every URL is read back from its
# state file, which lands under Application Support on macOS and the XDG data
# home on Linux — and lands some time after --detach returns, so finding it and
# reading it are both retried together below.
STATE_CANDIDATES=(
  "$HOME/Library/Application Support/prisma-dev-nodejs/$PRISMA_SERVER/server.json"
  "${XDG_DATA_HOME:-$HOME/.local/share}/prisma-dev-nodejs/$PRISMA_SERVER/server.json"
)

# The app's client speaks the Accelerate protocol, so DATABASE_URL has to be
# the prisma+postgres:// proxy URL; the plain postgres:// address prisma dev
# prints on startup is DIRECT_URL, used by migrations, the seed and Mastra.
read_state() {
  node -e '
    const fs = require("fs");
    const file = process.argv.slice(1).find((path) => fs.existsSync(path));
    const { exports: state } = require(file);
    console.log(state.ppg.url);
    console.log(state.database.connectionString);
  ' "${STATE_CANDIDATES[@]}" 2>/dev/null
}
wait_for 90 read_state >/dev/null ||
  die 'prisma dev never published its connection URLs' "$PRISMA_LOG"
{
  read -r DATABASE_URL
  read -r DIRECT_URL
} < <(read_state)
export DATABASE_URL DIRECT_URL

step 'Applying migrations'
"$BIN/prisma" migrate deploy

step 'Starting the mock services and the app'
# Started together rather than in sequence: no client is built at module load,
# so Next reaches the mocks no earlier than its first request, which is the
# health poll below.
"$BIN/tsx" test/e2e-api/serve.ts >"$SERVE_LOG" 2>&1 &
SERVE_PID=$!
npm run dev >"$NEXT_LOG" 2>&1 &
NEXT_PID=$!
wait_for 120 grep -q '^ready$' "$SERVE_LOG" ||
  die 'the mock services never came up' "$SERVE_LOG"
healthy() { HEALTH=$(curl -sf "http://127.0.0.1:$APP_PORT/api/health/deep"); }
wait_for 180 healthy || die 'the app never reported healthy' "$NEXT_LOG" "$SERVE_LOG"

from_serve_log() { sed -n "s/^$1=//p" "$SERVE_LOG"; }

cat <<SUMMARY

  App        http://localhost:$APP_PORT
  Health     $HEALTH

  Sign in    $(from_serve_log E2E_USER_EMAIL) / $(from_serve_log E2E_PASSWORD)
  Bearer     $(from_serve_log E2E_AUTH_TOKEN)

  Seeded transactions are dated January and February 2026, so any view scoped
  to recent months is empty by design. Every run re-seeds from scratch, so
  anything you added by hand last run is gone.

  Logs       $NEXT_LOG, $SERVE_LOG
  Ctrl-C stops the app and the mocks. The database keeps running — stop it
  with npx prisma dev stop $PRISMA_SERVER.

SUMMARY

# Waited on rather than run in the foreground: bash defers a trap until the
# running command returns, and `tail -f` never does — Ctrl-C would hang instead
# of stopping anything.
tail -f "$NEXT_LOG" &
TAIL_PID=$!
wait "$TAIL_PID" || true
