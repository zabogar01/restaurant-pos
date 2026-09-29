#!/usr/bin/env bash
# One-shot read-only question to the explorer or librarian on Codex. The model,
# web search and MCP servers come from .agent/agents.yaml (roles.<role>.oneshot,
# roles.<role>.mcps, gated_mcps). Prints only the final answer. The Claude
# subagents in .claude/agents/ are the fallback when Codex is rate-limited.
# usage: ask.sh explorer|librarian "<question>"
# ASK_LOG=<file> also saves codex's JSON event stream (tool calls included).
set -euo pipefail

ROLE=${1:?usage: ask.sh explorer|librarian "<question>"}
QUESTION=${2:?usage: ask.sh explorer|librarian "<question>"}
ROOT=$(git rev-parse --show-toplevel)
CONFIG="$ROOT/.agent/agents.yaml"

case $ROLE in
  explorer)
    BRIEF="You are the explorer: a read-only codebase search. Answer the question from the repository only. Return at most 15 lines, with path:line references for every claim. Never edit a file, never propose a fix unless asked." ;;
  librarian)
    BRIEF="You are the librarian: a read-only researcher for library, API and CLI facts. Try the Context7 MCP tools first for library and framework documentation, then the web. Prefer primary sources (official docs, release notes, the package's own repository). Return at most 20 lines, with a source URL or path for every claim, and say which facts came from Context7. Never edit a file." ;;
  *) echo "ask.sh: role must be explorer or librarian, got '$ROLE'" >&2; exit 2 ;;
esac

# Ruby's YAML parser, because yq is not installed. Prints one line: the model,
# "web" or "noweb", then launch.codex.mcp_on for each gated MCP the role lists
# in roles.<role>.mcps and launch.codex.mcp_off for the rest. No flag holds a
# space inside a value, so the line splits on whitespace.
SETTINGS=$(ruby -ryaml -e '
  c = YAML.load_file(ARGV[0]); r = ARGV[1]
  role = c.dig("roles", r) or abort "ask.sh: no roles.#{r} in agents.yaml"
  one = role["oneshot"] or abort "ask.sh: no roles.#{r}.oneshot in agents.yaml"
  model = one["model"] or abort "ask.sh: no roles.#{r}.oneshot.model in agents.yaml"
  mine = role["mcps"] || []
  mcps = (c["gated_mcps"] || []).map do |m|
    key = mine.include?(m) ? "mcp_on" : "mcp_off"
    c.dig("launch", "codex", key, m) or abort "ask.sh: no launch.codex.#{key}.#{m} in agents.yaml"
  end
  puts [model, one["web"] ? "web" : "noweb", *mcps].join(" ")
' "$CONFIG" "$ROLE")
read -r MODEL WEB MCP_FLAGS <<<"$SETTINGS"

SEARCH=()
[ "$WEB" = web ] && SEARCH=(--search)
MCPS=()
[ -n "${MCP_FLAGS:-}" ] && read -r -a MCPS <<<"$MCP_FLAGS"

OUT=$(mktemp -t ask.XXXXXX)
trap 'rm -f "$OUT"' EXIT

# Codex has no system-prompt flag, so the role brief leads the prompt text.
# stdin is closed or codex waits on "Reading additional input from stdin".
# --search is a top-level flag and must come before exec.
codex ${SEARCH[@]+"${SEARCH[@]}"} exec -m "$MODEL" ${MCPS[@]+"${MCPS[@]}"} \
  --sandbox read-only --ephemeral --json -C "$ROOT" -o "$OUT" "$BRIEF

Question: $QUESTION" </dev/null >"${ASK_LOG:-/dev/null}" 2>&1 || {
  echo "ask.sh: codex exited non-zero. If this is a rate limit, use the $ROLE subagent (.claude/agents/$ROLE.md)." >&2
  exit 1
}
cat "$OUT"
