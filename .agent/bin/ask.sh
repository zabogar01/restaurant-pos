#!/usr/bin/env bash
# One-shot read-only question to the explorer or librarian on Codex gpt-6-luna
# (roles.explorer / roles.librarian in .agent/agents.yaml). Prints only the
# final answer. The Claude subagents in .claude/agents/ are the fallback when
# Codex account A is rate-limited.
# usage: ask.sh explorer|librarian "<question>"
set -euo pipefail

ROLE=${1:?usage: ask.sh explorer|librarian "<question>"}
QUESTION=${2:?usage: ask.sh explorer|librarian "<question>"}
ROOT=$(git rev-parse --show-toplevel)
MODEL=gpt-6-luna   # keep in step with agents.yaml roles.<role>.oneshot.model

case $ROLE in
  explorer)
    SEARCH=()
    BRIEF="You are the explorer: a read-only codebase search. Answer the question from the repository only. Return at most 15 lines, with path:line references for every claim. Never edit a file, never propose a fix unless asked." ;;
  librarian)
    SEARCH=(--search)
    BRIEF="You are the librarian: a read-only researcher for library, API and CLI facts. Prefer primary sources (official docs, release notes, the package's own repository). Return at most 20 lines, with a source URL or path for every claim. Never edit a file." ;;
  *) echo "ask.sh: role must be explorer or librarian, got '$ROLE'" >&2; exit 2 ;;
esac

OUT=$(mktemp -t ask.XXXXXX)
trap 'rm -f "$OUT"' EXIT

# Codex has no system-prompt flag, so the role brief leads the prompt text.
# stdin is closed or codex waits on "Reading additional input from stdin".
codex ${SEARCH[@]+"${SEARCH[@]}"} exec -m "$MODEL" --sandbox read-only --ephemeral -C "$ROOT" \
  -o "$OUT" "$BRIEF

Question: $QUESTION" </dev/null >/dev/null 2>&1 || {
  echo "ask.sh: codex exited non-zero. If this is a rate limit, use the $ROLE subagent (.claude/agents/$ROLE.md)." >&2
  exit 1
}
cat "$OUT"
