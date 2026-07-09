#!/usr/bin/env bash
# dev-safe.sh — runs `next dev` with resource guards so a compile failure
# can't fork-bomb the machine into oblivion.
#
# Two layers of defense:
#   1. ulimit -u  caps the max number of processes the dev server tree can spawn
#   2. a watchdog   kills the tree if free RAM drops below a threshold
#
# Usage:  ./scripts/dev-safe.sh
#         MAX_PROC=400 MIN_FREE_MB=1000 ./scripts/dev-safe.sh
set -euo pipefail
cd "$(dirname "$0")/.."

MAX_PROC="${MAX_PROC:-400}"
MIN_FREE_MB="${MIN_FREE_MB:-1000}"
PORT="${PORT:-3000}"

# --- start the memory watchdog in the background -------------------------
WDOG_PID=""
cleanup() {
  [ -n "$WDOG_PID" ] && kill "$WDOG_PID" 2>/dev/null || true
}
trap cleanup EXIT
MIN_FREE_MB="$MIN_FREE_MB" nohup bash "$(dirname "$0")/mem-watchdog.sh" >/tmp/wc-watchdog.log 2>&1 &
WDOG_PID=$!
echo "[dev-safe] memory watchdog started (pid $WDOG_PID, kill below ${MIN_FREE_MB}MB)"

# --- launch next dev under process + memory caps -------------------------
# ulimit -u: hard cap on processes for this shell and its children.
#   Next normally needs ~50-150 procs; a fork bomb blows past thousands.
#   400 leaves headroom while making a bomb impossible.
# NOTE: ulimit -u can only lower, never raise, so a low value is harmless
#   even if the system default is already higher.
ulimit -u "$MAX_PROC" 2>/dev/null || echo "[dev-safe] warning: could not set ulimit -u"

echo "[dev-safe] launching next dev (max procs $MAX_PROC, port $PORT)"
exec pnpm dev --port "$PORT"
