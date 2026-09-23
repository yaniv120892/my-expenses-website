#!/usr/bin/env bash
# The env below mirrors the block `.github/workflows/ci.yml` gives its e2e job;
# change both together. Presetting a var points that one integration at the real
# service.
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
export OPENAI_API_KEY=${OPENAI_API_KEY:-e2e}
export ASSISTANT_MODEL_URL="http://127.0.0.1:$MOCK_MODEL_PORT/v1"
export CRON_SECRET=e2e
# Test-only key; production uses its own secret.
export PRISMA_FIELD_ENCRYPTION_KEY=${PRISMA_FIELD_ENCRYPTION_KEY:-k1.aesgcm256.oAsfUHjnw25v7kaFzQXGAG24LEhRlt8Ow6cjjc5s3bE=}
export WEBSITE_URL="http://127.0.0.1:$APP_PORT"
export EXCEL_EXTRACTION_AGENT_URL="${EXCEL_EXTRACTION_AGENT_URL:-http://127.0.0.1:$EXTRACTION_PORT}"
export EXCEL_EXTRACTION_AGENT_WEBHOOK_SECRET=e2e-extraction-secret
export IMPORTS_S3_BUCKET=${IMPORTS_S3_BUCKET:-dev-local-imports}
export IMPORTS_S3_REGION=${IMPORTS_S3_REGION:-us-east-1}
export IMPORTS_S3_ACCESS_KEY_ID=${IMPORTS_S3_ACCESS_KEY_ID:-dev}
export IMPORTS_S3_SECRET_ACCESS_KEY=${IMPORTS_S3_SECRET_ACCESS_KEY:-dev}
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

start_local_database() {
  step 'Starting local Prisma Postgres'
  # Restarted rather than reused: the previous run's query-engine session still
  # holds its prepared statements, and `migrate deploy` dies on "s0 already
  # exists".
  "$BIN/prisma" dev stop "$PRISMA_SERVER" >/dev/null 2>&1 || true
  "$BIN/prisma" dev --detach --name "$PRISMA_SERVER" >"$PRISMA_LOG" 2>&1 ||
    die 'prisma dev failed to start' "$PRISMA_LOG"

  # Ports are whatever prisma dev picked, and its state file lands some time
  # after --detach returns, so finding and reading it are retried together.
  STATE_CANDIDATES=(
    "$HOME/Library/Application Support/prisma-dev-nodejs/$PRISMA_SERVER/server.json"
    "${XDG_DATA_HOME:-$HOME/.local/share}/prisma-dev-nodejs/$PRISMA_SERVER/server.json"
  )

  # The proxy URL, not the plain postgres:// one: that port multiplexes every
  # client onto one backend session, where the app collides on prepared
  # statements.
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
}

database_host() {
  node -e 'console.log(new URL(process.argv[1]).hostname)' "$1"
}

use_preset_database() {
  if [ -z "${DATABASE_URL:-}" ] || [ -z "${DIRECT_URL:-}" ]; then
    die 'DATABASE_URL and DIRECT_URL must be preset together, or neither'
  fi
  if [ -z "${SESSION_USER_EMAIL:-}" ]; then
    die 'SESSION_USER_EMAIL names the account to mint a session for when the database is preset'
  fi
  DATABASE_HOST=$(database_host "$DIRECT_URL")
  if [ "${REMOTE_DATABASE_OK:-}" != 1 ]; then
    die "Refusing a preset database without REMOTE_DATABASE_OK=1. Check that $DATABASE_HOST is the copy you mean to write to, not production, then set it."
  fi
  step "Using the preset database at $DATABASE_HOST"
}

if [ -n "${DATABASE_URL:-}${DIRECT_URL:-}" ]; then
  use_preset_database
else
  DATABASE_HOST=local
  start_local_database
fi

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

if [ "$DATABASE_HOST" = local ]; then
  DATA_NOTE='Seeded transactions are dated January and February 2026, so any view scoped
  to recent months is empty by design. Every run re-seeds from scratch, so
  anything you added by hand last run is gone.'
  SIGN_IN="$(from_serve_log E2E_USER_EMAIL) / $(from_serve_log E2E_PASSWORD)"
else
  DATA_NOTE="Running over the database at $DATABASE_HOST: nothing was seeded, and every
  import written here stays there."
  SIGN_IN="$(from_serve_log E2E_USER_EMAIL) with that account's own password"
fi

cat <<SUMMARY

  App        http://localhost:$APP_PORT
  Health     $HEALTH
  Database   $DATABASE_HOST

  Sign in    $SIGN_IN
  Bearer     $(from_serve_log E2E_AUTH_TOKEN)

  $DATA_NOTE

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
