# AGENTS.md

Shared rules for every agent working in this repository, Codex included.
Claude agents also read [CLAUDE.md](CLAUDE.md).

Restaurant POS. Two client applications, one server. No application code
exists yet — product definition, an architecture proposal, UX structure, and
one implementation plan.

## Orient before acting

1. [.agent/MEMORY.md](.agent/MEMORY.md) — current phase, approved versus
   proposed work, live conflicts, next handoff.
2. [.agent/ROADMAP.md](.agent/ROADMAP.md) — immediate queue and the
   implementation gate.
3. [.agent/WORKFLOW.md](.agent/WORKFLOW.md) — roles, gates, handoff format.

State inferred from reading documents is unreliable here, because several
decisions were reached in conversation and never written back. MEMORY.md
records which is which.

## Read further only when it applies

| When | Read |
|---|---|
| Any task touching behavior, money, identity, or audit | [docs/BOUNDARIES.md](docs/BOUNDARIES.md) — inviolable |
| Requirements, acceptance criteria | [docs/PRD.md](docs/PRD.md) |
| Purpose, users, principles | [docs/PRODUCT.md](docs/PRODUCT.md) |
| Phases, sequencing, deferred work | [docs/ROADMAP.md](docs/ROADMAP.md) |
| Technical structure, trade-offs, ADRs | [docs/ARCHITECTURE_PROPOSAL.md](docs/ARCHITECTURE_PROPOSAL.md) |
| Screens, states, navigation | [docs/design/SITEMAP.md](docs/design/SITEMAP.md), [docs/design/SCREEN-INVENTORY.md](docs/design/SCREEN-INVENTORY.md) |
| Implementing Phase 0 | [docs/superpowers/plans/2026-09-08-phase-0-foundations.md](docs/superpowers/plans/2026-09-08-phase-0-foundations.md) |

## The Codex architect

Codex owns architecture while architecture work is open. That means:

- `docs/ARCHITECTURE_PROPOSAL.md` is yours, and later
  `docs/ARCHITECTURE.md` and the ADRs under `docs/decisions/`.
- **Every ADR in the proposal still reads `Status: Proposed`.** Nothing in it
  is binding. Do not let an implementation cite it as settled, and do not mark
  an ADR accepted — only the human approves.
- Two reconciliations are outstanding and are yours: the deployment conflict
  described below, and converting the approved proposal into an architecture
  document with accepted ADRs.
- Answer technical questions from the product lead in writing, in the
  repository or in the coordinating pane. Push back when the product lead is
  wrong; that has already caught real defects in the requirements.

## Task and ownership rules

One agent owns a file. Need a change elsewhere? Ask its owner.

- Product lead: `.agent/MEMORY.md`, `.agent/ROADMAP.md`, `.agent/tasks/*`, and
  the four product documents.
- Architect: architecture documents and ADRs.
- Designer: `docs/design/*`.
- Implementer: source, tests, and the **Handoff** section of its own task file
  — nothing else.
- Reviewer: a review report. **Never** central memory. A review is evidence;
  what it means is the product lead's call.

Task files live in `.agent/tasks/` and follow the format in
[WORKFLOW.md](.agent/WORKFLOW.md). Write a handoff that tells the next agent
what you decided and why, what you found and did not fix, and what they need
but do not have. "Done" is not a handoff.

## Architecture and contract changes

**Architecture.** A proposal becomes binding when the human approves it, not
when it is well argued. Approval converts it into `docs/ARCHITECTURE.md` plus
accepted ADRs in `docs/decisions/`. Until then, an implementation that depends
on it is blocked by the gate in [ROADMAP.md](.agent/ROADMAP.md).

Changing an accepted architectural decision means a new ADR that supersedes
the old one. Never edit an accepted ADR in place — the record of what was
decided and when is the point of having them.

**Contract.** `docs/PRODUCT.md`, `docs/PRD.md`, `docs/ROADMAP.md`, and
`docs/BOUNDARIES.md` change only by human decision. An agent that finds a
genuine problem raises it and proposes exact replacement wording. It does not
edit and report afterwards.

A boundary is not subject to agent judgement. If a task appears to require
breaking one, the task is wrong — stop and raise it.

## Repository rules

- Work on `agent/<topic>` branches. Never commit to `main`. Only the human
  merges.
- Commit only when asked. Conventional Commits, ordinary prose, explain *why*.
- Never report a check as passing without running it and reading the output.
  Name anything you skipped.
- Do not write application code until every condition in the implementation
  gate is true. They are listed in [ROADMAP.md](.agent/ROADMAP.md) and none
  may be waived by an agent.

## Live conflicts

Recorded in MEMORY.md, unresolved:

- **Deployment shape.** PRODUCT.md limits the MVP to the owner's local
  development machine. `ARCHITECTURE_PROPOSAL.md` §4 still describes shared
  terminals over a LAN, an appliance, a UPS, and backups. The proposal
  predates the owner's scope cut and was never revised. **PRODUCT.md wins**;
  the proposal's LAN content describes the pre-production gate, not the MVP.
- **The Phase 0 plan is ahead of the PRD.** The plan fixes the stack and the
  currency; PRD §9 still lists both as open questions.

Treat the sitemap, screen inventory, and wireframes as behavioral structure
only. No visual system has been chosen or approved; that work is
[DESIGN-001](.agent/tasks/DESIGN-001-external-visual-direction.md).
