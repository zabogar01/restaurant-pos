---
id: ARCH-017
title: The Phase 1 plan (Back office and catalog), a slicing document the owner accepts before any Phase 1 task
category: arch
touches: [money, identity, audit, boundaries]
depends_on: []
owns: [docs/superpowers/plans/2026-10-*-phase-1-*.md]
status: not-started
cycles: 0
---
# ARCH-017 — The Phase 1 plan

**Written** 2026-10-19 by the lead. **Owner:** `architect17`, Claude Opus 5.5, opened by hand in its own pane.
**Branch and place:** `agent/arch-017`, cut from `development` at `82876b4`, in the worktree
`../restaurant-pos-wt/ARCH-017`. Write only the plan file named under *What to write* and this task file's Handoff.
You do not write an ADR or edit `docs/ARCHITECTURE.md` in this task: where the plan finds one is needed, it names it, and
the lead commissions it separately.

**Why this path.** WORKFLOW's planning gate says a phase does not begin without a written plan under
`docs/superpowers/plans/`. No role owns that directory in `agents.yaml`; the lead grants it to you for this one file
(this task's `owns:`). The Phase 0 plan beside it is not yours to edit.

## Why this task exists

Phase 0 (Foundations) was closed by the owner on 2026-10-19 on the gate report (`.agent/reviews/PHASE0-gate.md`).
ROADMAP says each phase needs its own plan before execution, and only Phase 0 had one.

The Phase 0 plan (`docs/superpowers/plans/2026-09-08-phase-0-foundations.md`) was written on 2026-09-08 as a build
script, with SQL and code, before ARCHITECTURE.md and the ADRs existed. It was superseded as a build script on
2026-10-12: in the end, every Phase 0 task was written from an architect consult and the previous task's Handoff, and
the plan's code was wrong wherever a consult differed (ARCH-006, ARCH-014 *For the lead* 7, ARCH-015). **Phase 1 must
not repeat that.** The owner approved this approach on 2026-10-19 ("yes, architect slicing plan and slice B"):

1. You write the Phase 1 plan as a **slicing document**, not a build script. It contains no SQL, no code and no test
   bodies. It says what Phase 1 delivers, in which slices and in what order, what each slice depends on, which slices
   need an ADR or an architect consult before their task file is written, and the Phase 1 Definition of Done.
2. The owner accepts the plan before any Phase 1 task is dispatched.
3. The lead then writes task files one at a time, each from the plan, the consult it names (if any) and the previous
   task's Handoff, as in Phase 0.
4. Beside it, a designer runs the back-office design slices: B (BO-01, BO-02) now, then D to H.

## Decided: do not reopen (`.agent/DECISIONS.md`)

- **2026-09-10:** the architecture is approved; `docs/ARCHITECTURE.md` and the accepted ADRs (001-007, 009-011) bind.
  ADR-008 (database roles and structural immutability) is reserved and deferred by the owner (2026-10-06), possibly to
  after the MVP; do not plan it into Phase 1 unless something in Phase 1 cannot be built safely without it, and then
  say so as a question.
- **2026-09-14:** the visual direction is Frost (`docs/DESIGN.md`); the sitemap, screen inventory and wireframe are the
  behavioural authority. **A screen with no reviewed Frost design gets a design task before any code** (WORKFLOW,
  design gate).
- **2026-09-24, amended 2026-10-06:** WIB, 24-hour `HH:MM`; a business day runs from one end-of-day close to the next and
  is named by the WIB date on which it opened.
- **2026-10-06:** the MVP back office signs in with a username and password; the first manager is injected by hand
  (`npm run create-manager`), with no bootstrap screen.
- **2026-10-13:** in Phase 0 the served POS shows fixture screens and approval stand-ins under a real sign-in; each
  stand-in goes when its server command arrives.
- **2026-10-14:** a different manager signing in from M-6 destroys the idled manager's draft; after the eight-hour limit
  the same manager signing in again in that tab gets their draft back.
- **2026-10-19:** ADR-011 accepted; the Phase 0 Definition of Done wording (verify from a clean checkout, then
  `test:e2e:all`; B-12 proven by scans, not a grep); ROADMAP's Phase 0 approval prompt met by the primitive; Phase 0
  closed.

Read every DECISIONS line from 2026-10-05 onward before you plan; several bind back-office behaviour.

## Not decided: the owner has not answered these (raise them; do not resolve them by architecture)

Each is a question for the owner, not a premise. Say which slice it blocks and propose an answer with reasons.

1. **ADR-009's *Not decided here*:** a manager changing their own password; a manager resetting their own PIN; changing
   a user's role. The gate report says these must be decided before the users screen (FR-B3, BO-06).
2. **PRD §9's permitted tax and service-charge range.** The PRD dates it "before Phase 2", but the Phase 1 settings
   screen stores the rates (FR-B1, BO-08). Can BO-08 ship in Phase 1 without it, and with what refusal?
3. **Service charge before a non-zero rate:** the lead's research cites Pasal 8 (`.agent/reviews/RESEARCH-receipt.md`).
   Does Phase 1 allow a non-zero service charge to be stored?
4. **FR-B7 (tender types)** is in the PRD (`docs/PRD.md:137`) but in no ROADMAP phase. Which phase, and is that a
   ROADMAP wording change for the owner?
5. **FR-B1's currency and minor-unit precision** are settings in the PRD, but the stack is IDR at precision 0
   everywhere (PRD, `packages/money`). Are they editable, displayed, or fixed in Phase 1?
6. **PRD wording owed, not drafted** (from STATE): "reactivation keeps the PIN" (FR-B3), and FR-M3/B-2's "half-up"
   below zero against the code's half away from zero (`packages/money`). Say whether Phase 1 needs either settled.

Anything else you find that the contract does not decide goes in the same list, in the same form.

## What to write

**`docs/superpowers/plans/2026-10-<DD>-phase-1-back-office-and-catalog.md`** (the day you finish), with a header saying
it is `Proposed`, awaiting the owner's acceptance, and that it is a slicing document whose task files are written one at
a time. Sections:

1. **Scope.** ROADMAP Phase 1 (`docs/ROADMAP.md:60-81`) item by item, each traced to its FR and AC in `docs/PRD.md`
   (FR-B1 to FR-B6, FR-C1 to FR-C8, the parts of FR-A that deactivation and reset touch, AC-12, AC-31, AC-32), and what
   is explicitly not Phase 1 (with the phase it belongs to). Check the ROADMAP list against the PRD and the screen
   inventory; name every gap either way.
2. **What exists to build on.** From the code and the Handoffs, not from the old plan: migrations 0001 to 0008, the
   domain modules, the route declaration and session guard, the transport core, the back-office frame and M-6, the POS on
   fixtures, the browser harness. Name the seams Phase 1 extends.
3. **The slices, in order.** For each: one-line goal; the FRs and ACs it closes; what it depends on (a slice, a consult,
   an ADR, a design slice, an owner answer); the `touches` flags it carries (`money`, `identity`, `audit`,
   `boundaries`), so the lead picks the review tier; whether it needs the browser harness; and the size you expect
   (one builder task, or a split). Slice by authority, not by component: a slice is something one task can make true and
   prove. The lead's guesses at the slices that need a consult or an ADR first, for you to confirm or reject:
   - the catalog and settings schema, with versioned settings so a rate change affects only orders opened afterwards
     (FR-B1), and how that reconciles with ARCH-006 (`.agent/reviews/ARCH-006-phase0-core-schema.md`);
   - catalog revisions: the two-second poll, the catalog version on POS commands and `CATALOG_CHANGED` (FR-C6, FR-C7,
     AC-12, AC-31), and what the POS does with an open selection dialog when an item is 86'd;
   - sessions ended on deactivation or a PIN or password reset (FR-B3, AC-32), on both surfaces;
   - the first back-office form against a real route: `VALIDATION_FAILED`'s details (ADR-011 *Not decided here*), the
     draft kept behind M-6, and whether a faster development loop is needed (ADR-011 *Not decided here*);
   - the POS catalog going from fixtures to the server (ROADMAP's "browsable at the POS"), and which fixture stand-ins go
     with it under the 2026-10-13 ruling.
4. **The design dependencies.** Which back-office screens each slice needs (BO-03 to BO-08), which design slice draws
   each (DESIGN-011's slices D, E, F; `.agent/reviews/DESIGN-011-back-office-audit.md:452-470`), and the order the
   designer must deliver them in for the build not to wait. Slice B (BO-01, BO-02) is running now as DESIGN-016; slices C
   and I (BO-13, BO-12) are drawn but belong to later phases. Say whether BO-02 Today has any Phase 1 content or stays the
   Phase 0 frame until the business day exists (Phase 4/5).
5. **Carry-forwards placed.** Every item the Phase 0 Handoffs and consults left for Phase 1, each assigned to a slice or
   explicitly deferred with a reason. At least: AC-32's POS half and AC-35's last sentence close in the browser harness;
   the harness's standing rules (ADR-011 rules 27-28; 012a and 012b Handoffs) bind every Phase 1 browser test;
   `VALIDATION_FAILED` details; the users screen's warning that a PIN or password reset ends all that manager's sessions
   (ADR-009); the queued POS gap (POS-03's actor group and Release, `docs/design/visual-directions/frost/pos/order.html:77`,
   left out of PHASE0-011c2, its task file `:560-566`); the three store line mutations that rely on the screen not offering them under a lock (ARCH-004);
   the compose file's missing project `name:`; no schema check at startup. Phase 2 items (AC-27's second sentence,
   AC-19's approval class, M-1 for real, the idempotency design) stay Phase 2; say if any must move earlier.
6. **The Phase 1 Definition of Done**, in the form of the Phase 0 plan's (`:3752-3761`, as amended): each line checkable
   by a passing test or a compiler check, not by inspection; ROADMAP's *Demonstrable* line ("a real menu is loaded in the
   back office and browsable at the POS; an 86 in one client reaches the other within three seconds"); AC-12, AC-31,
   AC-32; `verify` from a clean checkout then `test:e2e:all`; and any boundary a Phase 1 slice could weaken (at least
   B-1 money, B-7 audit append-only, B-12 no credential in a log, B-13 a named actor) proven still holding.
7. **ADRs and consults needed.** A list: for each, the question, why it cannot be settled in a task file, which slice
   waits on it, and whether it is an ADR (binding, owner-accepted) or a consult (an architect's report the lead turns
   into task files). Recommend; do not write them.
8. **Questions for the owner.** The six above and any you add, each with the slice it blocks and your proposed answer.

## Read

- `docs/ROADMAP.md` Phase 1 (`:60-81`) and the phases either side; `docs/PRD.md` §2, §3 A to C, §4, §5, §7 (AC-12,
  AC-27, AC-28, AC-31, AC-32, AC-35), §9; `docs/BOUNDARIES.md` in full; `docs/PRODUCT.md` for the manager's job.
- `docs/ARCHITECTURE.md` in full; ADR-001 to ADR-007 and ADR-009 to ADR-011 in `docs/decisions/`.
- `.agent/reviews/PHASE0-gate.md`; the consults `.agent/reviews/ARCH-006-phase0-core-schema.md`, `ARCH-012` to
  `ARCH-015`; the *must carry forward* sections and Handoffs of ARCH-012 to ARCH-016 and PHASE0-005 to PHASE0-013 in
  `.agent/tasks/` (look for *For Phase 1*, *For Phase 1's first form*, *What the next agent needs*).
- `.agent/reviews/DESIGN-011-back-office-audit.md` (the BO-03 to BO-08 sections, *Proposed design slices*, the questions
  table and which are ruled in DECISIONS); `docs/design/SCREEN-INVENTORY.md` BO-01 to BO-08 and POS-03's menu grid;
  `docs/design/SITEMAP.md` for the back office.
- The code where a Handoff leaves a seam unclear: `db/migrations/`, `apps/server/src/domain/`, `apps/server/src/http/`,
  `packages/contracts/src/`, `packages/api-client/src/`, `apps/back-office/src/`, the POS's catalog fixtures and store
  in `apps/pos/src/`, `e2e/`.
- The Phase 0 plan, for its Definition of Done's form only; its code and SQL are superseded.
- **Never print `db/dev.env`'s values.** If you need to know what it holds, list its variable names only.
- For a library fact (Fastify, PostgreSQL, Playwright), ask `.agent/bin/ask.sh librarian "<question>"`; do not recall.

## Acceptance criteria

1. The plan exists at the path above, marked `Proposed`, with the eight sections; it contains no SQL, no code and no test
   body. Red if any section is missing or the plan prescribes an implementation a consult should decide.
2. Every ROADMAP Phase 1 bullet, and AC-12, AC-31 and AC-32, is assigned to exactly one slice (or, for an AC, to the
   slice that proves it), and the Handoff includes the trace table. Red if one is unassigned or assigned twice.
3. Every slice names its dependencies, its `touches` flags, and whether it needs a consult or an ADR first. Each slice
   carrying `money`, `identity`, `audit` or `boundaries` names a consult, or says why one is not needed.
4. Every Phase 0 carry-forward listed under *What to write* 5 is placed or deferred with a reason.
5. Each Definition of Done line names the test or check that proves it, or the slice whose task must add one.
6. Nothing in the plan contradicts the contract (PRODUCT, PRD, ROADMAP, BOUNDARIES), an accepted ADR or a DECISIONS
   line. Where you think the contract is wrong or silent, the Handoff gives exact replacement wording; the plan states
   the question and does not assume the answer.
7. `git diff --name-only development` shows only the plan file and this task file. `git diff --check` is clean.

## Out of scope

- Writing any ADR or consult, or editing `docs/ARCHITECTURE.md` (commissioned separately once the plan is accepted).
- Task files (the lead's), design work (the designer's), and any code.
- Phases 2 to 6 beyond naming what Phase 1 leaves for them.
- ADR-008, unless Phase 1 cannot be built safely without it (then a question, not a plan item).

## Commit and report

Commit on `agent/arch-017` only, after `git diff --check` is clean, and never push. Write the Handoff below in full
prose: what you read, the slice list in one paragraph, the trace table, the questions for the owner with your proposed
answers, the ADRs and consults you recommend, anything stale you found elsewhere with exact replacement wording, and what
the lead needs to write the first task file. End with `DONE` or `BLOCKED: <one question>`. Then run exactly one of:

    herdr agent prompt lead "architect17: ARCH-017 done — <one line>"
    herdr agent prompt lead "architect17: BLOCKED — <question>"

## Handoff
