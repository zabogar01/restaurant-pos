# KIT-004 — The dispatcher, supervised

**Status:** Accepted by the owner 2026-09-29 (Stage 1 PR #18; the pilot FE-029 PR #20 and its fixes PR #19)
**Owner:** `lead` (the kit is the lead's to own; this task is not dispatched)
**Depends on:** KIT-003 (accepted 2026-09-29, PR #14) and KIT-002a (merged as PR #16)
**Source:** [AGENT-KIT.md](../AGENT-KIT.md) § The dispatch loop, § Review tiers, § Block protocol, § Phase 4, § Reference (`dispatch.sh` sketch, task frontmatter). Owner rulings of 2026-09-29 in [DECISIONS.md](../DECISIONS.md): candidate A is the pilot, no skills gate, Context7 for the librarian only, caveman off by `caveman_off_when`.
**Branch:** `agent/kit-dispatcher`, cut from `development` at `a9548fd`, worked in the worktree `../restaurant-pos-kit`.

---

## Objective

The lead can hand a written task file to a one-shot worker with one command,
and every launch is built from `agents.yaml` rather than from memory: the
right CLI, an explicit model and effort, the role prompt, caveman off where
the rules say so, Context7 off for every role but the librarian, and no
skills gate. The command prints exactly what it would do before it does
anything. The first real run, the pilot, is watched by the owner.

## Stages

The pilot cannot run from this branch. A worker's worktree is cut from
`development`, and the guard hooks read the `agents.yaml` snapshot installed
from `development`, so the dispatcher has to be merged before it dispatches
anything real.

1. **Stage 1 (lead, this branch).** Build `dispatch.sh`, the `/dispatch`
   skill and `preset.sh`. Prove every case below with `--dry-run` and with
   stub CLIs; no real worker runs. The one exception is a single Haiku call
   to prove Claude parses the permission flags, which a dry run cannot show
   (added during the task). Hand the branch to the owner to merge.
2. **Stage 2 (after the merge).** The lead reinstalls the hooks, writes the
   pilot task (`FE-029`, candidate A: render the `cancel`, `reauth` and
   `leaselost` modals inside `.pos-device`), shows the owner its dry run, and
   dispatches it for real while the owner watches the pane. Then verify,
   review at the right tier, and record what went wrong in LESSONS.md. Fixes
   to the kit go on a new `agent/kit-dispatcher-*` branch.

KIT-004 closes when the owner accepts the pilot's outcome. Product work
resumes after that (DECISIONS.md, 2026-09-29).

## What changes (Stage 1)

1. **`.agent/bin/dispatch.sh`**, new.
   `dispatch.sh <TASK-ID> [--role <role>] [--profile <name>] [--resume] [--dry-run]`.
   - **Reads the task file's frontmatter:** `category`, `touches`,
     `depends_on`, `owns`, `profile`, `status`. The role comes from
     `routing.<category>.build` unless `--role` is given. Only one-shot roles
     are dispatched (`builder`, `reviewer`, `docs-writer`). An interactive
     role (architect, designer) or a category built by the lead is refused
     with a message naming the role.
   - **Profile resolution**, first match wins: `--profile`, then the task's
     `profile:`, then `.agent/profile` (the global preset), then the role's
     `default`. The reviewer is picked from `reviewer.pick` by the builder's
     family (`families:`) and the task's review strength
     (`routing.<category>.review_strength`, forced to `strong` by any
     `escalate_touches` flag).
   - **Launch built from `launch.<cli>`:** `oneshot`, then `effort` when the
     profile sets one, the role prompt the CLI's way (Claude
     `--append-system-prompt-file`; Codex and OpenCode prepend it to the
     prompt), and `stdin` for Codex. `max_turns` for Claude.
   - **Caveman:** a Claude launch carries `caveman_off` when the role's
     `caveman` is `off`, the category is in `caveman_off_when.categories`, or
     `touches` meets `caveman_off_when.touches`. All Claude settings go into
     **one** `--settings` JSON object, because a second `--settings` does not
     combine with the first.
   - **MCPs:** every launch whose role does not list a gated MCP in
     `roles.<role>.mcps` carries `launch.<cli>.mcp_off.<mcp>`. A CLI with no
     `mcp_off` entry for a gated MCP is a refusal unless that CLI has no such
     server configured, and the script says which.
   - **No skills gate.** `launch.<cli>.skills_gate` is never applied
     (owner, 2026-09-29).
   - **Permissions for an unattended Claude worker** (the open item in
     agents.yaml): `--permission-mode acceptEdits` plus an `--allowedTools`
     list of the read tools and the Bash commands a builder needs (verify,
     tests, typecheck, path-scoped `git add`, `git commit`, `git status`,
     `git diff`, `git log`), and `git push` in `--disallowedTools`. In `-p`
     mode anything not allowed is denied, not prompted, so a worker that
     needs more ends BLOCKED instead of hanging. The list lives in
     agents.yaml. This is the lead's choice; `auto` and `bypassPermissions`
     were rejected as broader than a builder needs. The owner may overrule.
   - **Worktree:** `../restaurant-pos-wt/<ID>` on `agent/<id-lowercase>`,
     cut from `integration_branch`. If the task file is not committed at the
     branch point, the script commits it as the branch's first commit, with
     no `AGENT_ROLE`, so the pre-commit hook compares the worker's frontmatter
     against a committed spec. Then `npm ci` in the worktree.
   - **Environment for the worker:** `AGENT_ROLE`, `TASK_ID`, and
     `caffeinate -i` around the process on macOS.
   - **Pane:** a Herdr pane beside the lead's, cwd the worktree, named after
     the task. It shows readable progress; the raw event stream goes to
     `.agent/runs/<ID>/`, gitignored.
   - **Completion:** the exit code is written to the run directory, and the
     script waits for it, so the lead runs `dispatch.sh` in the background
     and is woken on exit. It then prints the Handoff's last line (`DONE` or
     `BLOCKED: …`), or reports a missing Handoff.
   - **Stall alert:** no log growth and no file change in the worktree for
     `limits.stall_alert_min` minutes sends a Herdr notification and a line to
     the lead. It never kills the run. There is no wall-clock timeout.
   - **Resume:** `--resume` reads the recorded session id and uses
     `launch.<cli>.resume`. The run directory counts rounds; a resume beyond
     `limits.max_fix_cycles` is refused with "escalate to the owner".
   - **Fallback:** a non-zero exit whose log shows a rate limit or quota
     error is re-run once on the role's `fallback` profile, and the switch is
     logged.
   - **Preflight** (refuses with a reason, exit non-zero): `check-state.sh`
     fails; `install-hooks.sh --check` is stale; a `depends_on` task's status
     is not `complete`; another builder's run is live (a run directory with
     no exit file) and `limits.max_builders` would be exceeded; the task's
     status is not `not-started`, `active` or `blocked`; the worktree or
     branch already exists without `--resume`.
   - **`--dry-run`** prints the resolved role, profile, CLI, model, effort,
     branch, worktree, pane name, environment, the full command and the full
     prompt, and changes nothing: no worktree, no branch, no pane, no files.
   - The prompt is: execute the task file, commit on this branch only after
     verify is green, write the Handoff, last line `DONE` or
     `BLOCKED: <question>`, then the two Herdr report lines.
2. **`.agent/bin/preset.sh`**, new: `preset.sh <profile>` writes
   `.agent/profile`; `preset.sh default` removes it; no argument prints the
   active one. `.agent/profile` and `.agent/runs/` are gitignored.
3. **`.claude/skills/dispatch/SKILL.md`**, new: the lead's steps: classify
   the task, write its frontmatter, ask the explorer for tests expected to
   change, dry run, dispatch in the background, handle each outcome (DONE,
   BLOCKED, non-zero exit, stall, missing Handoff), verify, pick the review
   tier, record, and when to escalate.
4. **`agents.yaml`:** the Claude worker permissions; the dispatcher's
   worktree root. Then `install-hooks.sh` must be re-run after the merge.
5. **WORKFLOW.md** step 3 names `dispatch.sh` and the skill.

## Acceptance criteria (Stage 1)

Each is proven in the journal with the command and its real output.

1. `--dry-run` on a builder task prints a Claude command with `--model
   claude-sonnet-5-5`, one `--settings` argument, the Context7
   `--disallowedTools`, the permission flags and `--max-turns 200`, and
   leaves `git worktree list`, `git branch` and `herdr pane list` unchanged.
2. The same task with `--profile economy` prints an OpenCode command with
   `openai/gpt-6-luna`; a `money` touch on a Claude launch adds caveman off
   inside the same single `--settings` object; a reviewer for a
   Sonnet-built `feature` task resolves to Codex `gpt-6-astra` with effort
   `high` and both Codex Context7 off flags.
3. No launch, for any role or CLI, contains a skills-gate flag.
4. A `routing.logic` task (architect) and a `docs` task are refused with a
   message naming why. Each preflight refusal above is triggered once and
   refuses.
5. With stub CLIs on `PATH`, a live (non-dry) run creates the worktree and
   branch with the task file committed first, opens and names the pane,
   records the exit code and session id, prints the Handoff's last line, and
   `--resume` uses the recorded session. A stub that exits with a rate-limit
   message is re-run once on `economy`. A stub that sleeps with
   `STALL_ALERT_MIN` lowered raises the stall alert and is not killed. All
   stub worktrees, branches and panes are removed afterwards.
6. `skills-report.sh` no longer shows `dispatch` as missing for the lead.
7. `bash -n` is clean on both scripts; `check-state.sh` passes;
   `npm run verify` is run and its real output reported.

## Out of scope

- Per-task test databases (`DB_NAME`). `max_builders` is 1; deferred as in
  KIT-003.
- Automatic cross-family review after DONE, and running a designer alongside
  a builder (Phase 5). Stage 1 proves the reviewer launch by dry run only.
- Launching interactive roles (architect, designer). They stay manual, which
  leaves Context7 reachable by an interactive Codex designer (owner's ruling
  on the global config).
- A second, `feature`-sized pilot. The playbook suggests one; it can be the
  first product task after KIT-004 closes.
- Skills gating (owner, 2026-09-29).

## Handoff

**Stage 1, written by the lead, 2026-09-29.**

**What was done.**
- `.agent/bin/dispatch.sh` (entry point) and `.agent/bin/lib/dispatch.rb`
  (the logic, in Ruby, because macOS ships bash 3.2 and the hooks already
  require Ruby). `.agent/bin/lib/dispatch_progress.rb` turns each CLI's JSON
  stream into readable lines for the pane.
- `.agent/bin/preset.sh`, the global builder preset (`.agent/profile`).
- `.claude/skills/dispatch/SKILL.md`, the lead's side of the loop.
- `agents.yaml`: the launch section rewritten so every flag the dispatcher
  needs is data (Claude permissions, tool lists, `caveman_off` as a settings
  fragment, Codex writable roots, OpenCode permissions, session-id fields,
  Herdr pane commands), plus a `dispatch:` block (worktree root, setup
  command, one-shot roles).
- `.githooks/pre-commit`: the task file is found as `<ID>-*.md` or
  `<ID>.md`, no longer `<ID>*.md`, which let `KIT-002` match `KIT-002a`.
- `.gitignore`: `.agent/runs/` and `.agent/profile`. WORKFLOW.md step 3
  names the script and skill.

**Evidence** is in [journal/2026-09-29-kit-004.md](../journal/2026-09-29-kit-004.md).

**Acceptance criteria.**
1. Met. The builder dry run shows `--model claude-sonnet-5-5`, no
   `--settings` (caveman stays on for a builder), the permission flags, the
   Context7 tools in the single `--disallowedTools`, and `--max-turns 200`.
   Worktree, branch and pane counts were unchanged afterwards.
2. Met. `--profile economy` resolves OpenCode `openai/gpt-6-luna`; a `money`
   touch adds caveman off in one `--settings`; the reviewer for a
   Sonnet-built `feature` task is Codex `gpt-6-astra`, effort `high`, both
   Context7 flags. After the stub fallback ran on OpenCode, the reviewer for
   that task flipped to Claude Opus 5.5 with caveman off.
3. Met. No launch for any role or CLI contains a skills-gate flag.
4. Met. `logic` and `docs` are refused with the reason; stale hooks,
   a `depends_on` not complete, a wrong status, a live run of the same task,
   `max_builders`, an existing worktree, a missing session and the resume
   limit were each triggered and refused.
5. Met, with stub CLIs: worktree, branch and first commit of the task file;
   named pane; `npm ci`; exit code, session id and verdict (`BLOCKED`, exit 3,
   then `DONE`, exit 0, after `--resume`, in the same pane); the rate-limit
   fallback to `economy`; the stall alert at 0.5 min with the run left alive.
   All stub worktrees, branches, panes and run state were removed.
6. Met. `skills-report.sh`: lead, "assigned but missing: none".
7. Met. `bash -n` clean on `dispatch.sh`, `preset.sh` and the hook; `ruby -c`
   clean on both Ruby files; `check-state.sh` ok (146/150);
   `npm run verify` in the kit worktree: typecheck clean, 2253/2253 tests,
   32 files, exit 0.

**Decided, and why.**
- **Claude worker permissions:** `acceptEdits` and an allowlist of Bash
  commands, with `git push` denied. One Haiku call with these exact flags
  showed Context7 absent, `git status` allowed and `git push` denied without
  a prompt. `ls` was allowed too, although it is not on the list: Claude
  Code auto-approves read-only commands. `auto` and `bypassPermissions` were
  rejected as broader than a builder needs. The owner may overrule.
- **The prompt goes on stdin for Claude,** because `--allowedTools` and
  `--disallowedTools` are variadic and would swallow a trailing prompt.
- **Placeholders are filled after the line is split,** so the repository
  path, which contains a space, stays one argument.
- **The worker gets the dispatcher's `PATH`,** because a Herdr pane starts a
  fresh login shell.
- **Resume counts every round,** `BLOCKED` answers included, and refuses
  after `max_fix_cycles` resumes. A third round of anything on one task is
  an escalation.

**Found and fixed during the task.**
- In YAML 1.1 a bare `caveman: off` is the boolean `false`, so a check for
  the string `"off"` would have launched the Opus reviewer with caveman on.
  The dispatcher now treats `false` and `"off"` alike. Anything else that
  reads `caveman:` must do the same.

**Found and not fixed.**
- The OpenCode permission block and the Codex writable-roots flag are proven
  by dry run only. Their first real run is the first `economy`/`heavy`
  builder or the first Codex reviewer (Phase 5).
- Codex runs load the owner's other global MCP servers (Playwright, Stitch
  and others); only Context7 is gated.
- `--no-verify` still bypasses the hooks (KIT-003).

**For the owner.**
1. Merge `agent/kit-dispatcher`. Then the lead re-runs
   `.agent/bin/install-hooks.sh` from `development`, because agents.yaml and
   the pre-commit hook changed (until then `--check` reads stale, and the
   dispatcher refuses to run).
2. Confirm or overrule the Claude worker permissions above.
3. Stage 2 then starts: the lead writes FE-029 (the modal move), shows you its
   dry run, and dispatches it while you watch the pane.

Stage 1 DONE; KIT-004 stays open until the pilot is accepted.

**Stage 2, the pilot, written by the lead, 2026-09-29.**

The owner merged Stage 1 as PR #18, accepted KIT-002a, and confirmed the
Claude worker permissions (DECISIONS.md). The lead reinstalled the hooks from
`a42652b`, wrote FE-029, showed the owner its dry run, and dispatched it on
the owner's "go" while the owner watched pane `FE-029`.

**What ran.**
- **Builder**, Claude Sonnet 5.5: 18 turns, 55 s, $0.34, exit 0, `DONE`.
  Commit `0ea7687` moved the three modals inside `.pos-device` and added three
  tests. The lead verified: `npm run verify` 2256/2256 in 32 files; the three
  tests red on the original placement (`expected null not to be null`) and
  green on the fix; only owned paths changed and no existing test; and a
  Chrome walk at 1920×929 put each modal's centre at (640, 400), the frame's
  centre, with the scrim covering exactly the 1280×800 frame and "Keep
  collecting" working by a real click.
- **Reviewer**, Codex `gpt-6-luna` (light, the other family): seven commands,
  no Context7 call, verify green inside the Codex sandbox, verdict clean with
  no findings, report not committed as its role requires. This was the first
  real Codex launch through the dispatcher.
- `agent/fe-029` holds the task file, the fix, the review and `status:
  complete` (`d08f772`), for the owner to merge.

**What went wrong, and what changed** (branch `agent/kit-pilot`):
1. The allowlist refused five of the builder's commands, all compound
   (`cd …;`, heredocs, `sed … && git commit …`); the builder recovered each
   time. The builder and reviewer role prompts now say to run one simple
   command per call.
2. The dispatcher exited 4 on a clean review, because the Codex reviewer wrote
   `## Verdict: clean` and the parser wanted `**Verdict:**`. The parser now
   accepts the heading, bold and numbered forms.
3. The `/dispatch` skill told the lead to commit the task file on its own
   branch, which would have made two PRs add the same file with different
   content. The lead caught it before dispatch; the skill now says to leave
   it uncommitted and edit only the worktree copy afterwards.
4. The task's `status:` had to be edited in two copies. The dispatcher now
   reads the worktree's copy once it exists, and finds the task there when the
   lead's checkout has none.
5. Codex printed "Reading additional input from stdin..." and went on; the
   empty stdin file works as `/dev/null` did.

Three lessons were added to LESSONS.md.

**For the owner.** Merge `agent/fe-029` (the pilot's product change) and
`agent/kit-pilot` (these fixes, your two rulings, the records); they touch no
common file. Then say whether the pilot is accepted, which closes KIT-004 and
lifts the rule that no product task starts during the rollout.

Stage 2 DONE.
