---
id: DESIGN-022
title: BO-07 Discount presets in Frost (slice F, BO-07 half), for S6b
category: ui
touches: [money, boundaries]
depends_on: [DESIGN-020]
owns: [docs/design/**, docs/DESIGN.md]
status: active
cycles: 0
---
# DESIGN-022 — BO-07 Discount presets (slice F, BO-07 half)

**Written** 2026-10-29 by the lead. The BO-07 half of design slice **F** in the accepted Phase 1 plan
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, §4 and *S6*), split from DESIGN-011's slice F
(`.agent/reviews/DESIGN-011-back-office-audit.md:463`). DESIGN-018 drew the BO-08 half (merged as PR #125).
**Owner:** a Codex designer on `gpt-6-astra`, effort high, opened by hand in its own pane (name `design022`). The review
is Claude Opus's (the other family).
**Branch and place:** `agent/design-022`, cut from `development` at `a6e682d`, in the worktree
`../restaurant-pos-wt/DESIGN-022`. Touch nothing under `apps/`, `packages/`, `db/` or `e2e/`.

Nothing is built from this task directly. A design review follows; then plan slice **S6b** (BO-07 in the back office)
is written from it. Its server half, **PHASE1-S6a**, is being built at the same time from ADR-012 and consult C1 §4; the
facts it fixes are listed under *Server facts* below. Draw what it does. Where you need something it does not do, stop
and ask; do not draw it.

Abbreviations, as in DESIGN-017 to -020: `I` = `docs/design/SCREEN-INVENTORY.md`, `D` = `docs/DESIGN.md`, `S` =
`docs/design/SITEMAP.md`, `P/` = `docs/design/prototype/back-office/`, `F/` =
`docs/design/visual-directions/frost/back-office/`. **C1** = `.agent/reviews/ARCH-018-c1-configuration-schema.md`;
**C2** = `.agent/reviews/ARCH-019-first-back-office-form.md`; **ADR-012** =
`docs/decisions/ADR-012-versioned-configuration.md`.

## Objective

When this task is done, BO-07 has a reviewed Frost composition, `F/presets.html`, in every state S6b will build, with
every word it will show (ADR-011 rule 24: the builder copies the design's words and invents none). A manager creates,
edits, deactivates and reactivates named discount presets of two kinds: a **percentage** and a **fixed amount**. The
rail gains its entry for BO-07. Almost every rule is already in `D`. This slice applies them to a new record; it
should add very little.

## Required inputs

Read these, in this order.

1. **`D` *Configuration forms***, all four parts: DESIGN-017 / C2 (from `D:1486`), DESIGN-018 additions (from
   `D:1628`), DESIGN-019 additions (from `D:1788`), DESIGN-020 additions (from `D:1876`). These rules bind. Note in
   particular:
   - **the stale-draft refusal** (`D:1636`), which names BO-07;
   - **the rate field** (`D:1700`), which says BO-07's percentage preset reuses it;
   - **the money input** (`D:1887`), which says BO-07's fixed-amount preset reuses it;
   - **two forms on one screen** (`D:1728`), **"unchanged"** (`D:1677`), and **a success while the list read stands
     failed** (`D:1741`).
2. **ADR-012** rules 10 and 13 (what advances the catalog version; which commands carry it) and *Consequences* (the
   stale draft after M-6).
3. **C1** §0 (rates and money on the wire, text that reaches paper) and §4 (S6a).
4. **`F/settings.html`'s payment-methods part** (DESIGN-018, its task file's Handoff), the nearest precedent: a small
   list of named records with create, rename, deactivate and reactivate. Share rather than copy where the pattern is the
   same. **`F/item-editor.html`** (DESIGN-020) for the money input and `CATALOG_CHANGED` as drawn.
5. **DESIGN-011** BO-07 (`.agent/reviews/DESIGN-011-back-office-audit.md:187-200`): its P1 (subject-correct walks; both
   kinds; inline validation; values kept through error and cancel), S2 to S4, and the destructive-confirmation row
   (`:404`).
6. `I` BO-07 (`:847-870`), the shared general failures (`I:83-124`), and the POS discount picker's rows (`I:296-301`,
   `I:1137-1140`), so you know what a deactivated preset means at the POS. `S` BO-07 (`:305-306`). `P/presets.html`.
7. The contract, for meaning: PRD FR-B5, FR-F1 to FR-F8, FR-M5; BOUNDARIES B-1, B-8, B-13, B-21, B-22, B-24.
8. `D`'s *Shared back-office patterns — DESIGN-012* (from `D:1335`), *Modal and sheet*, *Data table*, *Notices and
   empty states*, *Buttons (back office)*, *Money*. Use `F/office.css`, `F/office.js` and `F/patterns.html` as they
   are; do not fork them.

## Server facts (PHASE1-S6a, lead rulings 2026-10-29)

- **The record** is `{ presetId, name, value, isActive }`. `value` is either `{ kind: 'PERCENTAGE', ratePpm }` or
  `{ kind: 'FIXED', amount }`. A percentage is 0 to 100 percent, held as parts per million (so at most four decimal
  places of a percent, as the rate field already accepts). A fixed amount is whole rupiah, 0 to 99.999.999. **Zero is
  accepted for both kinds** (FR-M5's range; C1 §4.1). Nothing else is stored: no date, time, schedule, trigger,
  minimum spend, stacking, approval or POS-visibility field (B-21, B-22, FR-F2).
- **The name** is 1 to 32 code points, trimmed, with no control character. It is unique among **active** presets,
  compared case-insensitively. An inactive preset may share a name with an active one.
- **The list** is one read answering every preset, active and inactive, with the catalog version. The server orders it
  by creation; there is **no reorder and no manager-set order** (FR-B5 names four operations). Choose the order and
  grouping the screen shows, and state it as a rule S6b can test.
- **Create** carries no version. **Edit** sends the whole preset (name, kind and value together) with the catalog
  version the form was read at, and may change the kind. **An inactive preset may be edited.** **Deactivate** and
  **reactivate** are state commands and carry no version.
- **Refusals:** `DUPLICATE` (bare, no subject) for create, edit of an active preset, and reactivation into a held name;
  **`CATALOG_CHANGED`** for a stale edit only; `NOT_FOUND` for an unknown preset; `VALIDATION_FAILED` for a malformed
  request, which is a general failure because the client refuses it first. **No preset command is audited** (Q11).
- **The catalog version is shared** with the menu (ADR-012 rule 10). So an edit can be refused `CATALOG_CHANGED`
  because an item changed in another tab while this preset did not. `D`'s stale-draft rule already covers the case
  where nothing in the reread differs from the draft. Draw it for BO-07, and say whether the copy differs.

## Rulings that bind this task

- **FR-F5, I BO-07:** deactivating a preset hides it from the POS picker and leaves it readable on orders that already
  carry it. The words at deactivation say so in plain language. **Q10:** a preset may be reactivated.
- **FR-F4, B-8: never retroactive.** An edit changes only discounts applied afterwards; an order that carries the
  preset keeps the snapshot. Say so where the manager edits. There is no "apply to open orders" option.
- **FR-M5:** a fixed amount is capped at the order's subtotal **when it is applied** (Phase 2). Storing an amount above
  a likely subtotal is not an error and is not refused. You may add a hint; if you do, say why.
- **Zero.** A 0% or Rp 0 preset is accepted by the server. Decide whether the screen accepts it silently, warns, or
  refuses it locally. A local refusal is a business rule no ruling makes, so the lead's recommendation is to accept
  it. Say what you decide and why.
- **The kind switch.** Decide what happens to the typed value when the manager switches kind in the form: whether it is
  cleared or kept per kind, and what Cancel restores. State this as a rule S6b can test, with the focus after the
  switch.
- **Deactivate and reactivate:** apply `D`'s state-command rules and DESIGN-018's methods precedent. Decide whether
  deactivation needs the desktop destructive confirmation (DESIGN-011 `:404`, I-11). Its effect reaches the POS
  picker, so the lead leans towards a confirmation, but the decision is yours, with a reason. Reactivation needs none.
- **Presets are not approval-gated** (FR-F2; `I` *Must not invent*). Nothing on BO-07 suggests that the POS asks for a
  manager PIN for a preset.
- **Drafts, M-6, BO-01, the departure decision, the unknown outcome without a resend, no `beforeunload`:** as `D`
  says. Do not change these rules; apply them.
- **Tokens:** use the registry first. A missing value may be registered in `frost.tokens.json`, `frost.css` and `D`
  with `source: null` and a `designed` record, each listed in the Handoff. No raw colour, size or weight. No success
  green. Show money and rates in the Frost numeral style the registry already has.

## What to draw

### Part A — BO-07, `F/presets.html`

1. **Every state, by `?state=`.** List the states you draw in the Handoff. They include:
   - **empty**: no preset yet (B-24); creating the first is plain;
   - **loading**, and **failed to load** with *Try again*;
   - **the list**: active and inactive presets of both kinds, in your order and grouping;
   - **overflow**: a long list in its scroll owner, with the longest name and the largest values (100%, Rp 99.999.999,
     and a four-decimal percent such as 12.3456%);
   - **create**, for each kind, and **edit**, for each kind, including **a kind switch**;
   - **local invalid input**, for each refusal the rate field and the money input already define, and for the name
     (empty, over 32, a control character if one can be received);
   - **saving**, and **saved**;
   - **name in use**, for create, edit and reactivation;
   - **stale draft refused** (`CATALOG_CHANGED`) three times: once with the preset changed in the reread, once with
     only the menu changed (nothing in the reread differs from the draft), and once **after M-6**;
   - **deactivate**, with its confirmation if you decide on one, then **deactivated**; **reactivated**;
   - **edit of an inactive preset**, which is the way out of a refused reactivation;
   - **general failure**, with the draft kept; **outcome unknown**, with the draft kept, a reread and no resend;
   - **the departure decision**; **M-6 over the form**; **BO-01 with a draft held**;
   - BO-07's equivalent of **a success while the list read stands failed**.
2. **Subject-correct walks** (DESIGN-011 P1). Every row's Edit opens that preset; a refusal names the right preset; a
   success changes the right row. A percentage and a fixed amount are each walked. The fixture's counts agree with the
   rows drawn.
3. **Copy for every state**, in final words, listed in the Handoff as a table S6b can copy: the state, the element, the
   exact text, and the accessible name where a test will drive it. Name every control a test will press:
   - the rail's BO-07 entry and *New preset*;
   - a row's edit, deactivate and reactivate controls;
   - the form's name field, kind choice, value field, Save and Cancel;
   - the confirmation's controls, if any;
   - the stale state's two choices;
   - the departure decision's Stay and Discard.
4. **Focus:** say where focus lands when each form opens, after a field error, after `DUPLICATE`, after a kind switch,
   after `CATALOG_CHANGED`, after a save, after Cancel, after a deactivate or reactivate, and after a form is reopened
   for the same manager.

### Part B — patterns, in `D`

Add a short *DESIGN-022 additions* part only for what BO-07 settles that a later form could reuse (the kind switch is
the likely one). Mark each rule as behaviour or as BO-07 copy. Change no existing rule. If nothing new is needed, say
so in the Handoff and add nothing.

### Part C — links, rail, gallery, inventory and sitemap

1. `F/office.js`: add `presets` where Frost destinations are resolved, so that the rail's entry and every link to
   `P/presets.html` reach `F/presets.html`. Report the `grep -c "prototype/"` count for each changed artifact, before
   and after, and confirm that no Frost back-office artifact still links to `P/presets.html`.
2. Register the artifact and every state in `manifest.js` and the gallery. Write `docs/design/checks/design022.cjs`.
3. Bring `I` BO-07 and `S` BO-07 into line with the rulings above, and show each changed line in the Handoff (`git
   diff`):
   - `I` *States*: reactivated (Q10), name in use, the stale draft, deactivated with its confirmation if drawn; drop
     *permission-denied (n/a)* if your states make it meaningless, and say why.
   - `S` BO-07: reactivate, *name in use*, and the stale-draft refusal.
   - `P/presets.html` gains a pointer to the Frost artifact.

## Constraints

- Light only, desktop only. No scheduling, auto-apply, date or time field, stacking, precedence, minimum spend, item or
  category scope, approval gate or POS operation (B-21, B-22, FR-F2, FR-F7). No reorder (*Server facts*).
- *Invent, revert, ask:* draw nothing that the inventory, the PRD, ADR-012, C1 or the server facts above do not grant.
- Every person is named (B-13). The four product documents, ADR-012, C1 and C2 are not edited.
- Do not change the shared behaviour of DESIGN-012, -013, -014, -016, -017, -018, -019 or -020, except where Part B
  adds rules. Their checks must still pass (`design012.cjs` to `design014.cjs`, `design016.cjs` to `design020.cjs`).
- **The lead runs the check scripts**, which saves your allowance and the owner's approvals. When you want a run, ask
  through Herdr (`herdr agent prompt lead "design022: please run <script>"`) and wait for the result in your pane. Do
  not run them yourself unless the lead says so. Measure in a browser at 1440×900 and 1920×1080 through the check
  script, and quote the measurements in the Handoff. Evidence stays outside the repository.

## Tests expected to change

None outside `docs/design/`. If you register a token, `packages/tokens/test/tokens.test.ts` must pass unchanged. The
expected prototype-link counts in earlier check scripts may change for Part C. Change only those expectations, say
so, and weaken no assertion.

## Acceptance criteria

1. `F/presets.html` imports the shared `office.css`, and every state in Part A item 1 is reachable by `?state=` and
   registered. A missing state fails this.
2. The Handoff maps every `I` BO-07 state (as amended), every ruling above and every item of Parts A to C to the state
   or walk that shows it, and gives the copy table of Part A item 3.
3. The Handoff states each of these as a rule S6b can test:
   - the name rules;
   - the percentage field and the money input as BO-07 uses them, including zero and the bounds;
   - the kind switch;
   - the list's order and grouping;
   - which commands carry the catalog version;
   - the deactivation confirmation, or why there is none.
4. Shown in the browser:
   - an edit refused `CATALOG_CHANGED` with the draft kept, both when the preset changed and when only the menu did;
   - *name in use* on create, edit and reactivation;
   - a kind switch;
   - deactivate, then reactivate;
   - M-6 over the form, with the form inert;
   - BO-01 with the draft held.
5. No state offers a date, time, schedule, automatic, stacking or approval control, and none offers a reorder.
6. Measurements at 1440×900 and 1920×1080 show no horizontal overflow at the longest name and the largest values.
7. No raw colour, size or weight; any new tokens registered and listed; `npm run verify` green if anything under
   `docs/design/tokens/` changed. The earlier checks pass.
8. The Handoff lists every question raised and not ruled, each with a proposed answer, and anything S6b or DESIGN-021
   (the POS addition, which draws the POS discount picker's served states) must know.

## Out of scope

- The POS discount picker and applying a preset (DESIGN-021, Phase 2). BO-08 and BO-03/BO-04, beyond the rail's new
  entry. BO-06 (E2). Building anything.

## Reporting

Commit on `agent/design-022` only, with path-scoped `git add`, after verify is green where it applies, and never push.
Commit as you finish each part, so the work survives an allowance limit. Write the Handoff below in full prose, ending
with `DONE` or `BLOCKED: <one question>`. Then run exactly one of:

    herdr agent prompt lead "design022: DESIGN-022 done — <one line>"
    herdr agent prompt lead "design022: BLOCKED — <question>"

## Handoff
