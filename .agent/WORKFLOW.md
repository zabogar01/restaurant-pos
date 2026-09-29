# Workflow

How agents in this repository divide work, hand it over, and get changes
approved. Stable process, not current state. Current state lives in
[STATE.md](STATE.md), the upcoming queue in [QUEUE.md](QUEUE.md), owner
rulings in [DECISIONS.md](DECISIONS.md), and learned rules in
[LESSONS.md](LESSONS.md). Narratives go to `journal/`. The design behind this
process is [AGENT-KIT.md](AGENT-KIT.md).

---

## Roles and ownership

Every role's CLI, model, effort, mode, skills and owned paths live in
[agents.yaml](agents.yaml), and each role's prompt in `roles/<role>.md`. This
table is the summary; agents.yaml wins where they differ.

| Role | Default runner | Writes |
|---|---|---|
| **Lead** | Claude Opus 5.5, interactive, permanent pane `lead` | STATE, QUEUE, DECISIONS, LESSONS, journal, task files (all but each Handoff), the kit. **Drafts** contract changes; only the owner approves them |
| **Architect** | Claude Opus 5.5, interactive, on demand | `docs/ARCHITECTURE*.md`, `docs/decisions/` |
| **Designer** | Codex `gpt-6-astra` (high effort), interactive, on demand | `docs/design/`, `docs/DESIGN.md` |
| **Builder** | Claude Sonnet one-shot, own worktree, at most one at a time. Profiles `economy` / `heavy` on OpenCode | Source, tests, root build files, its task's Handoff |
| **Reviewer** | One-shot, always the other model family from the builder | `reviews/<ID>-review.md` only |
| **Explorer / librarian** | Codex `gpt-6-luna` read-only via `bin/ask.sh`; Claude subagents as fallback | Nothing; they return a summary |

Panes are named after the role or the task (`lead`, `FE-029`), never
referred to by pane ID in documents: IDs are not reused and go stale.

Ownership is exclusive. An agent that needs a change in a file it does not own
asks the owner rather than editing it.

**Only the lead writes STATE, QUEUE, DECISIONS and LESSONS.** Workers read
only their task file. If several agents wrote these files they would stop
being a shared account of the project. A worker with something worth
remembering puts it in its Handoff.

**Reviewers do not update central memory.** A review is evidence, not a
decision. The lead decides what findings mean and whether anything durable
changed.

---

## Herdr is a switchboard, not a memory

Herdr routes messages between agent panes and reports which agents are alive,
working, blocked or idle. It stores nothing that survives the session.
Anything that must outlive the pane goes in a file: project state in STATE.md,
rulings in DECISIONS.md, task state in the task's Handoff, technical reasoning
in the architecture or design documents. The test: **if this pane closed right
now, would the next agent know this?**

- **Every brief** to a delegated agent ends with the report lines:
  `herdr agent prompt lead "<name>: <task> done — <one line>"` and
  `herdr agent prompt lead "<name>: BLOCKED — <question>"`. In the same turn
  the lead starts a background `herdr agent wait <name>`, so it is woken even
  if the agent forgets. The lead's pane must carry the name `lead`
  (`herdr agent rename <pane> lead`); the name drops when a session changes.
- **Close idle agents.** Once an agent's work is accepted and no further round
  is expected, the lead exits its session and closes the pane it created, and
  records it as closed in STATE.md. It does not ask the owner first. Only panes
  the lead created are closed; the owner's own panes are left alone.
- **Models are explicit.** Every agent is started with its model from
  agents.yaml passed explicitly, never on a CLI default. A model changes
  between slices, never inside one.

---

## Gates

Work moves through gates. Each ends in an artifact, and the next stage reads
that artifact rather than the conversation that produced it.

**Planning gate.** A phase does not begin without a written plan under
`docs/superpowers/plans/`. Only Phase 0 has one.

**Design gate.** Behavioral structure is confirmed before visual direction,
and visual direction before components. Both are done: the sitemap, screen
inventory and wireframe are confirmed, and Frost is the visual direction.
A screen with no reviewed Frost design gets a design task before any code.

**Implementation gate.** Open since 2026-09-14; STATE.md records what it
required. None of its conditions may be waived by an agent.

**Review gate.** Work is reviewed by an agent from the other model family, who
reads the requirement or boundary the work claims to satisfy, not only the
diff. Trivial changes (≤ `review.trivial_max_lines`, no `touches` flag, verify
green) are reviewed by the lead. Anything touching `money`, `audit`,
`identity` or `boundaries` gets an architect consult before dispatch, a strong
cross-family review, and the owner's look before merge.

**Integration gate.** Only the owner merges. See below.

---

## The dispatch loop

1. **Task file.** The lead writes it (format below), including the tests
   expected to change, found by asking the explorer.
2. **Preflight.** Dependencies closed; no other builder running; no running
   task owns the same files; `bin/check-state.sh` passes.
3. **Dispatch** with `.agent/bin/dispatch.sh <ID>` (the lead's `/dispatch`
   skill; `--dry-run` first). A worktree on `agent/<task>` cut from
   `development`, a named pane, the CLI launched one-shot with the role
   prompt, all read from agents.yaml. Caveman is off for the run when the
   role says so or the task matches `caveman_off_when` (an `arch` or `logic`
   category, or a `money`/`audit`/`identity`/`boundaries` touch). Context7
   is off for every role but the librarian. No skills gate is applied.
4. **Wait.** Exit with `DONE` → verify. `BLOCKED` → the lead rules from the
   documents or escalates, then resumes the same session. Idle with no
   Handoff → re-prompt once, then escalate.
5. **Verify.** The lead runs `npm run verify` in the worktree and reads the
   output, checks every acceptance criterion against the Handoff, and flags
   any changed test file not listed in the task.
6. **Review** at the right tier. Findings go back to the builder's resumed
   session, at most `max_fix_cycles` times; then escalate.
7. **Record.** The lead rewrites STATE.md and appends any ruling to
   DECISIONS.md.
8. **Merge.** The owner merges; the lead removes the worktree.

**Block protocol.** A one-shot worker that hits a question builds everything
the question does not affect, leaves the conflicting test, copy or rule
untouched, and ends the round with `BLOCKED`, numbered findings and a proposed
resolution for each. The lead rules and resumes the same session.

---

## Task file format

One file per task in `.agent/tasks/`, named `<AREA>-<NNN>-<slug>.md`. The lead
writes everything except the **Handoff**, which only the worker writes.

```markdown
---
id: FE-029
title: <title>
category: quick | feature | ui | logic | arch | docs
touches: []            # money | audit | identity | boundaries
depends_on: []
owns: [apps/pos/src/**]
profile: default       # optional: economy | heavy
status: not-started    # not-started | active | blocked | review | complete
cycles: 0
---
# <ID> — <Title>

## Objective
What must become true. One paragraph.

## Required inputs
Documents, files, and decisions needed. Everything the worker needs is here
or cited; workers do not read STATE.md.

## Constraints
What the work must not do. Cite requirement and boundary IDs.

## Tests expected to change
Existing tests the worker may update, with why. Any other test: stop and ask.

## Acceptance criteria
Observable conditions, each checkable by someone who was not here, each naming
the case that goes red.

## Out of scope
Named explicitly, so it reads as deliberate rather than forgotten.

## Handoff
Written by the worker: what was done (paths, commits), what was decided and
on what evidence, tests changed and why, what was found and not fixed, the
real verify output, what the next agent needs. Last line: DONE or
BLOCKED: <question>.
```

A Handoff that says only "done" has failed. The reason a thing was done the
way it was done is exactly what gets lost first.

---

## Approval, commits and merge

**The owner is the only approver and the only merger.** No agent merges into
`main` or `development`, and no agent decides that something is approved.

- The integration branch is **`development`**. Every agent branch is
  `agent/<task>`, cut from `development`, and every PR targets it. `main` and
  `development` are both protected.
- **A dispatch counts as asking.** Workers commit only on their own
  `agent/<task>` branch, only after verify is green, and never push.
- Commit messages are Conventional Commits in ordinary prose and explain
  *why*; the diff already shows what.

**Enforced by code, not only by this document.** The hooks in `.githooks/`
are installed with `.agent/bin/install-hooks.sh` into the shared `.git/hooks`,
together with a snapshot of `agents.yaml`, so no branch or commit can change
them. They reject, for every commit: a commit directly on `main` or
`development`, a change to a contract file (unless the owner sets
`ALLOW_CONTRACT=1`), and an edit to an accepted ADR. For a dispatched agent
(`AGENT_ROLE` set) they also reject a branch other than `agent/*`, a path
outside its `owns:`, an edit to its task file's frontmatter, and any push. On
GitHub, `main` and `development` accept changes only through a pull request
(0 approvals, since the owner cannot approve their own PR; enforced for
admins; no force-push or deletion). After editing `.githooks/` or
`agents.yaml`, the lead re-runs `install-hooks.sh`; `--check` reports a stale
install. `git commit --no-verify` skips any hook, so GitHub protection is the
backstop.

Three things always require the owner, never an agent:

1. **Changing the product contract**: PRODUCT.md, PRD.md, ROADMAP.md or
   BOUNDARIES.md. The lead drafts exact replacement wording; only the owner
   approves it.
2. **Accepting architecture**: a new ADR binds when the owner accepts it.
3. **Merging.**

A boundary in [docs/BOUNDARIES.md](../docs/BOUNDARIES.md) is not subject to
agent judgement at all. If a task appears to require breaking one, the task is
wrong. Stop and raise it.
