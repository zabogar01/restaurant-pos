---
id: DESIGN-018
title: BO-08 Settings and payment methods in Frost (slice F, BO-08 half), for S2b and S3
category: ui
touches: [money, boundaries]
depends_on: [DESIGN-017]
owns: [docs/design/**, docs/DESIGN.md]
status: review
cycles: 0
---
# DESIGN-018 — BO-08 Settings and payment methods (slice F, BO-08 half)

**Written** 2026-10-21 by the lead. The BO-08 half of design slice **F** in the accepted Phase 1 plan
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, §4: "then F's BO-08 half, with the payment
methods"), split from DESIGN-011's slice F (`.agent/reviews/DESIGN-011-back-office-audit.md:463`). The BO-07 half
(discount presets) is a later task.
**Owner:** a Claude Opus 5.5 designer, opened by hand in its own pane (name `design018`). *Owner exception* (DECISIONS
2026-10-21, "just this once use opus as designer and review"): Codex was at 16% of its allowance, so this task is
designed and reviewed by Claude Opus, with no Codex step. The other-family rule stands for every other task.
**Branch and place:** `agent/design-018`, cut from `development` at `513a436`, in the worktree
`../restaurant-pos-wt/DESIGN-018`. Touch nothing under `apps/`, `packages/`, `db/` or `e2e/`, and nothing in the main
checkout.

Nothing is built from this task directly. A design review follows; then the frontend halves of plan slices **S2b**
(BO-08's settings section) and **S3** (payment methods, server and screen together) are written from it. Neither
server half exists yet, but their behaviour is fixed by ADR-012, consult C1 and consult C2: draw what they will do,
and where you settle something they leave to the design (lengths, the rate field's format), say so in the Handoff as
a number or a rule S2a and S3 can copy.

Abbreviations, as in DESIGN-017: `I` = `docs/design/SCREEN-INVENTORY.md`, `D` = `docs/DESIGN.md`, `S` =
`docs/design/SITEMAP.md`, `P/` = `docs/design/prototype/back-office/`, `F/` =
`docs/design/visual-directions/frost/back-office/`. **C1** = `.agent/reviews/ARCH-018-c1-configuration-schema.md`;
**C2** = `.agent/reviews/ARCH-019-first-back-office-form.md`; **ADR-012** =
`docs/decisions/ADR-012-versioned-configuration.md`.

## Objective

When this task is done, BO-08 has a reviewed Frost composition, `F/settings.html`, in every state S2b and S3 will
build, with every word they will show (ADR-011 rule 24: the builder copies the design's words; it invents none). The
screen has two parts: the **settings** (the fixed currency and precision, the two rates, the five business details),
saved as one new immutable version per change; and the **payment methods** (cash and card, fixed, plus the
restaurant's own custom methods, created, renamed, deactivated and reactivated with C2's pattern). The rail gains its
Settings entry. This slice also draws the first **stale-draft refusal** (`SETTINGS_CHANGED`), which BO-04 and BO-07
copy later for `CATALOG_CHANGED`.

## Required inputs

Read these, in this order.

1. **ADR-012**, Part 1 (rules 1 to 8, above all 2, 3, 4, 5 and 8) and *Consequences* (the stale draft after M-6).
2. **C1** §0 (rules shared by the four slices: money and rates on the wire, text that reaches paper) and §1 (S2a: the
   table, the recommended length guards, the domain's answers, including "unchanged"). The guards are yours to settle.
3. **C2** in full for the pattern, and §8 (cash and card for S3) for the payment methods. C2's *OQ1* is answered
   (reactivation: yes).
4. **DESIGN-017's task file and Handoff** (`.agent/tasks/DESIGN-017-tables.md`): the first configuration form, its
   modal-or-non-modal decision, the copy table, focus rules, the stay-or-discard decision, M-6 over a form, BO-01
   with a draft held, and how `design017.cjs` registers states. **`D` *Configuration forms — DESIGN-017 / consult C2***
   (from `D:1486`) is now binding behaviour for every configuration form: follow it; do not restate it differently.
5. **What S1b built from it** (merged, PR #123), read for the patterns the builder will copy, not to change:
   `apps/back-office/src/tables/model.ts`, `apps/back-office/src/forms/fieldsInError.ts`,
   `apps/back-office/src/work/guard.ts`, and the PHASE1-S1b task file's *Handoff*, *How it works*, and its lead ruling
   **F4** (`.agent/tasks/PHASE1-S1b-tables-screen.md:481`, a success after a failed reread), which has no designed
   state yet. Draw BO-08's equivalent, and say whether F4's composition should change for BO-05 too.
6. **DESIGN-011**, BO-08 (`.agent/reviews/DESIGN-011-back-office-audit.md:202-220`), its P1 (subject-correct walks:
   each rate's own change, each method's own edit), P2 (fixture counts), S2/S3, and its Q6 proposal (four decimal
   places of a percent).
7. `I` BO-08 (`:817-841`) and the shared general failures (`I:83-124`); `I` ruling I-9 (`:1148`); `S` BO-08
   (`:288-292`); `P/settings.html`.
8. `D`: *Shared back-office patterns — DESIGN-012* (from `D:1335`), *Modal and sheet*, *Data table*, *Navigation (back
   office)*, *Notices and empty states*, *Buttons (back office)*, *Layout*, token provenance. Consume `F/office.css`,
   `F/office.js`, `F/patterns.html`; do not fork them. `F/tables.html`, `F/tables.css`, `F/tables.js` are the nearest
   precedent; share rather than copy where a pattern is the same.
9. The contract, for meaning: PRD FR-B1, FR-B7, FR-M1, FR-M5, §4 (tax-inclusive, service charge untaxed), §9 question
   1 (receipt content, still open beyond the five fields); BOUNDARIES B-1, B-3, B-4, B-8, B-9, B-13, B-24.
10. `packages/money/src/index.ts`, `rateFromPercent` (`:25-49`): what the client's conversion accepts today.

## Rulings that bind this task

**Settings**

- **Owner, Q5 (DECISIONS 2026-10-20):** currency and minor-unit precision are fixed at **IDR** and **0**. BO-08 shows
  them and **never offers to change them**, in every state including the first run. The inventory's "locked after
  the first order" no longer describes anything: there is no unlocked state. Draw it as a plain read-only fact, not
  a disabled control, a lock icon, or a warning.
- **Owner, Q2:** each rate is **0 to 100 percent** inclusive, a typing guard (11 typed as 110). Zero is a valid rate.
- **Owner, Q3:** a **non-zero service charge** may be stored in Phase 1. Draw no legal note about it.
- **Owner, Q12, and the lead's call on the footer (ARCH-018, DECISIONS 2026-10-20):** the business details are
  **outlet name, address, phone, an optional NPWPD, and a footer line**, all typed by the manager, none seeded.
  Outlet name, address, phone and footer are **required**; NPWPD is optional. The address may hold line breaks (C1:
  at most three lines); no other field may. Nothing else (receipt numbering, tax label, language) is on this screen:
  PRD §9 question 1 keeps it open for Phase 4. Say in one line on the screen that these details are printed on
  receipts; do not draw a receipt preview.
- **ADR-012 rule 4:** every change makes a version, a business detail as much as a rate. **One save sends the whole
  set** (both rates and the five details) and makes one new version, or none if nothing differs.
- **ADR-012 rule 1 and B-24: the first run.** A new installation has **no** settings version. The first-run state is
  real (B-24): every field empty, the currency and precision still shown, and saving it creates version 1. The rates
  are not pre-filled with zero or with 10 and 5: the manager types them.
- **ADR-012 rule 3: the stale save (`SETTINGS_CHANGED`).** A save built on an older version is refused; nothing is
  written. The client keeps the manager's draft, reads the current settings again, and **the manager decides**;
  nothing resends by itself (ADR-011 rule 20). Draw this state so the manager can see what changed (the reread
  values beside or behind their draft) and choose between keeping their draft (then Save, which now carries the new
  version) and taking the current values. You choose the composition and words. ADR-012 *Consequences* expects this
  most often **after M-6**, when a manager returns after thirty minutes: draw that walk too.
- **ADR-012 rule 4, "unchanged":** a save identical to the current version writes nothing and is not refused. Decide
  whether Save is offered when the draft equals the current values; either way, draw what the manager sees.
- **ADR-012 rule 2: version facts.** You may show the current version's number and when it came into force
  ("in force since", from `created_at`), and the manager who saved it (`created_by`, a column, lead's call; B-13: a
  real name). If you show any of them, list each in the Handoff as a field S2a's settings view must carry.
- **B-8, B-9, FR-B1: never retroactive.** A rate change affects **only orders opened afterwards**; there is no "apply
  to open orders" option. The plan asks for a **version-change confirmation** before a save that changes a rate: draw
  it, with words that say exactly that. Decide whether a save that changes only business details needs it too (ADR-012
  rule 4 says a corrected phone reaches only orders opened afterwards, the same rule), and say why.
- **The rate field (C1 §0, DESIGN-011 Q6; yours to settle, with a recommendation).** The manager types a **percent**;
  the client converts it exactly with `rateFromPercent` before sending, and the server never parses a percent. Four
  decimal places of a percent is exactly one part per million, so **at most four decimal places** is the lead's
  recommendation. Settle, and state in the Handoff as a rule S2b can test: the decimal separator the field accepts
  (`rateFromPercent` accepts only `.`; an Indonesian manager may type `,`, so say whether the client maps `,` to `.`
  before converting, or refuses it with a message), whether a leading zero (`05`) or trailing zeros (`10.50`) are
  accepted, how a stored rate is displayed (`11` or `11.0000` or `11%`), and the exact local error for each refusal
  (empty, not a number, negative, over 100, more than four decimal places). Every one is a local refusal, before
  sending; the server's `VALIDATION_FAILED` for the same is the general failure (C2 §6).
- **Lengths (C1 §1.1, yours to settle).** C1 recommends outlet name 1–64; address 1–200, at most three lines; phone
  1–32; NPWPD 1–32 when present; footer 1–120; and allows a charset for phone and NPWPD (digits, spaces, `+ - . ( )`).
  Draw the longest of each without overflow, and state every guard you settle in the Handoff. If you differ from C1,
  say why. Every text field: trimmed before checking, no control character (ADR-012 rule 8; a pasted control character
  is a local refusal if the field can receive one).

**Payment methods**

- **C2 §8 (lead: as recommended):** **cash and card are fixed kinds**, always offered, never created, renamed or
  deactivated; only **custom methods** are rows. Show cash and card in the list as fixed, with their display names as
  your copy (rule 24), and nothing that suggests they can be edited.
- **Owner, C2 OQ1 (DECISIONS 2026-10-20):** a custom method may be **created, renamed, deactivated and reactivated**
  (FR-B7 as now worded). The method's record is `{ id, name, active }`; draw nothing else per row (no fee, no
  integration, no ordering, no icon).
- **C2's pattern, as BO-05 drew it:** a name is unique among **active** methods, case-insensitively; `DUPLICATE` for
  create, rename, and **reactivation** into a held name, placed on the name with the list reread behind it; renaming an
  **inactive** method is allowed (the way out of a refused reactivation); no confirmation step is required for
  deactivate or reactivate (you may draw one; say why). Settle the name's length (BO-05's 32 is the precedent).
- **Lead's call on C2 §8's open point:** a custom name **may** equal the display name of cash or card; the server does
  not refuse it, and you draw no refusal for it. If you think the screen should warn, propose it in the Handoff; do not
  draw it as a refusal.
- **Empty is real (B-24):** with no custom methods, cash and card are still listed, and the way to create the first
  custom method is plain.
- **Not Phase 1:** a method's use in tendering is Phase 4 (FR-G1). Nothing on BO-08 refuses a deactivation because a
  method was used; do not draw such a state.

**Both parts**

- **`D` *Configuration forms — DESIGN-017 / consult C2*** binds: field-level validation, the refusal on a field,
  pending, saved, outcome unknown (draft kept, reread, **no "send again" control**, no inferred success), the departure
  decision, and the working-area dialog rule (M-6: open, visible and inert behind it; BO-01: closed with state kept,
  reopened for the same manager; a different manager destroys it). Do not change these rules; apply them.
- **Two forms on one screen.** The settings form and a payment-method form can each hold an unsaved draft. Decide, and
  say why against `D` and DESIGN-012's F1: whether both may be open at once; whether a command in one makes the other
  inert (C2: one command at a time, per form or per screen); and what the departure decision says when both hold work.
  Decide too whether the settings form is a modal decision under N2 or a non-modal panel, as DESIGN-017 decided for
  BO-05; consistency with BO-05 is the default, and a difference needs a reason.
- **Drafts (owner, 2026-10-14, 2026-10-16, 2026-10-20):** the same manager resuming through M-6 or signing in again at
  BO-01 gets the unsaved draft back; a different manager destroys it.
- **No `beforeunload` prompt** (C2 §7).
- **Tokens (lead, as in slices A, B, C, I, E1):** registry first; a missing value may be registered in
  `frost.tokens.json`, `frost.css` and `D` with `source: null` and a `designed` record, each listed in the Handoff. No
  raw colour, size or weight. No success green. Money and rates in the Frost numeral style the registry already has.

## What to draw

### Part A — BO-08, `F/settings.html`

1. **Settings, every state, by `?state=`:** first run (no version: every field empty, currency and precision shown);
   loading; failed to load, with *Try again*; the current settings (a populated version, with any version facts you
   chose); editing; local invalid input for **each rate refusal** you settle and for each business-detail refusal
   (empty required field, over-long, a fourth address line, a control character if receivable); the rate-change
   confirmation; saving (pending); saved (the new version current); unchanged (if Save is offered); **stale draft
   refused** (`SETTINGS_CHANGED`: draft kept, current values reread, the manager's choice), once from an ordinary save
   and once **after M-6**; general failure (draft kept); **outcome unknown** (draft kept, reread, no resend); the
   **stay-or-discard decision** with its pending and outcome-unknown copy; **M-6 over the form**; **BO-01 with a draft
   held**; and the longest value in every field.
2. **Payment methods, every state:** empty (cash and card only); the list (active and inactive custom methods with
   cash and card, your order and grouping, recorded); overflow (a long list inside its scroll owner; the longest name);
   create; rename; local invalid input; saving; saved; **name in use** for create, rename and reactivation; deactivated;
   reactivated; general failure; outcome unknown; the departure decision; and BO-08's equivalent of S1b's **F4** (a
   success after a failed reread).
3. **Subject-correct walks** (DESIGN-011 P1): changing the tax rate opens the tax rate, and the service-charge rate its
   own; every method's Edit opens that method's own name; a refusal names the right method; a success changes the
   right row. Fixture counts agree with the rows drawn (P2).
4. **The two-forms decision** above, drawn, with *Log out*'s and the rail's behaviour while each form is open.
5. **Copy for every state**, final words, listed in the Handoff as a table S2b and S3 can copy (state, element, exact
   text, accessible name where a test will drive it). Name the controls their tests will press: the rail's Settings
   entry; each settings field; the settings Save and Cancel; the confirmation's confirm and back controls; the stale
   state's two choices; New payment method; a method's edit control, name field, Save, Cancel, Deactivate, Reactivate;
   and the departure decision's Stay and Discard.
6. **Focus:** where it lands on opening each form, after a field error, after `DUPLICATE`, after the confirmation is
   dismissed, after `SETTINGS_CHANGED`, after save, after Cancel, and after a form is reopened for the same manager.

### Part B — the patterns, in `D`

1. Add to *Configuration forms* what this slice settles for every later form: **the stale-draft refusal** (behaviour:
   draft kept, reread, the manager decides, no resend; and which parts are BO-08's copy), so BO-04 and BO-07 can copy it
   for `CATALOG_CHANGED`; **the rate field** (format, conversion, refusals), which BO-07's percentage preset reuses;
   **a read-only installation fact** (currency and precision); and the two-forms rule if you make one. Say plainly which
   are behaviour and which are BO-08's copy. Change no existing rule.

### Part C — links, rail, gallery, inventory and wireframe

1. `F/office.js`: add `settings` where Frost destinations are resolved, so the rail's Settings entry and every authored
   link to `P/settings.html` reach `F/settings.html`. Report the `grep -c "prototype/"` counts before and after for each
   changed artifact, and that no Frost back-office artifact still links to `P/settings.html`.
2. Register the artifact and every state in `manifest.js` and the gallery. Write `docs/design/checks/design018.cjs`.
3. Bring `I` BO-08 and `S` BO-08 into line with the rulings above (show each changed line in the Handoff, `git diff`):
   - `I` purpose and states: currency and precision **fixed** (Q5), not "locked after the first order", in *States* and
     *Must not invent*; the range **0–100%** (Q2), replacing "Open Question 4 … not yours to settle"; the five business
     details (Q12); the stale-draft and first-run states; and the payment methods (FR-B7, I-9) with *name in use* and
     *reactivated*.
   - `S` BO-08: drop "locked after first order"; add the stale-draft refusal and the payment method's reactivate and
     *name in use* entries.
   - `P/settings.html` gains a pointer to the Frost artifact and loses IDR precision 2 and anything Q5 or C2 §8 removed.

## Constraints

- Light only, desktop only. One tax rate, tax-inclusive, service charge untaxed (§4, B-3, B-4): no tax groups, no
  per-item rates, no jurisdiction packs. No payment integration. No receipt preview. No POS operation.
- *Invent, revert, ask:* nothing the inventory, the PRD, ADR-012, C1 or C2 does not grant.
- Every person is named (B-13): the top bar shows the real manager's name in the fixture, and so does any "saved by".
- The four product documents are not edited; ADR-012, C1 and C2 are not edited.
- Do not change DESIGN-012's, DESIGN-016's or DESIGN-017's shared behaviour except as Part B adds rules; slices A, B,
  C, I and E1 must still pass their checks (`design012.cjs`, `design013.cjs`, `design014.cjs`, `design016.cjs`,
  `design017.cjs`).
- Measure in a browser at 1440×900 and 1920×1080. Each run of a check script needs the owner's approval in the pane;
  ask before it, not after. Run the checks with `PLAYWRIGHT_MODULE="$PWD/node_modules/playwright" node
  docs/design/checks/designNNN.cjs`. Evidence stays outside the repository; quote measurements in the Handoff.

## Tests expected to change

None outside `docs/design/`. If a token is registered, `packages/tokens/test/tokens.test.ts` must pass unchanged. The
earlier check scripts may need their expected prototype-link counts updated for Part C; change only those expectations,
say so, and weaken no assertion.

## Acceptance criteria

1. `F/settings.html` exists, imports the shared `office.css`, and every state in Part A items 1 and 2 is reachable by
   `?state=` and registered. Red if one is missing.
2. The Handoff maps every `I` BO-08 state (as amended), every ruling above and every item of Parts A to C to the state
   or walk that shows it, and gives the copy table of Part A item 5.
3. The Handoff states, as rules S2a, S2b and S3 can test: the rate field's accepted input, conversion, display and
   refusals; every length and charset guard; and every version fact the view must carry.
4. Shown in the browser: the stale-draft refusal from an ordinary save and after M-6, with the draft kept; the
   rate-change confirmation; the two-forms behaviour as decided, with *Log out*'s; focus as Part A item 6 says; M-6
   over a form with the form inert; BO-01 with the form closed and BO-01's fields accepting input.
5. Currency and precision are never editable in any state, including the first run; no rate is pre-filled at first
   run; cash and card are never editable.
6. Measurements at 1440×900 and 1920×1080: no horizontal overflow at the longest value of every field and the longest
   method name; the list's header sticky in overflow.
7. No Frost back-office artifact links to `P/settings.html`; counts in the Handoff. No raw colour, size or weight; new
   tokens registered and listed; `npm run verify` green if anything under `docs/design/tokens/` changed. Slices A, B,
   C, I and E1 checks pass.
8. The Handoff lists every question raised and not ruled, each with a proposed answer.

## Out of scope

- BO-07 (the other half of slice F), BO-03 and BO-04 (D), BO-06 (E2); tendering (Phase 4); the receipt's layout and
  any field PRD §9 question 1 still holds open; capturing a settings version when an order opens (Phase 2); any server
  or API shape beyond the facts listed for the Handoff; building anything.

## Reporting

Commit on `agent/design-018` only, after verify is green where it applies, and never push. Write the Handoff below in
full prose, ending with `DONE` or `BLOCKED: <one question>`. Then run exactly one of:

    herdr agent prompt lead "design018: DESIGN-018 done — <one line>"
    herdr agent prompt lead "design018: BLOCKED — <question>"

## Lead verify (2026-10-21)

The lead read the whole Handoff and checked the branch at `95b199b`. The tree is clean. Every changed path is inside
`owns` (`docs/design/**`, `docs/DESIGN.md`) or is this task file. No token or package changed, so `npm run verify` does
not apply. The lead ran all six checks in this worktree after `npm ci`, with evidence outside the repository:
`design018.cjs` 702/702 (128 state and viewport combinations, no errors); `design012.cjs` 293 checks and 52 states, no
failures; `design013.cjs` 371 checks and 41 states, no errors; `design014.cjs` 288/288; `design016.cjs` 399/399;
`design017.cjs` 347/347. The only change to `design014.cjs` is its two expected prototype-link counts (menu 35 to 34,
report-detail 6 to 5), which match the Settings link migration. The lead looked at the `default` and `stale`
screenshots at 1440. **For the reviewer:** in `stale`, the facts line above the form still reads "Version 4 · In force
since 12 Oct 2026, 14:05 · Saved by M. Iqbal", while the notice says version 5 is now in force. Check whether that line
names the version in force or the version the draft builds on, and whether either reading is honest in `stale`,
`unknown-changed` and after *Keep my changes*.

**Review:** Claude Opus, hand-opened, under the owner exception above; the dispatcher would pick Codex.

## Handoff

### Delivery

Designed by `design018` (Claude Opus 5.5, under the owner's one-time exception) on `agent/design-018`. The artifact is
`F/settings.html` with `settings.css` and `settings.js`. It imports the shared `office.css` and `office.js`, BO-01's
`entry.css`, and BO-05's `tables.css`, whose list and non-modal panel classes the payment methods reuse rather than
copy. It is a local review fixture: no setting, method, credential or request is stored or sent, and S2b and S3 must
use the real settings and tender routes. All 64 states are reachable by `?state=` and registered in the artifact, in
`manifest.js` and in the gallery. Nothing under `apps/`, `packages/`, `db/`, `e2e/` or `docs/design/tokens/` changed;
**no token was added**, so `npm run verify` was not required and was not run.

Files changed: `F/settings.html`, `F/settings.css`, `F/settings.js` (new); `docs/design/checks/design018.cjs` (new);
`F/office.js` (Settings resolves to Frost); `F/menu.html` and `F/report-detail.html` (their authored Settings link);
`F/tables.html` (the Phase 1 rail gains Settings, and its fixture note says so); `manifest.js` and `index.html` (the
gallery); `docs/design/checks/design014.cjs` (its expected prototype-link counts only); `docs/DESIGN.md` (Part B);
`SCREEN-INVENTORY.md`, `SITEMAP.md` and `P/settings.html` (Part C); and this Handoff.

### The decisions, and why

**Composition.** BO-08 is one screen in two parts. *Rates and receipt details* is a read view in two columns: Money
(currency and decimal places) and Rates on the left, Receipt details on the right. Each group is a white group with
the data-table header's tinted band as its label, so it reads as part of the back office's table vocabulary, not as a
new card. Each editable row carries its own small **Change** action; pressing it opens the whole set as one form, in
place, with focus in that row's field. That makes every entry subject-correct (DESIGN-011 P1: *Change tax rate* opens
the tax rate, *Change service charge rate* its own), while keeping ADR-012 rule 4's one save of the whole set. The
form is one bordered panel with the same two columns as plain labelled regions (never boxes within the panel). *Payment
methods* sits below with BO-05's list-and-panel composition. At 1440×900 the read view ends at y 650 and the methods
heading is visible without scrolling.

**Modal or non-modal: non-modal, as BO-05.** The settings form is an inline form in the page and the method form is
BO-05's non-modal panel. Consistency with BO-05 is the default and nothing here argues against it: Log out, the rail
and incident actions stay live (DESIGN-012 F1), and only decisions are modal: the rate confirmation and the
stay-or-discard decision, which repeat the kitchen emergency and defer its action under N2.

**Two forms on one screen: one form open at a time, one command in flight at a time, per screen.** Every opener on
BO-08 (each Change, *Enter settings*, *New payment method*, each method's Edit, Deactivate and Reactivate) goes through
the departure decision of whichever form is open when it is dirty or its save is pending or unknown, and simply closes
a clean form. While any command on the screen is pending (a settings save, a method save, a method status command, or
a discarded save still outstanding), every opener on the screen is inert, and the waiting sentence appears in the
status of the part that sent it; after an unknown outcome they are live again. Why: `D`'s command rule already makes
every record action inert while a command is pending (BO-05), and C2 §6 allows one command at a time "per form or per
screen"; per screen is the only reading under which the departure decision never has to describe two drafts, so its
copy stays BO-05's verbatim, and S1b's `work/guard.ts`, which holds one registration and one status, serves BO-08
unchanged (the screen registers once; its status is the open form's). The cost is that a manager editing settings who
presses a method's Deactivate meets the decision first; that is the same rule BO-05 applies to a row action while a
table form is open, and switching tasks is the moment to decide about a draft. *Log out* with either form open: the
built logout confirmation, verbatim, when dirty or uncertain; directly otherwise. The rail: Stay or Discard when
dirty or uncertain; directly otherwise.

**Save is offered when the draft equals the current values.** A clean Save still proves the draft is not stale, and
the server's no-op answer is drawn (`unchanged`: "Nothing changed. Version 4 is still in force."). The client tells
`unchanged` from `saved` by the answer's version number: equal to the one it carried means nothing was written.

**The rate-change confirmation** is shown before a save that changes a rate, and names each changed rate from and to.
It is **not** shown at the first run (there is no earlier rate) or for a save that changes only business details.
Those too reach only orders opened afterwards (ADR-012 rule 4), and the form's standing context sentence says so for
every save, but a corrected phone number moves no money, and a confirmation spent on it teaches the manager to click
through the one that does (PRODUCT principle 3; I-11 keeps confirmations for what matters). When rates and details
change together, the confirmation adds "Your other changes are saved in the same version."

**The stale-draft refusal (`SETTINGS_CHANGED`).** Nothing was written; the draft and form stay; the current settings
are read once; beside every field whose current value differs from the draft, a tinted line reads "Now in force:
{value}". The notice names the version now current, who saved it and when. Save is disabled, with a visible reason,
until the manager chooses **Keep my changes** (the draft now builds on that version; nothing is sent; Save is the next
explicit step and carries it) or **Use current settings** (the fields take the current values and the form is clean
against them; nothing is sent). The acknowledgement is never implicit: Save does not stand in for *Keep*. Any
confirmation then compares the draft with the version it now builds on, so a draft that undoes another manager's change
shows it being undone ("Service charge from 5,5% to 5%"). The after-M-6 walk is drawn and checked: the manager edits,
times out, another save lands meanwhile, the manager resumes into the draft, presses Save, and meets the refusal with the
draft kept. Its copy also holds when the newer version was the same manager's, in another tab (`stale-reauth`).

**Outcome unknown on the settings form.** If the reread shows the version the draft builds on, the plain uncertainty
is shown. If it shows a newer version, the uncertainty is shown with the stale comparison and its two choices, and says
"It may be this save" (never that it is). The common case, a lost response to one's own save, therefore reads "It has
the same values as your draft", and *Keep my changes* then Save is answered `unchanged`: the manager's explicit resend
is harmless and nothing is inferred. If the reread fails, the version facts are withheld and Try again repeats the
read only. **The version a draft builds on changes only three ways**: an authoritative success, an `unchanged` answer,
or the manager's choice in the stale state. A reread alone never moves it, because a silently rebased draft would
overwrite whatever the reread contained (ADR-012 rule 3).

**Currency and precision** are plain term-and-value text ("IDR · Indonesian rupiah", "0 · amounts are whole rupiah",
"Fixed for this installation.") in the read view, in the form and at the first run. They are never an input, a
disabled or read-only control, a lock or a warning, and have no Change action. They come from the settings read (ADR-012
rule 5), so they are withheld while it loads or has failed.

**Cash and card** are the first two rows of the method list, "Cash" and "Card", status "Always offered", with an empty
actions cell. Custom methods follow, active before inactive, names in natural case-insensitive order. A method row
shows its name, status and actions only.

**No confirmation for deactivate or reactivate**, as BO-05: both are reversible, nothing in Phase 1 depends on a
method, and the server prevents nothing harmful that a confirmation would.

**F4 (a success while the list read stands failed).** BO-08 draws S1b's lead ruling as built (known rows with the
answered record applied, the named result announced and its Edit focused, New live, counts withheld; Try again repeats
the read only) with **one change: the alert's words.** "Payment methods could not be loaded" is untrue above a list
that is drawn, so the partial state reads "The list may be out of date" / "Payment methods could not be read again. The
rows below are the ones this page knows, including your latest change. Try again to read the full list." **BO-05
should adopt the same change** ("The list may be out of date" / "Tables could not be read again. The rows below are the
ones this page knows, including your latest change. Try again to read the full list."). It is a copy change in
`copy.ts` and its test, not a behaviour change; I did not edit BO-05's artifact for it. A failed list read with no
answered record still withholds the list with the plain read-failure alert.

**The Phase 1 rail** now lists Tables and Settings in both Frost artifacts; `tables.html`'s authored rail gained the
Settings link and its fixture note says "Tables and Settings only". S2b adds Settings to the built manifest and rail.
The business-day indicator is suppressed on BO-08, as on BO-05.

### Rules S2a, S2b and S3 can test

**The rate field (S2b; BO-07's percentage preset reuses it).**

| Rule | Exact behaviour |
|---|---|
| Normalisation | Trim; if the text ends with `%`, remove that one `%` and trim again. |
| Accepted shape | Digits with at most one decimal separator, `,` or `.`, and at least one digit in all. `05`, `,5`, `.5`, `10.`, `10,50`, `100,0000`, `11%`, `11 %` and ` 7 ` are accepted. |
| Conversion | `,` becomes `.`; leading zeros of the whole part are dropped, keeping one; an empty whole part becomes `0`; an empty fraction is dropped; the string goes to `rateFromPercent`; the resulting parts per million must be at most 1,000,000. No float. The server never parses a percent. |
| Examples | `05` → 50000; `10,5` and `10.50` → 105000; `,5` → 5000; `0,0001` → 1; `100` → 1000000. |
| Refusal order | empty → negative → not a number → more than four decimal places → over 100. Each is a local refusal before sending; the server's `VALIDATION_FAILED` for the same is the general failure (C2 §6). |
| Empty | "Enter the tax rate." / "Enter the service charge rate." (`%` alone is empty.) |
| Negative | A leading ASCII `-` before an otherwise accepted number (`-5`, `- 5`): "Use 0 or more." |
| Not a number | Anything else: letters, a second separator (`1.000,5`), `+`, an exponent (`1e2`), grouping spaces (`1 000`), a Unicode minus (`−5`): "Enter a number, such as 10 or 10,5." |
| Decimal places | More than four digits after the separator, counted as typed (`5,12345`, `10.00000`): "Use at most four decimal places." |
| Over 100 | More than 1,000,000 ppm (`101`, `100,0001`): "Use 100 or less." |
| Display | Decimal comma, no trailing zeros: 0 → `0`, 1 → `0,0001`, 55000 → `5,5`, 105000 → `10,5`, 999999 → `99,9999`. The read view adds `%` (`10,5%`); the field holds the same text without `%`, which sits beside it. The comma matches money, where `.` groups thousands (`155.925`). |
| Zero and pre-fill | Zero is a valid rate. Neither rate is pre-filled at the first run. |

**Lengths and charsets (S2a's schema and database checks; S2b's local checks).** Lengths in UTF-16 units, as zod
counts; every text is trimmed before checking; a blank optional NPWPD is absent (null). Check order per field: empty,
too long, too many lines (address), phone charset, control character.

| Field | Required | Guard | Refusal copy |
|---|---|---|---|
| Outlet name | Yes | 1–64; one line; no control character | "Enter the outlet name." · "Use 64 characters or fewer." · "Remove control characters from the outlet name." |
| Address | Yes | 1–200 including line feeds; at most three lines (two LF); no control character but LF (a pasted tab is refused) | "Enter the address." · "Use 200 characters or fewer." · "Use three lines or fewer." · "Remove control characters from the address. Line breaks are allowed." |
| Phone | Yes | 1–32; only digits, spaces and `+ - . ( ) /` | "Enter the phone number." · "Use 32 characters or fewer." · "Use only digits, spaces and + - . ( ) /." |
| NPWPD | No | 1–32 when present; no charset; no control character | "Use 32 characters or fewer." · "Remove control characters from the NPWPD." |
| Footer line | Yes | 1–120; one line; no control character | "Enter the footer line." · "Use 120 characters or fewer." · "Remove control characters from the footer line." |
| Method name (S3) | Yes | 1–32; no control character; unique among active methods, case-insensitively | "Enter a method name." · "Use 32 characters or fewer." · "Remove control characters from the name." · `DUPLICATE` copy below |

Where I differ from C1: **phone adds `/`**, so that two numbers fit on one receipt line ("021 5550 1340 / 0812 345
6789"); **NPWPD has no charset**, because regional NPWPD formats mix letters and punctuation (the fixture's
`P.2.0012345.07.001`), and refusing a real registration number is worse than accepting a typo. Every other length is
C1's. Single-line fields are native inputs, which drop a pasted line break before validation (DESIGN-017's finding);
the control-character refusal is drawn with U+0007 and ESC, which survive.

**Version facts S2a's settings view must carry** (each shown on screen): the version number (`null` before the first
save); `createdAt` of the current version, shown as `D Mon YYYY, HH:MM` in the restaurant's time zone, 24-hour ("12
Oct 2026, 14:05"); and the saving manager's display name (`created_by`, B-13), shown as "Saved by M. Iqbal" and named in
the stale and unknown notices. Also the two rates as ppm strings, the five details (NPWPD nullable), and the constants
`currency` (`IDR`) and `minorUnitPrecision` (`0`). The save command should answer this same view for the version now
current, so that the facts line updates after a success without a reread (C2 §3); its version number equal to the one
carried means `unchanged`. **If the lead drops `created_by`**, remove "· Saved by {name}" from the facts line and
"saved by {name}" from the two notices; nothing else changes.

### Copy and accessible names

Braces are values from the record or the read, never server text. Every string below is product copy; the fixture's
review panel, its response selector and its disclaimers are not. **Unchanged from BO-05 and quoted verbatim there
(DESIGN-017's Handoff and `apps/back-office/src/copy.ts`):** the departure decision (Discard unsaved changes? / Stay /
Discard and both bodies), the built logout confirmation, the pending/unknown context sentence, the emergency sentences
of the departure decisions, the waiting sentence, M-6 and its different-manager steps, and BO-01's held-draft
composition.

| State / context | Element | Exact text | Accessible name / test target |
|---|---|---|---|
| Frame | Rail entry, page heading, top bar | Settings | link `Settings` in group `Configuration`; heading `Settings` |
| Settings part | Heading | Rates and receipt details | heading level 2 |
| Settings part | Version facts | `Version {n} · In force since {12 Oct 2026, 14:05} · Saved by {name}` | `#version-facts`; withheld while loading, failed, or after an unknown outcome whose reread failed |
| First run | Version facts | Not saved yet. Saving creates version 1. | |
| Loading | Status | Loading settings… | status |
| Read failed | Title / body / action | Settings could not be loaded / Try again to read the settings. / Try again | alert; button `Try again` (read only) |
| First run, form closed | Empty heading / body / action | No settings saved yet / Enter the rates and receipt details. Saving creates version 1. / Enter settings | button `Enter settings` |
| Read view | Group labels | Money · Rates · Receipt details | headings level 3 (sentence case; styled as table headers) |
| Read view | Currency, decimal places | Currency — IDR · Indonesian rupiah; Decimal places — 0 · amounts are whole rupiah; note: Fixed for this installation. | plain `dt`/`dd`, no control |
| Read view | Rate rows | Tax rate (Included in menu prices) — `{rate}%`; Service charge (Added to the bill · not taxed) — `{rate}%` | |
| Read view | Receipt note | These details are printed on receipts. | |
| Read view | Detail rows | Outlet name · Address · Phone · NPWPD (Optional) · Footer line; an absent NPWPD reads Not set | |
| Read view | Change actions | Change | buttons `Change tax rate`, `Change service charge rate`, `Change outlet name`, `Change address`, `Change phone`, `Change NPWPD`, `Change footer line` |
| Form | Title | Edit settings · first run: Enter settings | form named by its title |
| Form | Context | Changes apply to orders opened after you save. Orders already open keep the settings they opened with. · first run: Nothing is saved yet. Enter every rate and detail; saving creates version 1. | |
| Form | Field labels | Tax rate · Service charge rate · Outlet name · Address · Phone · NPWPD · Footer line | textboxes with these names (Address is multi-line); `%` beside each rate is hidden from assistive technology |
| Form | Help | Included in menu prices. 0 to 100, up to four decimal places. · Added to the bill, not taxed. 0 to 100, up to four decimal places. · Up to 64 characters. · Up to three lines and 200 characters. · Up to 32 characters: digits, spaces and + - . ( ) / · Optional. Up to 32 characters. · One line, up to 120 characters. | `{id}-help`, in each field's description |
| Form | Field errors | as in the two tables above | `{id}-error`, first in the field's description; field `aria-invalid` |
| Form | Actions | Save / Cancel | buttons `Save`, `Cancel` |
| Rate confirmation | Title | Save new rates? | modal dialog `Save new rates?` |
| Rate confirmation | Change lines | `{Tax rate or Service charge} from {old}% to {new}%`, one per changed rate | list |
| Rate confirmation | Rule | Orders opened after you save use the new rates. Orders already open keep the rates they were opened with. Closed orders and day reports never change. | dialog description |
| Rate confirmation | With detail changes too | Your other changes are saved in the same version. | |
| Rate confirmation | With a kitchen emergency | Decide whether to save the new rates before opening print incidents. | under the repeated incident title and identity |
| Rate confirmation | Actions | Back to editing / Save new rates | buttons; initial focus `Back to editing` |
| Pending | Title / body | Saving… / Wait for the result. Your draft is kept. | focusable form status; fields and Save disabled |
| Saved | Result | `Settings saved as version {n}. Orders opened from now on use them.` | settings status |
| Unchanged | Result | `Nothing changed. Version {n} is still in force.` | settings status |
| Settings changed | Title | Settings changed while you were editing | form alert |
| Settings changed | Body | `Nothing was saved. Version {n} was saved by {name} on {date, time}, after you started.` then `Fields where it differs from your draft show its value.` (or `It has the same values as your draft.`) then `Choose which to keep.` | |
| Settings changed | Choices | Keep my changes / Use current settings | buttons with these names |
| Settings changed | Save reason | Choose Keep my changes or Use current settings first. | Save's description while disabled |
| Settings changed | Beside a differing field | `Now in force: {value}` (`not set` for an absent NPWPD) | `{id}-current`, in the field's description |
| After Keep | Title / body | `Your changes now build on version {n}` / Nothing has been saved yet. Press Save to save them. | form status |
| After Use | Title / body | `The form now shows version {n}` / Nothing was saved. Edit it and save, or Cancel to close. | form status |
| General failure | Title / body | Something went wrong / Nothing was saved. Your draft is kept. Press Save to try again. | form alert; no Try again |
| Unknown, same version | Title / body | Outcome not confirmed / `The outcome could not be confirmed. The settings have been read again; version {n} is in force. Your draft is kept; nothing was sent again.` | form status |
| Unknown, newer version | Title / body | Outcome not confirmed / `The outcome could not be confirmed. The settings have been read again: version {n}, saved by {name} on {date, time}, is now in force. It may be this save.` then the stale comparison sentence, then `Your draft is kept; nothing was sent again. Choose which to keep.` | form status; the two choices as above |
| Unknown, reread failed | Title / body / action | Outcome not confirmed / The outcome could not be confirmed. The settings could not be read again. Your draft is kept; nothing was sent again. / Try again | button `Try again` (read only) |
| Methods part | Heading / count | Payment methods / `{active} active · {inactive} inactive custom methods` | heading level 2; count withheld unless the list read succeeded |
| Methods list | Caption / headers | Cash and card are always offered · Custom methods: active first, names in order / Name · Status · Actions | table |
| Methods list | Fixed rows | Cash — Always offered; Card — Always offered | no control in these rows |
| Methods list | Custom status | Active / Inactive | |
| Methods empty | Note | No custom payment methods yet. Use New payment method for any way of paying other than cash or card. | |
| Methods | Create | New payment method | button `New payment method` |
| Methods | Row actions | Edit · Deactivate · Reactivate | `Edit {name} — active` / `Edit {name} — inactive`, `Deactivate {name}`, `Reactivate {name}` |
| Methods loading | Status | Loading payment methods… | status |
| Methods read failed | Title / body / action | Payment methods could not be loaded / Try again to read the payment methods. / Try again | alert; read only |
| Methods partial (F4) | Title / body / action | The list may be out of date / Payment methods could not be read again. The rows below are the ones this page knows, including your latest change. Try again to read the full list. / Try again | alert; read only |
| Method form | Title | New payment method · `Edit {name}` | non-modal dialog with that name |
| Method form | Context | Choose the name cashiers will see when they take payment. · Active method. Changes keep this method’s history. · Inactive method. Saving its name does not reactivate it. | |
| Method form | Field / help | Method name / 1–32 characters. Active methods must have different names. | textbox `Method name` |
| Name in use | Create, rename | An active payment method already uses this name. Choose another name. | on the name; list reread |
| Name in use | Reactivation | An active payment method already uses this name. Rename this inactive method, save, then reactivate it. | opens that inactive method's form |
| Name in use | Holder marker | Name in use | text in the holder's name cell, not a link |
| Method results | Page status | `{name} saved.` · `{name} deactivated. It is kept for history.` · `{name} reactivated.` · `Deactivating {name}…` · `Reactivating {name}…` | methods status |
| Method status unknown | Page status | `{name}: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again.` (or `The list could not be refreshed.`) | the row action reflects the reread |
| Method status failure | Page status | `Something went wrong. {name} was not changed. Use its row action to try again.` | |
| Method status, session refusal | Page status after the same manager resumes | `{name} was not changed. Use its row action to try again.` | |
| Method form pending / failure / unknown | Notices | BO-05's words: Saving… / Wait for the result. Your draft is kept. · Something went wrong / Nothing was saved. Your draft is kept. Press Save to try again. · Outcome not confirmed / The outcome could not be confirmed. The list has been refreshed. Your draft is kept; nothing was sent again. (or …could not be refreshed…) | |

### Focus

| Moment | Focus |
|---|---|
| A Change opens the settings form | That row's field (*Change tax rate* → Tax rate) |
| *Enter settings* opens the first-run form | Tax rate |
| A method form opens | Method name |
| A field refusal | The first invalid field, in form order |
| `DUPLICATE` | Method name |
| The confirmation opens | Back to editing |
| The confirmation is dismissed (Back to editing or Escape) | The first changed rate's field |
| *Save new rates*, or any Save that sends | The form's focusable Saving status |
| `SETTINGS_CHANGED`, or unknown with a newer version | The form's notice; its two choices follow in tab order |
| After *Keep my changes* / *Use current settings* | Save / Tax rate |
| General failure, unknown with the same version, unknown with a failed reread | Tax rate (Method name on the method form) |
| Settings saved or unchanged | The Change control that opened the form (the first Change after a first-run save) |
| Method saved, deactivated, reactivated | That method's Edit |
| Method status pending, unknown, failed | The methods status |
| Cancel on a clean form, or Discard | The opener (Change, Enter settings, New payment method or the method's Edit) |
| Stay in a departure decision | The field last edited in the open form (Method name on the method form) |
| Same manager resumes through M-6 or BO-01 | The field last edited, holding the unsaved value; a held confirmation or departure decision is reopened first and takes its initial focus |
| Different manager | The first live opener; the draft is gone |

### Requirement, ruling and state map

| Requirement, ruling or task item | State or walk (all checked by `design018.cjs`) |
|---|---|
| `I` first run; ADR-012 rule 1; B-24 | `first-run` (form open, rates and details empty, currency and precision shown, no Cancel trap: Cancel leads to `first-run-closed` with *Enter settings*); first save creates version 1 with no confirmation |
| `I` loading / error | `loading`, `load-error` (Try again reads), `failure` (draft kept) |
| `I` overflow | n/a for settings; `methods-overflow` (40 custom methods, the 32-unit name, sticky header) |
| `I` invalid input; C1 lengths; ADR-012 rule 8 | `invalid-rate-empty`, `-format`, `-negative`, `-over`, `-decimals`, `invalid-required`, `invalid-long`, `invalid-address-lines`, `invalid-control`, `invalid-phone`; `longest`, `edit-longest` |
| Q5 currency and precision fixed | Every state at both sizes: no input names currency or precision; `first-run` shows both |
| Q2 0–100 inclusive; zero valid | Rate rule table; `invalid-rate-over`; the first-run walk saves a 0% service charge |
| Q3 non-zero service charge, no legal note | The default 5%; no note anywhere |
| Q12 five details; one receipt line | Receipt details group and its note; no receipt preview, numbering, tax label or language |
| ADR-012 rule 4: whole set, one version, details too | Detail-only save (`saved` without confirmation); `unchanged` |
| ADR-012 rule 2: version facts | Facts line in every ready state; S2a fields listed above |
| ADR-012 rule 3: `SETTINGS_CHANGED` | `stale` (ordinary save), the after-M-6 walk, `stale-reauth`; Keep then Save → version 6; Use current |
| B-8, B-9, FR-B1: never retroactive; confirmation | `confirm-rates` (tax), the service-only walk, both-rates-after-stale walk |
| C2 §8 cash and card fixed | Every state: the two fixed rows hold no control |
| OQ1 reactivation; C2 `DUPLICATE` pattern | `method-duplicate-create`, `-rename`, `-reactivate`; rename inactive then Reactivate; `method-deactivated`, `method-reactivated` |
| Custom name equal to Cash or Card | No refusal drawn; see questions |
| Empty methods (B-24) | `methods-empty` |
| No tendering refusal (Phase 4) | None drawn |
| `D` configuration-form rules | `saving` (one command, inert openers), `unknown`, `unknown-changed`, `unknown-read-failed`, `method-unknown`, `method-unknown-deactivate`, `method-pending-deactivate`, `method-failure`; the discarded-save walk (waiting sentence, silent late answer) |
| Departure | `unsaved`, `unsaved-escape`, `unsaved-back`, `unsaved-rail`, `unsaved-logout`, `leave-pending`, `leave-unknown`, `method-unsaved` |
| Two forms | `unsaved-switch`, `method-unsaved-switch`; clean-form hand-over walk; inert openers in `saving`, `method-saving`, `method-pending-deactivate` |
| M-6 over a form; BO-01 with a draft | `reauth`, `bo01-draft`; the 8-case identity loop (idle and ended × same and other manager × settings and method form) |
| The confirmation as a working-area modal | `reauth-confirm` (visible and inert under M-6), `bo01-confirm` (closed at BO-01, reopened for the same manager, sends once on the explicit press) |
| F4 | `method-partial` and the walk from a failed reread to a success |
| Subject-correct walks; fixture counts (P1, P2) | Seven Change walks; four method Edit walks; counts asserted against rows in every state at both sizes |
| Part C links, rail, gallery | Link counts below; Settings resolves to Frost from nine artifacts; gallery routes `stale` |
| Part C inventory, sitemap, wireframe | Source assertions on each; diffs below |

### Verification

Each run below was approved by the owner in this pane. Evidence is in the session scratchpad
(`/private/tmp/claude-501/-Users-fajars-Work-Dev-POS-System-restaurant-pos-wt-DESIGN-018/d8bb3496-6785-4fef-83df-08f54f693ee8/scratchpad/`),
outside the repository.

| Run | Result |
|---|---|
| `design018.cjs`, run 1 | 701/702; 128 state/viewport combinations; no page errors. The one failure was the check's own test (incidents.html rewrites rail hrefs to absolute URLs with a query string, so `endsWith` was wrong); fixed to compare the path. I also fixed two visual defects seen in its screenshots: the address textarea fell back to the browser's monospace font (office.css inherits fonts for button, input and select only), and the rate field spanned the whole column. |
| `design018.cjs`, run 2 | **702/702**, 128 combinations, no page errors (`design018-run2/`) |
| `design012.cjs` | exit 0, 293 checks, 52 states, no failures or errors |
| `design013.cjs` | exit 0, 371 checks, 41 states, no failures or errors |
| `design014.cjs` | **288/288**, 24 states; its only change is the expected prototype-link counts, 35/6 → 34/5, no assertion weakened |
| `design016.cjs` | **399/399** |
| `design017.cjs` | **347/347** (one more than its last run: its "no authored prototype Tables" loop now also reads `settings.html`) |
| Impeccable detector | exit 2, twelve `cramped-padding` warnings, all on wrappers whose text-bearing children carry their own token padding (the settings groups, notices, the method panel, the dialogs and their emergency sections), the same false positive DESIGN-017 recorded; the screenshots show the insets. I ran the scan a second time only to capture its output to a file after truncating the first display; nothing changed between the two. |
| `git diff --check` | clean |

Visual inspection covered `default`, `stale`, `confirm-rates`, `method-partial`, `longest`, `invalid-long`, the scrolled
overflow, `reauth`, `first-run`, `first-run-closed` (1920), `unknown-changed` and `method-duplicate-reactivate`.

**Measurements** (CSS pixels, from `design018-run2/measurements.json`):

| Measurement | 1440×900 | 1920×1080 |
|---|---|---|
| Frame (x, width) | 0, 1440 | 240, 1440 (centred) |
| Rail / top bar / content padding | 220 / 1220×64 / 24px | same |
| Settings read view (`default`) | 1172×422 at y 228 | same |
| Read view with every longest value (`longest`) | 1172×528 | same |
| Settings form (`edit`) | 1172×809 at y 228 | same |
| Rate field / outlet field / address | 182×40 / 553×40 / 553×79 | same |
| Methods part (`default`) | starts at y 690 | same |
| Method panel / name field (`method-rename`) | 459×298 / 417×40 | same |
| Methods overflow: sticky header vs owner | header at y 64; owner 1220×836 at y 64; scrolled 1180px | header at y 64; owner 1220×1016 |

All 64 states at both sizes: no document or content horizontal overflow, one `main` landmark, empty password fields.
The longest values are at their limits exactly (outlet name 64, address 200 in three lines, phone 32, NPWPD 32, footer
120, method name 32; rates `99,9999%` and `0,0001%`); each invalid fixture is one unit over.

### Link migration

`grep -c "prototype/"` counts lines. Before → after: `F/menu.html` 35 → 34; `F/report-detail.html` 6 → 5; `F/office.js`
1 → 1 (it keeps one fallback for unbuilt screens and now resolves `settings` to Frost); `F/settings.html`,
`F/settings.css`, `F/settings.js` 0 (new); `F/tables.html` 0 → 0. No Frost back-office artifact links to
`P/settings.html`; the check asserts it for every `.html` and `.js` there, and that the rail's Settings entry resolves to
`F/settings.html` from shell, patterns, menu, report-detail, today, incidents, audit, tables and settings.

### Inventory, sitemap and wireframe changes

The diff is abridged to the changed hunks; its blank context lines omit their leading space.

```diff
--- a/docs/design/SCREEN-INVENTORY.md
+++ b/docs/design/SCREEN-INVENTORY.md
@@ -816,28 +816,54 @@
 ## BO-08 — Settings

-**Purpose.** Currency, minor-unit precision, tax rate, service-charge rate,
-and the business details printed on receipts.
-
-**Reached by / from.** Manager, from navigation.
-
-**States.** *empty* (first-run configuration) · *loading* · *error*
-(validation) · *permission-denied* (n/a) · *overflow* (n/a) · *currency and
-precision locked — an order already exists* (FR-B1, M1) · *rate change creates
-a new settings version affecting only orders opened afterwards* (FR-B1).
-
-**Requirements.** FR-B1, FR-M1, FR-M5.
+**Purpose.** Show the installation's fixed currency and minor-unit precision;
+set the tax rate, the service-charge rate and the five business details printed
+on receipts, saved together as one settings version; and manage the payment
+methods (ruling I-9): cash and card, fixed, and the restaurant's own custom
+methods, created, renamed, deactivated and reactivated.
+
+**Reached by / from.** Manager, from navigation. The [Frost BO-08 composition](visual-directions/frost/back-office/settings.html)
+(DESIGN-018, awaiting review) supplies every state and its exact copy.
+
+**States.** *first run* (no settings version: every rate and detail empty,
+currency and precision still shown; saving creates version 1 — a real starting
+state, B-24) · *loading* · *error* (read failed; command failure with the
+draft kept) · *permission-denied* (n/a) · *overflow* (n/a for the settings; a
+long payment-method list) · *invalid input* (each rate refusal; each
+business-detail refusal) · *rate change confirmation — the new version applies
+only to orders opened afterwards* (FR-B1) · *saved — a new version in force* ·
+*unchanged — nothing differed, no version written* (ADR-012 rule 4) ·
+*settings changed — `SETTINGS_CHANGED`: a save built on an older version is
+refused, the draft kept beside the current values, and the manager decides*
+(ADR-012 rule 3; most often after M-6) · *no custom payment methods* (cash and
+card still listed) · *name in use — create, rename or reactivation refused*
+(FR-B7) · *deactivated method retained* · *reactivated method*. Forms also show
+local validation, pending, outcome unknown, stay-or-discard and the retained
+draft through M-6 / BO-01.
+
+**Requirements.** FR-B1, FR-B7, FR-M1, FR-M5, FR-A2b, AC-35; ADR-012.

 **Must not invent.**
-- Currency and minor-unit precision become **immutable after the first order**
-  (FR-B1, M1). The locked state is not an edge case; it is the state this
-  screen spends its life in.
-- A rate change is versioned and **never retroactive** (FR-B1, B-8, B-9). No
+- Currency and minor-unit precision are **fixed** for the installation at IDR
+  and 0 (FR-B1, FR-M1; owner Q5, 2026-10-20). They are shown as plain facts in
+  every state, the first run included, and are never offered for change: no
+  field, no lock symbol, no warning.
+- Every settings change, a rate or a business detail, makes a new immutable
+  version and is **never retroactive** (FR-B1, B-8, B-9; ADR-012 rule 4). No
   "apply to open orders" option.
 - One tax rate. Tax-inclusive. Service charge untaxed (§4, B-3, B-4). No tax
   groups, no per-item rates, no jurisdiction packs (out of scope).
-- Rate precision is one part per million; the permitted **range** is Open
-  Question 4 and is not yours to settle.
+- Each rate is **0–100%** at a precision of one part per million (FR-M5; owner
+  Q2). The manager types a percent with at most four decimal places. Zero is a
+  valid rate, and neither rate is pre-filled at the first run.
+- The business details are the outlet name, address, phone, an optional NPWPD
+  and a footer line (owner Q12), all typed by the manager and none seeded.
+  Nothing else of the receipt is set here: the rest of its content is PRD §9
+  question 1.
+- Cash and card are fixed and always offered; only custom methods are created,
+  renamed, deactivated and reactivated (FR-B7; ARCH-019 §8). A custom method
+  has a name and an active state and nothing else. Its use in tendering is
+  Phase 4 (FR-G1).
--- a/docs/design/SITEMAP.md
+++ b/docs/design/SITEMAP.md
@@ -50,6 +50,15 @@
 Its stay-or-discard decision is `[MODAL]`. The OPEN-order refusal is explicitly
 Phase 2. These use the existing node vocabulary; the screen routes are unchanged.

+**BO-08 updated 2026-10-21, DESIGN-018.** Currency and precision are fixed and
+shown only (owner Q5), so the "locked after first order" node is retyped as a
+fixed fact. The settings are edited in place as one set and saved as one
+version; the rate-change decision stays `[MODAL]`, and a save refused because
+the settings changed meanwhile is an `[INLINE]` state of that form. Payment
+method create / edit becomes an `[INLINE]` non-modal panel, as BO-05's table
+form, with inline name refusal and deactivate / reactivate row actions; its
+stay-or-discard decision is `[MODAL]`. No route is added or removed.
+
@@ -285,11 +294,16 @@
-├── BO-08 [SCREEN] Settings ......................... FR-B1, M1, G1
-│   ├── [INLINE] Currency + precision locked after first order  FR-B1, M1
+├── BO-08 [SCREEN] Settings ......................... FR-B1, B7, M1, M5, G1
+│   ├── [INLINE] Currency + precision — fixed, shown only .. FR-B1, M1
+│   ├── [INLINE] Settings edit — whole set, one version .... FR-B1
+│   ├── [MODAL] Rate change — applies to future orders only  FR-B1
+│   ├── [INLINE] Settings changed — draft kept, manager decides  FR-B1
 │   ├── [INLINE] Custom payment methods (configuration) ...... [RULED IN] I-9, G1
-│   ├── [MODAL] Payment method create / edit ................ [RULED IN] I-9
-│   └── [MODAL] Rate change — applies to future orders only  FR-B1
+│   ├── [INLINE] Payment method create / edit — non-modal panel  [RULED IN] I-9, B7
+│   ├── [INLINE] Name in use — refused ...................... FR-B7
+│   ├── [INLINE] Row actions — deactivate / reactivate ...... FR-B7
+│   └── [MODAL] Stay or discard unsaved changes ............ FR-A2b
```

`P/settings.html` (19 lines added, 137 removed; `git diff docs/design/prototype/back-office/settings.html` shows it
whole): its state labels now read "… — see Frost"; its content pane is replaced by a pointer to the Frost artifact
with links to `first-run`, `confirm-rates`, `stale` and `method-create`, as BO-05's wireframe was; the static IDR
precision 2, the LOCKED tags, the "locked since the first order" banners, the Meal-voucher-for-every-link modals and the
six-decimal rate fields are gone; its rail gains a DESIGN-018 pointer, and "immutable after the first order" and "the
range is Open Question 4" become "fixed for the installation and never offered for change" and "0–100% at a precision
of one part per million".

### Questions raised and not ruled, each with a proposed answer

1. **A custom method named "Cash" or "Card".** As ruled, nothing is refused and no warning is drawn. *Proposed:* no
   warning in Phase 1, because nothing shows a method to a cashier until Phase 4; when Phase 4 designs the tender
   buttons, consider a non-blocking line under the name field: "Cash and card are always offered. A method with this
   name appears as a second button at the POS." (lead).
2. **The phone charset adds `/`, and NPWPD has no charset**, both differing from C1's suggestion (reasons above).
   *Proposed:* accept, and S2a's schema and database checks follow this table (lead).
3. **`created_by`.** The facts line and two notices name the manager who saved a version. *Proposed:* keep it, as C1
   §1.6 recommends; if dropped, remove the three name clauses listed above (lead).
4. **F4's alert wording for BO-05.** *Proposed:* a small S1b follow-up changes BO-05's partial alert to the wording
   above, with its test; BO-08 starts with it (lead).
5. **The save command's answer.** *Proposed:* it answers the full settings view of the version now current, including
   `createdAt` and the saving manager, so the facts line updates without a reread, and the client reads `unchanged`
   from an answered version equal to the one it carried (for S2a's task file, per C2 §3 and ADR-012 rule 15) (lead).
6. **Decimal comma for rates.** `D`'s money convention already groups thousands with `.`; the rate display follows the
   Indonesian convention to match it, and input accepts both separators. *Proposed:* accept (lead, or owner if the
   lead prefers the owner's eye on a convention).

None of these blocks S2b or S3.

DONE
