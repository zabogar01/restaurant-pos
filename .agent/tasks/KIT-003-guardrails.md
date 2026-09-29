# KIT-003 — Guardrails: commit and push hooks, branch protection

**Status:** Accepted by the owner 2026-09-29 (merged as PR #14, `dccd3d0`)
**Owner:** `lead`
**Depends on:** KIT-002 (accepted by the owner 2026-09-29, `a1d67d0`)
**Source:** [AGENT-KIT.md](../AGENT-KIT.md) § Guardrails and human gates, § Phase 3. Owner rulings of 2026-09-29 (DECISIONS.md).
**Branch:** `agent/agent-kit`, worked in the worktree `../restaurant-pos-kit`. The owner's main checkout was moved to `development` during this session and was left as the owner set it.

---

## Objective

The human gates hold even if a prompt is ignored. A commit that changes a
contract file or an accepted ADR is rejected unless the owner sets
`ALLOW_CONTRACT=1`. Nobody commits directly on `main` or `development`. A
dispatched agent commits only on an `agent/*` branch, only inside its owned
paths, and cannot push. On GitHub, `main` and `development` change only
through a pull request.

## Owner rulings this task implements (2026-09-29)

- **Protection:** `main` and `development` require a pull request with **0
  required approvals** (GitHub forbids approving your own PR, and the owner and
  the agents share the `zabogar01` account). The rules apply to admins too, and
  force-push and deletion are blocked. Agents never push; a local pre-push hook
  rejects any push when `AGENT_ROLE` is set.
- **Guard scope:** the contract and accepted-ADR guards apply to **every**
  commit, including the lead's interactive session and the owner's own.
  Commits directly on `main` or `development` are rejected for everyone. The
  branch-pattern and owned-path checks apply only when `AGENT_ROLE` is set.
- `main` is created from `development` at `881a36d` (done locally in KIT-002;
  pushed here).

## What changes

1. `.githooks/pre-commit`:
   - always: reject a commit on `main` or `development`;
   - always: reject staged changes to a path in agents.yaml `contract_paths`
     unless `ALLOW_CONTRACT=1`;
   - always: reject a change to an ADR under `docs/decisions/` whose committed
     version reads `Status:** Accepted`, since an accepted ADR is superseded,
     never edited;
   - with `AGENT_ROLE`: the branch must match `agent/*`; every staged path must
     match the role's `owns:` in agents.yaml (or the task's `owns:` frontmatter
     when `TASK_ID` is set), plus the worker's own task file.
2. `.githooks/pre-push`: reject any push when `AGENT_ROLE` is set.
3. ~~`git config core.hooksPath .githooks`~~. Replaced during the task by
   `.agent/bin/install-hooks.sh`, which installs into the shared `.git/hooks`
   (see Handoff).
4. Push `main` to `origin`. Protect `main` and `development` on GitHub as ruled.
5. Record the rulings in DECISIONS.md, and the pilot (candidate A) and skills
   rulings from KIT-002's review.

## Acceptance criteria

1. On an `agent/*` branch, a commit staging `docs/BOUNDARIES.md` is rejected,
   with and without `AGENT_ROLE`. With `ALLOW_CONTRACT=1` and no
   `AGENT_ROLE`, the guard lets it through (proved in a scratch clone, never
   committed here).
2. A commit on `main` or `development` is rejected. An edit to an accepted ADR
   is rejected. A dispatched `builder` staging a path outside its `owns:`, or
   committing on a non-`agent/*` branch, is rejected. A push with
   `AGENT_ROLE=builder` is rejected.
3. A normal commit on `agent/agent-kit` with no `AGENT_ROLE` passes (this
   task's own commit).
4. `gh api` shows protection on both branches: PR required, 0 approvals,
   enforced for admins, no force-push, no deletion.
5. `npm run verify` is run and its real output reported.

## Out of scope

- Per-task test database isolation (`DB_NAME`). The playbook marks it optional
  with one builder, and `max_builders` is 1. It belongs with KIT-004 or later
  if parallel builders are ever allowed.
- Blocking `--no-verify`. A git hook cannot stop its own bypass. Branch
  protection is the backstop on GitHub; see the Handoff.

## Handoff

**What was done.**
- `.githooks/pre-commit` and `.githooks/pre-push` as specified, plus one rule
  added during testing: a dispatched worker may not change its task file's
  frontmatter, because otherwise it could widen its own `owns:`.
- `.agent/bin/install-hooks.sh [--check]` installs both hooks and a snapshot
  of `agents.yaml` into the shared `.git/hooks`. Installed and checked in this
  repository.
- GitHub protection on `main` and `development` as ruled, read back via
  `gh api`. `main` was already on `origin`, pushed by the owner.
- WORKFLOW.md ("Enforced by code") and CLAUDE.md (re-run the installer after
  changing hooks or config) updated. DECISIONS.md gains four lines: the pilot,
  the skills layout, protection, and guard scope. STATE.md and QUEUE.md
  updated.
- Evidence: [journal/2026-09-29-kit-003.md](../journal/2026-09-29-kit-003.md).

**Decided, and why.**
- **Deviation from the playbook:** no `core.hooksPath`. The playbook's layout
  ran no hook on any branch without `.githooks/` (test T16 passed before the
  fix). It also let a branch disable its own guard or widen its own
  permissions. The shared `.git/hooks` plus a config snapshot closes all
  three. The cost is that the lead must re-run the installer after changing
  the hooks or agents.yaml; `--check` exists so that KIT-004's preflight can
  enforce it.
- The hook fails closed: no Ruby, no snapshot, or an unknown role all reject.

**Found and not fixed.**
- `git commit --no-verify` skips every hook, and so does `git push
  --no-verify`. No git hook can prevent that. On GitHub, protection is the
  backstop for `main` and `development`. Locally, an agent that bypasses the
  hook can still commit off-limits paths on its own branch; the lead's
  `git diff --name-only` check at verification (dispatch loop step 5) catches
  it before merge. A Claude Code PreToolUse hook could also refuse
  `--no-verify` for Claude workers; not built, owner's call.
- Anyone holding the `zabogar01` credentials can merge a PR through GitHub.
  With one account, GitHub cannot tell the owner from an agent. The pre-push
  hook and the rule "workers never push" are what keep agents off GitHub.
- The owner's checkout now rejects local commits on `development`. `git pull`
  and fast-forwards still work; a merge commit made locally runs
  `pre-merge-commit`, which is not installed, so it is not blocked.
- Per-task test databases remain deferred (out of scope).

**Verification.** 22/22 guard cases as expected in a scratch clone. The
contract guard rejected a real commit in this repository, with and without
`AGENT_ROLE`. The protection read-back is shown in the journal.
`npm run verify` in the worktree: typecheck clean, 2253/2253 tests, 32 files, exit 0.

DONE
