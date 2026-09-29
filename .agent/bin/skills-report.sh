#!/usr/bin/env bash
# For each role in .agent/agents.yaml: the skills it is assigned (base_skills
# plus roles.<role>.skills), the skills each of its CLIs actually loads, and
# which are "assigned but missing" or "installed but not assigned".
#
# Each CLI reports its own skills, so the list is what the model sees, not a
# guess from folders:
#   claude    the init event of `claude -p --output-format stream-json` (one
#             short Haiku call; user, repo and plugin skills)
#   codex     `codex debug prompt-input` (no model call)
#   opencode  `opencode debug skill` (no model call)
# A Claude subagent (.claude/agents/<role>.md) whose `tools:` list has no
# Skill tool gets no skills at all.
#
# usage: skills-report.sh            summary: counts, missing skills named
#        skills-report.sh --full     also name every installed-but-unassigned skill
#        skills-report.sh --gate <role> <claude|codex|opencode>
#                                    print the per-run arguments that limit that
#                                    CLI to the role's assigned skills (KIT-002a)
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
TMP=$(mktemp -d -t skills-report.XXXXXX)
trap 'rm -rf "$TMP"' EXIT

MODE=summary GATE_ROLE="" GATE_CLI=""
case "${1:-}" in
  "") ;;
  --full) MODE=full ;;
  --gate) MODE=gate; GATE_ROLE=${2:?usage: skills-report.sh --gate <role> <cli>}; GATE_CLI=${3:?usage: skills-report.sh --gate <role> <cli>} ;;
  *) echo "usage: skills-report.sh [--full | --gate <role> <cli>]" >&2; exit 2 ;;
esac

# Which CLIs the roles use, so only those are asked.
CLIS=$(ruby -ryaml -e '
  c = YAML.load_file(ARGV[0]); clis = []
  walk = ->(h) { h.each { |k, v| clis << v if k == "cli"; walk.(v) if v.is_a?(Hash) } }
  c["roles"].each { |_, r| walk.(r); clis << "claude" if r["subagent"] }
  puts clis.uniq.join(" ")
' "$ROOT/.agent/agents.yaml")
[ "$MODE" = gate ] && CLIS=$GATE_CLI

# Each inventory is written to a file; a failure is recorded, not fatal.
cd "$ROOT"
for cli in $CLIS; do
  case $cli in
    claude)
      claude -p --model haiku --output-format stream-json --verbose --max-turns 1 "Reply OK." \
        </dev/null 2>"$TMP/claude.err" | grep -m1 '"subtype":"init"' >"$TMP/claude.json" || true ;;
    codex)
      codex debug prompt-input </dev/null >"$TMP/codex.json" 2>"$TMP/codex.err" || true ;;
    opencode)
      # Written to a file: piped, its JSON is cut off at the pipe buffer.
      opencode debug skill </dev/null >"$TMP/opencode.json" 2>"$TMP/opencode.err" || true ;;
    *) echo "skills-report: unknown cli '$cli'" >&2; exit 2 ;;
  esac
done

exec ruby -ryaml -rjson - "$ROOT" "$TMP" "$MODE" "$GATE_ROLE" "$GATE_CLI" <<'RUBY'
root, tmp, mode, gate_role, gate_cli = ARGV
home = Dir.home
cfg = YAML.load_file(File.join(root, ".agent/agents.yaml"))

def src_of(path, root, home)
  return "repo" if path.start_with?(root + "/")
  return "system" if path.include?("/.codex/skills/.system/")
  return "plugin" if path.include?("/plugins/cache/")
  return "builtin" if path == "<built-in>"
  "user"
end

# name => { src:, path:, plugin: } per CLI; nil when the CLI could not be asked.
inv = {}
errs = {}

f = File.join(tmp, "claude.json")
if File.exist?(f)
  line = File.read(f)
  if line.strip.empty?
    errs["claude"] = File.read(File.join(tmp, "claude.err")).lines.last(2).join.strip
  else
    init = JSON.parse(line)
    plugins = (init["plugins"] || []).group_by { |p| p["name"] }
    inv["claude"] = init["skills"].to_h do |n|
      pl = n.split(":").first
      if n.include?(":") && plugins[pl]
        [n, { src: "plugin", plugin: plugins[pl].map { |p| p["source"] } }]
      elsif n.include?(":")
        # claude.ai-synced skills (~/.claude/skills/synced/) carry a prefix
        # but are not plugins; skillOverrides reaches them by full name.
        [n, { src: "synced" }]
      elsif File.exist?(File.join(root, ".claude/skills", n, "SKILL.md"))
        [n, { src: "repo" }]
      elsif File.exist?(File.join(home, ".claude/skills", n, "SKILL.md"))
        [n, { src: "user" }]
      else
        [n, { src: "builtin" }]   # bundled with Claude Code
      end
    end
  end
end

f = File.join(tmp, "codex.json")
if File.exist?(f)
  strings = ->(o) { o.is_a?(String) ? [o] : o.is_a?(Hash) ? o.values.flat_map(&strings) : o.is_a?(Array) ? o.flat_map(&strings) : [] }
  block = File.size(f) > 0 && strings.(JSON.parse(File.read(f))).find { |s| s.include?("<skills_instructions>") }
  if block
    roots = block.scan(/^- `(r\d+)` = `([^`]+)`/).to_h
    inv["codex"] = block.scan(/^- (\S+): .*?\(file: (r\d+)\/([^)]+)\)$/).to_h do |n, r, rel|
      path = File.join(roots.fetch(r), rel)
      [n, { src: src_of(path, root, home), path: path }]
    end
  else
    errs["codex"] = File.read(File.join(tmp, "codex.err")).lines.last(2).join.strip
  end
end

f = File.join(tmp, "opencode.json")
if File.exist?(f)
  begin
    inv["opencode"] = JSON.parse(File.read(f)).to_h do |s|
      [s["name"], { src: src_of(s["location"], root, home), path: s["location"] }]
    end
  rescue JSON::ParserError
    errs["opencode"] = File.read(File.join(tmp, "opencode.err")).lines.last(2).join.strip
  end
end

# A role's CLIs: every `cli:` under it, plus the Claude subagent fallback.
def clis_of(r)
  out = []
  walk = ->(h) { h.each { |k, v| out << v if k == "cli"; walk.(v) if v.is_a?(Hash) } }
  walk.(r)
  out.uniq
end

def subagent_tools(root, name)
  f = File.join(root, ".claude/agents", "#{name}.md")
  return nil unless File.exist?(f)
  fm = File.read(f)[/\A---\n(.*?)\n---/m, 1] || ""
  t = fm[/^tools:\s*(.+)$/, 1]
  t && t.split(",").map(&:strip)
end

# An assigned name matches an installed skill by exact name, or by the part
# after "plugin:" for a plugin skill.
def match(assigned, installed)
  installed.keys.find { |n| n == assigned || n.split(":").last == assigned }
end

base = cfg["base_skills"] || []

if mode == "gate"
  role = cfg.dig("roles", gate_role) or abort "skills-report: no roles.#{gate_role} in agents.yaml"
  have = inv[gate_cli] or abort "skills-report: could not list #{gate_cli} skills: #{errs[gate_cli]}"
  assigned = (base + (role["skills"] || [])).uniq
  keep = assigned.map { |a| match(a, have) }.compact
  drop = have.reject { |n, _| keep.include?(n) }
  case gate_cli
  when "opencode"
    perm = { "*" => "deny" }.merge(keep.to_h { |n| [n, "allow"] })
    puts "OPENCODE_CONFIG_CONTENT=#{JSON.generate({ "permission" => { "skill" => perm } }).inspect}"
  when "codex"
    entries = drop.map { |_, s| "{path=#{s[:path].inspect},enabled=false}" }
    puts "-c 'skills.config=[#{entries.join(",")}]'"
  when "claude"
    # Plugin skills cannot be switched off one by one (checked 2026-09-29):
    # only a whole plugin can. A plugin with an assigned skill stays on, and
    # caveman stays under caveman/caveman_off (it also carries chat hooks).
    kept_plugins = keep.flat_map { |n| have[n][:plugin] || [] }
    off_plugins = drop.values.flat_map { |s| s[:plugin] || [] }.uniq - kept_plugins - ["caveman@caveman"]
    overrides = drop.reject { |_, s| s[:src] == "plugin" }.keys.to_h { |n| [n, "off"] }
    settings = { "skillOverrides" => overrides, "enabledPlugins" => off_plugins.to_h { |p| [p, false] } }
    puts "--settings '#{JSON.generate(settings)}'"
    left = drop.select { |_, s| s[:src] == "plugin" && (s[:plugin] & (kept_plugins + ["caveman@caveman"])).any? }.keys
    warn "skills-report: still visible, their plugin stays on: #{left.join(", ")}" if left.any?
  end
  missing = assigned.reject { |a| match(a, have) }
  warn "skills-report: assigned but missing on #{gate_cli}: #{missing.join(", ")}" if missing.any?
  exit
end

puts "Skills by role (agents.yaml) against what each CLI loads. #{Time.now.strftime("%Y-%m-%d %H:%M")}"
puts
inv.each do |cli, have|
  by = have.values.group_by { |s| s[:src] }.transform_values(&:size)
  puts "#{cli.ljust(9)} #{have.size} skills loaded (#{by.map { |k, v| "#{k} #{v}" }.join(", ")})"
end
errs.each { |cli, e| puts "#{cli.ljust(9)} could not be listed: #{e}" }

cfg["roles"].each do |name, role|
  assigned = (base + (role["skills"] || [])).uniq
  puts
  puts "== #{name}"
  puts "   assigned: #{assigned.join(", ")}"
  targets = clis_of(role).map { |c| [c, c] }
  targets << ["claude-subagent", "claude"] if role["subagent"]
  targets.each do |label, cli|
    if label == "claude-subagent"
      tools = subagent_tools(root, name)
      if tools && !tools.include?("Skill")
        puts "   #{label.ljust(16)} no skills: .claude/agents/#{name}.md grants no Skill tool"
        next
      end
    end
    have = inv[cli]
    unless have
      puts "   #{label.ljust(16)} not listed (#{errs[cli] || "not asked"})"
      next
    end
    found = assigned.to_h { |a| [a, match(a, have)] }
    missing = found.select { |_, v| v.nil? }.keys
    extra = have.keys - found.values.compact
    puts "   #{label.ljust(16)} assigned but missing: #{missing.empty? ? "none" : missing.join(", ")}"
    renamed = found.select { |a, v| v && v != a }
    puts "   #{"".ljust(16)} matched as: #{renamed.map { |a, v| "#{a} -> #{v}" }.join(", ")}" if renamed.any?
    puts "   #{"".ljust(16)} installed but not assigned: #{extra.size}"
    next unless mode == "full"
    extra.group_by { |n| have[n][:src] }.each do |src, names|
      puts "   #{"".ljust(16)}   #{src}: #{names.sort.join(", ")}"
    end
  end
end
RUBY
