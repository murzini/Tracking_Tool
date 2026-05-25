#!/usr/bin/env bash
# Stop hook: if a checkpoint doc changed this session, block the stop once and
# remind Claude to suggest starting a new session (per AGENTS.md). Fires at most
# once per session_id (marker in .git/) to avoid an infinite stop->block loop.

input=$(cat)

# Resolve repo root from this script's location (.claude/hooks/ -> repo root).
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo="$(cd "$script_dir/../.." && pwd)"

# Parse session_id without jq (not installed in this Git Bash env).
session_id=$(printf '%s' "$input" \
  | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' \
  | head -1 \
  | sed 's/.*"\([^"]*\)"$/\1/')
[ -z "$session_id" ] && session_id="nosession"

marker="$repo/.git/claude-checkpoint-reminded-$session_id"

# Already reminded this session -> allow the stop.
[ -f "$marker" ] && exit 0

# Did any checkpoint doc change this session?
changed=$(git -C "$repo" status --porcelain -- \
  "Documentation/AGENT_RUN_LOG.csv" \
  "ONBOARDING.md" \
  "Documentation/PRODUCT_OVERVIEW.md" 2>/dev/null)

if [ -n "$changed" ]; then
  : > "$marker"
  printf '%s' '{"decision":"block","reason":"A checkpoint doc changed this session (AGENT_RUN_LOG.csv, ONBOARDING.md, or PRODUCT_OVERVIEW.md). Per the AGENTS.md session-management rule, tell the user this is a good checkpoint to start a new session and offer to update ONBOARDING.md first. If you already suggested this in your last message, just stop."}'
fi

exit 0
