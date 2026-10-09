#!/usr/bin/env bash
# One-shot read-only question to the explorer or librarian. roles.<role>.runner
# in .agent/agents.yaml names the first route; if it exits non-zero (a rate
# limit, an outage, a sandbox without network), the other route answers.
#   subagent: claude -p --agent <role>, the Claude subagent in .claude/agents/,
#             on roles.<role>.subagent.model, with that file's tools allowed.
#   oneshot:  codex exec on roles.<role>.oneshot.model, read-only, with web
#             search and MCP servers from roles.<role>.mcps and gated_mcps.
# Prints only the final answer. A fallback is announced on stderr.
# usage: ask.sh explorer|librarian "<question>"
# ASK_LOG=<file> also saves each route's JSON event stream (tool calls included).
set -euo pipefail

ROLE=${1:?usage: ask.sh explorer|librarian "<question>"}
QUESTION=${2:?usage: ask.sh explorer|librarian "<question>"}
ROOT=$(git rev-parse --show-toplevel)
CONFIG="$ROOT/.agent/agents.yaml"
AGENT_FILE="$ROOT/.claude/agents/$ROLE.md"

case $ROLE in
  explorer)
    BRIEF="You are the explorer: a read-only codebase search. Answer the question from the repository only. Return at most 15 lines, with path:line references for every claim. Never edit a file, never propose a fix unless asked." ;;
  librarian)
    BRIEF="You are the librarian: a read-only researcher for library, API and CLI facts. Try the Context7 MCP tools first for library and framework documentation, then the web. Prefer primary sources (official docs, release notes, the package's own repository). Return at most 20 lines, with a source URL or path for every claim, and say which facts came from Context7. Never edit a file." ;;
  *) echo "ask.sh: role must be explorer or librarian, got '$ROLE'" >&2; exit 2 ;;
esac

# Ruby's YAML parser, because yq is not installed. Prints one line: the runner,
# the subagent model, the codex model, "web" or "noweb", then
# launch.codex.mcp_on for each gated MCP the role lists in roles.<role>.mcps and
# launch.codex.mcp_off for the rest. No flag holds a space inside a value, so
# the line splits on whitespace.
SETTINGS=$(ruby -ryaml -e '
  c = YAML.load_file(ARGV[0]); r = ARGV[1]
  role = c.dig("roles", r) or abort "ask.sh: no roles.#{r} in agents.yaml"
  runner = role["runner"] || "subagent"
  %w[subagent oneshot].include?(runner) or abort "ask.sh: roles.#{r}.runner must be subagent or oneshot"
  sub = role.dig("subagent", "model") or abort "ask.sh: no roles.#{r}.subagent.model in agents.yaml"
  one = role["oneshot"] or abort "ask.sh: no roles.#{r}.oneshot in agents.yaml"
  model = one["model"] or abort "ask.sh: no roles.#{r}.oneshot.model in agents.yaml"
  mine = role["mcps"] || []
  mcps = (c["gated_mcps"] || []).map do |m|
    key = mine.include?(m) ? "mcp_on" : "mcp_off"
    c.dig("launch", "codex", key, m) or abort "ask.sh: no launch.codex.#{key}.#{m} in agents.yaml"
  end
  puts [runner, sub, model, one["web"] ? "web" : "noweb", *mcps].join(" ")
' "$CONFIG" "$ROLE")
read -r RUNNER SUB_MODEL MODEL WEB MCP_FLAGS <<<"$SETTINGS"

# The subagent's `tools:` line, comma-separated, so that -p mode allows them
# instead of denying them.
TOOLS=$(ruby -e '
  fm = File.read(ARGV[0])[/\A---\n(.*?)\n---/m, 1] or abort "ask.sh: no frontmatter in #{ARGV[0]}"
  t = fm[/^tools:\s*(.+)$/, 1] or abort "ask.sh: no tools: line in #{ARGV[0]}"
  puts t.split(",").map(&:strip).join(",")
' "$AGENT_FILE")

OUT=$(mktemp -t ask.XXXXXX)
EVENTS=$(mktemp -t ask-events.XXXXXX)
trap 'rm -f "$OUT" "$EVENTS"' EXIT

log_events() { [ -n "${ASK_LOG:-}" ] && cat "$EVENTS" >>"$ASK_LOG"; return 0; }

# The agent file is the system prompt; its model is pinned again from
# agents.yaml so that one file decides. Caveman is switched off per process,
# as the dispatcher does. stream-json keeps the tool calls for ASK_LOG; the
# answer is the result event's text, and is_error counts as a failure.
ask_subagent() {
  claude -p --agent "$ROLE" --model "$SUB_MODEL" \
    --allowedTools "$TOOLS" \
    --settings '{"enabledPlugins":{"caveman@caveman":false}}' \
    --no-session-persistence --output-format stream-json --verbose \
    "$QUESTION" </dev/null >"$EVENTS" 2>&1 || { log_events; return 1; }
  log_events
  ruby -rjson -e '
    r = File.foreach(ARGV[0]).map { |l| JSON.parse(l) rescue nil }.compact.reverse.find { |e| e["type"] == "result" }
    exit 1 if r.nil? || r["is_error"] || r["result"].to_s.strip.empty?
    puts r["result"]
  ' "$EVENTS" >"$OUT"
}

# Codex has no system-prompt flag, so the role brief leads the prompt text.
# stdin is closed or codex waits on "Reading additional input from stdin".
# --search is a top-level flag and must come before exec.
ask_oneshot() {
  local search=() mcps=()
  [ "$WEB" = web ] && search=(--search)
  [ -n "${MCP_FLAGS:-}" ] && read -r -a mcps <<<"$MCP_FLAGS"
  codex ${search[@]+"${search[@]}"} exec -m "$MODEL" ${mcps[@]+"${mcps[@]}"} \
    --sandbox read-only --ephemeral --json -C "$ROOT" -o "$OUT" "$BRIEF

Question: $QUESTION" </dev/null >"$EVENTS" 2>&1 || { log_events; return 1; }
  log_events
}

if [ "$RUNNER" = subagent ]; then
  FIRST=(ask_subagent "claude ($SUB_MODEL)"); SECOND=(ask_oneshot "codex ($MODEL)")
else
  FIRST=(ask_oneshot "codex ($MODEL)"); SECOND=(ask_subagent "claude ($SUB_MODEL)")
fi

if ! "${FIRST[0]}"; then
  echo "ask.sh: ${FIRST[1]} failed; falling back to ${SECOND[1]}." >&2
  "${SECOND[0]}" || { echo "ask.sh: ${SECOND[1]} failed too. ASK_LOG=<file> keeps both event streams." >&2; exit 1; }
fi
cat "$OUT"
