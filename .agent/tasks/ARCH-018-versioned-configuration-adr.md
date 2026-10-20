---
id: ARCH-018
title: ADR-012 (versioned configuration — settings versions and the catalog version), with consult C1 and the owed ARCHITECTURE closures
category: arch
touches: [money, boundaries]
depends_on: []
owns: [docs/decisions/ADR-012-*.md, docs/ARCHITECTURE.md, docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md, .agent/reviews/ARCH-018-*.md]
status: not-started
cycles: 0
---
# ARCH-018 — ADR-012: versioned configuration, with consult C1

**Written** 2026-10-20 by the lead. **Owner:** `architect18`, Claude Opus 5.5, opened by hand in its own pane.
**Branch and place:** `agent/arch-018`, cut from `development` at `ffe0bb2`, in the worktree
`../restaurant-pos-wt/ARCH-018`. Write only the files in `owns` and this task file's Handoff.

## Why this task exists

The owner accepted the Phase 1 plan on 2026-10-20
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, DECISIONS 2026-10-20). Its section 7 names
**ADR-012** as the one ADR Phase 1 needs, and **C1** as its task-level half, and recommends that one architect task
write both, "C1 marked as not binding, as ARCH-006 wrote migrations for a task file". Slices S2, S4, S5, S6 and S7 wait
on ADR-012's acceptance; S2a, S4a, S5 and S6a take their schema rules, refusals and test cases from C1. Read the plan's
section 7 row for ADR-012 and C1 word for word: it is your question list.

A second architect is writing **C2** (the first back-office form, ARCH-019) at the same time. C2 owns the route shape,
`VALIDATION_FAILED`'s details, what a configuration command answers and the table lock. Where ADR-012 needs one of
those, say what it needs and cite C2 as the place it is settled; do not decide it.

## Decided: do not reopen

Everything in `.agent/DECISIONS.md` binds; read every line from 2026-10-05 onward, and all of 2026-10-20. The ones that
shape this ADR, as the owner ruled them on 2026-10-20 (these **override the plan's text** where the plan predates them):

- **Q2, the rate range.** Tax and service-charge rates are bounded **from zero to 100 percent**, as a typing guard,
  besides the representational refusals (a whole number of parts per million, not negative). This replaces the
  2026-10-06 "no range" line. The plan's S2 and its C1 row still say "no business ceiling": they are stale on this point.
  PRD FR-M5 now reads "tax and service-charge rates 0–100%", and PRD §9 lists the question as closed.
- **Q3.** A non-zero service charge may be stored in Phase 1. The owner's ruling on Pergub 35/2024 Pasal 8 (which puts a
  service charge inside the PBJT base) becomes an **entry condition of the Phase 2 slice that captures the settings
  version when an order opens**. Say so in the ADR's consequences; do not decide Pasal 8.
- **Q5.** The installation's currency and minor-unit precision are **fixed at IDR and 0**; the back office shows them and
  never offers to change them; the clients stay IDR-specific. PRD FR-B1 and FR-M1 now say so. Decide whether they are
  stored in the settings version at all, or are installation constants, and say why.
- **Q12.** A settings version holds these business details: **outlet name, address and phone, an optional NPWPD, and a
  footer line**, all typed by the manager and none seeded. The rest of PRD §9 question 1 stays open for Phase 4.
- **Q10.** Tables, discount presets, items and categories may be **reactivated (restored)**. Say whether a restore
  advances the catalog version (it changes what the POS may offer).
- **Q13.** No Phase 1 POS command carries the catalog version; `CATALOG_CHANGED` passes in Phase 2 with add-line (AC-31).
  ADR-010 rule 1: "a code enters that list in the task that first emits it and tests it". So whether a **back-office**
  catalog command is version-checked, and with which code, is yours (plan G2, ARCHITECTURE §17.9); if none in Phase 1
  emits `CATALOG_CHANGED`, say which task first will.
- **Q14.** In Phase 1 a cashier may add a real menu item to the POS's client order stand-in; nothing is stored. The
  version the POS keeps for Phase 2 is C4's, later; ADR-012 says only what a POS command will carry.
- **B-24:** no seeded settings row and no seeded catalog; an empty catalog is the starting state.
- **ADR-008 stays deferred** (owner, 2026-10-06); the plan's section 7 explains why Phase 1 does not need it.

## What to write

1. **`docs/decisions/ADR-012-versioned-configuration.md`**, status `Proposed`, in the form of ADR-009 to ADR-011. It
   answers the plan's ADR-012 row: settings (an append-only version per change; how the current one is identified,
   given ARCH-006 §5's finding that a key and a timestamp cannot order two versions made in one transaction; whether
   every settings change or only a rate change makes a version, given that a receipt prints the business fields of the
   version the order opened under, ARCHITECTURE §5.2; the calculation-policy version's value; currency and precision
   under Q5; the 0–100% bound under Q2) and catalog (one counter or two, since FR-C7's list omits availability while
   ARCHITECTURE §5.1 includes it and §4.3 polls it; global or per record; what a later POS command carries; whether
   back-office catalog commands are version-checked and with which code; the coordination row and its place in the lock
   order for Phase 2's add, Phase 3's fire, Phase 4's quick-sale close and 86-versus-lease, ARCHITECTURE §8). Each
   decision with the alternatives considered and why rejected. A *Not decided here* section for what it leaves to C2,
   C4 or a later phase.
2. **The ARCHITECTURE.md amendments the ADR needs**, made in this branch so they are accepted with it (as ADR-010 and
   ADR-011 were), plus the closures the owner has already ruled, in the wording ARCH-017's Handoff drafted
   (`.agent/tasks/ARCH-017-phase-1-plan.md`, *Stale text found elsewhere*, ARCHITECTURE), adjusted for Q2:
   - §16: delete the row "Permitted rate range is unresolved".
   - §19 item 1 (time zone, closed), item 3 (rates, closed — **with the 0–100% bound**, owner 2026-10-06 and
     2026-10-20, not "no range"), item 5 (back-office reprint audit, closed), as drafted.
   - ADR-004's last consequence stays unedited (accepted ADRs are never edited); §19 records the closure.
   List every amendment in the ADR's *Consequences* so the owner accepts them together.
3. **`.agent/reviews/ARCH-018-c1-configuration-schema.md`**, consult C1, headed **not binding**: for S2a, S4a, S5 and
   S6a, the tables and columns (types, nullability, keys, checks), the grants in each creating migration (the settings
   versions get `SELECT` and `INSERT` only), the domain functions and their refusals, the test cases each task must
   carry with the red proof for each, and how each reconciles with ARCH-006 §5 and the privilege-equality test. SQL
   sketches are allowed here, marked as sketches for a builder to verify; not code a builder pastes. Name the tests
   expected to change in each slice. Respect FR-C1 to FR-C4 (single-select variants with a signed delta; multi-select
   modifiers with a non-negative delta; no nested groups; no stock link) and FR-M5's bounds.
4. **The plan's header**: change `Status: Proposed, 2026-10-19` to say it was accepted by the owner on 2026-10-20 with
   the answers in DECISIONS, and that where an ADR, consult or DECISIONS line differs, they win. Change nothing else in
   the plan; its stale "no range" lines are superseded by DECISIONS and by this ADR, which say so.

## Read

- The plan in full; ARCH-017's Handoff (`.agent/tasks/ARCH-017-phase-1-plan.md`).
- `docs/ARCHITECTURE.md` in full, especially §4.3, §5, §8, §13, §16, §17.9, §19; ADR-003 (versioned commands), ADR-004
  (monetary policy), ADR-010 and ADR-011; ADR-001, 002, 005, 006, 007 and 009 as they bear.
- `docs/PRD.md` §3 B and C, §4 (FR-M1 to FR-M5), §7 (AC-12, AC-31), §9; `docs/BOUNDARIES.md` in full (B-1, B-8, B-9,
  B-17, B-24 at least).
- `.agent/reviews/ARCH-006-phase0-core-schema.md` (§5 especially); `db/migrations/`; `apps/server/test/schema.test.ts`
  (the privilege map) and `harness-race.test.ts` (the table list); `packages/money` (`Rate`, `rateFromPercent`).
- `.agent/reviews/RESEARCH-receipt.md` *Proposal* (the business details) and the DESIGN-011 audit's BO-03, BO-04, BO-07,
  BO-08 sections (`.agent/reviews/DESIGN-011-back-office-audit.md`).
- **Never print `db/dev.env`'s values.** For a library fact, `.agent/bin/ask.sh librarian "<question>"`; do not recall.

## Acceptance criteria

1. ADR-012 exists, `Proposed`, answers every question in the plan's ADR-012 row or names where it is answered (C2, C4, a
   later phase), each with alternatives and reasons. Red if a question in the row is silently skipped.
2. It is consistent with the 2026-10-20 rulings above: the 0–100% bound, a storable non-zero service charge with Pasal 8
   as a Phase 2 entry condition, IDR and 0 fixed, the five business details, restorable records. Red if it assumes
   "no range" or an editable currency.
3. Nothing contradicts the contract, an accepted ADR or a DECISIONS line; where you think one is wrong or silent, the
   Handoff gives exact replacement wording and the ADR states the question without assuming the answer.
4. The ARCHITECTURE amendments are made and listed in the ADR's *Consequences*; no accepted ADR is edited.
5. C1 is marked not binding and gives each of S2a, S4a, S5 and S6a its schema rules, grants, refusals, test cases with
   red proofs, and tests expected to change.
6. `git diff --name-only development` shows only the files in `owns` and this task file; `git diff --check` is clean.

## Out of scope

- C2's questions (route shape, `VALIDATION_FAILED` details, command answers, the table lock); C3 (users) and C4 (the POS
  catalog), which are commissioned later.
- Any code, migration or test; task files (the lead's); design work (the designer's); the contract documents.

## Commit and report

Commit on `agent/arch-018` only, after `git diff --check` is clean, and never push. Write the Handoff below in full
prose: what you decided and why, the ARCHITECTURE amendments, what C1 gives each slice, the questions for the owner (if
any) with proposed answers, and anything stale you found with exact replacement wording. End with `DONE` or
`BLOCKED: <one question>`. Then run exactly one of:

    herdr agent prompt lead "architect18: ARCH-018 done — <one line>"
    herdr agent prompt lead "architect18: BLOCKED — <question>"

## Handoff

**Written** 2026-10-20 by `architect18`. **Files written:** `docs/decisions/ADR-012-versioned-configuration.md`
(`Status: Proposed`); `docs/ARCHITECTURE.md` (the amendments below); `.agent/reviews/ARCH-018-c1-configuration-schema.md`
(consult C1, headed not binding); the plan's status banner. Nothing else, apart from this Handoff.

### What I read

This task file; the plan in full; ARCH-017's Handoff; `docs/ARCHITECTURE.md` in full; ADR-002, ADR-003 and ADR-004 in
full; ADR-010's rule 1, *Consequences* and *Not decided here*; ADR-011's opening, *Consequences* and *Not decided here*,
and its headings; ADR-009's headings. `.agent/DECISIONS.md` from 2026-10-05 to the end. PRD §3 B and C, §4, §7, §9;
ROADMAP Phases 1 and 2 (as applied on 2026-10-20); BOUNDARIES in full. ARCH-006 §3 (later tables), §5, §7, the schema
test list and its rules. `db/migrations/0001`, `0002`, `0004`, `0007`; `schema.test.ts` (the privilege map and case
list), `harness-race.test.ts`, the throttle concurrency tests; `packages/money/src/index.ts`; `packages/contracts/src/
errors.ts`; both clients' `realSession.ts` code maps by search. RESEARCH-receipt's *Proposal*; DESIGN-011's BO-03,
BO-04, BO-07, BO-08 and its questions table; SCREEN-INVENTORY BO-03, BO-04, BO-07, BO-08. The librarian answered five
PostgreSQL 16 questions (the privilege `FOR UPDATE` and `FOR SHARE` need; the row-lock conflict table; a concurrent
duplicate key waiting then failing 23505, confirmed from source; `REPEATABLE READ` taking one snapshot; and whether a
schema drop fires a `TRUNCATE` trigger, which the docs do not say and the existing `audit_entry` trigger shows it does
not). I did not print `db/dev.env`.

### What I decided, and why

**Settings (ADR-012 Part 1).** One append-only table; every change, rate or business detail, writes a whole new
version, with `SELECT` and `INSERT` only and a trigger against `UPDATE`, `DELETE` and `TRUNCATE`. The current version is
the one with the highest number; the number is the primary key, assigned by the server as current plus one, which is what
refuses a concurrent duplicate and answers ARCH-006 §5's ordering problem without a timestamp, a flag or a pointer row.
The settings command carries the version it was built on and is refused with a new code, `SETTINGS_CHANGED` (409, no
details), when stale; the code enters the contracts in S2a. An identical submission writes nothing. A receipt's
business fields come from the settings version its order captured, which is why every change makes a version.
**Currency and precision are installation constants, not stored** (Q5): a column that can hold one value records
nothing, and the "immutable after the first order" mechanism goes away. The calculation-policy version is stored, pinned
to 1 by a database check, written by the server only; a policy 2 then needs a migration, which is where its effect on
open orders must be decided. Rates are ppm in `bigint`, checked 0 to 1,000,000 (Q2), and cross the wire as canonical
integer strings, never JSON numbers. The five business details per Q12; no text that reaches paper may hold a control
character, because ESC/POS reads them as printer commands (a finding, applied to every catalog name too).

**Catalog (ADR-012 Part 2).** **One global version** on **one seeded coordination row** (`catalog_revision`, version
0), which is both the number the POS polls and commands carry and the §8 lock point. Every committed catalog write
advances it by one, **availability, archive and restore included** (Q10; ROADMAP Phase 1 as applied says availability
advances "the catalog version that later POS commands carry"). A read that reports the version reads it in the same
snapshot as the contents; otherwise a POS could pair old prices with a current version, which is exactly what FR-C7
forbids. A Phase 2 POS command built on catalog contents (add-line, preset apply) carries that one integer; fire and
quick-sale close carry none and recheck availability. **Back-office catalog edits are version-checked with
`CATALOG_CHANGED`**; state commands (86, archive, restore, deactivate, reactivate) and creates are not, so an urgent 86 is
never refused for an unrelated edit. `CATALOG_CHANGED` therefore enters the contracts in **S4b**, its first emitter,
before Phase 2's add-line reuses it. Lock order: the catalog row first, `FOR UPDATE` by every catalog command, `FOR
SHARE` (never `FOR KEY SHARE`) by add-line, preset apply, fire, quick-sale lease acquisition and quick-sale close; then
business day, order, lease, receipt series. 86-versus-lease is sound because quick-sale lease acquisition takes the
shared lock, so Phase 4 adds a check to S5's command without reordering it.

The one choice I weighed hardest was one counter against two (a content version for commands and a revision for the
poll). Two would spare a cashier the up-to-two-second window in which an unrelated 86 refuses an add; I chose one because
the contract as applied on 2026-10-20 makes availability part of the version commands carry, and the refusal costs a
refresh and a tap. The ADR records the alternative, and if the owner prefers it the change is a ROADMAP wording change.

### The ARCHITECTURE amendments (to be accepted with the ADR)

§4.3 (one number, availability included, snapshot reads, back-office edits carry it); §5.1 (SettingsVersion, CatalogRevision,
Variant and Modifier rows); §5.2 (the Receipt's business fields from the order's version; currency and precision fixed and
not stored); §8 (lock modes and the commands that take them, quick-sale lease acquisition, settings needing no lock; the
constraint list); §13 (what carries which version, rates as ppm strings, `SETTINGS_CHANGED`); §16 (the rate-range row
deleted); §19 items 1, 3 (with the 0–100 percent bound) and 5 closed in ARCH-017's wording adjusted for Q2, and the
section's opening sentence. §18's row is added on acceptance, as for ADR-011. ADR-004 is not edited; §19 records the
closure of its last consequence. All are listed in the ADR's *Consequences*.

### What C1 gives each slice

- **S2a:** the `settings_version` table (sketch), its column-level `INSERT` and `SELECT` grants and the trigger, the
  domain (`readCurrentSettings`, `saveSettings` with the stale and concurrent refusals and the unchanged case), the rate
  codec `packages/money` lacks, 22 test cases with red proofs, and a reconciliation table against ARCH-006 §5.
- **S4a:** `catalog_revision` (seeded, singleton, `UPDATE (version)` only, an optional monotonic trigger), the four
  catalog tables with checks and column-level `UPDATE` grants, one `catalogWrite` helper so no command can forget the
  lock, check or advance, the command table with which carry a version, and 19 test cases, including the lock-read test
  in the pattern of `throttle.test.ts` case 13 and a snapshot-read test.
- **S5:** the two explicit commands, the Phase 4 lock note to carry verbatim, and six cases, including that an 86 waits
  for a `FOR SHARE` holder and that an edit built before an 86 is refused.
- **S6a:** `discount_preset` with a kind–value check, its grants, the four commands and seven cases.
- Each slice names the tests expected to change (the privilege map, `MIGRATED_TABLES`, the route-table and access tests,
  both clients' code maps when a code is added).

### For the lead to decide (not the owner's, unless the lead judges otherwise)

1. **Is the footer line required?** The Q12 ruling marks only the NPWPD as optional, so ADR-012 rule 8 and C1 make the
   other four required. *Proposed:* keep that reading. If the footer should be optional, it is a one-column change in
   S2a and a sentence in rule 8 before acceptance.
2. **`created_by` on a settings version** (C1 §1.6). *Proposed:* keep it: it answers "who set this rate?" and is not an
   audit entry. If the lead reads Q11 as excluding it, S2a drops one column.

### Stale text found elsewhere, with exact replacement wording

**PRD (the owner's, through the lead). Optional, recommended for consistency, not needed to build.**

- **FR-C7**: `Menu, variant, modifier, price, and preset changes advance a catalog version.` → *"Menu, variant, modifier,
  price, availability, and preset changes advance a catalog version."* ROADMAP Phase 1 already says availability
  advances it; FR-C7's list is the one place that omits it, and ADR-012 reads the contract whole.
- **FR-B1**: `Settings hold currency, minor-unit precision, tax rate, service charge rate, and the business details
  printed on receipts.` → *"Settings show the installation's currency and minor-unit precision and hold the tax rate,
  service charge rate, and the business details printed on receipts."* ADR-012 rule 5 reads "hold" as what the back
  office shows, which the next sentence of FR-B1 supports; the replacement says it plainly. Not needed if the owner is
  content with that reading.

**SCREEN-INVENTORY (the designer's).** ARCH-017's drafted replacement for BO-08's last bullet ("no permitted range") is
itself stale since the 2026-10-20 ruling.

- BO-08, **Purpose**: `Currency, minor-unit precision, tax rate, service-charge rate, and the business details printed
  on receipts.` → *"Tax rate, service-charge rate, and the business details printed on receipts, with the installation's
  fixed currency and minor-unit precision (IDR, 0) shown."*
- BO-08, **States**: `*currency and precision locked — an order already exists* (FR-B1, M1)` → *"*currency and precision
  shown, fixed — never editable* (FR-B1, M1)"*; and add *"· *settings changed elsewhere — this draft was built on an
  earlier version; nothing was saved* (ADR-012)"*.
- BO-08, **Must not invent**, first bullet: replace with *"Currency and minor-unit precision are fixed at IDR and 0 and
  are never editable (FR-B1, M1). The fixed state is the only state."*; last bullet: replace with *"Rate precision is one
  part per million, and each rate is from 0 to 100 percent (FR-M5; owner, 2026-10-20). A percent is typed with at most
  four decimal places and converted exactly."*
- BO-04, **States**: `*price immutable-currency context* (currency and precision are locked after the first order,
  FR-B1, M1)` → *"*price currency context* (prices are whole rupiah; the currency is fixed, FR-B1, M1)"*; and add *"·
  *menu changed elsewhere — this draft was built on an earlier catalog version; nothing was saved* (FR-C7, ADR-012)"*.
- BO-07, **States**: add *"· *presets changed elsewhere — nothing was saved* (FR-C7, ADR-012)"*.

**The plan.** Its S2 "Q2 is already answered by the owner: no permitted range", its Q2 text and its C1 row's "no business
ceiling" are stale; the new banner says ADR-012 and DECISIONS supersede them, as the task asked, and nothing else in the
plan was changed. The Definition of Done's B-24 line ("every new configuration table is empty after migration") holds,
because `catalog_revision` is a coordination row, not configuration (ADR-012 *Consequences*; C1 C-2, C-9).

### What the next tasks need that they do not have

- **C2** must make each configuration command answer the version it produced and each form read report the version it
  was read at (ADR-012 rule 15). Its name-uniqueness rule is applied to categories, items, options within an item, and
  presets by C1.
- **Design F and D** settle the length guards in C1 and draw the stale-draft states above; D draws items in an archived
  category as hidden from the POS.
- **Phase 2's plan** carries three entry conditions from ADR-012: the owner's Pasal 8 ruling before the settings capture
  (Q3), the open-order refusal when no settings version exists, and the FR-M3/B-2 wording before totals (Q6(b)).

### Checks

`git diff --check` is clean. `git diff --name-only development` lists only the four owned paths and this task file. No
code changed, so `npm run verify` was not run; the task names `git diff --check` as the check for this docs-only work.

DONE
