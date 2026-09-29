#!/usr/bin/env bash
# Hands one task file to a worker (KIT-004, KIT-005). Everything about the
# launch comes from .agent/agents.yaml: role from the task's category, CLI,
# model and effort from the resolved profile, mode (interactive or oneshot),
# caveman off by caveman_off_when, gated MCPs off unless the role lists them,
# the worker permissions, and no skills gate.
#
# usage: dispatch.sh <TASK-ID> [--role <role>] [--profile <name>] [--mode interactive|oneshot]
#                    [--keep-pane] [--dry-run]
#        dispatch.sh <TASK-ID> --resume [--message "<text>"] [same options]
#
# --dry-run runs preflight and prints the resolved launch, and changes nothing.
# A live run creates the worktree and branch (first run) and a Herdr pane named
# after the task. Oneshot runs the CLI there and waits for it to exit.
# Interactive starts the real CLI as a Herdr agent (lowercase task id), sends
# the brief, and waits until the agent is idle; a permission prompt is
# reported, never answered. Either way the lead runs this in the background.
# The pane closes itself on DONE or a written review verdict (not with --keep-pane).
# Run state lives in <main checkout>/.agent/runs/<ID>/<role>/ (gitignored).
#
# Exit: 0 DONE (or a review verdict), 3 BLOCKED, 4 no verdict, 2 refused,
#       1 an interactive agent left before a verdict, else the CLI's exit code.
#
# The logic is in lib/dispatch.rb: macOS ships bash 3.2, and Ruby is already
# required by the guard hooks.
set -euo pipefail
exec ruby "$(cd "$(dirname "$0")" && pwd)/lib/dispatch.rb" "$@"
