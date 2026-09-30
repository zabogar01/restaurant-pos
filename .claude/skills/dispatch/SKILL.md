---
name: dispatch
description: Hand a written restaurant-pos task file to a one-shot builder, reviewer or docs-writer through .agent/bin/dispatch.sh, then verify, review and record it. Use when the lead is about to start, resume or review a task in .agent/tasks/, or when a dispatched run finishes, blocks, stalls or fails.
---

# Dispatch a task

The lead's side of the dispatch loop in `.agent/WORKFLOW.md`. The script does
the mechanics from `.agent/agents.yaml`; this skill is the judgement around
it. Never build a launch by hand: if the script cannot express a launch,
fix the script or agents.yaml.

## 1. Before dispatch

1. **Frontmatter.** The task file needs `id`, `category` (`quick`,
   `feature`, `ui`, `logic`, `arch`, `docs`), `touches`, `depends_on`,
   `owns`, `status: not-started` and `cycles: 0`; `profile:` only to force
   one. Format and sections: WORKFLOW.md "Task file format".
2. **Route.** `logic` and `arch` go to the architect and `docs` to you: the
   script refuses them, correctly. `ui` without a reviewed design gets a
   design task first. A `touches` flag of `money`, `audit`, `identity` or
   `boundaries` needs an architect consult before dispatch and the owner's
   look before merge.
3. **Tests expected to change.** Ask the explorer
   (`.agent/bin/ask.sh explorer "<which tests assert X>"`) and list them.
4. **Leave the task file uncommitted** in your checkout. The script commits
   it as the first commit of the task branch, so it lives only there. Do not
   also commit it on your own branch: the two PRs would each add the file
   with different content (the Handoff) and conflict (FE-029 pilot). From
   then on, edit only the worktree's copy (rulings, `status:`), committed
   there without `AGENT_ROLE`; the script reads that copy once it exists.
5. **Dry run** and read all of it: role, profile, model, caveman, MCPs,
   preflight, command, prompt.
   ```bash
   .agent/bin/dispatch.sh <ID> --dry-run
   ```
   Any `FAIL` line is a refusal. Fix the cause; never work around a
   preflight check.

## 2. Dispatch

Run it in the background so you are woken on exit, and say "dispatched" to the
owner with the pane name:

```bash
.agent/bin/dispatch.sh <ID>          # run_in_background: true
```

It creates `../restaurant-pos-wt/<ID>` on `agent/<id>`, runs `npm ci`, opens
a Herdr pane named `<ID>` and waits. Do not poll it. The worker also pings
you with `herdr agent prompt lead`.

**Modes.** The builder runs **interactive** by default: the real CLI in the
pane as Herdr agent `<id>` (lowercase), which the owner can watch and type
into. Reviewers and the docs-writer run **oneshot** (`claude -p`, `codex
exec`). `--mode` or the task's `mode:` overrides. Interactive has no turn
cap; the stall alert is the only runaway guard. Codex interactive is refused
(its folder trust is the owner's call).

**Permission prompts.** `BLOCKED ON APPROVAL` means an interactive agent is
waiting on an approval in its pane; the pane text is saved as
`blocked-<n>.txt` in the run directory. Never answer it: the owner does, or
the round is resumed with a narrower instruction. A startup dialog (trust,
login, update) is the owner's too.

## 3. Outcomes (the script's exit code)

| Exit | Meaning | Do |
|---|---|---|
| 0 `DONE` | Handoff ends DONE; the pane has closed itself | Verify (step 4) |
| 3 `BLOCKED` | Handoff ends BLOCKED | Rule from the documents, write the ruling into the task file above the Handoff in the worker's worktree and commit it there (no `AGENT_ROLE`), then `--resume --message "<one line>"`. Interactive: the same live agent is prompted in its pane; if it has gone, the CLI restarts on the recorded session. A ruling you cannot make from the documents goes to the owner; park the task |
| 4 | Exited without a verdict | Read the Handoff and the log; re-prompt once with `--resume`, then escalate |
| 2 | Refused | Read the reason; nothing ran |
| other | CLI failed | Read `.agent/runs/<ID>/<role>/log.jsonl`. A rate limit already fell back once to the `fallback` profile. Otherwise treat it as BLOCKED |
| `STALL:` line | No output and no file change for `stall_alert_min` awake minutes | Read the pane. The run was not killed; decide |

The resume limit is `max_fix_cycles` rounds after the first. The script
refuses beyond it: escalate to the owner.

## 4. Verify (never skip)

In the worktree:

1. `git log --oneline development..HEAD` and the **whole** Handoff.
2. `npm run verify` yourself; read the counts.
3. `git diff --name-only development...HEAD`: flag any changed test file not
   under **Tests expected to change**, and any path outside `owns:`.
4. Check each acceptance criterion against evidence, not the Handoff's word.
5. UI task: walk every flow in a real browser.

## 5. Review

- **Trivial** (≤ `review.trivial_max_lines` changed lines, no `touches`
  flag, verify green): you review; fix directly, re-run verify.
- **Otherwise:** `.agent/bin/dispatch.sh <ID> --role reviewer` (set
  `status: review` in the worktree's copy first). The reviewer does not
  commit; you commit its report on the task branch with `status: complete`. It picks the other family from the
  builder's recorded CLI and the review strength. Findings go back to the
  builder with `--resume`.

## 6. Record and hand over

Rewrite STATE.md, update QUEUE.md, append any owner ruling to DECISIONS.md.
Tell the owner the branch is ready to merge, in plain prose: what was done,
verify output, open decisions. Close any pane of the task that is still open
(one kept by BLOCKED or `--keep-pane`) as soon as no further round is
expected, not at merge. After the merge: `git worktree remove
../restaurant-pos-wt/<ID>` and delete `.agent/runs/<ID>/`.

## Knobs

- `.agent/bin/preset.sh <profile>` switches every builder dispatch to a
  profile (`economy`, `heavy`); `preset.sh default` switches back.
- `--profile <name>` for one run; `--role <role>` to override routing.
- `--model <model>` replaces the resolved profile's model for one run only, on the same CLI,
  so a reviewer stays in the other family (for example `--role reviewer --model gpt-6.1-sol`).
  agents.yaml is unchanged; a fallback profile drops it.
- `--keep-pane` keeps the pane after DONE.
- Test-only environment: `DISPATCH_ALLOW_STALE_HOOKS=1`,
  `DISPATCH_SKIP_SETUP=1`, `DISPATCH_POLL_SEC`, `STALL_ALERT_MIN`,
  `DISPATCH_PASS_ENV`, `DISPATCH_TEST_MODEL`. Never use them on a real task.
