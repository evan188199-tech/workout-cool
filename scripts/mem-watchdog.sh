#!/usr/bin/env bash
# mem-watchdog.sh — kills the Next.js dev server if available memory drops too low.
# Prevents a runaway CSS-compile fork bomb from freezing the whole machine.
#
# Usage:  ./scripts/mem-watchdog.sh          # foreground
#         ./scripts/mem-watchdog.sh &        # background
#
# Tune via env vars (defaults shown):
#   MIN_FREE_MB=800     # kill when free + inactive < this (MB)
#   CHECK_INTERVAL=3    # seconds between checks
#   PATTERNS="next-server|/next/dist/bin/next|next dev"
set -euo pipefail

MIN_FREE_MB="${MIN_FREE_MB:-800}"
CHECK_INTERVAL="${CHECK_INTERVAL:-3}"
PATTERNS="${PATTERNS:-next-server|/next/dist/bin/next|next dev}"

PAGE_SIZE_BYTES="$(vm_stat | awk '/page size/ {gsub(/\./,"",$8); print $8*1}')"

# free + inactive pages are reclaimable without swapping much
avail_mb() {
  vm_stat | awk -v ps="$PAGE_SIZE_BYTES" '
    /Pages free/        {free=($3+0)*ps}
    /Pages inactive/    {inactive=($3+0)*ps}
    /Pages speculative/ {spec=($3+0)*ps}
    END {printf "%d", (free+inactive+spec)/1048576}
  '
}

kill_dev() {
  echo "[watchdog] memory low — killing Next dev processes" >&2
  # try graceful first, then force
  pkill -f "$PATTERNS" 2>/dev/null || true
  sleep 1
  pkill -9 -f "$PATTERNS" 2>/dev/null || true
}

echo "[watchdog] armed — kill below ${MIN_FREE_MB}MB, check every ${CHECK_INTERVAL}s"
while true; do
  free="$(avail_mb)"
  if [ "$free" -lt "$MIN_FREE_MB" ]; then
    echo "[watchdog] available ${free}MB < ${MIN_FREE_MB}MB threshold" >&2
    kill_dev
    # back off after a kill so the system recovers before re-checking
    sleep 15
  fi
  sleep "$CHECK_INTERVAL"
done
