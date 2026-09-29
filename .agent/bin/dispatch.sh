#!/usr/bin/env bash
# Hands one task file to a one-shot worker (KIT-004). Everything about the
# launch comes from .agent/agents.yaml: role from the task's category, CLI,
# model and effort from the resolved profile, caveman off by caveman_off_when,
# gated MCPs off unless the role lists them, and no skills gate.
#
# usage: dispatch.sh <TASK-ID> [--role <role>] [--profile <name>] [--dry-run]
#        dispatch.sh <TASK-ID> --resume [--role <role>] [--message "<text>"] [--dry-run]
#
# --dry-run runs preflight and prints the resolved launch, and changes nothing.
# A live run creates the worktree and branch (first run), opens a Herdr pane
# named after the task, starts the CLI there, and waits for it to exit, so the
# lead runs it in the background and is woken on exit. Run state lives in
# <main checkout>/.agent/runs/<ID>/<role>/ (gitignored).
#
# Exit: 0 DONE (or a review verdict), 3 BLOCKED, 4 no Handoff verdict,
#       2 refused by preflight or usage, anything else the CLI's own exit code.
#
# The logic is in lib/dispatch.rb: macOS ships bash 3.2, and Ruby is already
# required by the guard hooks.
set -euo pipefail
exec ruby "$(cd "$(dirname "$0")" && pwd)/lib/dispatch.rb" "$@"
