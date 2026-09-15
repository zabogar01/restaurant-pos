# Workflow

How agents in this repository divide work, hand it over, and get changes
approved. Stable process, not current state — current state lives in
[MEMORY.md](MEMORY.md).

---

## Roles and ownership

| Role | Typically | Owns | Writes |
|---|---|---|---|
| **Product lead** | Claude, pane `w2:p1` | Coordination, product contract, central memory | `.agent/MEMORY.md`, `.agent/ROADMAP.md`, `.agent/tasks/*`, the four product documents |
| **Architect** | Codex, pane `w2:p2` | Architecture proposal, technical trade-offs, ADRs | `docs/ARCHITECTURE_PROPOSAL.md`, later `docs/ARCHITECTURE.md` and `docs/decisions/*` |
| **Designer** | Claude, pane `w2:p3` | UX structure, wireframes, later the design system | `docs/design/*` |
| **Implementer** | Any agent, per task | One task from a plan | Source, tests, and the **Handoff** section of its own task file |
| **Reviewer** | Any agent, per review | Verdicts on someone else's work | A review report only |

Ownership is exclusive. An agent that needs a change in a file it does not own
requests it from the owner rather than editing it.

### Two rules that exist because they are easy to violate quietly

**Only the product lead writes `.agent/MEMORY.md` and `.agent/ROADMAP.md`.**
These are the files every agent reads to orient. If several agents write them,
they stop being a shared account of the project and become a merge conflict.
An implementer with something worth remembering puts it in its task handoff
and tells the lead.

**Reviewers do not update central memory.** A review is evidence, not a
decision. The reviewer writes findings; the lead decides what they mean and
whether anything durable changed. A reviewer who edits MEMORY.md has promoted
their own opinion to project fact without anyone agreeing to it.

---

## Herdr is a coordinator, not a memory

Herdr routes messages between agent panes and reports which agents are alive.
It stores nothing that survives the session. A pane's scrollback is not a
record; it is a terminal buffer.

Anything that must outlive the session goes in a file: durable project state
in `MEMORY.md`, task-scoped state in the task's handoff section, technical
reasoning in the architecture or design documents.

The practical test: **if this pane closed right now, would the next agent know
this?** If not, it is not written down yet.

---

## Gates

Work moves through gates. Each ends in an artifact, and the next stage reads
that artifact rather than the conversation that produced it.

**Planning gate.** A phase does not begin without a written plan under
`docs/superpowers/plans/`. The plan names files, interfaces, and tests, and
contains no placeholders. Only Phase 0 currently has one.

**Design gate.** Behavioral structure — sitemap, screens, states — is
confirmed before visual direction is chosen, and visual direction is chosen
before any component is built. The current phase is deliberately split: this
repository owns structure, the owner and an external tool own the visual
system. Wireframes here are greyscale by intent, and an agent that adds colour
to them has misunderstood the task.

**Implementation gate.** The hard one. Conditions are listed in
[ROADMAP.md](ROADMAP.md) and none may be waived by an agent. It exists because
the architecture is still formally proposed while a plan already depends on
it.

**Review gate.** Work is reviewed by an agent that did not produce it. The
reviewer reads the requirement or boundary the work claims to satisfy, not
only the diff. A review that only checks style has not reviewed anything.

**Integration gate.** Only the human merges. See below.

---

## Task handoff format

One file per task in `.agent/tasks/`, named `<AREA>-<NNN>-<slug>.md`. The
owning agent writes only the **Handoff** section; the rest is set by the
product lead when the task is created.

```markdown
# <ID> — <Title>

**Status:** Not started | Active | Blocked | Complete
**Owner:** <agent name or "owner">
**Depends on:** <task IDs, or none>

## Objective
What must become true. One paragraph.

## Required inputs
Documents, files, and decisions needed before starting.

## Constraints
What the work must not do. Cite requirement or boundary IDs.

## Acceptance criteria
Observable conditions. Each one checkable by someone who was not here.

## Out of scope
Named explicitly, so it reads as deliberate rather than forgotten.

## Handoff
Written by the owning agent as work proceeds.
- What was done, with paths
- What was decided, and on what evidence
- What was found and not fixed
- What the next agent needs and does not have
```

A handoff that says only "done" has failed. The next agent inherits no
context, and the reason a thing was done the way it was done is exactly what
gets lost first.

---

## Human approval and merge authority

**The human owner is the only approver and the only merger.** No agent merges
to `main`, and no agent decides that something is approved.

Agent work happens on branches named `agent/<topic>`. The current branch is
`agent/design-direction`.

An agent commits only when the owner asks. Commit messages are ordinary prose
in Conventional Commits form and explain *why*, since the diff already shows
what.

Three things always require the owner, never an agent:

1. **Changing the product contract** — PRODUCT.md, PRD.md, ROADMAP.md, or
   BOUNDARIES.md. An agent that believes one of these is wrong says so and
   proposes exact replacement wording. It does not edit and report afterwards.
2. **Approving architecture.** A proposal becomes binding when the owner
   approves it, not when it is written well.
3. **Merging.**

A boundary in [docs/BOUNDARIES.md](../docs/BOUNDARIES.md) is not subject to
agent judgement at all. If a task appears to require breaking one, the task is
wrong. Stop and raise it.
