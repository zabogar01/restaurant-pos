# KIT-005 — Interactive dispatch mode and automatic pane close

**Status:** Complete 2026-09-29, awaiting the owner's merge and acceptance
**Owner:** `lead` (the kit is the lead's to own; this task is not dispatched)
**Depends on:** KIT-004 (accepted by the owner 2026-09-29)
**Source:** the owner's feedback and question after the FE-029 pilot (lead session
2026-09-29): the lead left the task's panes open after the work was accepted, and asked
why a worker is a one-shot command in a pane rather than an interactive agent the owner
can watch and talk to. The lead recommended supporting both, per role or per task; the
owner said to write KIT-005 before DESIGN-009 (DECISIONS.md). [AGENT-KIT.md](../AGENT-KIT.md)
§ Roles ("Interactive vs one-shot"), § Block protocol ("Use interactive mode instead").
**Branch:** `agent/kit-interactive`, cut from `development` at `cc08590`, in `../restaurant-pos-kit`.

---

## Objective

`dispatch.sh` can start a worker as a real interactive agent in its Herdr pane: the
CLI's own interface, which the owner can watch and type into and the lead can prompt
for a second round. It keeps every rule a one-shot launch applies (explicit model, role
prompt, caveman, Context7 off, worker permissions, no skills gate). Either mode closes
the task's pane by itself when the round ends accepted-ready (`DONE`, or a review
verdict of clean), and leaves it open when there is something to read or answer.

## Facts established before writing (probes, 2026-09-29)

- `herdr agent start <name> --kind <claude|opencode|codex> --pane <id> -- <args>`
  starts a supported interactive agent in a pane at its shell prompt, names it and
  waits until it is ready. `herdr agent prompt <name> <text>` sends it a message.
  Agent names must be lowercase (`fe-029`, not `FE-029`).
- `herdr pane split --env KEY=VALUE` sets the pane's environment: `AGENT_ROLE` and
  `TASK_ID` reached the agent's Bash commands.
- Claude accepts `--session-id <uuid>`, so the dispatcher chooses the session id
  up front; Herdr reports it back as `agent_session.value`.
- The worker permissions work interactively: `acceptEdits`, the allowlist, `git push`
  denied. An unlisted command (`node -e …`) put the agent in Herdr state
  **`blocked`** with the approval prompt in the pane. The dispatcher never answers
  one; it tells the lead and the owner.
- `herdr agent wait` can return the *previous* state: straight after a prompt it
  returned `idle` before the agent had started. Wait for `working` first.
- **Folder trust.** An interactive Claude asks "Do you trust this folder?" in an
  untrusted directory (one-shot `-p` does not). `/Users/fajars/Work/Dev/POS System`
  is trusted in `~/.claude.json` and trust covers subdirectories, so worktrees under
  `../restaurant-pos-wt/` open without the dialog. Codex trusts only the main checkout
  path in `~/.codex/config.toml`, so an interactive Codex in a new worktree would
  likely ask. Neither global file is edited.
- No turn cap exists for an interactive session (`--max-turns` is `-p` only). The
  stall alert remains the runaway guard.

## What changes

1. **Mode resolution**, first match wins: `--mode <interactive|oneshot>`, the task's
   `mode:` frontmatter, then `roles.<role>.mode`. **The builder's default becomes
   `interactive`** (the lead's recommendation while the owner watches builders;
   one line in agents.yaml to flip back). Reviewers and the docs-writer stay
   `oneshot`.
2. **Interactive launch shapes** in agents.yaml (`launch.<cli>.interactive`), for
   Claude and OpenCode. Codex interactive is refused with the trust reason above;
   no role needs it today.
3. **Interactive run:** split the pane with the env, `herdr agent start` with the
   launch arguments, then `herdr agent prompt` with the brief (for OpenCode the role
   prompt leads the brief, as in one-shot). Wait for `working`, then poll the agent:
   - `blocked`: notify the lead and the owner once per episode ("approval needed in
     pane …"); keep waiting.
   - `idle` or `done`: read the verdict (Handoff's last line, or the review's
     Verdict). `DONE`/clean ends the round; `BLOCKED` ends it with exit 3; no verdict
     ends it with exit 4 and "idle without a verdict: read the pane".
   - A rate-limit or quota message in the pane at idle falls back once to the role's
     `fallback` profile, as one-shot does.
   - The agent or pane gone: exit 1, "the agent left before a verdict".
   - Stall: no pane-output or file change for `stall_alert_min` while `working`.
4. **Resume, interactive:** if the agent is still in its pane, `--resume --message`
   prompts it there; otherwise it starts the CLI again on the recorded session
   (`--resume <id>` for Claude, `--session <id>` for OpenCode). Resume limits as
   before.
5. **Pane auto-close, both modes:** on `DONE` or a clean review, the dispatcher closes
   the pane (the log and session stay in `.agent/runs/`); on anything else it stays.
   `--keep-pane` keeps it. The `/dispatch` skill and WORKFLOW.md say so.
6. The dry run shows the mode, the pane env, the `herdr agent start` line and the
   brief.

## Acceptance criteria

1. Dry runs: a builder task resolves `interactive` with the Claude interactive shape
   (explicit model, `--session-id`, one `--settings` where caveman is off, the
   permission flags and the Context7 tools denied), and no `-p` or `--max-turns`;
   `--mode oneshot` gives the KIT-004 command unchanged; a task with `mode: oneshot`
   does too; `--profile economy` gives the OpenCode interactive shape; a Codex
   interactive launch is refused with the trust reason; a reviewer stays one-shot.
2. One real interactive run on a scratch task, with a cheap model (test-only
   override, printed in the plan): the pane shows the real CLI interface, the agent
   is named after the task, it writes the Handoff and `DONE`, commits under the guard
   hook, and the dispatcher reports DONE, exit 0, and **closes the pane**.
3. A real interactive `BLOCKED` round leaves the pane open; `--resume --message`
   prompts the same live agent, which then ends `DONE`.
4. A one-shot stub run ending `DONE` closes its pane; one ending `BLOCKED` does not.
5. Scratch worktrees, branches, panes and run state are removed afterwards.
6. `bash -n`, `ruby -c`, `check-state.sh`, and `npm run verify` run and reported.

## Out of scope

- Launching the architect or designer through the dispatcher.
- Codex interactive, and any change to `~/.claude.json` or `~/.codex/config.toml`.
- Answering permission prompts automatically: only the owner answers them.

## Handoff

**Written by the lead, 2026-09-29.**

**What was done.**
- `agents.yaml`: `launch.claude.interactive` and `session_new`,
  `launch.opencode.interactive`, `launch.codex.interactive_refused` (the trust
  reason), `launch.herdr.start_agent` and `prompt_agent`;
  `roles.builder.mode: interactive`; `dispatch.one_shot_roles` renamed
  `dispatch.roles`, since dispatched roles are no longer all one-shot.
- `dispatch.rb`: `--mode` and `--keep-pane`; mode resolution (flag, task
  `mode:`, role); `claude_flags` shared by both modes, so interactive gets
  exactly the one-shot settings, permissions and tool lists;
  `launch_interactive`; `start_interactive` (pane split with `--env`,
  `herdr agent start`, retried while the new shell comes up); `wait_interactive`
  (waits for `working` first, then polls: `blocked` reported once per episode
  with the pane text saved as `blocked-<n>.txt`, stall alert, idle ends the
  round); `run_interactive` (verdict, rate-limit fallback, resume by prompting
  the live agent or restarting on the recorded session); pane auto-close in
  both modes. A test-only `DISPATCH_TEST_MODEL` swaps the model and says so
  in the plan.
- `dispatch.sh` header, the `/dispatch` skill (modes, approvals, closing
  panes as soon as no round is expected) and WORKFLOW.md step 3.

**Evidence** is in [journal/2026-09-29-kit-005.md](../journal/2026-09-29-kit-005.md).

**Acceptance criteria.**
1. Met. Builder dry run: `herdr agent start kittest-011 --kind claude … --
   --model claude-sonnet-5-5 --append-system-prompt-file … --permission-mode
   acceptEdits --allowedTools … --disallowedTools Bash(git
   push:*),mcp__plugin_context7_context7,mcp__claude_ai_Context7 --session-id
   <new uuid>`, no `-p`, no `--max-turns`, no skills gate; a `money` touch adds
   the one `--settings`; `--mode oneshot` and a task's `mode: oneshot` give the
   KIT-004 command; `--profile economy` gives `opencode --model
   openai/gpt-6-luna`; a Codex interactive reviewer is refused with the trust
   reason; the reviewer stays one-shot; `--mode chatty` is refused.
2. Met with Haiku (`DISPATCH_TEST_MODEL`): KITTEST-011 ran as agent
   `kittest-011` in the real Claude interface, wrote the Handoff and `DONE`,
   committed through the guard hook, pinged the lead; the dispatcher reported
   DONE, exit 0, and closed the pane.
3. Met. KITTEST-014 round 1 ended `BLOCKED` (exit 3) with the pane and agent
   left open; `--resume --message` prompted the same live agent in the same
   pane and session; round 2 ended `DONE` and the pane closed.
4. Met with stubs: a one-shot DONE closed its pane, a one-shot BLOCKED kept
   it, and `--keep-pane` kept a DONE pane.
5. Met. All scratch worktrees, branches, panes, agents, run state and task
   files were removed.
6. Met. `bash -n` and `ruby -c` clean; `check-state.sh` ok; `npm run
   verify` in the kit worktree: typecheck clean, 2256/2256 tests, 32 files.

**Found and fixed during the task.**
- `herdr agent start` straight after `pane split` failed with "not an
  available shell": the new pane's shell was not up yet. Start is now retried
  for up to 15 s on that error only. The first failure message also blamed a
  dialog wrongly; a dialog is now named only when Herdr says the agent is
  blocked at startup.
- A reviewer's written verdict, findings included, is exit 0, so its pane
  closes too. The docs now say "a written review verdict", which is the
  behaviour: the reviewer is never resumed, and its report holds everything.

**Found and not fixed.**
- **Approvals happened in the pane.** Both Haiku runs hit permission prompts
  (in KITTEST-014 the saved pane text shows a compound `cd … && git add … &&
  git commit` on the backslash-escaped path, "Contains backslash-escaped
  whitespace"), and each was approved. Neither the lead nor the dispatcher
  sends keys, so the lead infers the owner approved them while watching.
  That is the intended supervised flow, but it means an interactive builder
  can do more than the allowlist when someone approves; unattended, the
  prompt waits and the lead is told.
- Weak models escape the space in the repository path (`POS\ System`) and
  their file tools then fail; Haiku fell back to Bash each time. Sonnet did
  not do this in FE-029.
- An interactive session has no turn cap. OpenCode interactive and its
  permission block are proven by dry run only.
- In the probe, a scratch folder whose trust dialog was never answered later
  read as trusted in `~/.claude.json`. The cause is unknown; recorded, not
  investigated.

**For the owner.**
1. Merge `agent/kit-interactive`. It changes agents.yaml, so the lead
   reinstalls the hooks afterwards.
2. Did you approve the prompts in the `KITTEST-011` and `KITTEST-014` panes?
   If not, something else answered them and that needs looking into before
   the next real dispatch.
3. Builder default is now interactive; say if you would rather keep one-shot
   and opt in per task.

DONE
