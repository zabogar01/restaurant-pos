#!/usr/bin/env bash
# The global builder preset (KIT-004), like oh-my-opencode-slim's /preset.
# dispatch.sh resolves a profile as: --profile, the task's `profile:`, this
# preset, then the role's default. The file is local and gitignored.
# usage: preset.sh              print the active preset
#        preset.sh <profile>    use roles.builder.profiles.<profile> for every dispatch
#        preset.sh default      back to each role's default
set -euo pipefail

MAIN=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
FILE="$MAIN/.agent/profile"
CONFIG="$(git rev-parse --show-toplevel)/.agent/agents.yaml"

case "${1:-}" in
  "") [ -f "$FILE" ] && echo "preset: $(cat "$FILE")" || echo "preset: default (no $FILE)" ;;
  default) rm -f "$FILE"; echo "preset: default" ;;
  *)
    ruby -ryaml -e 'exit(YAML.load_file(ARGV[0]).dig("roles", "builder", "profiles", ARGV[1]) ? 0 : 1)' "$CONFIG" "$1" ||
      { echo "preset: no roles.builder.profiles.$1 in agents.yaml" >&2; exit 2; }
    printf '%s\n' "$1" > "$FILE"; echo "preset: $1" ;;
esac
