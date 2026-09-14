# PHASE0-001 — Monorepo scaffold, PostgreSQL, migration runner

**Status:** Active
**Owner:** `builder1`
**Depends on:** the implementation gate, opened 2026-09-14

## Objective

Stand up the repository skeleton the other eleven Phase 0 tasks build inside:
npm workspaces, shared TypeScript configuration, a PostgreSQL 16 container for
development and tests, and a migration runner that applies ordered SQL files
and refuses to apply one twice. Nothing domain-specific. When this is done,
`npm run verify` runs and passes on an empty project, and a migration can be
written by the next task without inventing a mechanism for it.

This is **Task 1** of
[the Phase 0 plan](../../docs/superpowers/plans/2026-09-08-phase-0-foundations.md).
Work only that task. Tasks 2 through 12 belong to other agents.

## Required inputs

| Input | Path | Why |
|---|---|---|
| The plan | [docs/superpowers/plans/2026-09-08-phase-0-foundations.md](../../docs/superpowers/plans/2026-09-08-phase-0-foundations.md) | Task 1 names every file, interface, and test. Follow it rather than improvising an equivalent |
| The architecture | [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md) | Approved 2026-09-10, standing since 2026-09-14. §3.1 is single-host and loopback-only |
| Accepted decisions | [docs/decisions/](../../docs/decisions/) | Seven ADRs. ADR-001 and ADR-002 bear on this task |
| Inviolable rules | [docs/BOUNDARIES.md](../../docs/BOUNDARIES.md) | 24 of them. B-1 and B-7 are reachable from this task |
| Requirements | [docs/PRD.md](../../docs/PRD.md) | `NFR-1` (loopback), `NFR-5` (two bundles) shape the scaffold |
| Process | [.agent/WORKFLOW.md](../WORKFLOW.md) | Handoff format, ownership, what needs the owner |

Environment on this machine, already checked by the lead: Node v25.2.1,
npm 11.6.2, Docker 28.3.2. No local `psql` — the container is the database, and
anything needing a client should go through it or through `pg`.

## Constraints

- **Follow the plan's file list and interfaces.** Where the plan names a path, a
  script name, or an export, use it. The eleven tasks after this one were
  written against those names.
- **No `number` for money or rates, anywhere, ever** (`B-1`). Nothing in this
  task handles money, but the scaffold's lint or type configuration should not
  make it easy to break later.
- **The audit table will be append-only** (`B-7`, Task 3). Do not create a
  database role or grant in this task that a later task has to take away.
- **Do not edit the contract documents** — `docs/PRODUCT.md`, `docs/PRD.md`,
  `docs/ROADMAP.md`, `docs/BOUNDARIES.md`. A finding against one is raised, not
  applied.
- **Do not edit `.agent/MEMORY.md` or `.agent/ROADMAP.md`.** They are the
  lead's. Write your handoff in this file.
- **Do not edit `docs/ARCHITECTURE.md` or `docs/decisions/`.** They are the
  architect's, and they are accepted.
- **Test-first.** The plan is written as TDD tasks. A test that was written
  after the code it tests proves less than it appears to.
- **Commit only what this task covers**, on branch `agent/phase-0-foundations`,
  and never to `main`. Commit messages: ordinary prose, Conventional Commits
  form, explaining *why*.
- **The placeholder design tokens in the plan's Task 11 are superseded.** Not
  your task, but do not propagate them.

## Acceptance criteria

1. `npm run verify` passes from a clean checkout, and its output is quoted in
   your handoff. Not "should pass" — the actual output.
2. `npm run db:up` starts PostgreSQL 16 and `npm run db:migrate` applies the
   migration set in order.
3. Applying migrations twice is a no-op, proven by a test rather than by
   inspection.
4. A migration that fails leaves the database in the state it was in before it
   ran, and the runner says which file failed.
5. TypeScript compiles under the shared config with no `any` introduced by the
   scaffold itself.
6. Every file the plan's Task 1 names exists, or your handoff says why it does
   not.

## Out of scope

- Tasks 2 through 12 of the plan: money, schema, PIN, audit, throttling,
  sessions, the HTTPS server, auth routes, approval, client shells, acceptance
  tests. The scaffold makes them possible; it does not start them.
- Any domain table. Task 3 owns the schema.
- Design tokens and anything visual.
- Merging. Only the owner merges.

## Handoff

Written by `builder1`. Follow the format in
[WORKFLOW.md](../WORKFLOW.md#task-handoff-format): what was done with paths,
what was decided and on what evidence, what was found and not fixed, and what
the next agent needs and does not have. A handoff that says only "done" has
failed.
