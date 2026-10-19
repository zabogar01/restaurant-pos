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

**Written** 2026-10-19 by `architect17`. **File written:**
`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, marked `Proposed`, with the eight sections and
no SQL, code or test body. Nothing else was edited except this Handoff.

### What I read

The whole of this task file. `docs/ROADMAP.md`, `docs/PRD.md`, `docs/BOUNDARIES.md` and `docs/PRODUCT.md` in full.
`docs/ARCHITECTURE.md` in full. ADR-001 to ADR-007 in full; ADR-009 in full; ADR-010's *Decision*, *Consequences*,
*Risks* and *Not decided here*; ADR-011's Parts 1, 3 and 4, *Consequences*, *Risks* and *Not decided here* (Part 2 by
its headings and ARCHITECTURE §3.1's summary of it). `.agent/DECISIONS.md` in full, every line from 2026-10-05 onward
with care. `.agent/reviews/PHASE0-gate.md` in full. ARCH-006's summary, *Missing*, *Decided too early*, *Not wrong
today*, *Columns Task 3 must not add*, §3 (roles), §5 (money and settings), §8 and *For the owner*. ARCH-012 §8 and the
validation passage; ARCH-013 §7 and *For the owner*; ARCH-014 §10, *The Handoffs must carry forward*, *For the lead* and
*For the owner*; ARCH-015's carry-forward table (through the 012a and 012b task files, which reproduce it verbatim).
The carry-forward and Handoff passages of PHASE0-004, 006b, 007, 007b, 009b, 011c2 (the Release ruling, `:550-575`),
011d2, 012a, 012b, 013 and ARCH-016. ARCH-004's passage on the three unchecked store mutations, by search.
`.agent/reviews/DESIGN-011-back-office-audit.md` from *Shared findings* through BO-08, and the questions table, *Proposed
design slices* and Handoff. `docs/design/SCREEN-INVENTORY.md` BO-02 to BO-08, POS-03's states and M-2;
`docs/design/SITEMAP.md` §3. `.agent/reviews/RESEARCH-receipt.md` *What this means*, *Answered by the owner* and
*Proposal*. The Phase 0 plan's status banner and Definition of Done only.

Code, where a Handoff left a seam unclear: `db/migrations/0002`, `0003`, `0006`, `0007`; the exports of every module in
`apps/server/src/domain/` and `apps/server/src/http/`, with `pin.ts` and `session.ts` read where they touch the
credential version; `packages/contracts/src/errors.ts` and `routes.ts`; `packages/api-client/src/specs.ts`;
`apps/back-office/src/OfficeApp.tsx`; `apps/pos/src/menuFixtures.ts` and the 86 passages of `MenuRegion.tsx` and
`Sheets.tsx`; `docker-compose.yml`, the root `package.json`, and `db/dev.env`'s variable names only (no values printed).
I did not need the librarian: no answer in the plan rests on a library fact.

### The slices in one paragraph

**S0** housekeeping (the compose project name; the server refuses a database whose migrations differ from the files);
**S1** tables as the first back-office form, with the rail and the dense table, split server (S1a) and client (S1b, which
closes AC-35's last sentence in the harness), after consult C2; **S2** settings versions, server and BO-08, after
ADR-012 and owner questions Q3, Q5 and Q12; **S3** tender types, if the owner places FR-B7 in Phase 1 (Q4); **S4** the
catalog and its version in three parts (schema and domain, routes, BO-03 and BO-04), after ADR-012; **S5** the 86
toggle; **S6** discount presets, server and BO-07; **S7** the POS reads the catalog and an 86 reaches it within three
seconds, split server and POS client with a two-profile browser test, after consult C4 and owner question Q14; **S8**
users in three parts (staff records with kitchen and reactivation, credentials with the own-change re-stamp, BO-06 with
AC-32's first sentence in the harness), after the owner's answers to Q1 and Q7 to Q11 and consult C3; **S9** POS-03's
actor group and Release; **S10** BO-01 from design slice B. The critical path to the *Demonstrable* is
S1 → ADR-012 → S4 → S5 → S7; S8 can run beside S4 as soon as the owner answers.

### Trace table

| ROADMAP Phase 1 item | Slice |
|---|---|
| Desktop back-office navigation and dense management layouts | S1 (S1b) |
| Settings, versioned (FR-B1) | S2 |
| Categories, items, variants, modifiers, prices (FR-B4, C1–C4) | S4 |
| 86 toggle (FR-B6, C5) | S5 |
| Tables, deactivation blocked while an order is open (FR-B2, C8) | S1; the refusal itself is Phase 2's (G1, Q13) |
| Discount presets (FR-B5) | S6 |
| Users, username and password, invalidation (FR-B3) | S8 |
| Catalog-revision propagation, two-second poll (FR-C6) | S7 |
| Catalog-version handling and `CATALOG_CHANGED` (FR-C7) | S4; the POS command's rejection is Phase 2's (G2, Q13) |
| *Demonstrable* | S7 (S7b's browser test) |
| AC-12 | S7 proves the propagation and presentation; the add rejection is Phase 2's and the fire rejection Phase 3's (G3, Q13) |
| AC-31 | S4 proves the version advance and the stale-command refusal; the full criterion passes with Phase 2's add-line (G2, Q13) |
| AC-32 | S8 proves the first sentence (S8c in the browser); the second needs an open order, Phase 2 (G1, Q13) |
| FR-B7 (not in ROADMAP) | S3, if Q4 is answered as proposed |

Each item is in exactly one slice. AC-12, AC-31 and AC-32 cannot pass whole in Phase 1, which is the plan's most
consequential finding; it is stated as Q13, not assumed.

### Questions for the owner, with the proposed answers

The full reasoning is in the plan's section 8.

1. **Q1, ADR-009's three items** (S8). Own-password change requires the current password: yes. Own-PIN reset keeps the
   back-office session and requires the current password: yes. A role change increments the credential version: yes.
2. **Q2, the rate range** (nothing). Already ruled 2026-10-06: no range. BO-08 refuses only what is not representable.
   One proposal to reconsider: a 0–100 percent ceiling on both rates as a typing guard.
3. **Q3, a non-zero service charge** (S2a). Storable in Phase 1; the Pasal 8 ruling becomes an entry condition of the
   Phase 2 slice that captures a settings version.
4. **Q4, FR-B7's phase** (S3). Phase 1, with a ROADMAP bullet.
5. **Q5, currency and precision** (S2, design F). Fixed at IDR and 0, shown, never editable; FR-B1 and FR-M1 wording.
6. **Q6, PRD wording owed.** "Reactivation keeps the PIN" is needed before S8a. The half-up wording is not needed in
   Phase 1 and is recommended before Phase 2.
7. **Q7, who types a PIN the manager sets** (E2, S8b). The manager's screen, typed by whoever is at the desk; asked so the
   PIN-in-use oracle (plan §7) is accepted knowingly, and recommended for the §3.2 review list.
8. **Q8, self-deactivation or self-demotion** (S8a). Refused, so the acting manager always remains.
9. **Q9, kitchen to and from the two roles** (S8a, E2). Allowed, with a PIN (and for a manager a username and password)
   set in the same command; demotion to kitchen ends every session.
10. **Q10, reactivation and seats** (designs D, E1, F). Reactivation for tables, presets, items and categories; no seats.
11. **Q11, audit of user changes** (S8). Audit status, role and credential changes of a user; nothing else in Phase 1.
12. **Q12, the business details** (S2, design F). The research list: outlet name, address, phone, optional NPWPD, footer.
13. **Q13, ROADMAP's acceptance line** (the Definition of Done). Amend it as below.
14. **Q14, adding a real item at the POS in Phase 1** (C4, S7b). Yes, into the client stand-in; POS-02 stays fixture.

### ADRs and consults recommended

- **ADR-012, versioned configuration** (settings versions and the catalog version), `Proposed`, before S2, S4, S5, S6
  and S7. It binds Phases 2 to 4 and both clients.
- **C1**, the task-level half of ADR-012, for S2a, S4a, S5 and S6a. I recommend one architect task writes both.
- **C2, the first back-office form**, before S1a; it can be commissioned as soon as the owner accepts the plan, since it
  waits on no owner answer.
- **C3, users and credentials**, before S8, after the owner answers Q1 and Q7 to Q11.
- **C4, the POS catalog**, before S7, after Q14.
- **C5, a faster development loop**, only if S1b's measurement says so.
- **No ADR for users** (ADR-009 left the items open), and **ADR-008 is not needed** for Phase 1 (plan §7 says why).

### Stale text found elsewhere, with exact replacement wording

None of these was edited. Each is for its owner: the four product documents for the owner through the lead, ARCHITECTURE
for an architect task (ADR-012's amendments are a natural place), the design documents for the designer.

**ROADMAP (Q13, Q4, G4).** Conditional on the owner's answers.

- Phase 1, after `- Discount presets (FR-B5)`, add: *"- Tender types: create, rename and deactivate custom named
  methods alongside cash and card (FR-B7)"* (Q4).
- Phase 1, replace `- Tables, with deactivation blocked while an order is open (FR-B2, C8)` with *"- Tables: create,
  edit and deactivate (FR-B2); the refusal while a table holds an open order arrives with orders in Phase 2 (FR-C8)"*.
- Phase 1, replace ``- Catalog-version handling and `CATALOG_CHANGED` rejection (FR-C7)`` with *"- Catalog-version
  handling: every menu, option, price, availability and preset change advances the catalog version that later POS
  commands carry (FR-C7)"*.
- Phase 1, replace `**Demonstrable:** a real menu is loaded in the back office and browsable at the POS; an 86 in one
  client reaches the other within three seconds. **AC-12, AC-31, AC-32** pass here.` with *"**Demonstrable:** a real
  menu is loaded in the back office and browsable at the POS; an 86 in the back office reaches the POS within three
  seconds. AC-32's first sentence and AC-35's last sentence pass here, and AC-12 as far as the POS presents an 86:
  disabled in place, and an open selection dialog keeping its choices with Add disabled. AC-31 passes in Phase 2, with
  the first command that carries the catalog version this phase delivers."*
- Phase 1, if Q5 is answered as proposed, replace `- Settings: currency and minor-unit precision, tax rate, service
  charge rate, and business details, versioned so a rate change affects only orders opened afterwards (FR-B1)` with
  *"- Settings: tax rate, service charge rate and business details, with the installation's fixed currency and
  minor-unit precision (IDR, 0) shown, versioned so a rate change affects only orders opened afterwards (FR-B1)"*.
- Phase 2, add after `- Void a pending line; void an unfired order (FR-H2, H3)`: *"- Table deactivation refused while
  the table holds an `OPEN` order (FR-C8)"* and *"- `CATALOG_CHANGED` rejection of a command built on a stale catalog
  version, and availability revalidated when a line is added (FR-C6, C7)"*.
- Phase 2, replace `**AC-4, AC-8, AC-9, AC-10, AC-24, AC-26** pass here.` with *"**AC-4, AC-8, AC-9, AC-10, AC-24,
  AC-26, AC-31** pass here, with AC-32's second sentence and AC-12's rejection of an unavailable item when a line is
  added."*
- Phase 3, replace `- Two-second availability polling, three-second AC-12 budget (FR-C6)` with *"- Fire revalidates
  availability (FR-C6, E4)"*, and replace `**AC-1, AC-2, AC-3, AC-22, AC-23, AC-33** pass here.` with *"**AC-1, AC-2,
  AC-3, AC-12, AC-22, AC-23, AC-33** pass here; AC-12 completes with its rejection at fire."*

**PRD.**

- **FR-B1 (Q5)**, replace `Currency and minor-unit precision become immutable after the first order.` with *"This
  installation's currency and minor-unit precision are fixed at IDR and 0; the back office shows them and never offers
  to change them."*
- **FR-M1 (Q5)**, replace `Currency and minor-unit precision are configured once (2 for USD or EUR, 0 for IDR or JPY)
  and become immutable after the first order.` with *"Currency and minor-unit precision are fixed for an installation
  (2 for USD or EUR, 0 for IDR or JPY) and never change."*
- **FR-B3 (Q1, Q6a, Q8, Q9, G10)**, replace the whole requirement with *"Manage users: create, assign a role or the
  kitchen classification, set and reset PIN, set a manager's back-office username and password and reset the password,
  deactivate and reactivate. A username, once set, never changes. A reactivated user keeps their PIN unless another
  active user holds it, in which case a new PIN is set before reactivation. Deactivating a user, changing their role, or
  resetting their PIN or password, from the back office invalidates every session of that user, POS and back office, on
  its next authenticated request. The one exception is a manager who changes their own password or PIN, which requires
  their current password: the back-office session the change was made from continues, and every other session of theirs
  is invalidated. A manager cannot deactivate their own account or remove their own manager role."* Each clause stands
  or falls with its question: the role-change clause with Q1(c), the own-PIN and current-password clauses with Q1(a) and
  (b), the reactivation clause with Q6(a) (already ruled 2026-10-07), the last sentence with Q8, the classification with
  Q9. G10's username sentence needs no question: it states ADR-009 §2.
- **FR-B2 and FR-B5 (Q10)**: `Manage tables: create, edit, and deactivate.` becomes *"Manage tables: create, edit,
  deactivate and reactivate."*; `Manage discount presets: create, edit, deactivate.` becomes *"Manage discount presets:
  create, edit, deactivate and reactivate."*; FR-B4 gains *"An archived item or category may be restored."*
- **FR-J3 (Q11)**, replace `back-office reprint of a kitchen ticket (naming the actor, the order, and the round
  reprinted), and every manager-approval outcome.` with *"back-office reprint of a kitchen ticket (naming the actor, the
  order, and the round reprinted), a back-office change to a user's status, role or credentials (naming the acting
  manager and the user, and never a PIN or password), and every manager-approval outcome."*
- **§9 question 3 (G8, Q2)**: delete item 3, and add under *Closed since the first draft*: *"- **Tax and service-charge
  rates.** No permitted range is set beyond the representation: a rate is a whole number of parts per million, zero or
  more (owner, 2026-10-06)."* If the owner takes Q2's ceiling, the last clause reads *"from zero to 100 percent"* and
  FR-M5's first clause becomes *"Bounds: rate precision one part per million; tax and service-charge rates 0–100%;"*.

**ARCHITECTURE (architect-owned; not edited here, as the task says).**

- §16, delete the row `| Permitted rate range is unresolved | Settings validation cannot be finalized | Approve maximum
  tax and service-charge rates before Phase 2 | Open product decision |`.
- §19 item 1 becomes *"1. **Restaurant time zone — closed.** WIB (Asia/Jakarta, UTC+7), shown as 24-hour `HH:MM`; a
  business day runs from one end-of-day close to the next and is named by the WIB date on which it opened (PRD §9;
  owner, 2026-09-24 and 2026-10-06)."*
- §19 item 3 becomes *"3. **Maximum tax and service-charge rates — closed.** No range beyond the representation (owner,
  2026-10-06)."*
- §19 item 5 becomes *"5. **Back-office kitchen-ticket reprint audit treatment — closed.** Audited, naming the actor,
  the order and the round (ruling I-8, FR-J3); a reprinted cancellation ticket counts as a kitchen ticket (owner,
  2026-10-06)."*
- ADR-004's last consequence ("The product owner must still set maximum permitted tax and service-charge rates") is in
  an accepted ADR and is not edited; the owner's ruling answers it, and §19 records the closure.

**Design documents (designer-owned).**

- `SCREEN-INVENTORY.md` BO-08, last *Must not invent* bullet: replace `Rate precision is one part per million; the
  permitted **range** is Open Question 4 and is not yours to settle.` with *"Rate precision is one part per million. The
  owner ruled on 2026-10-06 that no permitted range beyond that representation is needed: a rate is zero or more."*
- `SCREEN-INVENTORY.md` BO-06 (G5): **Purpose** becomes *"Manage staff: create, assign a role or the kitchen
  classification, set and reset PIN, set a manager's back-office username and password and reset the password,
  deactivate."*; **States** gain *"· *a PIN or password reset of a manager ends all of that manager's sessions, POS and
  back office — said before the reset is confirmed* (FR-B3, ADR-009) · *own password change — this session continues;
  every other session of yours ends* (FR-B3)"*; **Requirements** gain FR-A2b.
- `SITEMAP.md` §3, under BO-06, add *"│   ├── [MODAL] Back-office username and password: set; reset password .. FR-B3,
  A2b"* and *"│   ├── [MODAL] Change own password — this session continues .......... FR-B3"*.

**A task file, for the record only.** PHASE0-004's line "FR-B3's audited user management is Phase 1's" (`:152`) asserts
an audit FR-J3 does not contain; it is history and needs no edit, but nobody should cite it as a requirement. Q11 is
where that is decided.

### What the lead needs to write the first task file

- **S0 can be written now**, from the plan alone. The lead's rulings it needs: the project name the compose file sets
  (`restaurant-pos` matches the container the owner already runs, `restaurant-pos-db-1`, and keeps every worktree on
  one container, which the Phase 0 race design assumes); what "differ" means (a file not applied, or an applied name
  with no file); that the check runs at startup in the process, before any socket and after the certificate check, as a
  new member of ADR-010 rule 2's closed set of fixed startup sentences; that in-process server tests that build the
  server without listening are unaffected; and that the harness's own server, started after its schema reset, is the
  check's proof against a fully migrated database.
- **S1a waits on C2.** C2 waits on nothing but the plan's acceptance, so the lead can commission it with the
  acceptance. Design E1 (BO-05 alone) can start at the same time; S1b needs it.
- **ADR-012 and C1** can be commissioned with the acceptance too; S2 needs Q3, Q5 and Q12 as well.
- **The owner's answers that unblock the most:** Q13 (the Definition of Done depends on it), Q5 and Q12 (S2), then Q1
  and Q7 to Q11 together (S8 and design E2), then Q14 (S7), Q4 (S3), Q10 (reactivation in every design slice).

DONE
