# FE-001 — POS shell and lock screen

**Status:** Active
**Owner:** `builder3`
**Depends on:** [PHASE0-001](PHASE0-001-monorepo-postgres-migrations.md) (the workspace root)

## Why this task exists, and why it is this small

The owner has re-sequenced the work: **frontend first, reviewed by the owner,
and only then the backend behind it.** The Phase 0 plan is written
backend-first — ten server tasks, then the clients — and that order is now
suspended rather than followed. See the sequencing note in
[ROADMAP.md](../ROADMAP.md).

The second instruction matters as much: **tasks are to be small enough to
finish inside one session with room to spare, and the owner reviews between
them.** A task that runs out of context halfway leaves a half-built screen and
a handoff nobody can trust. This task is deliberately one screen.

So: the smallest thing that is genuinely reviewable. A POS bundle that builds
and runs, the Frost tokens wired in, and one screen — the lock screen — drawn
at its real device target with its real touch sizes. If the design system does
not survive contact with real code, this is where we find out, before anything
larger is built on top of it.

## Objective

`apps/pos` builds and serves a POS client at **1280×800 landscape** showing the
lock screen, styled from the Frost tokens, with the PIN pad at the sizes
`docs/DESIGN.md` states. The owner can open it in a browser and judge it.
Nothing behind it is real: no server call, no session, no PIN verification.

## Required inputs

| Input | Path | What it gives you |
|---|---|---|
| Visual authority | [docs/DESIGN.md](../../docs/DESIGN.md) | Frost as values. 169 tokens, each with the file and line it came from |
| The tokens | `docs/design/tokens/frost.css`, `frost.tokens.json` | CSS custom properties. **Import them; do not retype them** |
| The screen, styled | `docs/design/visual-directions/frost/pos/lock.html` | What it should look like. Open it in a browser first |
| The screen, specified | [docs/design/SCREEN-INVENTORY.md](../../docs/design/SCREEN-INVENTORY.md) POS-01 | Every state that must exist and what each one means |
| Structure | [docs/design/SITEMAP.md](../../docs/design/SITEMAP.md) | Where this screen sits and what it may reach |
| Requirements | [docs/PRD.md](../../docs/PRD.md) `FR-A1`–`FR-A5`, `FR-E3b` | Identity, throttling, and the pre-authentication incident indicator |
| Inviolable rules | [docs/BOUNDARIES.md](../../docs/BOUNDARIES.md) | `B-12` especially — a PIN never reaches a log, an audit row, or an error message |
| The plan's Task 11 | [the Phase 0 plan](../../docs/superpowers/plans/2026-09-08-phase-0-foundations.md) | Names `apps/pos/{package.json,vite.config.ts,index.html}` and `src/{main.tsx,App.tsx,PinPad.tsx}`. Use those paths; its **token values are superseded** by `docs/DESIGN.md` |

## What to build

- **`apps/pos`** — a Vite + React + TypeScript bundle in the existing npm
  workspace, at the plan's paths, with a `dev` script the owner can run.
- **`packages/tokens`** — the Frost custom properties made importable by both
  clients. Generate or re-export from `docs/design/tokens/frost.css`; do not
  hand-copy values, because a hand-copied token drifts and the registry exists
  precisely so it cannot.
- **The lock screen**, at 1280×800, including:
  - the PIN pad at its stated touch sizes — **88px keys, 3 columns**, from
    `docs/DESIGN.md`, not from your judgement of what looks right;
  - the entry display that shows *how many digits have been entered* and never
    the digits themselves;
  - the **unresolved kitchen incident indicator** (`FR-E3b`), which must be
    unmissable while revealing nothing about any order — the reason it exists
    is that the screen faces a room;
  - the states POS-01 declares, driven by a fixture or a query string as the
    wireframe does, so the owner can walk them without a server.

## Constraints

- **Fixtures only. No network call, no session, no PIN verification, no
  throttling logic.** Those are real behaviour with boundaries attached and
  they are not this task. A PIN typed here is compared against nothing.
- **`B-12`: a PIN never reaches a log, an error message, or a stored value** —
  including `console.log` in a mock, including React state you dump while
  debugging. The habit is what matters; the habit is what survives into Task 9.
- **No invented design values.** Every colour, size, weight and space comes
  from `docs/DESIGN.md` or its registry.
- **The pressed / active touch state is a known gap** — Frost does not contain
  one, it is tracked as `A7`, and the PIN pad is exactly where its absence
  hurts. If the screen needs one to be usable, **use a treatment already
  sourced in the registry, mark it provisional in a code comment and in your
  handoff, and tell me.** Do not mint a new colour.
- **Do not touch `apps/server`, `db/`, or anything backend.** Do not start the
  back office.
- **Do not touch the worktree at `../restaurant-pos-design`.** A designer is
  working there.
- **Do not edit** the contract documents, `docs/ARCHITECTURE.md`,
  `docs/decisions/`, `docs/DESIGN.md`, `.agent/MEMORY.md`, or
  `.agent/ROADMAP.md`.
- **Branch `agent/phase-0-foundations`.** Never `main`.
- **Stop when the screen is reviewable.** If you find yourself starting a
  second screen, the task has ended and the rest is mine to assign.

## Acceptance criteria

1. `npm run dev -w apps/pos` serves the lock screen, and your handoff states
   the exact command and URL the owner should open.
2. `npm run verify` still passes — including Task 1's migration tests and
   whatever `builder2` lands for money — and its verbatim output is in your
   handoff.
3. The PIN pad's keys measure 88px at the stated grid, verified by measuring
   the rendered page rather than by reading the CSS.
4. No PIN digit appears in any log, any DOM attribute, or any error path.
   Say how you checked.
5. Every value used traces to `docs/DESIGN.md` or the token registry, except
   anything you flagged as provisional under the pressed-state gap.
6. The screen renders correctly at 1280×800 and you say what you inspected it
   in.

## Out of scope

- The back-office client. The order workspace. Every other screen.
- Authentication, sessions, session expiry (`FR-A2`), throttling (`FR-A5`),
  and the manager approval prompt. All real behaviour, all later.
- Server routes, database work, and the remaining Phase 0 backend tasks.
- A dark palette, a pressed state designed from scratch, and the other `A7`
  gaps.

## Handoff

Written by `builder3`. What was built with paths, what was decided and on what
evidence, what was found and not fixed, what the next implementer needs, the
verbatim verification output, and **the exact command the owner runs to see
it**. A handoff that says only "done" has failed.
