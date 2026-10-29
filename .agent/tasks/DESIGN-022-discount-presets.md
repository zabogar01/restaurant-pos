---
id: DESIGN-022
title: BO-07 Discount presets in Frost (slice F, BO-07 half), for S6b
category: ui
touches: [money, boundaries]
depends_on: [DESIGN-020]
owns: [docs/design/**, docs/DESIGN.md]
status: complete
cycles: 1
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

## Handover (lead, 2026-10-29): finish the Codex designer's draft on Claude Opus

**Owner exception** (DECISIONS 2026-10-29). Codex hit its usage limit at about 11:50, and it resets at 15:57. The owner
asked to continue on Claude Opus rather than wait, so a Claude Opus 5.5 designer (`design022c`) finishes this task, as
DESIGN-020 was finished on 2026-10-22. The lead routes the design review that follows; the other-family rule stands for
every other task.

**What the Codex designer (`design022`) did.**
- **Committed:** Part A as `1a8ef8e` (`F/presets.html` and its states), Part B as `618c89f` (`D`'s kind-switch rule),
  and Part C as `531b09d` (navigation, the gallery and the link migration).
- **Uncommitted** in this worktree when it stopped:
  - `docs/design/checks/design019.cjs`: the authorised rail change below;
  - `docs/design/checks/design022.cjs`: its extended run 2 checks;
  - **the Handoff below, a draft of about 280 lines**, committed by the lead with this section as-is.

**Finish it; do not restart it.** Read the draft Handoff whole, check it against the artifact and the acceptance
criteria, complete what is missing, and correct what is wrong. Commit the two check scripts first.

**The lead's check runs.**
- **Run 1** (evidence `/Users/fajars/.claude/jobs/3f069013/tmp/design022-r1`):
  - `design022.cjs`: 672/672, 58 states.
  - The earlier checks: `design012`, `013`, `014` (287/287), `016` (399/399), `018` (730/730) and `020` (754/754)
    passed; `design017` failed one check, F7, on the sitemap's `[ACTION]` tag; `design019` failed three, the F5 rails.
  - `npm run verify`: 142 files, 5226 tests passed.
  - The Impeccable detector on `presets.html` and `presets.css`: 8 `[cramped-padding]` findings
    (`section.table-editor`; the shared `office-dialog` ×3, `office-emergency` ×3, `office-notice` ×1).
- **Run 2** (evidence `…/design022-r2`): `design022.cjs` 683/683, 58 states; `design017` 349/349; `design019`
  998/998; no page errors.

**Lead rulings given to the Codex designer in its pane.** Record each in the Handoff as a ruling, not as your choice:
1. **`design019.cjs`, F5:** *Discount presets* is added to the three exact expected rail arrays (menu, tables,
   settings), in its drawn position. Nothing else there changes, and no assertion is weakened.
2. **The detector findings:** fix what belongs to BO-07. For any that is a shared pattern, the Handoff says why it is a
   false positive for a static detector, quoting the measured padding (`design022.cjs` now measures all eight).

**Checks.** The lead runs every check script, as *Constraints* says. Ask with `herdr agent prompt lead "design022c:
please run <script>"`, and run a final full set (`design022.cjs`, the eight earlier ones and `npm run verify`) before
you report done.

## Lead verify (2026-10-29)

The lead ran the final set in this worktree at `0d8cd31` (evidence `/Users/fajars/.claude/jobs/3f069013/tmp/design022-r3`).
`9b470c5` changes only this Handoff.
- **`design022.cjs`:** 683/683, 58 states.
- **The earlier checks:** `design012` (421 checks), `013` (371), `014` (287/287), `016` (399/399), `017` (349/349),
  `018` (730/730), `019` (998/998) and `020` (754/754) passed, all without failures or page errors.
- **`npm run verify`:** 142 files, 5226 tests passed.
- **The Impeccable detector on `presets.html`:** exit 2, eight `[cramped-padding]` findings. These are the shared
  `office-dialog` ×3, `office-emergency` ×3 and `office-notice`, and BO-05's `table-editor`, all inherited. The
  Handoff accounts for each with the measured inset (at least 12px), which `design022.cjs` asserts.

Every changed path is inside `owns`. The one earlier check script changed, `design019.cjs`, follows the lead's ruling 1.

Reviewer: you cannot reach the browser or run the checks. This note is the evidence for them.

## Round 2 (lead rulings, 2026-10-29), from the review

The review is `.agent/reviews/DESIGN-022-review.md` (Claude Opus, the owner's exception). All three findings are
accepted. The fixes are the review's own, so the lead reviews round 2 itself: it repeats the red for F1 by running the
new walk against round 1's `presets.js`, and runs every check.

**F1 (high), accepted: BO-07's list keeps a standing version, as BO-03's does.** BO-07 has BO-03's shape: one list read,
editors opened from the list, and the one shared catalog version. So `D:1818-1823`, DESIGN-019's standing-version rule,
applies to it, and the lead's DESIGN-020 clarification does not take BO-07 out of it (that clarification concerns
BO-04, which builds on its own read). In this round:
1. **`presets.js`:** keep a standing list version beside `facts`, as `menu.js` keeps `listVersion`.
   - A full read sets it.
   - A command answer advances it only when the answered version is exactly the standing version plus one, or equal to
     it for an unchanged answer; otherwise it stays.
   - `openEditor` takes `base` from the standing version.
   - The facts line keeps naming the version most recently read or answered (`D:1663-1666`), never the standing one.
   - In `partial` (the list read failed), the standing version stays at the last full read, or unset if there was none.
     An editor opened from such a list carries it, and a save is refused `CATALOG_CHANGED` and rereads. State which in
     the Handoff.
2. **`D`, *DESIGN-022 additions*:** one sentence saying that BO-07's list follows `D:1818-1823`, marked as behaviour.
   Do not edit the DESIGN-019 or DESIGN-020 text itself.
3. **The Handoff:** in the *Command versions* row, state the standing-version rule as a rule S6b can test.
4. **`design022.cjs`:** add the review's walk, run from the `default` state:
   - another tab changes *Regular customer* (`PresetFixture.other`);
   - this tab deactivates *Staff meal*, which answers version 14 while the list stands at 12;
   - this tab opens *Edit Regular customer*, renames it only, and saves.

   Expect `CATALOG_CHANGED`, the current 20% shown beside the draft, no write (the fixture's stored value is still the
   other tab's), and the facts line naming 14. Add the plus-one case too: no other tab, deactivate (answer 13), then an
   edit from the list saves without refusal.

**F2 (low), accepted.** In `I` BO-07's second *Must not invent* bullet, restore FR-M5's invariant at the end: "…; no
order reaches a negative total (FR-M5)."

**F3 (low), accepted. The lead's choice: shared constants, always shown.** On BO-07 the currency and precision beside
the fixed-amount field are input-format context. They come from the shared-code constants (ADR-012 rule 5), not from
the preset read, which does not carry them. So they are **not** withheld when that read is loading or has failed.
`D:1721-1726` stays as written for BO-08, where the facts belong to the settings read and are withheld with it. Say
this in one sentence in *DESIGN-022 additions* (BO-07 copy and composition) and in the Handoff's *Installation
facts* row. Do not change `item-editor.html`. Name the same inherited pattern there in *Questions and downstream
notes* for S6b and BO-04.

Change nothing else. Ask the lead for the full check set when done (`design022.cjs`, the eight earlier ones and
`npm run verify`). Add a *Round 2* section at the end of the Handoff, and end it with `DONE`.

## Round 2 lead review and acceptance (2026-10-29)

Round 2 is `04c2fd9`, `78ff867` and `44a186b`. The diff against `cb36143` is exactly the ruled items:
- F1: a standing `listVersion` in `presets.js`, the *BO-07's standing list version* rule in `D`, the Handoff's
  *Command versions* rule, and the skipped-answer and plus-one walks in `design022.cjs`;
- F2: FR-M5's negative-total clause restored in `I`;
- F3: the shared-constants sentence in `D` and the Handoff.

**The red, repeated by the lead.** Round 2's `design022.cjs` run against round 1's `presets.js` (from `cb36143`,
restored afterwards) gave 684/688. The four failures were "skipped answer names 14, list stands at 12", "editor carries
the standing version", "edit after skipped answer refused, no write" and "plus-one answer advances the list". The new
walks detect F1.

**The lead's final set** at `44a186b` (evidence `/Users/fajars/.claude/jobs/3f069013/tmp/design022-r4`):
- `design022.cjs`: 688/688, 58 states;
- `design012` (421 checks), `013` (371), `014` (287/287), `016` (399/399), `017` (349/349), `018` (730/730), `019`
  (998/998) and `020` (754/754): all passed, with no page errors;
- `npm run verify`: 142 files, 5226 tests passed.

The review's three findings are closed, and the task is **complete**. The look of BO-07 is the owner's (`F/presets.html`
in the gallery). S6b is written from this Handoff.

## Handoff

The Codex designer (`design022`) drew Parts A to C and drafted this Handoff;
the Claude Opus designer (`design022c`) finished it under the lead's handover
above. `design022c` checked the draft against the artifact, the run evidence
and the acceptance criteria, committed the two check scripts, extended the
padding measurement by one level, and wrote *Verification* and *Lead rulings*.
It changed no drawing, copy or rule, because the draft and the run evidence
agreed.

Implemented BO-07 as a Frost list with the existing 3:2 list/editor composition,
shared 40px fields, 36px form actions, 28px row actions, neutral result notices
and amber refusals. `presets.html` imports `office.css`, `tables.css`,
`settings.css` and `entry.css`; its small stylesheet only composes existing
tokens. The fixture runtime is local review plumbing, not production behavior,
authentication, persistence or seed configuration. No new token is registered.

The task's server facts take precedence over C1's sketch: there is no display
order control, edits send the whole name/kind/value, and inactive records may
be edited. No product document, architecture decision, server, client,
contract, database or production test is changed. The prescribed independent
design review still follows this handoff; this is not an owner acceptance.

### Parts and testable rules for S6b

| Part or ruling | Settled rule and evidence |
|---|---|
| A: empty, read, list | `empty`, `loading`, `load-error`, `default`. A fresh installation has zero rows. Read failure withholds counts and version facts; Try again repeats only the read. |
| List order and grouping | One table: active first, inactive second, preserving the server's oldest-created-first order within each group. The fixture preserves array order, including after a rename; it never sorts by name or exposes reorder. Every row has Edit and its applicable state action. |
| Overflow | `overflow`: 48 rows, 36 active and 12 inactive; a 32-code-point unbroken name, 100%, 12,3456% and 99.999.999. `.bocontent` owns list scrolling and its table header sticks to that content edge. The editor has its own bounded scrolling and sticky action footer. |
| Name | Trim surrounding spaces, then check empty, over 32 Unicode code points, Unicode Cc control character, in that order. No maxlength truncation. Native single-line inputs strip line breaks before receipt; the control fixture uses U+0007, which survives. Active names are unique without regard to case; inactive names may repeat. Duplicate comes from the authoritative command and rereads the list. |
| Percentage | DESIGN-018's parser unchanged: trim, remove one trailing percent sign and trim again; ASCII digits, comma or dot decimal separator, leading/trailing separator allowed with at least one digit. Refuse empty, leading minus, malformed number, more than four typed fraction digits, then more than 100. Exact conversion to canonical ppm string; no floating-point arithmetic. Display decimal comma and no trailing zeros, with `%` outside the input and after the value in the list. `invalid-percent-*` shows every refusal. |
| Fixed amount | DESIGN-020's unsigned parser: trim, accept ASCII digits or one-to-three digits followed by dot groups of three; refuse empty, leading minus, malformed number, then above 99.999.999. Convert by string/BigInt to a canonical integer string. No sign, exponent, decimal fraction, grouping space, comma or non-ASCII digit. Refused text remains as typed. `invalid-amount-*` shows every refusal. |
| Zero and upper bounds | Accept 0 silently for both kinds; the server permits it and no owner ruling grants a local refusal. Both first-create walks save zero. Percentage maximum 100; fixed maximum 99.999.999. The amount hint explains the later application-time subtotal cap, so a large stored amount is not confused with an invalid preset. |
| Kind switch | `kind-switch` and the interaction walk. Each kind keeps its own exact typed buffer while open; first switch starts the other buffer empty. No conversion between kinds. Switch clears old value errors and focuses the newly visible value input. Only selected kind/value is validated and sent. Dirty compares name and selected kind/value with the opening record. Clean Cancel or Discard drops both buffers; reopening reads the saved record. Stay and same-manager recovery keep both. Use current replaces the whole draft and clears the unused buffer; Keep retains both. |
| Command versions | Create, deactivate and reactivate carry no catalog version. Edit carries the version read when the form opened and the whole `{name, value}` with its selected kind. Every committed change advances the catalog version; an unchanged edit still checks its base and returns the unchanged version. The form base moves only on an answered save/unchanged or the manager's explicit stale choice. A reread alone never rebases. **Standing list version (round 2, `D:1818-1823`):** the list keeps the version its rows stand at, separate from the facts line. A successful full read sets it. A command answer advances it only when the answered version is exactly the standing version plus one, or equal to it for an unchanged answer; otherwise it stays. An editor opened from the list carries the standing version as its base. The facts line and the form's version line keep naming the version most recently read or answered, never the standing one. While the list read stands failed (`partial`), answers do not advance it: it stays at the last full read, or is unset if there was none, and an editor opened from that list carries it, so its save is refused `CATALOG_CHANGED` and rereads. Test: another tab changes a preset, this tab deactivates a different one (answer skips a version), then edits the changed preset; the edit is refused `CATALOG_CHANGED`, the current value is shown beside the draft and nothing is written. With no other tab, the same edit saves. |
| Snapshots | Standing editor copy says only discounts chosen afterwards change. No apply-to-open-orders action, approval gate or rate-change confirmation. Existing orders retain their name/kind/value snapshots. Configuration writes have no audit claim. |
| Deactivation | Confirmation is warranted because this action removes a choice from staff at the POS. `deactivate` names its subject, explains the picker and existing-order effects, and focuses Keep active. Escape keeps it active. Final action is destructive. `deactivated` announces the affected name; Reactivate acts without confirmation and `reactivated` announces it. Both commands have no version. |
| Reactivation name conflict | `duplicate-reactivate` rereads and opens the right inactive preset's editor, focusing its name. Saving the new name leaves it inactive; the separate Reactivate row action must then be pressed. This applies the DESIGN-018 payment-method recovery precedent. |
| Stale edit | `stale` shows current name and value beside the differing fields. `stale-menu` shows no difference and explicitly says the current preset has the same values. Save is held until Keep my changes or Use current preset. Both choices send nothing. The title says catalog, because a menu change can be the cause. `stale-reauth` uses the same words after M-6. `stale-read-failed` keeps the draft and holds Save until a successful read and choice. |
| Known/unknown results | `saving`, `saved`, `unchanged`, `failure`, `not-found`, `unknown`, `unknown-changed`, `unknown-read-failed`, `partial`. Unknown rereads once and never infers success, even from a matching row. A newer version combines uncertainty with explicit stale choices. Try again repeats a failed read only. Success inserts/replaces only the answered row, without a reread. Partial success keeps known rows, withholds counts and explains the list may be out of date. |
| State-command results | `pending-deactivate`, `pending-reactivate`, `unknown-deactivate`, `unknown-reactivate`, `status-failure`. No status editor or resend control; the ordinary row action remains the explicit command path after settlement. Successful state changes focus that row's Edit. |
| One form and one command | Another record/New/state action goes through departure if the open draft is dirty, pending or unknown. Pending makes every opener inert, including after the draft is discarded. Clean form handover closes the old form. Log out, rail and print incidents remain available through their normal decisions. |
| Departure | `unsaved`, `unsaved-switch`, `unsaved-logout`, `leave-pending`, `leave-unknown`; control walks also cover Escape, rail and browser Back. Stay is initial focus and Escape means Stay. Discard drops the local draft, not the sent command. A held response never chooses departure for the manager. A late authoritative answer after Discard updates the row silently, without reopening, announcing or moving focus. No beforeunload handler. |
| Session gates | `reauth`, `bo01-draft`, `reauth-confirm`, `bo01-confirm`, `reauth-decision`, `bo01-decision`. M-6 keeps work visible and inert. BO-01 closes working-area dialogs while retaining their mounted state. The same manager reopens a held dialog before focus returns; a different manager destroys the draft and pending presentation. Recovery never submits a command. |
| Shared incidents | Kitchen identity repeats inside deactivation/departure decisions and M-6. Routine non-modal editing does not defer the incident link. M-6 queues its incident destination after sign-in; dirty work still requires its departure decision. |
| B | Appended DESIGN-022 additions to D; no existing rule changed. Reusable behavior is the kind-switch buffer rule. BO-07-specific names, bounds, list order, copy and deactivation choice are marked BO-07 copy and composition. |
| C | `office.js` resolves presets to Frost and adds the entry to authored Phase 1 rails; the existing authored report rail now links to Frost. `manifest.js` registers all states and the gallery scope names BO-07. Inventory, sitemap and historical wireframe changes are reproduced below. |
| I permission-denied (n/a) | Removed the non-state: BO-07 is manager-only inside the session guard, and has no preset permission refusal or approval gate. Access loss uses the shared BO-01 mapping, not a new preset state. |
| B-21, B-22 and FR-F2 | No scheduling, date, time, trigger, minimum spend, stacking, precedence, automatic application, scope or approval control; no POS operation or reorder. |

### Every registered state

`?state=` accepts the following 58 entries; the artifact and manifest declare
identical lists. The gallery labels explain their review purpose.

| Group | States |
|---|---|
| Read/list | `default`, `empty`, `loading`, `load-error`, `overflow` |
| Forms | `create-percent`, `create-fixed`, `edit-percent`, `edit-fixed`, `kind-switch`, `edit-inactive` |
| Name validation | `invalid-name-empty`, `invalid-name-long`, `invalid-name-control` |
| Percentage validation | `invalid-percent-empty`, `invalid-percent-negative`, `invalid-percent-format`, `invalid-percent-decimals`, `invalid-percent-over` |
| Amount validation | `invalid-amount-empty`, `invalid-amount-negative`, `invalid-amount-format`, `invalid-amount-over` |
| Command results | `saving`, `saved`, `unchanged`, `failure`, `not-found`, `unknown`, `unknown-changed`, `unknown-read-failed`, `partial` |
| Name conflict | `duplicate-create`, `duplicate-edit`, `duplicate-reactivate` |
| Stale draft | `stale`, `stale-menu`, `stale-reauth`, `stale-read-failed` |
| State changes | `deactivate`, `deactivated`, `reactivated`, `pending-deactivate`, `pending-reactivate`, `unknown-deactivate`, `unknown-reactivate`, `status-failure` |
| Departure | `unsaved`, `unsaved-switch`, `unsaved-logout`, `leave-pending`, `leave-unknown` |
| Identity | `reauth`, `bo01-draft`, `reauth-confirm`, `bo01-confirm`, `reauth-decision`, `bo01-decision` |

### Exact product copy and accessible names

Braces are returned record values, never error keys or raw server messages.
All buttons have their visible text as their accessible name unless a name is
specified in the last column. The fixture's response chooser and simulation
controls are outside the product and must not be built in S6b.

| State | Element | Exact text | Accessible name / semantics |
|---|---|---|---|
| All frame states | Rail / top title / heading | Discount presets | link `Discount presets`; selected rail has `aria-current=page` |
| All frame states | Create | New preset | button `New preset` |
| List | Standing context | Named discounts staff choose at the POS. Existing orders keep the name and value applied to them. | paragraph |
| List | Facts | `{active} active · {inactive} inactive · Catalog version {version}` | withheld on failed read |
| List | Caption | Active first · Oldest created first within each status · Fixed amounts in IDR | table caption |
| List | Headers | Name · Discount · Status · Actions | column headers |
| List | Kind / status | Percentage · Fixed amount / Active · Inactive | plain text |
| List | Row actions | Edit · Deactivate · Reactivate | `Edit {name} — active`, `Edit {name} — inactive`, `Deactivate {name}`, `Reactivate {name}` |
| Empty | Title / body | No presets yet / Use New preset to create the first discount staff can choose. | empty collection |
| Loading | Status | Loading discount presets… | status; unread rows and counts withheld |
| Read failed | Title / body / action | Discount presets could not be loaded / Try again to read the discount presets. / Try again | alert; button `Try again`, repeats read only |
| Partial success | Title / body / action | The preset list may be out of date / The rows below are the ones this page knows, including your latest change. Try again to read the full list. / Try again | alert; button `Try again` |
| Create / edit | Title | New preset / `Edit {opening name}` | non-modal dialog labelled by title |
| Create | Context prefix | Choose the name staff will see at the POS. | followed by shared editor context |
| Inactive edit | Context prefix | Inactive preset. Saving does not reactivate it. | followed by shared editor context |
| Every form | Shared editor context | Changes apply only to discounts chosen afterwards. Orders already carrying this preset keep their saved name and value. | paragraph |
| Every form | Version | `Catalog version {version}` | latest read/answered version; withheld after read failure |
| Every form | Name / help | Preset name / 1–32 characters. Active presets must have different names. | textbox `Preset name` |
| Every form | Kind choices | Discount kind / Percentage / Fixed amount | fieldset `Discount kind`; native radios `Percentage`, `Fixed amount` |
| Percentage | Field / suffix / help | Percentage / % / 0 to 100, up to four decimal places. | textbox `Percentage`; suffix decorative |
| Fixed | Installation facts | Currency / IDR · Indonesian rupiah / Decimal places / 0 · amounts are whole rupiah / Fixed for this installation. | term/value rows, never controls; taken from the shared-code constants (ADR-012 rule 5), not the preset read, so always shown, including while that read is loading or failed (round 2, F3) |
| Fixed | Field / help | Fixed amount / 0–99.999.999; whole rupiah. When applied, the discount is capped at the order subtotal. | textbox `Fixed amount` |
| Every form | Footer / actions | Nothing is sent until you save. / Cancel / Save | buttons `Cancel`, `Save` |
| Invalid name | Empty / length / control | Enter a preset name. / Use 32 characters or fewer. / Remove control characters from the name. | inline; input `aria-invalid`, error in `aria-describedby` |
| Invalid percentage | Empty / negative / format / precision / ceiling | Enter a percentage. / Use 0 or more. / Enter a number, such as 10 or 10,5. / Use at most four decimal places. / Use 100 or less. | same inline semantics |
| Invalid amount | Empty / negative / format / ceiling | Enter a fixed amount. / Use 0 or more. / Enter whole rupiah, such as 10.000. / Use 99.999.999 or less. | same inline semantics |
| Duplicate create/edit | Name error | An active preset already uses this name. Choose another name. | name field; holder row says `Name in use` |
| Duplicate reactivate | Name error | An active preset already uses this name. Rename this inactive preset, save, then reactivate it. | name field in that inactive preset's editor |
| Pending save | Title / body / footer | Saving… / Wait for the result. Your draft is kept. / Wait for the save result. | focusable form status; inputs and Save disabled |
| Saved | Result | `{name} saved.` | page status, named record only |
| Unchanged | Result | `{name}: nothing changed. Catalog version {version} is still current.` | page status; no write claim |
| Stale, including after M-6 | Title / body | The catalog changed while you were editing / `Nothing was saved. The catalog has been read again at version {version}. Your draft is kept. Choose which values to keep.` | focusable alert |
| Stale with differences | Current field values | `Current name: {name} · Differs from your draft` / `Current kind: {kind} · Differs from your draft` / `Current value: {value} · Differs from your draft` | beside the corresponding field; fixed current value includes ` · IDR` |
| Stale without differences | Comparison | The current preset has the same values as your draft. | explicit acknowledgement still required |
| Stale | Status / choices / footer | `Current status: {Active or Inactive}.` / Keep my changes / Use current preset / Choose Keep my changes or Use current preset before saving. | buttons `Keep my changes`, `Use current preset`; Save disabled until choice |
| Stale read failed | Body / footer | The current preset could not be read. Your draft is kept. Try again reads the list; nothing is sent again. / Read the current preset before choosing which values to keep. | choices withheld; list's Try again reads only |
| Definite failure / NOT_FOUND | Title / body | Something went wrong / Nothing was saved. Your draft is kept. Press Save to try again. | alert; draft kept; NOT_FOUND additionally rereads |
| Unknown | Title / body | Outcome not confirmed / The outcome could not be confirmed. The list has been refreshed. Your draft is kept; nothing was sent again. | status; no resend action |
| Unknown failed read | Body | The outcome could not be confirmed. The list could not be refreshed. Your draft is kept; nothing was sent again. | version and count withheld |
| Unknown newer version | Body | `The catalog has been read again at version {version}. It may include this save. Your draft is kept; nothing was sent again. Choose which values to keep.` | stale comparison plus uncertainty; no success claim |
| Unknown after choice | Body | `Your draft now builds on catalog version {version}. The earlier save is still unconfirmed. Nothing was sent again.` | explicit Save remains the next command |
| Deactivation confirmation | Title / body | `Deactivate “{name}”?` / It will disappear from the POS picker. Orders that already carry it keep its name and value as applied. You can reactivate it later. | native modal, named title |
| Deactivation confirmation | Actions | Keep active / Deactivate | `Keep active — {name}`, `Deactivate {name}` |
| State pending | Result | `Deactivating {name}…` / `Reactivating {name}…` | focusable page status |
| Deactivated | Result | `{name} deactivated. It is hidden from the POS picker; existing orders keep it.` | page status |
| Reactivated | Result | `{name} reactivated. Staff can choose it at the POS.` | page status |
| State unknown | Result | `{name}: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again.` | failed read replaces middle sentence with `The list could not be refreshed.` |
| State definite failure | Result | `Something went wrong. {name} was not changed. Use its row action to try again.` | page status |
| State session refusal | Result | `{name} was not changed. Use its row action to try again.` | after the same manager resumes |
| Departure | Title / body / actions | Discard unsaved changes? / Your edits have not been saved. Stay to keep editing, or discard them before leaving. / Stay / Discard | modal; buttons `Stay`, `Discard` |
| Pending/unknown departure | Body | The save may or may not have succeeded. Leaving does not send it again. Stay to keep the draft, or discard it and leave. | replaces normal departure body |
| Logout departure | Title / body / actions | Log out and discard your changes? / The unsaved changes to this draft will be lost. Anyone signing in next starts a separate session. / Keep this draft / Discard changes and log out | exact shared logout copy |
| Pending/unknown logout | Additional context | The save may or may not have succeeded. Leaving does not send it again. | added separately |
| Discarded pending save | Page status | Waiting for an earlier save to finish. Nothing will be sent again. | clears silently on answer |
| M-6 | Title / body | Your session timed out / Your unsaved changes are kept. Continue as m.iqbal to resume them. | modal; work inert |
| M-6 | Fields / actions | Username / Password / Sign in as a different manager / Log out / Continue | username readonly; password secret; visible action names |
| Other-manager acknowledgement | Title / body / actions | Sign in as a different manager? / The current manager’s unsaved changes will not be available to the manager signing in. / Stay with current manager / Continue to sign-in | starts on Stay with current manager |
| Other-manager sign-in | Title / body / actions | Sign in as a different manager / Enter your own username and password. The current manager’s unsaved changes will not be available to you. / Back to m.iqbal / Log out / Sign in | editable Username and Password; Back clears credentials |
| BO-01 | Title / introduction | Back office / Sign in with your manager username and password. | shared sign-in composition |
| BO-01 held draft | Title / body / additional sentence | Your session has ended / Sign in again to continue. / The previous session’s unsaved changes are stored on this tab and are not submitted automatically. | protected work hidden |
| BO-01 | Fields / errors / action | Username / Password / Enter your username. / Enter your password. / Sign in | labelled inputs; button `Sign in` |
| M-6 local required password | Error | Enter your password. | password field |
| Shared frame | Actor / logout | M. Iqbal · Manager / Log out | different-manager fixture uses Ratna Ayu · Manager |
| Kitchen in deactivation | Deferred context | Decide whether to keep or deactivate this preset before opening print incidents. | repeats shared incident title and identity |
| Kitchen in departure | Deferred context | Decide whether to stay or discard before opening print incidents. | repeats shared incident title and identity |
| Kitchen in M-6 | Context / action | Continue your session to open print incidents. / Open print incidents after sign-in | button with visible name |
| M-6 queued incident | Body | Continue as m.iqbal to open print incidents. Your unsaved changes are kept. | password takes focus |

### Focus contract

| Moment | Target |
|---|---|
| Create, active edit or inactive edit opens | Preset name |
| Local validation failure | First invalid visible input in form order: name, then selected value |
| Name in use | Preset name, including reactivation recovery |
| Kind changes | Newly visible Percentage or Fixed amount input |
| Save pending | Focusable Saving notice |
| CATALOG_CHANGED or unknown with newer version | Form notice; choices follow in reading/tab order |
| Keep my changes / Use current preset | Save / Preset name |
| Definite form failure or plain unknown | Preset name |
| Saved / unchanged | Returned record's Edit; New preset if the opener no longer exists |
| Clean Cancel / Discard | Original Edit or New preset opener |
| Deactivation opens / Escape or Keep | Keep active / that row's Deactivate |
| State pending / unknown / definite failure | Page status |
| Deactivated / reactivated | That row's Edit, even if it moved between status groups |
| Departure opens / Escape or Stay | Stay (Keep this draft for logout) / Preset name, or Saving notice while pending |
| Same manager restores a form | Preset name holding the draft; retained name selection restored when available |
| Same manager restores confirmation / departure | Reopen first, then Keep active / Stay |
| Different manager signs in | New preset; previous draft cleared |

### Link ledger and inventory changes

Counts below use the same definition as `grep -c "prototype/"`: number of
matching source lines. A new artifact's before count is zero (file absent).
The common runtime retains its generic fallback for the remaining historical
screens; `presets` is now a Frost destination.

| Changed artifact | Before | After |
|---|---:|---:|
| `F/office.js` | 1 | 1 |
| `F/report-detail.html` | 5 | 4 |
| `F/presets.html` | 0 | 0 |
| `F/presets.js` | 0 | 0 |
| `F/presets.css` | 0 | 0 |
| `F/presets-states.js` | 0 | 0 |
| `visual-directions/manifest.js` | 0 | 0 |
| `visual-directions/index.html` | 0 | 0 |
| `P/presets.html` | 0 | 0 |

Tests changed: `design014.cjs`'s authored report-detail link count is 5 to 4.
By the lead's explicit ruling of 2026-10-29, `design019.cjs`'s F5 exact rail
expectation now includes Discount presets between Tables and Settings; the
same assertion checks menu, tables and settings. Nothing else in that script
is changed. No assertion is weakened. `design022.cjs` also records the computed
padding of the editor, the dialogs and the notices, down to the editor form's
children, as evidence only; it asserts nothing about them. The new check asserts every relevant
rendered rail reaches Frost and no Frost HTML/JS still names
`prototype/back-office/presets.html`.

The exact inventory, sitemap and wireframe diff follows.

```diff
diff --git a/docs/design/SCREEN-INVENTORY.md b/docs/design/SCREEN-INVENTORY.md
index 697c3c2..70022a8 100644
--- a/docs/design/SCREEN-INVENTORY.md
+++ b/docs/design/SCREEN-INVENTORY.md
@@ -850,9 +850,19 @@ that user's POS session on its next authenticated request* (FR-B3, AC-32) ·
 
 **Reached by / from.** Manager, from navigation.
 
-**States.** *empty* · *loading* · *error* · *permission-denied* (n/a) ·
-*overflow* · *deactivated preset — hidden from the POS picker but still
-readable on orders carrying it* (FR-F5, AC-17).
+**States.** *empty* · *loading* · *failed read with Try again* · *overflow* ·
+*create and edit — percentage or fixed amount, including a kind switch* ·
+*invalid name, percentage or fixed amount* · *saving* · *saved* · *unchanged* ·
+*name in use — create, active edit or reactivation* · *stale draft refused
+(CATALOG_CHANGED), including after M-6 and when only the menu changed* ·
+*deactivation confirmation* · *deactivated preset — hidden from the POS picker
+but still readable on orders carrying it* (FR-F5, AC-17) · *reactivated* (Q10) ·
+*inactive edit* · *definite failure with draft kept* · *outcome unknown with a
+reread and no resend* · *success while the list read stands failed*. Forms also
+show the departure decision, M-6 over inert work and BO-01 with the draft held.
+
+The Frost artifact is `visual-directions/frost/back-office/presets.html`;
+DESIGN-022's Handoff fixes its words, focus targets and testable field rules.
 
 **Requirements.** FR-B5, FR-F2, FR-F4, FR-F5.
 
@@ -860,8 +870,9 @@ readable on orders carrying it* (FR-F5, AC-17).
 - A preset is the **constrained common path**: any authenticating staff member
   applies it with no prompt (FR-F2, principle 3). Presets are not approval-gated
   here or at the POS.
-- Discounts are 0–100%; a fixed discount is capped at the subtotal; no order
-  reaches a negative total (FR-M5).
+- Percentages accept 0–100%, up to four decimal places. Fixed amounts accept
+  0–99.999.999 whole rupiah; the subtotal cap applies when the discount is
+  applied to an order, not when the preset is stored (FR-M5).
 - **No scheduling, no auto-apply, no date or time triggers** (FR-F7, B-21).
   This is the promotions boundary; a "valid from / valid to" field crosses it.
 - One discount per order (B-22) — no stacking rules, no precedence editor.
diff --git a/docs/design/SITEMAP.md b/docs/design/SITEMAP.md
index 89a5ef7..8ac223d 100644
--- a/docs/design/SITEMAP.md
+++ b/docs/design/SITEMAP.md
@@ -303,8 +303,11 @@ reports and audit.
 │   └── [MODAL] Deactivate — invalidates POS session ..... FR-B3
 │
 ├── BO-07 [SCREEN] Discount presets ...................... FR-B5, F5
-│   ├── [MODAL] Preset create / edit .................... FR-B5
-│   └── [MODAL] Deactivate — stays readable on orders ... FR-F5, C8
+│   ├── [INLINE] Preset create / edit — non-modal panel . FR-B5
+│   │   ├── [INLINE] Name in use — draft kept ........... FR-B5
+│   │   └── [INLINE] Stale draft — choose, then Save .... ADR-012 rule 13
+│   ├── [MODAL] Deactivate — stays readable on orders .... FR-F5
+│   └── [INLINE] Reactivate; name in use opens edit ..... FR-B5, Q10
 │
 ├── BO-08 [SCREEN] Settings ......................... FR-B1, B7, M1, M5, G1
 │   ├── [INLINE] Currency + precision — fixed, shown only .. FR-B1, M1
diff --git a/docs/design/prototype/back-office/presets.html b/docs/design/prototype/back-office/presets.html
index 235bd80..a5b9332 100644
--- a/docs/design/prototype/back-office/presets.html
+++ b/docs/design/prototype/back-office/presets.html
@@ -105,6 +105,8 @@
 </div></div><div class="device__caption">Back office &mdash; 1440 wide</div></div>
 
 <aside class="rail">
+  <h2>Frost composition</h2>
+  <div class="ann"><p><a href="../../visual-directions/frost/back-office/presets.html">BO-07 in Frost</a> supersedes this historical drawing: both kinds, validation, reactivation, preserved drafts and stale-draft recovery. See <a href="../../visual-directions/frost/back-office/presets.html?state=stale">the stale draft</a> and <a href="../../visual-directions/frost/back-office/presets.html?state=deactivate">deactivation confirmation</a>.</p></div>
   <h2>Purpose</h2>
   <div class="ann"><p>Define the named discounts staff may apply without approval.</p></div>
   <h2>Fixed by the PRD</h2>
```

### Verification

Neither designer ran a check script; the lead ran every one, and the evidence
stays outside the repository. Run 1 was taken before the three Part commits,
run 2 after them, and the final run on the finished branch.

- **Run 1** (`/Users/fajars/.claude/jobs/3f069013/tmp/design022-r1`):
  `design022.cjs` 672/672 over 58 states; `design012`, `013`, `014` (287/287),
  `016` (399/399), `018` (730/730) and `020` (754/754) passed. `design017`
  failed F7 (*sitemap uses defined node tags*) because the draft sitemap used an
  undefined `[ACTION]` tag; the committed sitemap uses the defined `[INLINE]`
  tag. `design019` failed its three F5 rail checks, because the rail now has a
  fourth entry; see ruling 1 below. `npm run verify`: 142 files, 5226 tests.
- **Run 2** (`…/design022-r2`): `design022.cjs` 683/683 over 58 states, no
  page errors; `design017` 349/349; `design019` 998/998.
- **Final run** at `0d8cd31` (`…/design022-r3`): `design022.cjs` 683/683 over
  58 states; `design012` (421 checks) and `design013` (371 checks) with no
  failures; `design014` 287/287; `design016` 399/399; `design017` 349/349;
  `design018` 730/730; `design019` 998/998; `design020` 754/754. No page error
  in any script. `npm run verify`: 142 files, 5226 tests passed. The Impeccable
  detector on `presets.html` exits 2 with the same eight `[cramped-padding]`
  findings as run 1, each accounted for below. Nothing under
  `docs/design/tokens/` changed, and no token was registered.

**Measurements (run 2, through `design022.cjs`).** At 1440×900 and at
1920×1080, for every one of the 58 states, the document's scroll width equals
its client width (1440 and 1920) and `.bocontent`'s scroll width equals its
client width (1220), so nothing overflows horizontally. Every table cell's
scroll width fits its client width in every state with the list visible,
including `overflow`: 48 rows (36 active, 12 inactive), the 32-code-point
name `WWWW…W`, 100%, 12,3456% and 99.999.999, in a 1172px table. With the
editor open the list is 689px and the editor 459px wide at both sizes (the
content column is capped at 1220px). Focus as measured: `kind-switch` on
`preset-amount`, `stale` on `form-notice`, `deactivate` on `keep-active`,
`reauth` on `resume-password`.

**Acceptance criterion 4, shown in the browser** (check names in run 2's
`report.json`, screenshots beside it):

| Shown | Checks | Screenshot |
|---|---|---|
| `CATALOG_CHANGED`, preset changed, draft kept | `stale held stale`, `changed fields show current values stale`, `Keep rebases without sending stale`, `explicit Save uses chosen version stale` | `stale-*.png`, `stale-choices-*.png` |
| `CATALOG_CHANGED`, only the menu changed | `stale held stale-menu`, `matching preset still needs explicit choice`, `real menu-only version conflict on fixed amount` | `stale-menu-*.png` |
| `CATALOG_CHANGED` after M-6 | `stale held stale-reauth`, `save after real M-6 cycle refuses stale draft` | — |
| Name in use on create, edit and reactivation | `duplicate kept, reread and holder duplicate-create / -edit / -reactivate`, `explicit reactivation after rename` | `duplicate-reactivate-*.png` |
| Kind switch | `first kind switch starts empty and focuses value`, `kind switch restores percentage`, `kind switch restores amount`, `kind edit sends whole selected value` | `kind-switch-*.png` |
| Deactivate, then reactivate | `named confirmation`, `cancel deactivation`, `deactivate state command`, `reactivate without confirmation` (for a percentage and a fixed amount) | `deactivate-*.png` |
| M-6 over the form, inert | `M-6 inert work reauth`, `M-6 cannot Escape reauth`, `same-manager draft retained reauth` | `reauth-*.png` |
| BO-01 with the draft held | `BO-01 closes working dialogs bo01-draft`, `same-manager draft retained bo01-draft`, `both buffers survive same-manager BO-01` | `bo01-draft-*.png` |

Acceptance criterion 5 is the check `no invented control {state} {width}`,
which passed in every state at both sizes. Subject-correct walks are
`subject-correct open`, `clean Cancel returns to subject`, `save changes only
subject` and `save focuses Edit` for all six fixture rows, both kinds among
them.

**The Impeccable detector** on `presets.html` reported the same eight
`[cramped-padding]` findings in run 1 and in the final run. None belongs to
BO-07: all eight are shared containers that `presets.html` uses unchanged. The
detector is static. It judges a container by its own padding and by whether
its direct children touch the container's edge. It does not follow the inset
one level further down, and it reports the incident sections, which are
`hidden` until a kitchen incident is open, as if they were laid out. Measured
padding from the final run's `measurements.json`, identical at 1440 and 1920:

| # | Finding | Element in `presets.html` | Shared from | Own padding | Measured inset of its content |
|---|---|---|---|---|---|
| 1 | `section.table-editor` | `#preset-editor` (state `create-percent`) | `tables.css`, DESIGN-019; also Tables, Menu and Settings | 0px | header `16px 20px`; the form is 0px, and inside it `.office-dialog__body` is `20px` and `.office-dialog__foot` `16px 20px` |
| 2 | `dialog.office-dialog` | `#deactivate-confirm` (`deactivate`) | `office.css`, DESIGN-012 | 0px | header `16px 20px`, incident section `12px 20px`, body `20px`, footer `16px 20px` |
| 3 | `dialog.office-dialog` | `#departure` (`unsaved`) | `office.css`, DESIGN-012 | 0px | header `16px 20px`, incident section `12px 20px`, body `20px`, footer `16px 20px` |
| 4 | `dialog.office-dialog` | `#presets-reauth` (`reauth`) | `office.css`, DESIGN-012 | 0px | header `16px 20px`, incident section `12px 20px`, form body `20px`, footer `16px 20px` |
| 5 | `section.office-emergency` | `#deactivate-emergency` | `office.css`, DESIGN-012 | `12px 20px` | its own padding |
| 6 | `section.office-emergency` | `#departure-emergency` | `office.css`, DESIGN-012 | `12px 20px` | its own padding |
| 7 | `section.office-emergency` | `#reauth-emergency` | `office.css`, DESIGN-012 | `12px 20px` | its own padding |
| 8 | `section.office-notice` | the BO-01 held-draft notice in `#presets-login` (`bo01-draft`), the page's only `<section class="office-notice">` | `office.css`, DESIGN-012; the same composition as `F/login.html` | `12px 16px` | its own padding; its children are 0px. The page's other notices (`#read-state`, `#form-notice`, `#page-status`) also measure `12px 16px` |

So nothing is cramped as rendered: every boundary has at least 12px of inset
between it and its text. Changing any of these would change a shared pattern
that the earlier checks guard, so nothing was changed. If the detector is to
run clean on back-office pages, it needs to be taught to follow the inset one
level down and to skip hidden elements; that is a tooling question, not a
BO-07 one.

### Lead rulings given during this task

These were ruled by the lead in the Codex designer's pane on 2026-10-29. They
are recorded as rulings, not as the designer's choices.

1. **`design019.cjs`, F5.** *Discount presets* is added to the three exact
   expected rail arrays (from menu, tables and settings), in its drawn position
   between Tables and Settings. Nothing else in that script changes, and no
   assertion is weakened. Committed as `8781a0e`.
2. **The detector findings.** Fix what belongs to BO-07; for any that is a
   shared pattern, say why it is a false positive for a static detector,
   quoting the measured padding. Answered in *Verification* above: all eight
   are shared, and none was changed.

### Questions and downstream notes

No unanswered product or server question was needed to draw this slice, and
no question is left open.
The task delegated the zero, kind-switch, grouping and confirmation choices;
the rules and their reasons are above. S6b must use real command responses,
records and the catalog version, not this fixture runtime. It must preserve
the shared general failure and session copy for the real authentication
responses; these drawings exercise local session lifetime, not credentials.

DESIGN-021 must show only active presets in the POS picker, preserve snapshots
on existing orders, and accept the fixed subtotal cap at application time.
A BO-07 edit can be stale because any menu row changed. Do not infer a new
POS approval gate from this desktop deactivation confirmation. The zero-valued
presets are valid and should not disappear merely because they change no total.

S6b and BO-04: `F/item-editor.html` (DESIGN-020) draws the same currency and
precision rows statically beside its money input. Round 2 rules BO-07's rows as
input-format context from the shared-code constants (ADR-012 rule 5), always
shown. `item-editor.html` is not changed here; whether BO-04's rows follow
BO-07 or `D:1721-1726`'s withholding is for whoever specifies BO-04's build.

DONE
