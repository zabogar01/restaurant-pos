---
id: DESIGN-018
title: BO-08 Settings and payment methods in Frost (slice F, BO-08 half), for S2b and S3
category: ui
touches: [money, boundaries]
depends_on: [DESIGN-017]
owns: [docs/design/**, docs/DESIGN.md]
status: not-started
cycles: 0
---
# DESIGN-018 — BO-08 Settings and payment methods (slice F, BO-08 half)

**Written** 2026-10-21 by the lead. The BO-08 half of design slice **F** in the accepted Phase 1 plan
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, §4: "then F's BO-08 half, with the payment
methods"), split from DESIGN-011's slice F (`.agent/reviews/DESIGN-011-back-office-audit.md:463`). The BO-07 half
(discount presets) is a later task.
**Owner:** a Codex designer on `gpt-6-astra`, effort high, opened by hand in its own pane (name `design018`).
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

## Handoff

_Not started._
