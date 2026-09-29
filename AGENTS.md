# AGENTS.md

Shared rules for every agent in this repository, on every CLI: Claude Code,
Codex and OpenCode. Claude agents read this through `@AGENTS.md` in
[CLAUDE.md](CLAUDE.md), which adds what is specific to the lead.

Restaurant POS: two client applications (a touch-first POS and a desktop back
office) against one server, one database and one transaction boundary. The
MVP runs on the owner's local machine only.

## What exists

- `apps/pos` — the POS client (React, Vite). POS-01 lock, POS-02 floor,
  POS-03 order workspace, POS-04 settlement and POS-07 print incidents are
  built against fixtures and a client order store. POS-05, POS-06 and the
  back office are not built yet.
- `apps/server` — Fastify skeleton: a connection pool, a migration runner and
  one migration. No schema, API or auth yet (Phase 0 tasks 3–12 are paused).
- `packages/money` (exact monetary arithmetic) and `packages/tokens` (Frost
  design tokens). `db/migrations`.
- Stack: TypeScript, Node ≥ 22, Fastify, React, Vite, PostgreSQL 16 (Docker,
  `127.0.0.1:5433`). Currency IDR at minor-unit precision 0.

**Commands:** `npm install` · `npm run db:up` · `npm run db:migrate` ·
`npm run dev -w apps/pos` · `npm run verify` (typecheck + unit tests; the
server's migration tests need `db:up` first).

## Agent base

These apply to every role unless its role prompt says otherwise.

- **Herdr** is the switchboard between agent panes. Use the `herdr` skill to
  coordinate. It stores nothing: anything that must survive a closed pane
  goes in a file.
- **Report to the lead through Herdr** when you finish or block:
  `herdr agent prompt lead "<your name>: <task> done — <one line>"` or
  `herdr agent prompt lead "<your name>: BLOCKED — <question>"`.
- **Caveman style is for chat and status pings only.** Every file another
  agent or the owner reads is full prose: task files, Handoffs, reviews,
  specs, ADRs, STATE and DECISIONS. Architect, designer and reviewer write
  full prose in chat too, and so does any agent on an `arch` or `logic` task
  or one touching money, audit, identity or boundaries (`caveman_off_when`
  in agents.yaml).
- Roles, models and owned paths are in [.agent/agents.yaml](.agent/agents.yaml);
  each role's prompt is in `.agent/roles/<role>.md`.

## Orient before acting

**Workers** (builder, reviewer, designer or architect on a dispatched task)
read **their task file only**, plus the documents it cites. Do not read
`.agent/STATE.md`, `.agent/QUEUE.md` or `.agent/journal/`. If something you
need is not in the task file, the task file is incomplete: write
`BLOCKED: <question>` in your Handoff rather than going looking.

**The lead** orients from [.agent/STATE.md](.agent/STATE.md), then
[.agent/QUEUE.md](.agent/QUEUE.md). [.agent/WORKFLOW.md](.agent/WORKFLOW.md)
holds the roles, gates, dispatch loop and handoff format.

Owner rulings are recorded one per line in
[.agent/DECISIONS.md](.agent/DECISIONS.md). A ruling that is not there is not
decided, however settled it sounded in conversation.

## Read further only when it applies

| When | Read |
|---|---|
| Any task touching behavior, money, identity, or audit | [docs/BOUNDARIES.md](docs/BOUNDARIES.md) — 24 inviolable rules |
| Requirements, acceptance criteria | [docs/PRD.md](docs/PRD.md) |
| Purpose, users, principles | [docs/PRODUCT.md](docs/PRODUCT.md) |
| Phases, sequencing, deferred work | [docs/ROADMAP.md](docs/ROADMAP.md) |
| Technical structure, trade-offs | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the accepted ADRs in [docs/decisions/](docs/decisions/) |
| Visual system, tokens | [docs/DESIGN.md](docs/DESIGN.md) (Frost) |
| Screens, states, navigation | [docs/design/SITEMAP.md](docs/design/SITEMAP.md), [docs/design/SCREEN-INVENTORY.md](docs/design/SCREEN-INVENTORY.md) |
| Phase 0 backend | [docs/superpowers/plans/2026-09-08-phase-0-foundations.md](docs/superpowers/plans/2026-09-08-phase-0-foundations.md) |

## Ownership

One role owns a file; the exact globs are `owns:` in
[agents.yaml](.agent/agents.yaml). Need a change elsewhere? Ask its owner.

- **Lead:** `.agent/` memory, task files (all but each Handoff), the kit, this
  file and CLAUDE.md. The lead **drafts** changes to the four product
  documents; only the owner approves them.
- **Architect** (Claude Opus 5.5): `docs/ARCHITECTURE*.md`, `docs/decisions/`.
- **Designer** (Codex `gpt-6-astra`): `docs/design/`, `docs/DESIGN.md`.
- **Builder:** source, tests and root build files, plus the **Handoff** of its
  own task file — nothing else.
- **Reviewer** (always the other model family from the builder): its review
  report only. A review is evidence; what it means is the lead's call.

A Handoff tells the next agent what you did and why, what you found and did
not fix, and what they need but do not have. "Done" is not a Handoff.

## Architecture and contract

**Architecture.** `docs/ARCHITECTURE.md` and seven accepted ADRs are binding.
`docs/ARCHITECTURE_PROPOSAL.md` is kept under a superseded banner as history.
A new ADR starts as `Proposed`; only the owner accepts it. Never edit an
accepted ADR; supersede it with a new one.

**Contract.** `docs/PRODUCT.md`, `docs/PRD.md`, `docs/ROADMAP.md` and
`docs/BOUNDARIES.md` change only by the owner's decision. An agent that finds
a genuine problem raises it and proposes exact replacement wording. It never
edits and reports afterwards.

A boundary is not subject to agent judgement. If a task appears to require
breaking one, the task is wrong: stop and raise it.

## Repository rules

- The integration branch is `development`. Agent branches are
  `agent/<task>`, cut from `development`. Never commit to `main` or
  `development`. Only the owner merges.
- **Commits:** a dispatch counts as asking. Workers commit only on their own
  `agent/<task>` branch, only after verify is green, and never push.
- Conventional Commits, ordinary prose, explaining *why*.
- Never report a check as passing without running it and reading the output.
  Name anything you skipped.
