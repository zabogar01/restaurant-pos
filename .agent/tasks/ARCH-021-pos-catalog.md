---
id: ARCH-021
title: Consult C4 — the POS catalog (plan slice S7), its routes, poll, menu sources and stand-ins
category: arch
touches: [money, boundaries, identity]
depends_on: []
owns: [.agent/reviews/ARCH-021-*.md]
status: complete
cycles: 0
---
# ARCH-021 — Consult C4: the POS catalog

**Written** 2026-10-30 by the lead. **Owner:** `architect21`, Claude Opus 5.5, opened by hand in its own pane.
**Branch and place:** `agent/arch-021`, cut from `development` at `ad8276b`, in the worktree
`../restaurant-pos-wt/ARCH-021`. A **read-only consult**: write only `.agent/reviews/ARCH-021-pos-catalog.md` and this
task file's Handoff. No ADR, no ARCHITECTURE edit, no code. **Read files with the Read, Grep and Glob tools, not shell
commands**: a shell read asks the owner for approval and stalls you.

## Why this task exists

Phase 1 slices S0 to S6 are merged: the catalog, its version, the 86 toggle and discount presets all exist on the
server and in the back office. The last catalog slice, **S7**, makes the POS read the real menu and proves that an 86
reaches it within three seconds (FR-C6, AC-12). The accepted Phase 1 plan
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`) puts S7 behind consult **C4**. Read, word for
word, the plan's slice S7 (`:348-367`), its section 7 row for C4 (`:541`), the section 5 rows that name C4 or S7b
(`:455`, `:456`, `:466`, `:472`), section 6's B-24 and FR-A2c lines (`:523-529`), and Q13 and Q14 (`:651-664`). They
are your question list.

The lead turns your report into the **S7a** (server) and **S7b** (POS client and browser test) task files, so write it
as ARCH-019 and ARCH-020 were written: decisions with alternatives and reasons, then *For the lead* items a task file can
copy (scope, `owns`, acceptance criteria each with a red proof, the tests expected to change, `touches` flags).

**A designer works beside you.** DESIGN-021 (a Codex designer, `design021`) is drawing the POS addition at the same
time: POS-03 with an empty catalog and with a failed catalog read (plan gap G6, `:83-85`), M-2 for any served item
instead of the twelve fixture sheets, and the discount picker's served states. Some of your decisions change what it
draws: when the "catalog read failed" state is entered, what the POS shows while a refresh fails, what reaches the POS
(archived, 86'd, inactive options and presets), whether the picker shows real presets in Phase 1, and what the open
sheet does when its item changes in other ways than an 86. **Write those first**, in a *For DESIGN-021* section at the
top of your report, commit it, and tell the lead (`herdr agent prompt lead "architect21: For DESIGN-021 ready"`). The
lead relays it; do not message the designer yourself. If the designer asks you something through the lead, answer in
that section.

## Decided: do not reopen

Everything in `.agent/DECISIONS.md` binds; read every line from 2026-10-13 onward. The ones that shape C4:

- **Q14 (owner, 2026-10-20):** in Phase 1 a cashier may add a real menu item to the POS's client order stand-in, as
  with fixture items today. Nothing is stored; the stand-in goes when Phase 2's add-line command arrives; the floor
  (POS-02) stays fixture until Phase 2.
- **Q13 (owner, 2026-10-20) and ADR-012:** no Phase 1 POS command carries the catalog version. AC-31 and the
  `CATALOG_CHANGED` refusal of a POS command pass in Phase 2. ROADMAP Phase 1 names the catalog version "that later POS
  commands carry" (FR-C7).
- **The Phase 0 stand-ins (owner, 2026-10-13):** the served POS shows the fixture floor, orders, payments and approval
  stand-ins under a real sign-in; each stand-in goes when its server command arrives.
- **ARCHITECTURE §4.3 and ADR-012:** the POS polls one monotonic catalog revision every two seconds and refreshes at
  once on tab focus; the revision it polls and the version a command carries are **one number on one coordination
  row**; every committed catalog change advances it (menu, option, price, availability, archive, restore, preset); a
  read that returns catalog contents reports the version **from the same snapshot**; polling is never the integrity
  control (the server revalidates at add and fire, in Phases 2 and 3).
- **The plan's access line for the new routes:** an active POS session, POS surface, **not interactive**, so polling
  never extends the 90-second idle (FR-A2b, AC-28). If you find a reason to differ, say so as a question, not a
  decision.
- **What the POS may offer** (C1 §2.2, last notes; DESIGN-019 round 2, F2, lead-ruled): an item that is active, in an
  active category, is offered. An **86'd** item stays on the grid, **disabled in place, never removed** (AC-12, ruling
  C-3). An **archived** item, or any item of an archived category, does not reach the POS at all.
- **Presets** (DESIGN-022's *Questions and downstream notes*, lead-accepted): the picker shows **active presets only**;
  a zero-valued preset is valid and is shown; a fixed amount is capped at the order's subtotal **when applied**; a
  deactivated preset stays readable on an order that carries it (FR-F5). Presets are not approval-gated (FR-F2).
- **ADR-011:** rule 23 (fixtures are chosen by the build command and proved absent from a served bundle), rule 24
  (every sentence a person reads comes from the design documents), rules 27 and 28 (the browser harness), and *Not
  decided here* on the POS `?state=` pictures (`docs/decisions/ADR-011-browser-clients.md:1111-1116`).
- **The first-form pattern is consult C2's** (`.agent/reviews/ARCH-019-first-back-office-form.md`); the catalog's is
  C1 §2 to §4 (`.agent/reviews/ARCH-018-c1-configuration-schema.md`). The POS reads are new; the patterns are not.
- **Money crosses the wire as canonical strings** decoded by the shared codec (`packages/money`); nothing in the POS
  computes a committed figure (plan S7 *Touches*).

## What to decide

From the plan's C4 row and S7, at least:

1. **The POS projection.** One read or several; what it holds (categories, items with their 86 state, active
   variants and modifiers, presets or not) and what it omits (archived items and categories, inactive options and
   presets); its order (display order, ties by name, as C1 §2.2); the version from the same snapshot; its shape in
   `packages/contracts`; the money fields as canonical strings; how large it can grow and whether that matters every two
   seconds.
2. **The revision read.** A separate route answering only the version, a conditional read of the projection, or
   another way; its access declaration and route-table entry; what it costs the server each poll; that it is not
   interactive and reports no activity.
3. **The poll.** When it runs and when it stops: signed in or not, under POS-01's lock, on screens other than POS-03,
   while the tab is hidden; the immediate refresh on focus; what one failed poll, several, and a session-ending answer
   each do; backoff, if any. When the POS enters DESIGN-021's "catalog read failed" state, and whether a menu already
   shown stays usable while refreshes fail. The poll must never mask or race the session's own handling (ADR-011, the
   one-at-a-time rules).
4. **The three-second proof.** The S7b browser test: two profiles (the back office toggles, the POS shows), the page
   clock driving the POS poll with no real waits (rule 27), the first harness test that reads a 2xx body in the page
   (plan `:456`), what is asserted and when, and how it avoids flaking on the two clocks.
5. **Menu sources under rule 23.** How served and fixture modes choose the menu without mixing; the built-bundle marker
   test that proves the fixture menu is absent from the served bundle (B-24; made as the fixture-session proof is);
   how the fixture orders that the floor stand-in still shows (lines naming fixture items) sit beside a served menu.
   The optional `OrderLine.itemId` must not become a guarantee (STATE, *Must not become a guarantee*).
6. **POS-03's `?state=` pictures** (ADR-011 *Not decided here*): which stay, which go, and how a kept one is gated
   (the build-command constant, not `import.meta.env.DEV`).
7. **Add into the stand-in (Q14).** What a stand-in line snapshots from a served item (names, the resolved unit price
   with FR-C2's floor at zero, AC-26, the option ids or not); refusing an 86'd item in the client (FR-C5) as a stand-in
   only, not an integrity control; and closing ARCH-004's unchecked `addLine` under a lock in the store (plan `:466`;
   `.agent/reviews/ARCH-004-discount-in-the-client.md`). `removeLine` and `setQuantity` stay deferred to Phase 2.
8. **The open sheet between polls** (AC-12, M-2): how an open sheet learns its item was 86'd, keeps the choices, marks
   it unavailable and disables Add; and what it does when the item is archived, its price or options change, or an
   option it has selected is removed while it is open (not drawn yet; a *For DESIGN-021* item). A pending stand-in line
   whose item is 86'd later: does the stand-in's fire-blocked state (FR-E4, B-17) apply to real items in Phase 1?
9. **The POS preset picker.** Real presets in served mode in Phase 1, or the fixture presets until Phase 2? If real,
   the discount stand-in applies a real preset's value: say whether Q14's ruling covers that or whether it is a new
   owner question, and give a recommendation with reasons. Either way the picker's served states are DESIGN-021's.
10. **The version the POS keeps for Phase 2**, so that Phase 2's add-line command can carry it without reshaping S7b's
    store; and where it lives in the client.
11. **The split**, S7a (the POS catalog and revision routes) and S7b (the POS client and the browser test), each with
    scope, `owns`, acceptance criteria with red proofs, tests expected to change and `touches`. Say whether S7b should
    split again (the plan says S7 is the only Phase 1 slice that touches the add path).
12. **What DESIGN-021 must draw that the architecture fixes** (the *For DESIGN-021* section above), and any copy
    the client needs that no design document yet holds (rule 24).

## Read

- The plan, as listed above; ARCH-017's Handoff (`.agent/tasks/ARCH-017-phase-1-plan.md`).
- `docs/ARCHITECTURE.md` §2.1, §4.3, §5.1, §8, §14.3; ADR-010, ADR-011 (rules 1, 16, 20, 23, 24, 26 to 28, *Not decided
  here*) and ADR-012 (rules 10 and 13, *Consequences*) in full.
- `docs/PRD.md` FR-A2b, FR-C1 to FR-C8, FR-D4, FR-E4, FR-F1 to FR-F5, AC-12, AC-21, AC-26, AC-28, AC-31;
  `docs/BOUNDARIES.md` (B-8, B-17, B-20, B-24 at least).
- `.agent/reviews/ARCH-018-c1-configuration-schema.md` §0, §2, §3, §4; `ARCH-019-first-back-office-form.md` (C2);
  `ARCH-014-client-shells.md`; `ARCH-015-browser-harness.md`; `ARCH-004-discount-in-the-client.md`.
- `docs/design/SCREEN-INVENTORY.md` POS-03 (`:163-312`), M-2 (`:1137-1145`), M-3 (`:1147-1153`). The Handoffs of
  `.agent/tasks/DESIGN-019-menu.md` (its *For DESIGN-021* line and round 2's F2) and
  `.agent/tasks/DESIGN-022-discount-presets.md` (*Questions and downstream notes*).
- The Handoffs of PHASE0-011c2 (the POS signs in), PHASE0-012a and 012b (the harness), PHASE1-S4b, S5 and S6a in
  `.agent/tasks/`, for *What the next agent needs*.
- The code: `apps/server/src/domain/catalog.ts`, `discount-preset.ts`; `apps/server/src/http/routes/back-office-catalog.ts`,
  `back-office-presets.ts`, `pos-auth.ts`; `apps/server/src/http/access.ts`, `session-guard.ts`;
  `packages/contracts/src/routes.ts` and the catalog contracts; `packages/api-client`; `apps/pos/src/menuFixtures.ts`,
  `MenuRegion.tsx`, `Sheets.tsx`, `sheetFixtures.ts`, `orderStore.ts`, `discountFixtures.ts`, `DiscountSheets.tsx`,
  `session/` (`source.ts`, `realSession.ts`, `fixtureSession.ts`, `activity.ts`); `e2e/support/` and `e2e/tests/`.
  BO-03's version merge (`apps/back-office/src/menu/model.ts`, FE-037) is the client precedent for a read and an answer
  ordered by version.
- **Never print `db/dev.env`'s values.** For a library fact (the Playwright page clock, Vite's `define`), run
  `.agent/bin/ask.sh librarian "<question>"`; do not recall.

## Acceptance criteria

1. The report answers each of the twelve items above, each with alternatives and reasons, or names where it is
   answered.
2. *For DESIGN-021* is at the top, was committed and announced to the lead before the rest of the report was finished,
   and names every state whose entry or content the architecture fixes.
3. Nothing contradicts the contract, an accepted ADR or a DECISIONS line. Anything that would needs an owner question
   with a proposed answer, not an assumption. If an accepted ADR's wording must change (ADR-011's *Not decided here*,
   for example), the report says exactly where and proposes the text.
4. *For the lead* gives S7a and S7b (and any further split) each a scope, `owns`, acceptance criteria with red proofs,
   tests expected to change and `touches`, concrete enough to copy into a task file. The AC-12 browser test and the
   B-24 bundle marker each have a red proof.
5. `git diff --name-only development` shows only the report and this task file; `git diff --check` is clean.

## Out of scope

- The POS's visual design and copy (DESIGN-021's); C3 and the users slices; Phase 2's add-line command, its idempotency
  and its `CATALOG_CHANGED` refusal (AC-31); the floor's stand-in; any code, ADR, ARCHITECTURE edit, task file or design
  work; the contract documents.

## Commit and report

Commit on `agent/arch-021` only, after `git diff --check` is clean, and never push. Commit the *For DESIGN-021* section
as soon as it is written. Write the Handoff below in full prose: what you decided and why, any question for the owner
with a proposed answer, anything stale you found with exact replacement wording, and what the lead needs to write S7a
and S7b. End with `DONE` or `BLOCKED: <one question>`. Then run exactly one of:

    herdr agent prompt lead "architect21: ARCH-021 done — <one line>"
    herdr agent prompt lead "architect21: BLOCKED — <question>"

## Questions relayed from DESIGN-021 (lead, 2026-10-30)

Answer both in *For DESIGN-021*. The designer is drawing the lead's provisional answer meanwhile.

- **D1. FR-M5's ceilings in the Phase 1 stand-in.** A legal served item can exceed 99.999.999 per line: a base price of
  99.999.999 plus a positive variant or modifier delta, or any price times a quantity up to 99. FR-M5 caps a line total
  and an order total at 99.999.999 minor units. The client order store does not check either today (fixture prices are
  small; only `SINGLE_TENDER_LIMIT` exists, `apps/pos/src/tender.ts:7`). Does the stand-in's Add enforce the line and
  order ceilings in Phase 1, and if so where (M-2's Add and quantity keys, the store, both)? Raised first by DESIGN-020.
  *Lead's provisional answer:* yes, in both: M-2 disables Add, and the plus key at the bound, with a plain reason when
  the line or the order would pass 99.999.999, as the quantity keys already do at 99; the store refuses the same, as
  item 7's `addLine` check does under a lock.
- **D2. The first read with no response.** What bounded wait moves POS-03 from *loading* to *first read failed* when
  the server does not answer? *Lead's provisional answer:* no new timer; the transport core's default request timeout
  (`DEFAULT_TIMEOUT_MS`, 10 seconds, `packages/api-client/src/client.ts:82`) ends the read, and its failure enters the
  state, with *Try again*.

## Lead review (2026-10-30)

At `9eb34dd`. `git diff --name-only ad8276b`: the report and this task file; `git diff --check` clean. The four acceptance
criteria are met: all twelve items are answered with alternatives and reasons; *For DESIGN-021* went first (`2e33a81`)
and was relayed to the designer, with D1 and D2 answered in it; *For the lead* gives S7a, S7b1, S7b2 and S7b3 each a
scope, `owns`, acceptance criteria with red proofs, tests expected to change and `touches`; nothing contradicts the
contract, an accepted ADR or a DECISIONS line, and no ADR wording changes (item 6's reading of ADR-011's *Not decided
here* is accepted). The lead checked the D2 correction against `packages/api-client/src/client.ts` (the ten-second
default, then the health read on a fault) and the decimal comma against `docs/DESIGN.md:1715`.

The lead accepts, as its own reading and the owner's to overturn: the split of S7b into three (S7b1, S7b2, S7b3, in that
order, all after DESIGN-021's review); the revision route opting out of the client-instance hook; a per-route log level
on the revision route, subject to the librarian's confirmation in S7a; the poll running on every signed-in POS screen and
pausing when hidden; no backoff; no option ids in a stand-in line; D1's three additions; and S7a building `presets` into
the projection whatever OQ1's answer, since the field is one line to remove. **To the owner:** OQ1 (real presets in the
Phase 1 picker; architect and lead: yes), and the interim between S7b1 and S7b2, when an available served tile opens
nothing. **For DESIGN-021, relayed:** the 86'd sheet's stepper (*Found and not fixed*) and the inventory's "twelve menu
tiles" (*Stale text* 3). **For the S7b1 task file:** `idle.spec.ts` B6 and B8 must change, or they flake. Four library
facts are left to builders (the log level, `clock.resume` and `pauseAt`, the page clock after `install()`, a hidden
two-profile page), each named where it applies. Complete.

## Handoff

The report is `.agent/reviews/ARCH-021-pos-catalog.md`. *For DESIGN-021* went first, at `2e33a81`, with the relayed D1 and D2
answered in it; the lead was told. The rest of the report followed. No code, ADR, ARCHITECTURE or contract text changed.

**What I decided, and why.** The POS gets two routes, `GET /api/pos/catalog/revision` and `GET /api/pos/catalog/menu`, both
an active POS session and not interactive, so polling never extends the 90 seconds. They are separate so that the two-second
poll reads one number and the whole menu is read only when it changes. The menu is one snapshot holding only what the POS
may show, filtered in SQL, so an archived name never leaves the server. A client store above the routes runs one cycle at a
time while signed in and visible, on every screen, because a quick sale's close on POS-04 reads availability as well. A menu
already shown stays usable while refreshes fail; two failed checks in a row show a doubt, because that is past the
three-second budget. Served and fixture menus come through the one constant in `session/source.ts`, with one screen path over
both. Add snapshots names, deltas and the floored unit but no option ids. `addLine` refuses under a lock, for an 86'd item and
past FR-M5's ceilings, as a stand-in. The sheet renders the live item, so what is displayed is what Add adds. The version
lives in one immutable store object beside the contents, so Phase 2 can read it with no reshaping, and no line carries it now.

**Where I differed from the lead's provisional answers.** D1: agreed, adding that a choice alone can pass the bound at
quantity 1, that the order figure is the panel's `total`, and that the line editor needs the same check or the rule is walked
around. D2: agreed there is no new timer, but the bound is up to 20 seconds, not 10, because a timed-out read asks health under
its own ten-second timer (`client.ts:299`).

**Question for the owner, with a proposed answer.** OQ1: may the served discount picker show real presets in Phase 1? Q14 does
not cover it. Proposed yes; it blocks S7b3 only. The designer is drawing that answer meanwhile.

**Found and not fixed.** `ItemSheet`'s comment says an 86'd sheet draws no stepper, and the code draws one; DESIGN-021 should
draw which it means. The report's *Stale text found* lists five small items; no contract document needs a change, and ADR-011
needs no change (item 6 says why).

**Not verified: I ran no test, build or browser**; this consult is reading only, and the only check I ran is the one below.
Four things are explicitly left for a builder to confirm, each named where it applies: that Fastify's per-route `logLevel`
silences a poll's lines (I inferred from finding no `disableRequestLogging` that those lines are written at all); that
`clock.resume` and `pauseAt` behave as the idle helper needs; that the page clock flows after `install()`, where the librarian
found the docs and source in conflict and I rely on `idle.spec.ts:24` in a suite recorded green; and that neither engine reports
a two-profile page as hidden. That Rollup drops the fixture module is also unconfirmed from its docs, which is why the marker
test is the proof.

**What the lead needs for the task files.** *For the lead* gives S7a, S7b1, S7b2 and S7b3 each a scope, `owns`, acceptance criteria
with red proofs, tests expected to change and `touches`. I recommend splitting S7b into three, in that order. Two things to
carry: `e2e/tests/idle.spec.ts` B6 and B8 will flake unless S7b1 changes them, because a poll and the deadline read race for the
verdict; and after S7b1 merges, an available tile does nothing in served mode until S7b2 does, which the owner should hear in
advance. DESIGN-021's review comes before S7b1.

DONE
