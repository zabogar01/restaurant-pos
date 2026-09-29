---
name: lead
description: Re-establish this Claude session as the restaurant-pos lead after /clear or a fresh start. Renames the Herdr pane to `lead`, orients from STATE.md and QUEUE.md only, runs the kit's health checks, and reports a five-line status. Invoke with /lead at the start of a lead session.
disable-model-invocation: true
---

# Re-establish the lead

You are the lead for this repository. Your role prompt is
`.agent/roles/lead.md`; CLAUDE.md and AGENTS.md hold the project rules. Do
these steps in order, then stop and report. Do not start or resume any task
until the owner answers.

1. **Herdr name.** Run `herdr agent rename "$HERDR_PANE_ID" lead` so that
   agents' reports (`herdr agent prompt lead …`) reach this pane; the name
   drops whenever the session changes. Do not guess whether you are inside
   Herdr: run the command. If it fails, quote its error in the report and
   continue. Use the `herdr` skill for anything beyond this.
2. **Orient.** Read `.agent/STATE.md`, then `.agent/QUEUE.md`. Nothing else
   yet. Do not open `.agent/journal/`, least of all the memory and roadmap
   archives: they cost tens of thousands of tokens, and STATE.md points to
   the line you need if one is ever needed.
3. **Health checks.** Run each and note the result:
   - `.agent/bin/check-state.sh` — STATE.md within its cap;
   - `.agent/bin/install-hooks.sh --check` — the guard hooks match this
     checkout (if stale, say so; do not reinstall without the owner);
   - `git branch --show-current` and `git status --short` — expected branch,
     clean tree;
   - `herdr agent list` — compare the live agents with STATE.md's "Running
     tasks and agents". In its JSON, `agent` is the CLI kind (`claude`,
     `codex`) and `name` is the agent's name (`lead`, `builder31`). Name any
     agent that is live but not recorded, or recorded but gone.
4. **Report** to the owner in exactly five lines, one short sentence each,
   in plain prose; STATE.md holds the detail, so do not repeat it:
   - phase and gate;
   - active task, and its status;
   - live agents, and any mismatch with STATE.md;
   - what is waiting on the owner (from STATE.md);
   - the next step you propose.
   Add one more line only if a health check failed.

## Before the owner clears this session

When the owner says to wrap up, or before a `/clear`: rewrite STATE.md so the
next session needs nothing from this conversation. Put anything that was only
discussed under "Questions waiting for the owner". Append any owner ruling to
DECISIONS.md with where it is recorded, and put narrative in
`.agent/journal/YYYY-MM-DD.md`. Then run `check-state.sh` and say it is safe
to clear.
