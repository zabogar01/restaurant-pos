---
id: ARCH-019
title: Consult C2 — the first back-office form (tables, S1), the pattern every configuration slice copies
category: arch
touches: [boundaries, identity]
depends_on: []
owns: [.agent/reviews/ARCH-019-*.md]
status: not-started
cycles: 0
---
# ARCH-019 — Consult C2: the first back-office form

**Written** 2026-10-20 by the lead. **Owner:** `architect19`, Claude Opus 5.5, opened by hand in its own pane.
**Branch and place:** `agent/arch-019`, cut from `development` at `ffe0bb2`, in the worktree
`../restaurant-pos-wt/ARCH-019`. This is a **read-only consult**: write only
`.agent/reviews/ARCH-019-first-back-office-form.md` and this task file's Handoff. No ADR, no ARCHITECTURE edit, no code.

## Why this task exists

The owner accepted the Phase 1 plan on 2026-10-20
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, DECISIONS 2026-10-20). Slice **S1** (tables,
the first back-office form, the navigation) waits on consult **C2**, and S2, S3, S4b and S6 inherit its pattern. Read
the plan's section 7 row for C2 and slice S1 word for word: they are your question list. The lead turns your report into
the S1a (server) and S1b (client) task files, so write it the way ARCH-012 to ARCH-015 were written: decisions with
reasons, then *For the lead* items a task file can copy.

A second architect is writing **ADR-012** (versioned configuration) and C1 (ARCH-018) at the same time. Tables are not
catalog and have no version; where your pattern meets a versioned record (S2, S4), say what the pattern needs from
ADR-012 and leave the version mechanism to it.

## Decided: do not reopen

Everything in `.agent/DECISIONS.md` binds; read every line from 2026-10-05 onward, and all of 2026-10-20. In particular:

- **Q10 (2026-10-20).** Tables may be **reactivated**; a table has **no seat count**. PRD FR-B2 now reads "Manage
  tables: create, edit, deactivate and reactivate."
- **Q13 (2026-10-20).** The refusal to deactivate a table that holds an open order (FR-C8, AC-32's second sentence)
  arrives with orders in **Phase 2**. In Phase 1 deactivation is never wrong. C2 still decides **the DiningTable lock**
  Phase 2's open-order command and the deactivation will both take, so Phase 2 adds a check rather than reorders a
  command (plan G1).
- **Q4 (2026-10-20).** FR-B7 tender types are Phase 1, slice S3, on BO-08. The plan asks C2 one question for S3: are
  cash and card fixed kinds the application never creates, renames or deactivates (recommended), or configuration rows?
- **AC-35's last sentence** closes in S1b's browser test: a real form, idled and resumed by the same manager, destroyed
  for another (the owner's 2026-10-05, 10-14, 10-16 and 10-20 draft rulings; ADR-011 rule 22).
- **B-24:** no seeded table; an empty list is the starting state.
- ADR-011 is accepted (2026-10-19) and binds, rules 1 to 28; its *Not decided here* leaves `VALIDATION_FAILED`'s details
  and the faster development loop to "the first form's consult" — this one.

## What to decide

From the plan's C2 row and S1, at least:

1. **Addressing one record within ADR-011 rule 16**: a path template in the route table, or an id in the body of a
   `POST`; how `packages/api-client` and the route-table equality test treat it; and that no query string reaches a
   credential route. If either choice changes a rule ADR-011 states, say so plainly: that needs a superseding ADR, which
   is the owner's call, and you propose it rather than assume it.
2. **`VALIDATION_FAILED`'s details**, built as ADR-011 *Not decided here* requires (issue paths intersected with the
   schema's own keys, typed as a union of literals), and how the client maps them to fields without echoing a value.
3. **What a configuration command answers** (the authoritative record, ARCHITECTURE §13) and whether a list read is
   interactive (ADR-011's session rules).
4. **Label uniqueness among active tables**, and what reactivating a table whose label an active table now holds does.
5. **The DiningTable lock** Phase 2 shares (G1), stated so S1a builds deactivation and reactivation under it.
6. **Unknown outcomes** presented without a resend (ADR-011 rule 20; DESIGN-011 Q11).
7. **The back-office route manifest and rail**, the first form inside the keyed working area, unsaved-work departure, and
   what S1b's harness test asserts for AC-35 under rules 27 and 28.
8. **Cash and card for S3** (above).
9. **The faster development loop (C5)**: only whether S1b's `vite build --watch` measurement is the right trigger and
   what number would justify C5; do not design C5.
10. **The split**: what S1a and S1b each own, their acceptance criteria and red proofs, the tests expected to change,
    and the `touches` flags each carries.

## Read

- The plan (S1, S2, S3, S4b, S6, sections 2, 5 and 7); ARCH-017's Handoff (`.agent/tasks/ARCH-017-phase-1-plan.md`).
- `docs/ARCHITECTURE.md` (§3, §8, §11 to §14, §17); ADR-009, ADR-010 and ADR-011 in full.
- `docs/PRD.md` FR-A2, A2b, A2c, FR-B2, FR-B7, FR-C8, AC-32, AC-35; `docs/BOUNDARIES.md` (B-20, B-24 at least).
- The consults `.agent/reviews/ARCH-012` to `ARCH-015`, and the *For Phase 1* parts of the PHASE0-009a to PHASE0-012b
  Handoffs in `.agent/tasks/`.
- `.agent/reviews/DESIGN-011-back-office-audit.md` (BO-05, BO-08, Q11); `docs/design/SCREEN-INVENTORY.md` BO-05 and
  BO-08; `docs/design/SITEMAP.md` (back office); DESIGN-012's shared patterns and DESIGN-016 (BO-01, BO-02).
- The code: `packages/contracts/src/`, `packages/api-client/src/`, `apps/server/src/http/` (access declarations, the
  session guard, the zod helper), `apps/back-office/src/` (`OfficeApp.tsx`, the working area, M-6), `e2e/`.
- **Never print `db/dev.env`'s values.** For a library fact, `.agent/bin/ask.sh librarian "<question>"`; do not recall.

## Acceptance criteria

1. The report answers each of the ten items above, each with alternatives and reasons, or names where it is answered.
2. Nothing contradicts the contract, an accepted ADR or a DECISIONS line. Where a choice would change an accepted ADR,
   the report says so and proposes a superseding ADR as a question for the owner; it does not assume it.
3. *For the lead* gives S1a and S1b each a scope, `owns`, acceptance criteria with red proofs, and tests expected to
   change, concrete enough to copy into a task file.
4. `git diff --name-only development` shows only the report and this task file; `git diff --check` is clean.

## Out of scope

- ADR-012's questions (settings versions, the catalog version); C3 (users), C4 (the POS catalog), C5's design.
- Any code, ADR, ARCHITECTURE edit, task file or design work; the contract documents.

## Commit and report

Commit on `agent/arch-019` only, after `git diff --check` is clean, and never push. Write the Handoff below in full
prose: what you decided and why, any question for the owner with a proposed answer, anything stale you found with exact
replacement wording, and what the lead needs to write S1a and S1b. End with `DONE` or `BLOCKED: <one question>`. Then
run exactly one of:

    herdr agent prompt lead "architect19: ARCH-019 done — <one line>"
    herdr agent prompt lead "architect19: BLOCKED — <question>"

## Handoff

Written by `architect19`, 2026-10-20. The report is `.agent/reviews/ARCH-019-first-back-office-form.md`; this
section is its digest for the lead. Nothing else was edited.

### What I decided, and why

- **Addressing (item 1).** A record is addressed by an id in the body of a `POST`; every route-table path stays a
  fixed string, so the transport core, the route-table equality test and ADR-011 rule 16 are unchanged. S1 needs no
  single-record read. A path template was rejected because it removes the property "the path the core sends is a
  table string" that every Phase 0 test relies on; a later slice that needs a `GET` by id brings it to a consult. A
  new contracts test makes "no `?`, `#` or `:` in any route-table path" a checked property.
- **`VALIDATION_FAILED` (item 2).** The form needs a field list and gets it from its own check against the shared
  schema before sending, built as ADR-011's *Not decided here* requires (issue `path[0]` intersected with
  `Object.keys(schema.shape)`, in schema order, typed as the union of those literal keys), in one back-office helper.
  The wire is unchanged: `VALIDATION_FAILED` keeps no details, so rule 9 stays true word for word and **no
  superseding ADR is needed**. A server `VALIDATION_FAILED` means a stale tab and is shown as the general failure,
  draft kept. A server-side list is deferred to the first slice with a representational rule the shared schema
  cannot hold; S1 has none. I checked the zod facts against the installed zod 4.6.5.
- **Answers and interactivity (item 3).** Every command answers `{ table: TableView }`, the list answers
  `{ tables }`; `TableView` is `{ tableId, label, isActive }`. The list read is not interactive (the page rereads it
  itself); the four commands are. No area column: nothing in the contract or the designs reads one (Q10's reasoning
  for seats).
- **Uniqueness (item 4).** A label (1 to 32 characters, trimmed, no control characters) is unique among active
  tables, case-insensitively, by one partial unique index. A new generic code `DUPLICATE` (409, no details) refuses
  create, rename and reactivation into a held label; renaming an inactive table is allowed, which is the way out of
  a refused reactivation.
- **The lock (item 5).** Update, deactivation and reactivation open with `SELECT … FOR UPDATE` on the DiningTable
  row; Phase 2's open-order takes the same lock after BusinessDay and before Order, and Phase 2 adds its open-order
  check after the lock in deactivation, reordering nothing. S1a proves the lock comes before the read through the
  no-op path (a deactivation of an already inactive table must wait for another holder of the row lock).
- **Unknown outcomes (item 6).** Keep the draft, reread the list, say the outcome could not be confirmed, never
  resend and never infer success from the reread. S1's commands make a manager's own resend harmless: a repeated
  create is `DUPLICATE`, a repeated rename sets the same label, and a command that would change nothing writes
  nothing and answers the record. So S1 needs no idempotency key.
- **Manifest, rail, working area, AC-35 (item 7).** A small route manifest of the back office's own, a rail of
  built destinations only, BO-05 inside the keyed working area, reached through a store member typed to the
  configuration routes only. **One hazard found:** by HTML §6.3.1 and CSS Position 4 §3.1 (librarian), a modal
  `<dialog>` under a `display: none` ancestor still blocks the document while drawing nothing, so a table form left
  open when BO-01 appears would make BO-01's own fields inert. Rule: a working-area dialog is closed (state kept)
  whenever the frame is not shown and reopened for the same manager. The browser spec has three cases: the same
  manager through M-6, another manager through M-6, and both through BO-01 with the form open.
- **Cash and card (item 8).** Fixed kinds, never rows; only custom methods are configuration, as FR-B7 and B-5
  already read. S3 follows this consult's pattern with a `tender_method` table.
- **C5 (item 9).** The watch-build measurement is the right trigger if it times save-to-visible over ten warm
  edits; C5 is justified above a five-second median, or a warm full rebuild over ten seconds.
- **The split (item 10).** S1a: the migration, the domain, the routes, the contracts and the compile-forced client
  lines (the back-office API functions and `DUPLICATE` in both clients' code switches). S1b: the manifest, the rail,
  BO-05, the form rules, the browser spec and the measurement. Scope, `owns`, acceptance criteria with red proofs,
  the tests expected to change and the `touches` flags are in the report's *For the lead*, ready to copy.

### Question for the owner

**OQ1 (blocks S3 only):** may a deactivated custom tender method be reactivated? Q10 named tables, presets, items and
categories, not tender types. Proposed: yes, with FR-B7 reading "Manage tender types: create, rename, deactivate and
reactivate custom named methods alongside cash and card." (the rest of FR-B7 unchanged).

### Stale text found, with replacement wording

1. **ARCHITECTURE §8's lock order** omits the DiningTable row. Replace "BusinessDay precedes Order; Order precedes
   CheckoutLease and ReceiptSeries." with "BusinessDay precedes DiningTable, and DiningTable precedes Order; Order
   precedes CheckoutLease and ReceiptSeries. Opening a table order, and deactivating, reactivating or renaming a
   table, lock the DiningTable row before reading its state, so a deactivation and an order opening on the same
   table serialise and the deactivation's open-order check (FR-C8) sees any order committed before it." This is an
   architect edit, owed before the Phase 2 plan; it fits ADR-012's ARCHITECTURE amendments.
2. **SCREEN-INVENTORY and SITEMAP BO-05** (the designer's, through E1): add reactivation and the *label in use*
   refusal, and mark the open-order refusal as arriving with Phase 2 (exact wording in the report, *Stale text* 2).
3. The plan's S1 goal predates Q10's reactivation; recorded, not edited, since later consults win over the plan.

No contract document is wrong; no PRD, PRODUCT, ROADMAP or BOUNDARIES wording is proposed except OQ1's FR-B7 line.

### What the lead needs to write S1a and S1b

- The report's *For the lead* gives each task its touches flags, dependencies, owned globs, scope, numbered
  acceptance criteria with red proofs, the tests expected to change and what its Handoff must carry forward.
- **E1's brief** must carry: the modal-dialog hazard and the rule above; DESIGN-012 F1's "*Log out* never inert"
  against a native modal form (E1 decides modal under N2, or non-modal); the label-in-use and reactivation states;
  the outcome-unknown and departure copy; and that architecture requires no confirmation step for deactivation or
  reactivation (both reversible; the ARCH-002 test).
- **For ADR-012** (the other architect): the six things the pattern needs where it meets a versioned record are in
  the report's *What the pattern needs from ADR-012*; the main one is that a manual resend of an applied versioned
  command must be refused as stale, not applied twice.
- S1b waits on E1 and on DESIGN-016's accepted Handoff (the rail and the landing); S1a waits only on S0.

### Not done

No code, test or browser was run, except one Node check of zod 4.6.5's issue shapes against the installed copy.
The dialog-blocking behaviour is from the specification, not from either engine; S1b's browser case C3 is the
evidence, and its Handoff reports what each engine did.

DONE
