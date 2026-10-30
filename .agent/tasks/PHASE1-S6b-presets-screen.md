---
id: PHASE1-S6b
title: BO-07 Discount presets in the back office — the screen, its rail entry, the preset form with both kinds, the state commands, and the ConfigApi inclusion (plan S6, DESIGN-022)
category: ui
touches: [money, boundaries, identity]
depends_on: [PHASE1-S6a]
owns: [apps/back-office/src/**, apps/back-office/test/**, e2e/tests/presets.spec.ts, e2e/support/**]
status: not-started
cycles: 0
---
# PHASE1-S6b — BO-07 Discount presets in the back office

**Written** 2026-10-30 by the lead. Sources:
- slice S6 of the accepted Phase 1 plan (`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, *S6*);
- the server half **PHASE1-S6a** (merged as PR #154; its Handoff's *What S6b needs* is the server's contract for you);
- the design **DESIGN-022** (merged as PR #156; `F/presets.html` and its Handoff, as amended by its round 2);
- the client slices whose code this one copies: **PHASE1-S3b** (BO-08's payment methods: a list of named records with
  a non-modal panel, deactivate and reactivate, `DUPLICATE` with the holder marked), **PHASE1-S2b** (BO-08's
  versioned settings form: the stale notice, *Keep my changes* and *Use current*, the gate recheck), and **PHASE1-S4c1**
  (BO-03: the catalog list's **standing version**).

The plan splits S6 into S6a (server, done) and this client half. Where this file and DESIGN-022 differ, this file's
rulings say which wins; where they still differ, or the merged code cannot do what this file says, stop and write
`BLOCKED: <question>`.

Abbreviations: `D` = `docs/DESIGN.md`; `F/` = `docs/design/visual-directions/frost/back-office/`; **C2** =
`.agent/reviews/ARCH-019-first-back-office-form.md`; **ADR-012** = `docs/decisions/ADR-012-versioned-configuration.md`.

## Objective

A signed-in manager reaches **Discount presets** (BO-07) from the rail, at `/back-office/presets`, and sees every preset,
active first and inactive second, each group in the server's creation order. The manager creates a preset of either
kind (a **percentage** or a **fixed amount**), edits one (name, kind and value together, active or inactive),
deactivates one after a confirmation, and reactivates one, through the five S6a routes, with every word from
DESIGN-022. The list keeps a **standing catalog version** as BO-03's does, so an edit opened from a list that missed
another tab's change is refused `CATALOG_CHANGED` and the manager chooses which values to keep. With this slice, FR-B5
is built end to end. Nothing applies a preset until Phase 2.

## Required inputs

Read these, in this order. Everything you need is here or cited.

1. **This file**, whole.
2. **DESIGN-022's Handoff**, `.agent/tasks/DESIGN-022-discount-presets.md`, from `## Round 2 (lead rulings` to the end:
   the round 2 rulings (F1 the standing version, F3 the installation facts), then the Handoff's *Parts and testable rules
   for S6b* (every row binds), *Every registered state*, *Exact product copy and accessible names* (every product word
   comes from it, ADR-011 rule 24), *Focus contract*, and *Questions and downstream notes*.
3. **`D`**, *Configuration forms*: the DESIGN-017 / C2 part (from `:1486`), the DESIGN-018 additions (from `:1628`; the
   stale-draft refusal at `:1636`, the rate field at `:1700`, "unchanged" at `:1677`, two forms on one screen at
   `:1728`, a success while the list read stands failed at `:1741`), the DESIGN-019 additions (from `:1788`; the
   standing version at `:1818-1823`), the DESIGN-020 additions (from `:1876`; the money input at `:1887`), and the
   **DESIGN-022 additions** (from `:2043`: the kind switch, BO-07's standing list version, BO-07's copy and
   composition).
4. **The Frost artifact**, `F/presets.html` with `presets.css`, `presets.js`, `presets-states.js`, and the shared
   `office.css`, `tables.css`, `settings.css`, `entry.css` it imports. Open it with `?state=<name>` (the 58 states are
   listed in the Handoff). It is a review fixture: its fixture data, response chooser, simulation controls and
   disclaimers are not product and are not copied. Port CSS only through tokens already in
   `docs/design/tokens/frost.css` (`apps/back-office/test/no-invented-values.test.ts` enforces this).
5. **PHASE1-S6a's Handoff**, `.agent/tasks/PHASE1-S6a-presets-server.md`, *What S6b needs*: the routes, the `ROUTES`
   names, the contract names, the `ConfigApi` exclusion you now remove, and how `CATALOG_CHANGED`, `DUPLICATE` and
   `NOT_FOUND` arrive. Its *The shape* rulings 2 and 5 (the name; the whole-preset edit; an inactive preset may be
   edited).
6. **PHASE1-S3b's task file and Handoff**, `.agent/tasks/PHASE1-S3b-payment-methods-screen.md`: its lead rulings 3 to
   11 and its Handoff. **BO-07's list, panel and state commands are BO-08's payment methods, with a version.**
7. **PHASE1-S2b's task file and Handoff**, `.agent/tasks/PHASE1-S2b-settings-screen.md`: the versioned form, the stale
   notice and its two choices, and *Round 2* (the gate recheck after every asynchronous reread, the held result, the
   focus request that survives the gate).
8. **PHASE1-S4c1's task file and Handoff**, `.agent/tasks/PHASE1-S4c1-menu-screen.md`: the standing version (its
   rulings near `:142-146` and the Handoff's notes near `:515-524`) and its round 3 F1 (an explicit retry of a reread
   presents through the gates).
9. **The existing back office**: `apps/back-office/src/` (`settings/`, `menu/`, `item/price.ts`, `forms/`,
   `work/guard.ts`, `copy.ts`, `Rail.tsx`, `routes.ts`, `Screens.tsx`, `session/`), and the tests beside them. **The
   browser harness**: `e2e/support/**`, `e2e/tests/payment-methods.spec.ts`, `e2e/tests/menu.spec.ts`.
10. The contract, for meaning only: PRD FR-B5, FR-F1 to FR-F8, FR-M5, FR-C7; BOUNDARIES B-1, B-8, B-13, B-21, B-22,
    B-24; ADR-012 rules 10 and 13.

## Decided: do not reopen

- **PRD FR-B5** (owner, 2026-10-20): create, edit, deactivate and reactivate. **Q10** (DECISIONS 2026-10-20): a preset
  may be reactivated. **Q11:** nothing in Phase 1 is audited except user management; no screen claims an audit.
- **The server (S6a, merged):** create, deactivate and reactivate carry no version; an edit sends the whole preset
  (`{ presetId, expectedVersion, name, value }`) and may change the kind; an inactive preset may be edited and stays
  inactive; `DUPLICATE` is bare; a no-op answers `OK` with the unchanged version. The read answers every preset with the
  catalog version, in creation order. There is no reorder and no display order.
- **ADR-012 rule 10:** presets share the **catalog version** with the menu, so an edit can be refused `CATALOG_CHANGED`
  because an item changed while the preset did not (DESIGN-022 `stale-menu`).
- **DESIGN-022, accepted with its round 2:** every rule in its *Parts and testable rules for S6b* table, including the
  list order and grouping, zero accepted silently for both kinds, the kind switch, the deactivation confirmation, the
  reactivation-conflict recovery, the standing list version, and the installation facts beside the fixed amount drawn
  from the shared-code constants and always shown.
- **B-21, B-22, FR-F2, FR-F7:** no date, time, schedule, trigger, automatic, minimum-spend, stacking, precedence, scope or
  approval control, and no POS operation, on any state.
- **Drafts (owner, 2026-10-05, 10-14, 10-16, 10-20):** the same manager resuming through M-6, or signing in again at
  BO-01, gets the unsaved draft back; a different manager's sign-in destroys it; a reload destroys it.
- **C2 §6 and ADR-011 rule 20:** an unknown outcome rereads and never resends; the client never infers success from a
  reread; there is no "send again" control.
- **Lengths are code points.** Count with `[...value].length`, never `value.length`. Do not write "UTF-16 units" in any
  new comment. (Older comments that say so are a queued cleanup, not this task.)
- **S1b's, S2b's, S3b's and S4c1's patterns**, as merged: reuse `fieldsInError`, `work/guard.ts`, the router's guard,
  `forms/Decision.tsx`, `forms/answer.ts` and the logout confirmation as they are. Change one only if BO-07 cannot work
  otherwise, and then say why.

## Lead rulings (2026-10-30)

1. **The screen and its place.** A new `Screen` `'presets'` at **`/back-office/presets`** in `routes.ts`, rendered by
   `Screens.tsx`, with a rail entry **Discount presets** between Tables and Settings (the order DESIGN-022 drew and
   `design019.cjs` asserts: Menu, Tables, Discount presets, Settings), `aria-current="page"` when current. The path
   names the screen and nothing else (no id, no query string).
2. **One screen model, in its own folder.** `apps/back-office/src/presets/`: `model.ts` (one model, one `workGuard`
   registration, one command slot for the whole screen, one departure decision), `Presets.tsx`, `copy.ts`, and pure
   helpers in their own files (for example `value.ts` for the order, the counts and the value text). Copy the shape of
   `settings/model.ts`'s methods part and of `menu/model.ts`'s standing version; do not import either model, and do not
   refactor them.
3. **The name.** Reuse `checkCategoryName` from `menu/name.ts` as it is: it trims, then refuses empty, over 32 code
   points, then a Unicode Cc character, in DESIGN-022's order, and sends the trimmed name. Do not write a fourth copy of
   this check; do not consolidate the three that exist (`menu/name.ts`, `settings/methods.ts`, `item/name.ts`). A pair
   test holds it and `PresetName` in agreement over the boundary values (empty, spaces only, 32 and 33 code points
   including 32 and 33 emoji, a tab, ESC, U+0007, an inner space, a name with leading and trailing spaces). Uniqueness
   is the server's: there is no local duplicate check.
4. **The percentage.** `checkRate` and `percentText` from `settings/rate.ts`, unchanged (DESIGN-018's rate field, which
   `D:1700` says BO-07 reuses). The request carries `{ kind: 'PERCENTAGE', ratePpm }` with the canonical ppm string it
   returns. A pair test holds `checkRate` and the contract's `RatePpm` in agreement, and pins the conversion S6a left to
   you: typed `10` sends `'100000'`, `12,3456` sends `'123456'`, `0` sends `'0'`, `100` sends `'1000000'`, and `100,0001`
   is refused *over*. No floating point anywhere on this path (B-1).
5. **The fixed amount.** `checkPrice(typed, 'base')` and `shownPrice` from `item/price.ts`, unchanged: DESIGN-020's
   unsigned money input, whose bound (99.999.999) is the contract's `DiscountAmount` bound. Its `'bounds'` error shows
   DESIGN-022's *ceiling* sentence. The request carries `{ kind: 'FIXED', amount }`. A pair test holds it and
   `DiscountAmount` in agreement on every accepted input and both bounds (`0`, `99.999.999`, `99999999`, `100.000.000`).
   Money in the list uses `priceText` from `menu/money.ts`. Never `Number()` on money.
6. **Zero** is accepted silently for both kinds (DESIGN-022). A create of `0%` and one of `0` each send one request.
7. **The kind switch** follows `D`'s *Switching between value kinds* exactly: one typed buffer per kind while the form
   is open; the first visit to the other kind starts empty; returning restores the exact text; no conversion; focus on
   the newly visible value input; switching clears value-field errors; only the selected kind's value is validated and
   sent; dirty compares the name, the selected kind and the selected value with the opening record; Cancel or Discard
   drops both buffers; same-manager recovery keeps both; *Use current preset* replaces the whole draft and clears the
   unused buffer; *Keep my changes* keeps both.
8. **The order and the counts.** One table: active presets first, inactive second, **each group in the order the
   server answered** (creation order). The client never sorts by name (this differs from BO-08's methods, on purpose).
   Keep the server's order as the one source: hold the rows in server order (a new record is appended, since it is
   the newest), and group them only for display. So a renamed record keeps its place, and a deactivated or reactivated
   record appears in its new group at the position its creation order gives, not at the end. The facts line `{active} active · {inactive} inactive ·
   Catalog version {version}` is withheld unless the list read succeeded (and in the partial state).
9. **Versions.**
   - **Create, deactivate and reactivate** carry no version. **Save on an existing preset** sends the whole preset to
     `update` with `expectedVersion` = the editor's base.
   - **The standing list version** is `D:1818-1823` as DESIGN-022 round 2 states it, built as `menu/model.ts` builds it:
     a full read sets it (except when an answer adopted after that read began is ahead of what the read saw, as S4c1's
     Handoff says); a command answer advances it only when the answered version is exactly the standing version plus
     one, or equal to it for an unchanged answer; otherwise it stays. An editor opened from the list carries the
     standing version as its base. In the partial state answers do not advance it; an editor opened then carries it
     and its save is refused `CATALOG_CHANGED` and rereads. While the standing version is `null` (no read ever
     succeeded), Edit is inert, as BO-03's Rename is.
   - **The facts line and the form's version line** name the version most recently read or answered, never the standing
     one.
   - **An edit's answer** is read with `meaningOf(answer, base)`: equal is *unchanged* (page status `{name}: nothing
     changed. Catalog version {version} is still current.`), ahead is *saved*. Create, deactivate and reactivate are
     *saved* when ok.
   - The form's base moves only on an answered save or unchanged, or on the manager's explicit stale choice. A reread
     alone never moves it.
10. **`CATALOG_CHANGED`** on an edit: write nothing, keep the draft, reread the list once, and show DESIGN-022's stale
    notice (focusable, focused) at the reread version, with the current name, kind and value beside each field that
    differs (`stale`), or the *same values* sentence when none differs (`stale-menu`). Save is held, with its reason,
    until *Keep my changes* (base moves to the reread version, focus Save, nothing sent) or *Use current preset* (the
    form shows the reread preset, clean, focus Preset name, nothing sent). If the reread fails, `stale-read-failed`:
    no comparison, no choices, the list's *Try again* reads only. After M-6 the words are the same (`stale-reauth`).
    The current status line (`Current status: {Active or Inactive}.`) is shown with the comparison.
11. **`DUPLICATE`** (409, bare). On create or edit: the form stays with the draft, DESIGN-022's name error on Preset name
    with focus there, the list reread once behind it, and the holder's row marked *Name in use* once the reread shows
    which **active** preset holds the name (compare case-insensitively; no marker if none matches). On reactivation:
    open that inactive preset's editor with the reactivation error on Preset name, focused, the list reread, the holder
    marked; saving a new name leaves it inactive, and Reactivate must then be pressed. Nothing is ever resent. This is
    S3b ruling 8 for presets.
12. **`NOT_FOUND`** (404) on update, deactivate or reactivate is unreachable today (nothing deletes a preset). Treat it
    as the definite failure of that command, with the list reread once (DESIGN-022 `not-found`), and say so in the
    Handoff. No new copy.
13. **Unknown outcomes** (`failed`, `unavailable`): one reread, never a resend. A form save: `unknown`,
    `unknown-read-failed`, or, when the reread shows a newer version, `unknown-changed` (the stale comparison and
    choices with the *may include this save* body; after a choice, the *Unknown after choice* body). A state command:
    DESIGN-022's state-unknown sentence, with or without *The list could not be refreshed.*
14. **Deactivation confirmation.** Deactivate opens DESIGN-022's named confirmation as a native modal `<dialog>`
    (`Deactivate "{name}"?`), focus on *Keep active*, Escape keeps it active and returns focus to that row's
    Deactivate. *Deactivate* sends the command. It follows the working-area dialog rule (C2 §7), as BO-08's rate-change
    confirmation does in `settings/Settings.tsx`: closed with its state kept at BO-01, reopened for the same manager with
    focus on *Keep active*, left open behind M-6, destroyed for anyone else. Reactivate sends at once, with no
    confirmation. Copy that confirmation's lifecycle; if you extract a shared confirmation component instead, say why.
15. **State commands.** While pending: `Deactivating {name}…` / `Reactivating {name}…` in the page status (focusable),
    every opener inert. Results and focus per DESIGN-022 (*Deactivated*, *Reactivated*, *State unknown*, *State definite
    failure*, *State session refusal*); a successful state change focuses that row's Edit even though the row moved
    between groups.
16. **One form and one command per screen** (DESIGN-022 *One form and one command*; S3b ruling 3). Every opener (New
    preset, each Edit, Deactivate, Reactivate) goes through the departure decision when the open form is dirty, its save
    is pending or its outcome is unknown, and simply closes a clean form. While any command is pending (including a
    discarded save still outstanding, with DESIGN-022's *Discarded pending save* status), every opener is inert and a
    second press sends nothing. Use `aria-disabled` on buttons and openers, never native `disabled` on them; fields use
    `disabled` while a save is pending (`D:1518`).
17. **The working-area rules, unchanged.** The panel is non-modal: under M-6 visible and inert; at BO-01 hidden with the
    draft held; the same manager gets it back with focus where the *Focus contract* says; a different manager destroys
    it and focus goes to New preset. **S2b round 2 F2 and S4c1 round 3 F1 apply to every command and every explicit
    retry:** after each asynchronous reread (unknown, `DUPLICATE`, stale, `NOT_FOUND`, a *Try again*), recheck the
    session gate and the open decision before presenting; if presentation is not permitted, hold the finished result
    with its read and present it once, with its focus, when the same manager returns, never repeating the command or
    the reread.
18. **The read.** Every visit to BO-07 reads (one `GET`, not interactive), following S1b's and S3b's rules as merged: a
    failed visit read keeps a newer success; a read that began before a command was answered never undoes the answered
    record; the partial state when a command succeeds while the list read stands failed (DESIGN-022 `partial` copy);
    *Try again* repeats the read only. `loading`, `load-error` and `empty` as drawn.
19. **`ConfigApi`.** Remove S6a's `Exclude` of the presets paths from `ConfigPath` in `session/api.ts`, add the five
    functions to `configApi()`, add the five paths to `fixtureSession.ts` answering `unavailable` (fixture mode then
    shows BO-07's read failure; there is no fixture preset list), and update `config-api.test.tsx`'s key list.
20. **Copy** goes in `presets/copy.ts`, each string traceable to a row of DESIGN-022's copy table, or to the shared
    `copy.ts` / `settings/copy.ts` where DESIGN-022 reuses their words verbatim (departure, logout, M-6, the general
    failure). Interpolated values are the manager's own typed value in a field and the names, kinds and values the read
    or an answer returns. No zod message, server text or error code ever becomes visible text.
21. **Not built in S6b**, though DESIGN-022 draws them: the kitchen-emergency sentences in the confirmation, the
    departure decision and M-6, and M-6's queued incident (the built frame has no incident action); BO-01's held-draft
    sentence (S10); the artifact's response chooser and simulation controls. Say in the Handoff that each was left out
    on purpose.
22. **No invented control.** A test asserts that no BO-07 state renders an input of type `date`, `time`,
    `datetime-local`, `week` or `month`, a reorder control, or the words *schedule*, *valid from*, *valid to*,
    *automatic*, *approval* or *minimum* (B-21, B-22, FR-F2).

## Acceptance criteria, each with its red proof

Each *Red* line is a mutation you apply, observe failing, revert, and report.

1. **The rail and the route.** The rail reads Menu, Tables, Discount presets, Settings, with hrefs
   `/back-office/menu`, `/back-office/tables`, `/back-office/presets`, `/back-office/settings`; a press on Discount
   presets opens BO-07, marks it `aria-current="page"` and sends one read. *Red:* put the entry after Settings: the
   rail-order test fails.
2. **Order and counts.** With presets created in the order `Staff meal` (PERCENTAGE `'500000'`), `Regular customer`
   (FIXED `'10000'`, inactive), `Birthday` (PERCENTAGE `'123456'`) and `Anniversary` (FIXED `'99999999'`), the table
   reads Staff meal, Birthday, Anniversary, then Regular customer; the values read `50%`, `12,3456%`, the money text
   of 99.999.999 and of 10.000 as `priceText` gives it, each above its kind; the facts read `3 active · 1 inactive ·
   Catalog version {v}`. Deactivating Staff meal then shows Birthday, Anniversary, then Staff meal and Regular customer
   in creation order. *Red:* sort each group by name: the order test fails.
3. **Read states.** `loading` withholds rows and facts; a failed read shows the read-failure alert with *Try again*
   (which sends one read and nothing else) and withholds the facts; a successful empty read shows the empty state, and
   New preset is live. Fixture mode shows the read failure. *Red:* show the facts line on a failed read: that test
   fails.
4. **The checks.** The three pair tests of rulings 3, 4 and 5. The UI refusals in order with DESIGN-022's copy, the
   input `aria-invalid` with its error in `aria-describedby`, focus on the first invalid visible input (name, then the
   selected value); nothing is sent while anything is invalid; the request carries the trimmed name and the canonical
   value. *Red:* count the name with `name.length`: the 32-emoji case fails; *Red:* refuse a zero value locally: the zero-create
   test (ruling 6) fails.
5. **The kind switch** (ruling 7): typed `10` as a percentage, switch to Fixed amount (empty, focused), type `5.000`,
   switch back (shows `10`), switch again (shows `5.000`), Save sends exactly `{ kind: 'FIXED', amount: '5000' }`; an
   edit of a percentage preset into a fixed amount sends the whole preset with the new kind; Cancel on a dirty form
   meets the departure decision, and Discard then reopening shows the saved record with the other buffer empty. *Red:*
   share one buffer between kinds: the restore case fails.
6. **Create, edit, deactivate, reactivate.** Each sends exactly one request with the body of the rulings (create `{
   name, value }`; update `{ presetId, expectedVersion, name, value }`; deactivate and reactivate `{ presetId }`),
   applies the answered record in place, announces its sentence, and focuses that preset's Edit; an edit of an inactive
   preset leaves it inactive and shows the *Inactive preset* context sentence; an unchanged edit announces the
   *unchanged* sentence and writes no row change. *Red:* send `{ id }` instead of `{ presetId }` on deactivate: the
   body assertion fails.
7. **The deactivation confirmation** (ruling 14): its title names the preset, focus on *Keep active*; Escape and *Keep
   active* each send nothing and return focus to that row's Deactivate; *Deactivate* sends one request; Reactivate sends
   at once with no dialog. *Red:* send deactivate from the row press without the dialog: the no-request-on-Escape case
   fails.
8. **The standing version** (ruling 9). (a) The skipped answer: the list stands at 12; another tab's change is not seen;
   this tab deactivates *Staff meal*, answered at 14; the facts line names 14; this tab opens *Edit Regular customer*,
   renames it only, and saves: the request carries `expectedVersion: 12`, the fake answers `CATALOG_CHANGED`, the stale
   notice shows the current value beside the draft, exactly one update was sent. (b) The plus-one answer: no other tab;
   deactivate answered at 13; an edit from the list carries 13 and saves. (c) Partial: with the read standing failed, a
   create's answer does not move the standing version. *Red:* let any answer move the standing version: case (a) sends
   `expectedVersion: 14` and fails.
9. **`CATALOG_CHANGED`** (ruling 10): `stale` with the differing fields marked, `stale-menu` with the same-values
   sentence, `stale-read-failed` with no choices; Save held with its reason; *Keep my changes* moves the base to the
   reread version and focuses Save, and the next Save carries that version; *Use current preset* replaces the form,
   clean, focus Preset name; neither choice sends anything. *Red:* let a reread move the base without a choice: the
   held-Save test fails.
10. **`DUPLICATE`** (ruling 11): create and edit keep the draft, show the error on Preset name with focus, reread once,
    and mark the holder; reactivation opens that inactive preset's editor with its own sentence, rereads once, marks the
    holder; saving a new name leaves it inactive. The request count is one per press in every case. *Red:* resend the
    create after the reread: the count is 2.
11. **Unknown and failure** (rulings 12, 13): a save or a state command answered `failed` or `unavailable` rereads once
    and never resends, with each drawn variant (`unknown`, `unknown-read-failed`, `unknown-changed` and its after-choice
    body, the two state-unknown sentences); a definite failure keeps the draft; `NOT_FOUND` is the definite failure with
    one reread. *Red:* resend once after `failed`: the command count is 2.
12. **One form, one command** (ruling 16): with a dirty draft, New preset, another Edit, Deactivate and Reactivate each
    meet the departure decision first; with a clean form each simply hands over; while any command is pending every
    opener is inert and a press sends nothing; a discarded pending save shows its status and its late answer updates
    the row silently, without reopening, announcing or moving focus. *Red:* let Reactivate ignore the command slot: the
    count test fails.
13. **Partial** (ruling 18): a command succeeds while the read stands failed: the known rows with the answered record
    applied, the result announced, its Edit focused, the facts withheld, the partial alert; *Try again* reads only.
    *Red:* show the plain read-failure copy in the partial state: that test fails.
14. **Departure, M-6 and BO-01** (ruling 17): the departure decision from Cancel, Escape, browser Back, the rail and Log
    out with a draft, and its pending and unknown bodies; M-6 over the panel (visible, inert) and over the confirmation;
    BO-01 with a draft held, returned to the same manager with both kind buffers, focus and value, destroyed for a
    different manager (focus New preset); a command's result arriving while M-6 is up is held and presented once on
    return; an explicit *Try again* whose read is outstanding when M-6 opens presents once on return. *Red:* present the
    held result while signed out: the M-6 test fails.
15. **`ConfigApi`** (ruling 19): the config-api type test and key list include the five presets paths; fixture mode
    serves BO-07's read failure; no fixture marker reaches the built bundle. *Red:* leave one function out of
    `configApi()`: the key-list test fails.
16. **No invented control** (ruling 22), over every state the unit tests reach. *Red:* add an `<input type="date">` to
    the form: the test fails.
17. **In the browser** (`e2e/tests/presets.spec.ts`, both engines, the harness's rules):
    - (a) A manager opens Discount presets from the rail, creates a percentage preset typed `10` and sees it listed
      with `10%`; the database holds it with `rate_ppm` 100000 (read through `listPresets` in
      `apps/server/src/domain/discount-preset.ts`, as `payment-methods.spec.ts` reads through `listTenderMethods`). The
      manager edits it to Fixed amount `5.000`; the database holds `amount` 5000 and no rate. The manager deactivates it
      through the confirmation and sees it *Inactive*; the database holds it inactive; Reactivate restores it.
    - (b) **The shared version, for real.** The manager opens Edit on a preset; a catalog change is made through the
      domain (a category created through `apps/server/src/domain/catalog.ts`), so only the menu changed; the manager
      renames the preset and presses Save: the stale notice shows the same-values sentence, exactly one update request
      was sent, and the database still holds the old name. *Keep my changes*, then Save: the database holds the new
      name.
    - (c) A preset `Staff meal` created through `createPreset`; the manager's create of `staff MEAL` shows *An active
      preset already uses this name. Choose another name.* on Preset name, exactly one create request was sent, and the
      holder's row is marked *Name in use*.
    - Assert changes, not absolute counts; nothing is deleted (there is no `DELETE`), so make names unique per run where
      a rerun would collide.
18. `npm run verify` and `npm run test:e2e:all` green, counts in the Handoff.

## Rules

- Touch only the paths in `owns`. `e2e/support/**` is for **additions**; an edit to an existing helper's behaviour is a
  change to every spec: stop and ask. No change to `packages/`, `apps/server`, `db/` or `docs/`: if a route or schema is
  wrong for the screen, that is a question, not a fix.
- Red first, per criterion: write the test, run it against the unchanged code, record the failing assertion; then the
  code.
- Every visible word from DESIGN-022's copy table or the shared copy it reuses; every style value from the Frost
  registry.
- Browser-test rules (ADR-011 rules 27 and 28; the 012a and 012b Handoffs): people through the harness's domain
  functions with random credentials (never `makePeople` from the server tests); requests made by the page; assertions
  on state, accessible names and codes; no screenshots or artefacts committed; sign-ins through the existing helpers so
  the credential ledger counts them; the credential scan runs as in every spec.
- Server tests need `npm run db:up` and `openssl` on `PATH`. Do not touch the development database `pos`.
- Format by hand, matching each file; there is no formatter config. One simple command per shell call; no heredoc
  edits: use the file tools.

## Tests expected to change

- `apps/back-office/test/routes.test.ts`: the manifest list gains `presets`, and `PATHS.presets` is
  `/back-office/presets` (ruling 1).
- The rail's exact text or link list, which gains *Discount presets* between Tables and Settings:
  `sign-in.test.tsx` (`:57-71`, the link list), `settings.test.tsx` (`:48-59`), `menu.test.tsx` (`:37-41`, text and
  hrefs), `item.test.tsx` (`:50`), `menu-fixture.test.tsx` (`:47`). Only the expected list changes; the comment beside
  `sign-in.test.tsx:70` changes "three entries" to four.
- `apps/back-office/test/config-api.test.tsx`: the `ConfigApi` key list (ruling 19).
- `apps/back-office/test/fixture-session.test.tsx`: only if it asserts the whole fixture path list.
- New tests under `apps/back-office/test/` (for example `presets.test.tsx`, `presets-versions.test.tsx`,
  `presets-departure.test.tsx`, `presets-value.test.ts`, `presets-support.tsx`), and the new spec
  `e2e/tests/presets.spec.ts`.
- **Nothing else should change**: BO-03, BO-04, BO-05 and BO-08's tests, `decision.test.ts`, `boundaries.test.tsx`
  and every existing e2e spec stay as they are. A change anywhere else is reported in the Handoff with its reason; a
  weakened assertion is not acceptable.

## Baseline

`development` at `8a35a82` (S6a #154, the lead's #155 and DESIGN-022 #156 merged). The lead's runs of S6a's final tree:
`npm run verify` 144 files, 5270 tests; `npm run test:e2e:all` 100 passed (DESIGN-022 changed no test those run).
Confirm the baseline before you start and state the new counts in the Handoff. Run `npm run test:e2e:all` yourself
before you finish.

## Out of scope

- The POS discount picker, applying a preset, the cap at the subtotal, the snapshot on an order (Phase 2; DESIGN-021
  draws the picker's served states). The POS read of presets (C4, S7).
- A reorder or a display order (S6a ruling 1). Any server, contract or migration change.
- The kitchen-emergency sentences and BO-01's held-draft sentence (ruling 21; S10).
- Consolidating the three name checks, or the code-point comments elsewhere (queued cleanup). BO-04's installation-facts
  question (DESIGN-022 F3 note; not this screen).

## Commit and report

Commit on `agent/phase1-s6b` only, after verify is green, and never push. Conventional Commits, explaining why. Write
the Handoff below in full prose:
- what was done (paths, commits);
- **how it works**: the model's state, the standing version and where it moves, the command slot, what a later list
  screen with a version copies;
- what was decided and on what evidence; every state of DESIGN-022 mapped to the test that shows it, or to ruling 21;
- tests changed and why; each red proof (mutation, failure read, reverted);
- what was found and not fixed; the real `verify` and `test:e2e:all` output.

End with `DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr as AGENTS.md says.

## Handoff
