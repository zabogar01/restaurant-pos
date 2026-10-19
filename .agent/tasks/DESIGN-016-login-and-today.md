---
id: DESIGN-016
title: BO-01 Login and BO-02 Today in Frost (slice B), with DESIGN-012's three lows and the sign-in layout findings from PHASE0-011d1
category: ui
touches: [identity]
depends_on: [DESIGN-012, DESIGN-015]
owns: [docs/design/**, docs/DESIGN.md]
status: active
cycles: 1
---
# DESIGN-016 — BO-01 Login and BO-02 Today (slice B)

**Written** 2026-10-19 by the lead. Slice B of the nine back-office design slices proposed in DESIGN-011
(`.agent/reviews/DESIGN-011-back-office-audit.md`), drawn inside the frame slice A delivered (DESIGN-012, PR #55),
beside slices C (BO-13, DESIGN-013) and I (BO-12, DESIGN-014), and on the sign-in copy DESIGN-015 wrote (PR #89).
**Owner:** a Codex designer on `gpt-6-astra`, effort high, opened by hand in its own pane (name `design016`).
**Branch and place:** `agent/design-016`, cut from `development` at `82876b4`, in the worktree
`../restaurant-pos-wt/DESIGN-016`. Touch nothing under `apps/`, `packages/` or `db/`, nothing in `docs/DESIGN.md` except
as allowed under *Tokens* and Part 0's N2, and nothing in the main checkout at `../restaurant-pos`.

Nothing is built from this task. A design review follows. The back office's real sign-in (built in PHASE0-011d1 as a
**provisional** Frost form, placed from DESIGN-015's copy table) is replaced by a frontend task written from this
slice once it is reviewed.

Abbreviations, as in DESIGN-011: `I` = `docs/design/SCREEN-INVENTORY.md`, `D` = `docs/DESIGN.md`, `S` =
`docs/design/SITEMAP.md`, `P/` = `docs/design/prototype/back-office/`, `F/` =
`docs/design/visual-directions/frost/back-office/`.

## Objective

When this task is done, the back office's two first screens have reviewed Frost compositions: `F/login.html` draws BO-01
in every state the inventory lists, in DESIGN-015's exact words, laid out so that the findings the first build raised
(two `<main>` landmarks, focus after logout, the frame beyond 1440px, the notice's contrast, password managers) are
answered by the design rather than left to a builder; and `F/today.html` draws BO-02 in every inventory state, read-only,
with the slice A emergency and receipt compositions, and with the Phase 0 frame kept as a named state for as long as the
landing has no data to show. DESIGN-012's three low findings N1 to N3 are closed first. Every Frost artifact that still
links to the greyscale `P/login.html` or `P/today.html` links to the new artifacts instead.

## Required inputs

Read these, in this order. Everything you need is here or cited.

1. `.agent/reviews/DESIGN-011-back-office-audit.md`: BO-01 (`:68-83`), BO-02 (`:85-102`), S1 to S5 (`:56` onward),
   *Shared pieces* (`:391`), *Tokens* (`:407`, the `--frost-office-login-width` row at `:415`), the link ledger rows for
   `today.html` (`:344`) and `login.html` (`:353`), the slice B row (`:459`), and questions Q2 and Q4 (`:440`, `:442`).
   Both questions are now ruled (below); its staff-number field and its cashier-PIN *denied* state are gone.
2. **DESIGN-012's task file**, `.agent/tasks/DESIGN-012-office-shell-and-reauth.md`: the lead ruling that carries N1 to
   N3 to you (`:296-310`, copied below), and its Handoff (`:312` to the end): the frame, the table pattern, read states,
   scroll ownership, the emergency and receipt compositions, and how `F/office.js` resolves destinations. Consume
   `F/office.css`, `F/office.js` and `F/patterns.html`; do not copy or fork them.
3. **DESIGN-015's task file**, `.agent/tasks/DESIGN-015-sign-in-copy.md`, its Handoff from `:339`, above all *Exact
   product copy for the builders* (`:374-443`). **That copy is binding and reviewed; use it verbatim.** It is also in
   the inventory's BO-01 section (`I:579-643`).
4. **DESIGN-013's and DESIGN-014's Handoffs**, for how a slice extends `office.js` narrowly, registers states in
   `manifest.js`, and writes its check script under `docs/design/checks/` (`design013.cjs`, `design014.cjs`).
5. `I:579-674` (BO-01 and BO-02), `I:83-124` (the shared general failures for both clients), `I:1077` onward (M-6), and
   the conventions `I:16-41`. `S:240-250` (back-office chrome, BO-01, BO-02) and `S:311-323` (the back-office screens the MVP
   deliberately does not have).
6. `docs/DESIGN.md`, by section (line numbers drift; these are at `82876b4`): *Emergency and warning — separately*
   (`D:615`), *Measured contrast* (`D:648`), *Typography* and its *Hierarchy* (`D:689`, `D:710`), *Layout* with the
   1440-wide back office (`D:759`, `D:804`), *Buttons (back office)* (`D:966`), *Numeric field* and *Modal and sheet*
   (`D:1046`, `D:1071`), *Data table* (`D:1141`), *Incident banner and incident block* (`D:1162`), *Navigation (back
   office)* (`D:1190`), *Notices and empty states* (`D:1199`), *Shared back-office patterns — DESIGN-012* (`D:1332`),
   and token provenance (`D:486`).
7. The contract, for meaning: `docs/PRD.md` FR-A2b, FR-A2c, FR-A5b, FR-A7, the FR-B preamble, FR-E3, FR-E6, FR-G12,
   FR-I1, FR-I2, §9 (time display and the business day), AC-28 and AC-35; `docs/BOUNDARIES.md` B-12 and B-13.
8. **What the first build found** (PHASE0-011d1's Handoff, `.agent/tasks/PHASE0-011d1-back-office-sign-in.md:989-998`):
   *"The mounted-but-hidden pane means two `<main>` elements exist while signed out (BO-01's, and the hidden pane); the
   hidden one is out of the accessibility tree. Slice B may want BO-01 to live inside the one landmark."* And: *"Nothing
   was seen: focus order, the amber notice's contrast on the pale field, the 40px fields, the empty rail at 1440px, and a
   browser password manager's behaviour are all unchecked by eye."* The lead also found that after a logout the built
   BO-01 focuses Password, not Username, and that the frame stops at `--frost-office-width` on a wider window. The
   provisional form is in `apps/back-office/src/` if you want to see it served; you may read it, never edit it.

## Rulings that bind this task

Each is recorded in `.agent/DECISIONS.md` on the date given unless marked as the lead's.

- **Credential (2026-10-06, DESIGN-011 Q4):** the MVP back office signs in with a **username and password**. No staff
  number, no PIN, no bootstrap or self-signup screen: the first manager is injected by hand. A cashier PIN at BO-01 is
  not a state; a non-manager's credential gets `FORBIDDEN`'s *Manager access required* (DESIGN-015).
- **Business day (2026-10-06, DESIGN-011 Q2):** a business day runs from one end-of-day close to the next and is named by
  the WIB date on which it opened. Times are 24-hour `HH:MM` WIB. On BO-02, name the day by its opening date; draw no
  start or end time and no "00:00-23:59".
- **No attempt count, no state the server cannot signal (DESIGN-015, ADR-010 rule 1):** the server sends a code and no
  message; the words are DESIGN-015's. There is no credential-level *permission denied* at sign-in.
- **The draft after the eight hours (2026-10-14):** the same manager signing in again in that tab gets their unsaved
  draft back. A different manager signing in from M-6 destroys it. DESIGN-015 deferred a retained-draft sentence on
  BO-01 until this answer existed (`I:610-623`); the answer now exists, so Part A item 4 asks you to draw it.
- **Browser-saved passwords (2026-10-13):** accepted for the loopback MVP; a browser may offer to save the password. The
  form must not fight a password manager.
- **Today observes, never operates (FR-G12, `I:670-671`):** no settle, fire, void, refund or reopen control on BO-02,
  and nothing that links into the POS (I-6).
- **The Phase 0 frame (DESIGN-015, `I:658-668`):** until the landing has data, the top bar says "Back office", shows the
  real manager's name and offers "Log out", over an empty rail and an empty content pane, with no loading skeleton and
  no empty-data claim. That is what is built today and what Phase 1 will show until the business day exists.
- **Tokens (lead, DESIGN-011 Q12, as in slices A, C and I):** registry first; a missing value may be registered in
  `frost.tokens.json`, `frost.css` and `docs/DESIGN.md` with `source: null` and a `designed` record, each listed in the
  Handoff. No raw colour, size or weight in an artifact. No success green.

## What to draw

### Part 0 — DESIGN-012's three lows, first (lead ruling, 2026-10-06, verbatim)

> - **N1:** a `close` listener on `#logout-dialog` that reopens M-6 while re-authentication is required, and the key
>   sequence added to the check (hardening; not reproduced).
> - **N2:** one sentence after the inert-action rule in `docs/DESIGN.md`: while a modal decision is open, the emergency
>   is repeated inside it and its action is deferred until the decision is made; no other state may defer it.
> - **N3:** announce a lockout once; the ticking time is not a live region (or updates once a minute). Applies to
>   `#cooldown`, `#logout-cooldown` and BO-01's throttle.

N1 is a change to the slice A shell's script and its check (`design012.cjs`); N2 is one sentence in `D`; N3 applies to
the two shell countdowns and to the throttle you draw in Part A.

### Part A — BO-01, `F/login.html`

1. **Every state in `I:595-608`**, by `?state=`: resting, local invalid input (each field), local oversize input,
   loading, error, throttled (including the username edited away from and back to the locked account, restoring the
   original remaining wait), session ended, access refused, unavailable and something went wrong (with *Try again*),
   initial lookup failed (credential controls disabled), and overflow. Success and idle have no BO-01 picture (success
   enters the frame; idle is M-6): say so in the gallery rather than drawing them.
2. **A desktop composition**, using DESIGN-012's stacked 40px native fields, persistent labels, primary office button
   and amber notice, and the desktop type hierarchy (`D:710`), not the POS lock box. Decide the panel width; the
   DESIGN-011 proposal is `--frost-office-login-width` 420px, registered only if the composition keeps it.
3. **The layout findings, each decided and recorded in the Handoff with its reason:**
   - **One `<main>`.** BO-01 lives inside the one landmark the frame uses, or the frame's pane is absent (not merely
     hidden) while signed out. Draw the one you choose and say what a builder must do.
   - **Focus.** Where focus lands on first load, after an explicit logout, after each error, after a throttle ends, and
     after an edited username leaves a lock. The lead's reading of DESIGN-015 is that a cold start or logout focuses
     Username, and a failure keeps the username and focuses Password; confirm or correct it.
   - **Beyond 1440px.** What the window shows wider than `--frost-office-width` (centred frame, a stretched frame, or a
     filled background), for BO-01 and for the signed-in frame alike. Measure at 1440×900 and at 1920×1080.
   - **The notice's contrast** on the field background, measured, meeting WCAG AA for its text.
   - **Password managers.** The fields' names and `autocomplete` tokens (`username`, `current-password`), and that no
     control (a reveal, a remember-me, a recovery link) appears; the rules already forbid those three.
4. **Session ended, with the draft kept.** Under the 2026-10-14 ruling, draw the *session ended* state for a tab whose
   eight-hour limit ended with an unsaved draft, and propose the copy, starting from DESIGN-015's deferred sentence
   (*"The previous session's unsaved changes are stored on this tab and are not submitted automatically."*). It must not
   name the manager or reveal the draft's content before sign-in (another person may be at the desk), must not promise
   the draft to whoever signs in, and must make clear nothing is resent. Say in the Handoff what the same manager sees
   after signing in, and what a **different** manager sees. Whether the draft is then kept for the original manager or
   destroyed when a different manager signs in after the eight hours is **not ruled** (the 2026-10-14 destroy ruling is
   about M-6's other-manager form): draw around it and put it in the Handoff as a question with your proposed answer.
5. **No back-office PIN anywhere.** Confirm in the Handoff that no BO-01 text, `P/login.html` annotation or `S` line
   still suggests a PIN or staff number at the back office; if one does, correct it and list it.

### Part B — BO-02, `F/today.html`

1. **Every state in `I:652-654`**: empty, loading, error (with *Try again*), overflow (a long open-order list, with the
   table header sticking inside its scroll owner), business day open, open orders outstanding, and emergency incident
   present; plus **the Phase 0 frame** (the empty rail and pane described above) as its own named state.
2. **Read-only content** within BO-02's purpose (`I:647-648`): the open business day named by its opening date, the
   open orders outstanding (table, area, opened time, total; your columns, recorded), any outstanding print incidents,
   and the route to End of day. DESIGN-011 notes that the closed-order count and *ready* state are supporting
   information, not licence for an analytics dashboard: draw nothing beyond the inventory's states.
3. **Slice A's global compositions**, not new ones: the persistent emergency (`D:1162`, and DESIGN-012's shell) with its *Open print
   incidents* link to `F/incidents.html`, the receipt warning chip, and the business-day indicator in the shell (`S:244`).
   If slice A drew no business-day indicator, draw it here and say so.
4. **Navigation entries** appear only when their destinations exist. Say in the Handoff which rail entries the Phase 0
   frame state shows (none, by DESIGN-015) and which the full state shows.

### Part C — links, gallery, inventory and wireframe

1. `F/office.js`: add `today` beside `menu`, `incidents` and `audit` where Frost destinations are resolved (`:20`), and
   point the logout fallback (`:31`) at `F/login.html`. Repoint the authored links to `P/login.html` and `P/today.html`
   in `F/menu.html` (one each), `F/report-detail.html` (one each) and `F/shell.html` (one to `login.html`). The lead's
   count before your change, by `grep -c "prototype/"`: `menu.html` 38, `report-detail.html` 9, `shell.html` 1,
   `office.js` 2. Report the counts after, and that no Frost back-office artifact links to `P/login.html` or
   `P/today.html`.
2. Register both artifacts and every state in `manifest.js` and the gallery.
3. Bring `I`'s BO-01 and BO-02 sections and `P/login.html` and `P/today.html` into line: BO-01's "awaiting review" and
   "a complete BO-01 visual composition remains slice B" sentences, and BO-02's "slice B still owns the complete sign-in
   and landing screens", point to the new artifacts; the copy table is unchanged except where Part A item 4 adds the
   retained-draft row; the greyscale prototypes gain a pointer to the Frost artifact, as `P/audit.html` did. Show each
   changed line in the Handoff (`git diff`). Any further conflict you find is raised in the Handoff with exact proposed
   wording, not edited.

## Constraints

- Light only, desktop only. Whole rupiah at precision 0 in every fixture.
- No POS operation, no remote approval, no PIN pad, no dark mode, no telemetry view (I-3, BO-14 stays separate), no
  account recovery, and nothing the inventory or the PRD does not grant. *Invent, revert, ask.*
- No credential value anywhere in a fixture, a screenshot or the Handoff, and no field that looks like a PIN (B-12).
- Every person is named (B-13): the top bar shows the real manager's name in the fixture.
- The four product documents are not edited.
- Do not change DESIGN-012's shared behaviour except N1 and N3; DESIGN-013's and DESIGN-014's states must still pass
  their checks. A narrow extension of `office.js` (Part C) is allowed and listed in the Handoff.
- Measure in a browser at 1440×900 and 1920×1080. Each run of a check script needs the owner's approval in the pane; ask
  before it, not after. Evidence (screenshots, `measurements.json`) stays outside the repository; quote the measurements
  in the Handoff.

## Tests expected to change

None outside `docs/design/`. If a token is registered, `packages/tokens/test/tokens.test.ts` must pass unchanged; if it
does not, stop and raise it. `docs/design/checks/design012.cjs` changes for N1's key sequence (and N3 if it asserts the
countdown's live region); `design012.cjs`, `design013.cjs` and `design014.cjs` may need their expected prototype-link
counts or destinations updated for Part C. Change only those expectations, say so in the Handoff, and remove or weaken no
assertion. Write `docs/design/checks/design016.cjs` for this slice.

## Acceptance criteria

1. `F/login.html` and `F/today.html` exist, import the shared `office.css`, and every state is reachable by `?state=` and
   registered in `manifest.js`. Red if a state is missing or unreachable.
2. The Handoff maps every inventory state (`I:595-608`, `I:652-654`), every ruling above and every item of Parts 0 to C
   to the state or walk that shows it.
3. BO-01's words are DESIGN-015's, verbatim, in every state; the only new copy is Part A item 4's, marked as new for the
   review. Red if any drawn sentence differs from `I:595-608` without being listed.
4. Shown in the browser: one `<main>` in every BO-01 state; focus lands where the Handoff says in each case of Part A
   item 3; the throttle's lockout is announced once and its ticking time is not a live region (N3); an edited username
   leaves and regains the lock as `I:602` says; loading disables the fields and the action.
5. Shown in the browser: N1's key sequence keeps M-6 open while re-authentication is required, and `design012.cjs`
   asserts it.
6. BO-02 shows no settle, fire, void, refund, reopen or POS link in any state; the day is named by its opening date with
   no start or end time; the emergency is slice A's composition.
7. Measurements in the Handoff at 1440×900 and 1920×1080: the frame's slice A geometry unchanged at 1440, the chosen
   wide-window behaviour at 1920, the notice's contrast ratio, the sticky header in `overflow`, and no horizontal
   overflow at the longest fixture name and amount.
8. No Frost back-office artifact links to `P/login.html` or `P/today.html`; the `grep -c "prototype/"` counts after the
   change are in the Handoff.
9. No raw colour, size or weight in a new or changed artifact; every new token is registered with designed provenance
   and listed; `npm run verify` green if anything under `docs/design/tokens/` changed. The slice A, C and I checks pass.
10. The Handoff lists every question raised and not ruled (at least Part A item 4's), each with a proposed answer, and
    every lead reading above it confirms or corrects (the focus reading in Part A item 3).

## Out of scope

- Any other screen's content (slices D to H), BO-14, and M-6 beyond N1 and N3.
- Account recovery, a password change, a PIN reset, or a role change (ADR-009 *Not decided here*; the Phase 1 plan
  raises them).
- Any server or API shape, and building anything.

## Reporting

Commit on `agent/design-016` only, after verify is green where it applies, and never push. Write the Handoff below in
full prose, ending with `DONE` or `BLOCKED: <one question>`. Then run exactly one of:

    herdr agent prompt lead "design016: DESIGN-016 done — <one line>"
    herdr agent prompt lead "design016: BLOCKED — <question>"

## Handover (lead, 2026-10-19): finish on OpenCode

`design016` (Codex `gpt-6-astra`) ran out of its Codex allowance before finishing. The owner chose an OpenCode
`gpt-6-astra` stand-in, `design016b`, to **finish** the slice, not to redo it. Everything below the Handoff heading is
design016's, written in the worktree and **not committed**: 23 paths, among them `F/login.html`, `F/login.js`,
`F/today.html`, `F/today.js`, `F/entry.css`, `docs/design/checks/design016.cjs` (new), and edits to `office.css`,
`office.js`, `shell.html`, `shell.js`, `menu.html`, `report-detail.html`, `manifest.js`, `index.html`, `DESIGN.md`,
`SCREEN-INVENTORY.md`, the two greyscale prototypes, the token files, and `design012.cjs` and `design014.cjs`
(`git status` lists them all). Keep every one of them.

What design016 finished, by its Handoff: both artifacts with all 26 states, N1 to N3, the Part C links and counts, the
inventory and prototype edits, the token registration, `npm run verify` green (93 files, 3744 tests), and the slice A,
C and I checks passing (281/281, 371/371, and DESIGN-014 after its two link counts changed).

**What is left, and all you do:**

1. Run `docs/design/checks/design016.cjs` to completion. It never completed: run 1 stopped on a collapsed review
   control, run 2 while reading focus during logout navigation; design016 fixed both in the script but did not rerun
   it. Run it as `PLAYWRIGHT_MODULE="$PWD/node_modules/playwright" DESIGN_EVIDENCE_DIR=/tmp/design016-evidence node
   docs/design/checks/design016.cjs` from the worktree root (Chrome is at its default path). If it fails, fix the
   **check** where the check is wrong; where the **artifact** is wrong, fix only that defect and say so. Remove or
   weaken no assertion.
2. Rerun `design012.cjs`, `design013.cjs` and `design014.cjs` the same way, and `npm run verify`, after any change.
3. Record in the Handoff the final measurements the task asks for (acceptance criterion 7): the frame's geometry at
   1440×900, the wide-window behaviour at 1920×1080, the notice's measured contrast ratio, the sticky header in Today's
   `overflow`, and no horizontal overflow. Quote the check output; evidence stays in `/tmp`.
4. Run the static checks design016 asked for and did not get: `node --check` on each changed or new `.js`/`.cjs`, and
   `git diff --check`.
5. Replace the Handoff's *"Final measurements and completion will be recorded after the approved reruns"* sentence
   with what the reruns showed, add a short **Finished by design016b** section saying what you ran and changed, and end
   the file with `DONE` or `BLOCKED: <one question>`.
6. Commit everything on `agent/design-016` (path-scoped `git add` of the paths `git status` lists), never push.

**Do not change any design decision** in the Handoff: the layout, the focus policy, the copy, the states, the
retained-draft proposal or the owner question. If something seems wrong, write it in your section as a finding for the
review. Running the checks is part of this brief; anything your allow list does not cover will ask the owner.

Report with `design016b` in place of `design016` in the two Reporting lines above.

## Round 2 — the review's five findings (lead rulings, 2026-10-19)

The review is `.agent/reviews/DESIGN-016-review.md` (Claude Opus 5.5, at `3ec72c9`). Read it in full. **Every finding
is accepted as proposed**; this is fix cycle 1 of 2. The reviewer could not run a browser or `node --check` (its
unattended session refused them), so its findings come from reading the code; the lead confirmed both medium ones in
the source (`office.css:15-16`; `login.js:57`). Fix each, then rerun everything, because nobody but you has run the
checks on this branch.

- **F1 (medium), wide-window centring on every consumer.** As proposed: centre `.device.device--bo` (or the outermost
  frame element) so that `menu.html` and `report-detail.html` centre at 1920 exactly as `today.html` does, and extend
  `design016.cjs`'s frame-geometry assertion to `menu.html` and `report-detail.html` at 1440 and 1920. **The lead also
  allows one sentence in `docs/DESIGN.md`**, in *Layout* beside the 1440-wide back-office sentence (`D:804`), stating
  the rule: wider than `--frost-office-width`, the signed-in frame stays that width, centred, with the canvas filling
  both sides; the sign-in column centres in the window. This answers the review's note for the lead, so the frontend
  task can cite DESIGN rather than a Handoff.
- **F2 (medium), local validation.** As proposed: compute the set of missing fields and, separately, the set of
  oversize fields; mark **every** member with its message and `aria-invalid`; focus the first in document order.
  Emptiness is `=== ''`, never `trim()`: a username of spaces goes to the server (`I:626-631`; the contract schema has no
  trim). The trimmed, lower-cased key stays only for the cooldown account match (`I:602`). Draw a blank-form state (both
  messages) and register it, and in `design016.cjs` assert both errors and both `aria-invalid` on a blank submit, both
  on a double oversize, and a whitespace username reaching `loading`. Say in the Handoff that local validation marks
  every invalid field.
- **F3 (low), the throttled picture.** As proposed: prefill the direct `throttled` state with `m.iqbal` (M-6's fixture
  manager), password empty, so the picture shows the submitted username kept and editable. A username is not a
  credential value under B-12. Drop the blank-username explanation from the fixture text and the Handoff.
- **F4 (low), M-6 announces once.** As proposed: port `login.js`'s `announcedKey` guard to `shell.js` so the snapshot is
  written only when a lock newly arrives or the locked account key changes; build the snapshot as `title + '. ' +
  body`; add a keystroke case (a trailing space, a case change) to `design012.cjs`'s N3 block.
- **F5 (low), N1's guard.** As proposed: both close guards reopen M-6 through the same focus rule `start()` uses, and
  restore the pre-logout state with `O.setState`; add the forced close from `reauth-other-throttled` to `design012.cjs`
  and assert where focus lands.

Then rerun `design016.cjs`, `design012.cjs`, `design013.cjs` and `design014.cjs` to completion, `node --check` on every
changed script, `npm run verify` and `git diff --check`. Add a **Round 2** section at the end of the Handoff mapping each
finding to its change and its evidence (quoted check output), with updated measurements wherever F1 changes them; change
round 1's sections only where a fix makes a statement in them untrue (F2's focus and state counts, F3's sentence).
Replace the final `DONE` with your Round 2 section, ending the file with `DONE` or `BLOCKED: <one question>`. Commit on
`agent/design-016` (path-scoped), never push, and report with the `design016b` lines.

## Handoff

### Delivery and design decisions

Designed by design016 on `agent/design-016`. The new entry points are
`docs/design/visual-directions/frost/back-office/login.html` and `today.html`.
Both consume `office.css`; Today also consumes `office.js`. `entry.css` holds
only this slice's layout, while `login.js` and `today.js` provide local review
interactions. No service, real authentication or order command is invoked.
The delivery is a design proposal for the task's subsequent design review.

BO-01 uses a 420px column on the Frost canvas, with a 30px medium heading,
14px body, persistent 12px labels, 40px native fields and a full-width 36px
primary office action. The form is centred in the available desktop window.
At short heights the page grows and scrolls; its top and submission action
remain reachable. It has no rail or authenticated top bar. A builder must
unmount the authenticated frame while signed out, including its main landmark,
and mount this one `main` instead. Merely hiding another `main` is insufficient.

The signed-in frame retains the 1440px width, 220px rail, 64px header and 24px
content padding. Its new `margin-inline: auto` centres it on a wider window,
with the existing Frost canvas filling both side margins. The frame does not
stretch its table or navigation beyond the reviewed geometry. This placement
rule applies to all consumers of `office.css`; their state behavior is unchanged.

The fields are named `username` and `password`, with `autocomplete="username"`
and `autocomplete="current-password"`. Password remains a native password
input. No reveal, remember-me or recovery control exists. No credential is
prefilled in the new artifact, recorded in screenshots, persisted, logged or
sent. The direct cooldown drawing retains the fixture username `m.iqbal`,
editable, with an empty password. A username is not a PIN or password value
under B-12. Its clearly separated review controls let a reviewer enter an
invented identifier and simulate a response for that account.

The lead's focus reading is confirmed for cold start, explicit logout and an
ordinary credential failure. Cold start, logout, session loss and access refusal
focus Username. Local validation marks every missing field, or every oversized
field, with its message and `aria-invalid`, and focuses the first in document
order. Oversize input clears Password. Emptiness is an empty string, without
trimming; nonempty whitespace usernames reach verification. Credential
failure and the two general failures retain Username, clear Password and focus
Password. A failed initial lookup disables both fields and Sign in and focuses
Try again; successful lookup recovery focuses Username. A general-failure retry
requests fresh password entry and never resends a secret. Editing away from a
locked account keeps focus in Username so typing is uninterrupted. A deadline
ending also keeps focus there if the user is still typing; otherwise Password
receives focus. Expiry enables entry without submitting it. During loading,
both fields and Sign in are disabled.

### Requirement and state map

Every named state below is registered in the gallery manifest and directly
reachable through `?state=`. BO-01 has 18 states and BO-02 has nine after Round 2.

| Requirement | Artifact state or interaction |
|---|---|
| Part 0 N1 | The `logout-dialog` close guard reopens M-6 when re-authentication is still required and neither dialog is open. DESIGN-012's check adds repeated Escape, Tab/Shift+Tab, forced logout-dialog closure and an attempted background focus. |
| Part 0 N2 | One sentence after the inert-action rule in DESIGN states that a modal decision repeats the emergency and defers its action only until the decision is made. |
| Part 0 N3 | M-6 and logout ticking text have `aria-live="off"` and no status role. A separate M-6 status region receives one snapshot on lock arrival; logout's static description includes its remaining wait. BO-01 similarly announces a lock once and updates its visible timer outside the live region. |
| A1 resting / explicit logout | Login `default`, `logged-out`. Empty native fields and exact common copy. Actual logout also reaches the default state. |
| A1 local invalid | `invalid-both`, `invalid-username`, `invalid-password`, and submitting missing values. Every missing field has its associated error and `aria-invalid`; focus goes to the first. |
| A1 local oversize | `oversize-username`, `oversize-password`, and submitting values over the shared 256/1024 UTF-16 bounds. Every oversized field has `aria-invalid` and the reviewed generic error body beside it, alongside the shared error notice. Focus goes to the first oversized field; Password is cleared. No truncation or creation-policy checks. |
| A1 loading / error | `loading`, `error`; local submission traverses loading to the selected response. |
| A1 throttle | `throttled`; edit away and return with trimmed/lower-case matching, retaining the original deadline. Separate accounts keep separate known deadlines. |
| A1 session loss | `session-ended` has no draft claim; `session-ended-draft` adds the proposed sentence only when the tab actually has retained work. |
| A1 access refused | `forbidden` uses Manager access required and contains no protected working area. |
| A1 general failures | `unavailable`, `unexpected`; Try again clears the notice and focuses fresh Password entry. |
| A1 lookup failures | `lookup-unavailable`, `lookup-unexpected`; disabled credential controls, retry of the simulated lookup only. |
| A1 overflow | `overflow` uses the longest legitimate session-ended notice. At a short desktop height the form scrolls without clipping its action. It adds no product sentence. |
| A1 success / idle | Neither is a BO-01 picture. The gallery and review notes say that success enters the frame and idle opens the existing M-6 fixture. |
| A2 / A3 composition | All Login states use the shared office fields, button and notice geometry, the new desktop width token, one landmark and the focus policy above. |
| A4 retained draft | `session-ended-draft`; no actor identity or draft content before sign-in, no resend or restoration promise to the unknown reader. Outcomes and the unresolved disposal question are below. |
| A5 credential vocabulary | The new BO-01 text and existing P/login annotation describe username/password; S's BO-01 entries already say password cooldown. The annotation's reference to separate POS PIN classes remains correct. |
| B1 / B2 open day and outstanding orders | Today `default` shows the opening WIB date and three read-only orders; `ready` has an open day and no open orders; `empty` means no trading yet. |
| B1 read states | `loading` withholds unread rows and the day indicator; `error` offers Try again and traverses loading to the default list. |
| B1 overflow | `overflow` contains 36 open orders, including the long area/table identity, the long named manager and `999.999.999`; the shared table header sticks within `.bocontent`. |
| B1 / B3 incidents | `incident` uses slice A's persistent emergency and receipt chip; `receipt` shows only the lower-priority receipt warning. The emergency action reaches Frost BO-13. Explicit incoming alert context retains slice A's precedence. |
| B1 / B4 Phase 0 | `phase0` has an empty rail and content pane, Back office, M. Iqbal's name and Log out; no day, incident or empty-data claim. |
| C1 destinations | Shared Today and logout destinations and the authored menu/report/shell links now target the two Frost artifacts. |
| C2 gallery | Both surfaces and all 27 states are registered after Round 2; the gallery explains the absence of a success or idle BO-01 picture. |
| C3 documentation | BO-01's provisional-composition introduction and BO-02's slice-B sentence link to the new artifacts; the retained-draft row is added. Both historical greyscale prototypes link to the corresponding Frost surface. The exact diff is recorded below. |

Today's columns are Table / order, Area, Opened and Total. Time is HH:MM WIB;
amounts are bare integer rupiah, with IDR stated once in the table caption.
The day is named by its opening date, Tue 6 Oct 2026, without start/end times.
The fixture lists totals of 155.925, 80.000 and 421.000 without aggregating them
into an invented analytics metric. Overflow adds 33 rows. No settle, fire,
void, refund, reopen or POS navigation control exists. The End of day action
opens the existing BO-09 behavioral wireframe and does not execute a close.
No closed-order metric or analytics dashboard was added.

Slice A already supplies the business-day indicator, emergency and receipt
compositions. This slice does not create substitutes. The full rail contains
Today, End of day, Reports, Audit, Menu, Tables, Staff, Discount presets,
Settings and Printing. Every destination exists: Today, Audit, Menu and
Printing are Frost; the remaining destinations still use their behavioral
wireframes pending their own slices. Phase 0 shows none of these entries.
The narrowly scoped `WF.phase0` flag suppresses generated navigation, day and
alerts for that named fixture only. Other shared behavior changes are N1 and
N3; the destination resolver also adds Today and the Frost logout fallback.

### New copy and unresolved questions

The only new BO-01 product sentence is the proposed retained-draft sentence:
“The previous session’s unsaved changes are stored on this tab and are not
submitted automatically.” It keeps DESIGN-015's deferred words verbatim and
is explicitly marked as a DESIGN-016 proposal in the inventory and review
notes. Every other BO-01 product string is DESIGN-015's exact copy. Review
control explanations are outside the product.

After eight-hour expiry, the same manager signing in again in the same tab
gets their unsaved draft back under the 2026-10-14 ruling. A builder must
restore its values and validation without submitting it and return to that
working area. A different manager sees only their separate working area,
with none of the earlier draft visible, editable or submitted. The sign-in
notice promises neither manager a recovery flow before identity is established.

**Owner question:** after a different manager signs in from BO-01 following
eight-hour expiry, is the isolated old draft destroyed or retained for its
original manager? Proposed answer: destroy it after the different manager's
successful sign-in, matching the already-ruled M-6 transition. Until ruled,
keep it inaccessible and make no disposal or later-restoration claim. This
proposal is not implemented in the fixture.

The following existing text conflicts with the supplied rulings or current
Frost composition. Part C requires further conflicts to be raised rather
than edited, so these passages remain for the lead to reconcile:

- BO-01's paragraph below its copy table still says same-manager recovery is
  an owner question and calls the sentence deferred. Proposed replacement:
  “At absolute expiry the draft remains isolated in this tab and is never
  submitted automatically. The same manager receives it after signing in
  again in this tab. Another manager never receives it; whether that sign-in
  destroys the isolated draft remains an owner question. Phase 0 has no
  draft, so it shows no retained-draft sentence.”
- M-6's Session ended row and Owner questions paragraph still call the two
  2026-10-14 answers unresolved. Proposed replacement: “The same manager
  receives the tab's unsaved draft after signing in again beyond eight hours.
  A different manager signing in through M-6 destroys it and enters a separate
  working area. Disposal after a different manager signs in through BO-01
  following absolute expiry remains undecided.”
- DESIGN's M-6 and DESIGN-015 supplements repeat those old unresolved claims
  and call the BO-01 composition provisional. Proposed replacement: “The
  reviewed DESIGN-015 copy is drawn in DESIGN-016's Frost Login and Today
  compositions. Same-manager recovery after absolute expiry and draft
  destruction on M-6's different-manager success follow the 2026-10-14
  rulings; the BO-01 different-manager disposal question remains open.”
- P/today's historical drawing still has a start time, decimal amounts,
  a PIN-labelled old M-6 and a claim that I-2 could be cut. Proposed exact
  replacements are “Business day · Tue 6 Oct 2026”, totals “155.925”,
  “80.000”, “421.000”, the current M-6 username/password composition via
  `F/shell.html?state=reauth`, and “I-2 is kept. Frost Today is the current
  composition.” Its new pointer makes its historical status explicit; it
  is not used as the destination of any Frost Today link.

### Files, token and validation

The only added token is `--frost-office-login-width: 420px`, registered with
`source: null` and its DESIGN-016 designed record in `frost.tokens.json`,
regenerated in `frost.css`, and described in DESIGN's token supplement.
No new colour, font weight, fixed product height or success green is introduced.
The shared frame's centring and visually hidden announcement utility consume
existing tokens. The four product documents, application code, packages and
database files are unchanged. No existing check assertion was removed or
weakened, DESIGN-013 needs no expectation change. DESIGN-014 changes only its two
prototype-link counts from 38/9 to 36/7.

The authored `prototype/` counts are Menu 36, Report detail 7, Shell 0 and
Office runtime 1. The remaining runtime occurrence is the common resolver
prefix for existing greyscale destinations. There is no Frost back-office
reference to `prototype/back-office/login.html` or `prototype/back-office/today.html`.

Repository verification passed: typechecking and 93 test files / 3,744 tests,
including the unchanged token tests. Its final output arrived while I was
attempting to stop what appeared to be a stalled run. A duplicate approved
run had already started; it was stopped rather than repeating the passed
suite. The first run exited 0; the duplicate was interrupted and is not
claimed as passing. The existing Vite native-config warning remains.

The individually approved DESIGN-012 run passed 281/281 assertions across
52 states, including N1's key sequence and forced-close hardening, N3's static
announcement, and preserved 1440px geometry. DESIGN-013 passed 371/371 across
41 states. Both reported zero page errors and no failed assertions. DESIGN-014
initially passed 286/288; only the two prototype-link counts failed. Its
expected counts now match the authorized migration; no assertion was removed.

The first DESIGN-016 run captured all states at both target widths, then
stopped because the check tried to select a collapsed review control. The
second run passed the state/geometry capture phase and stopped while reading
focus during navigation. These are recorded as incomplete checks, not passes.
The check now opens its disclosure before using its controls and waits for
logout navigation before checking focus. The completed design016b reruns passed
all four browser checks and repository verification; final measurements and
completion are recorded below.


### Exact inventory and wireframe changes

The following is the complete diff for the three Part C documentation files.
No sitemap line needed correction.

```diff
diff --git a/docs/design/SCREEN-INVENTORY.md b/docs/design/SCREEN-INVENTORY.md
index 2f02b22..896c8e5 100644
--- a/docs/design/SCREEN-INVENTORY.md
+++ b/docs/design/SCREEN-INVENTORY.md
@@ -584,9 +584,9 @@ Reporting and audit are read surfaces; everything else operates.
 Idle expiry uses the re-authentication modal instead, so unsaved form state is
 preserved (FR-A2b).

-**States and exact copy — DESIGN-015 (awaiting review).** This table is the
-copy specification for PHASE0-011d's provisional Frost form; a complete BO-01
-visual composition remains slice B. Use DESIGN-012's stacked 40px native
+**States and exact copy — DESIGN-015 (reviewed).** This table remains the
+copy specification. The complete [Frost BO-01 composition](visual-directions/frost/back-office/login.html)
+is drawn by DESIGN-016 for design review, using DESIGN-012's stacked 40px native
 fields, persistent labels, primary office button and amber notice. The page
 heading is “Back office”; helper text is “Sign in with your manager username
 and password.” Labels are “Username” and “Password”; the primary action is
@@ -601,6 +601,7 @@ and password.” Labels are “Username” and “Password”; the primary actio
 | Error | `INVALID_CREDENTIALS` without cooldown details | “Sign-in failed” / “Check your username and password, then try again.” Do not identify which credential failed. |
 | Throttled | `INVALID_CREDENTIALS` with `retryAfterSeconds`, or `THROTTLED` | “This username is locked for {wait}” / “This username is cooling down. Other managers can sign in with their own usernames.” Use POS-01's duration format. Disable password and Sign in for the submitted username; keep Username editable. As soon as the edited username no longer matches the locked account (compare trimmed, lower-case usernames), remove that notice and enable Password and Sign in unless the new account has its own known wait. Switching back restores the original remaining wait; editing never resets it. |
 | Session ended | `UNAUTHENTICATED` on a held session, including M-6 after eight hours | “Your session has ended” / “Sign in again to continue.” No claim about the cause. Do not place a retained-draft sentence in Phase 0; see the deferred copy below. |
+| Session ended with an isolated draft — DESIGN-016 proposal for review | Eight-hour expiry with unsaved work in this tab; absent in Phase 0 | Keep Session ended’s title and body, then add: “The previous session’s unsaved changes are stored on this tab and are not submitted automatically.” Show no manager identity or draft contents before sign-in, and promise no restoration to the unknown reader. |
 | Access refused | `FORBIDDEN` on an authenticated back-office request, including M-6 | “Manager access required” / “This account cannot use the back office. Sign in with a manager account.” Remove the protected working area; show this notice on BO-01 with the ordinary form. Do not claim that the account was disabled or explain why its role changed. |
 | Unavailable / something went wrong | Shared general-failure triggers | Use the exact shared title, body and “Try again” action above. |
 | Success | Successful sign-in | No success sentence; enter the Phase 0 frame described at BO-02. |
@@ -662,8 +663,9 @@ name and offers “Log out”. No loading skeleton or empty-data message: this i
 a shell with no landing content yet. No navigation entries, business-day
 indicator, incident banner or receipt chip until their destinations and routes
 exist. This is a Phase 0 exception to the populated DESIGN-012 fixture, not a
-replacement for I-2 or the eventual BO-02 design. No new drawing or token is
-needed; slice B still owns the complete sign-in and landing screens. This
+replacement for I-2. DESIGN-016 supplies the [complete Frost landing](visual-directions/frost/back-office/today.html)
+and its named [Phase 0 frame](visual-directions/frost/back-office/today.html?state=phase0),
+alongside [Frost sign-in](visual-directions/frost/back-office/login.html). This
 empty-content allowance does not suppress errors: a failed Log out uses the
 notice placement and repeat-logout action in the shared failures table above.

diff --git a/docs/design/prototype/back-office/login.html b/docs/design/prototype/back-office/login.html
index d17ac07..fe431fa 100644
--- a/docs/design/prototype/back-office/login.html
+++ b/docs/design/prototype/back-office/login.html
@@ -40,6 +40,7 @@
 </div><div class="device__caption">Back office &mdash; 1440 wide</div></div>

 <aside class="rail">
+  <div class="ann"><p>The complete BO-01 states and native form are drawn in <a href="../../visual-directions/frost/back-office/login.html">Frost Login</a> (DESIGN-016, awaiting review). This greyscale drawing is historical; use the Frost artifact for the current composition and state coverage.</p></div>
   <h2>Purpose</h2>
   <div class="ann"><p>Establish a conventional desk session for a manager.</p></div>
   <h2>Fixed by the PRD</h2>
diff --git a/docs/design/prototype/back-office/today.html b/docs/design/prototype/back-office/today.html
index 19911c9..902cd0f 100644
--- a/docs/design/prototype/back-office/today.html
+++ b/docs/design/prototype/back-office/today.html
@@ -110,6 +110,7 @@
 </div></div><div class="device__caption">Back office &mdash; 1440 wide</div></div>

 <aside class="rail">
+  <div class="ann"><p>The read-only BO-02 states, Phase 0 frame and persistent alerts are drawn in <a href="../../visual-directions/frost/back-office/today.html">Frost Today</a> (DESIGN-016, awaiting review). This greyscale drawing is historical; use the Frost artifact for the current composition and state coverage.</p></div>
   <h2>Purpose</h2>
   <div class="ann"><p>A landing destination after sign-in: the open business day, anything
    outstanding, and the route to end of day.</p></div>
```

### Finished by design016b

Completed the lead's finish-only handover on `agent/design-016`. No artifact,
check, token, copy or design decision needed changing. This completion updates
only the Handoff, including removal of trailing whitespace from four blank
context lines in its quoted diff after the first `git diff --check` flagged them.

The browser checks ran to completion with `PLAYWRIGHT_MODULE="$PWD/node_modules/playwright"`
and their respective `DESIGN_EVIDENCE_DIR=/tmp/designNNN-evidence` directories.
Their final output was:

| Check | Completed output |
|---|---|
| DESIGN-016 | `"passed": 381, "total": 381, "failures": [], "errors": []` |
| DESIGN-012 | `"states": 52, "checks": 281, "errors": [], "failures": []` |
| DESIGN-013 | `"states": 41, "checks": 371, "failed": [], "errors": []` |
| DESIGN-014 | `"states": 24, "passed": 288, "total": 288, "errors": [], "failures": []` |

The final `npm run verify` exited 0: typechecking passed, followed by
`Test Files 93 passed (93)` and `Tests 3744 passed (3744)`, including the
unchanged token tests. The existing Vite native-config warning was emitted.

#### Final browser measurements

The following values are quoted from `/tmp/design016-evidence/measurements.json`.
Coordinates and dimensions are CSS pixels; the frame measurements use Today's
incident state, and the login measurements use its error state.

| Measurement | 1440×900 | 1920×1080 |
|---|---|---|
| Frame `(x, y, width, height)` | `(0, 0, 1440, 900)` | `(240, 0, 1440, 1080)` |
| Navigation `(x, y, width, height)` | `(0, 0, 220, 900)` | `(240, 0, 220, 1080)` |
| Top bar `(x, y, width, height)` | `(220, 0, 1220, 64)` | `(460, 0, 1220, 64)` |
| Content padding | `24px` | `24px` |
| Emergency `(x, y, width, height)` | `(220, 64, 1220, 80)` | `(460, 64, 1220, 80)` |
| Receipt chip `(x, y, width, height)` | `(878.453125, 17.5, 191.375, 28)` | `(1118.453125, 17.5, 191.375, 28)` |
| Login panel `(x, y, width, height)` | `(510, 195.5, 420, 509.015625)` | `(750, 285.5, 420, 509.015625)` |
| Username field `(width, height)` | `(420, 40)` | `(420, 40)` |
| Today overflow header `(x, y, width, height)` | `(244, 64, 375.375, 40.9375)` | `(484, 64, 375.375, 40.9375)` |
| Today scroll owner `(x, y, width, height)` | `(220, 64, 1220, 836)` | `(460, 64, 1220, 1016)` |
| Today scroll offset | `600` | `600` |

The 1440px frame geometry matches slice A's passing rerun. At 1920px the frame
remains 1440px wide and is centred with 240px side margins; the login column is
centred independently in the window. At both sizes the overflow header stays
at its scroll owner's `y: 64` after scrolling 600px.

The notice measured `foreground: rgb(131, 97, 28)`,
`background: rgb(255, 245, 218)`, and `ratio: 5.234805077491828` at both sizes,
exceeding the 4.5:1 AA threshold. Every one of the 26 states at both target
sizes passed `overflow: 0` and `contentOverflow: false`, with one main landmark
and an empty password field. The overflow assertions also confirmed the full
name `Ratna Ayu Kartikasari Prameswari · Manager` and amount `999.999.999`.
Screenshots and measurement files remain outside the repository in `/tmp`.

Static syntax checks passed with `node --check` for all eight changed or new
scripts: `design012.cjs`, `design014.cjs`, `design016.cjs`, `office.js`,
`shell.js`, `login.js`, `today.js` and `manifest.js`. The final
`git diff --check` passed after the whitespace correction above.

No additional design finding arose from these checks. The retained-draft
owner question and previously recorded documentation conflicts remain for
review exactly as proposed above.

### Round 2 — F1 to F5, completed by design016b

Applied the lead's five accepted findings from `.agent/reviews/DESIGN-016-review.md`.
The following changes and regression assertions address each finding. All
existing assertions remain; none was removed or weakened.

| Finding | Change | Passing evidence |
|---|---|---|
| F1 | Added `margin-inline: auto` to `.device.device--bo` in `office.css`, centring the outer wrapper on Menu and Report detail as well as the inner frame. Added the authorized wide-window sentence beside the back-office Layout paragraph in `docs/DESIGN.md`. | DESIGN-016 now measures both wrapped frames at 1440×900 and 1920×1080, checking width, x coordinate, rail, header, padding and document overflow. All four `wrapped frame geometry` assertions passed; measurements are below. |
| F2 | `login.js` computes missing fields using `=== ''`, then computes oversized fields separately using the unchanged 256/1024 UTF-16 limits. Every member receives a field message and `aria-invalid`; the first in document order receives focus. Oversize keeps the reviewed generic notice, repeats its existing body beside each affected field and clears Password. Registered the new `invalid-both` blank-form state in the artifact and manifest. | DESIGN-016 passed blank-submit and blank-deep-link assertions for both messages, both invalid attributes and Username focus; double oversize marked both fields, cleared Password, retained the untruncated username and focused Username. A three-space username reached `loading` unchanged. BO-01 now has 18 states; BO-02 retains nine. |
| F3 | The direct `throttled` state now starts with the submitted fixture username `m.iqbal` and an empty password. Removed the blank-username rationale from the fixture explanation and this Handoff. | DESIGN-016 passed `direct throttle retains submitted fixture username and empty secret`: Username is editable, while Password and Sign in are disabled. Clearing Username removes the lock and enables entry; the empty key is not locked. Both target-size throttle screenshots show the retained username. |
| F4 | Added a normalized `announcedKey` guard to M-6. The other-manager snapshot is built from the same title/body pair as the visible notice, joined with `. `, rather than concatenating DOM text. Unlocked rendering clears the snapshot and guard. | DESIGN-012's MutationObserver recorded zero announcement writes after a timer tick, a trailing-space keystroke and a case change on the same locked account. The snapshot remained identical, with a sentence separator. Leaving the account cleared the snapshot; returning announced the newly present lock. |
| F5 | Both close listeners now call `reopenReauth`, which reopens through `start` and its shared `reauthFocus` rule. Forced logout closure restores the pre-logout state through `render` / `O.setState`; the existing expired-wait normalization is shared with Keep this draft. | DESIGN-012 forced direct M-6 closure in `reauth`, `reauth-throttled`, `reauth-other-throttled` and `reauth-other-confirm`: focus returned respectively to Password, Sign in as a different manager, Username and Stay with current manager. Forced logout closure in the first three restored the same focus plus the document and URL state. The other-manager case retained `r.ayu` and its disabled submission. |

#### Completed checks

All four browser checks ran to completion using the installed Chrome and
`PLAYWRIGHT_MODULE="$PWD/node_modules/playwright"`. The quoted final output is:

| Check | Output | Evidence directory |
|---|---|---|
| DESIGN-016 | `"passed": 393, "total": 393, "failures": [], "errors": []` | `/tmp/design016-evidence/round2` |
| DESIGN-012 | `"states": 52, "checks": 293, "errors": [], "failures": []` | `/tmp/design012-evidence/design016-round2` |
| DESIGN-013 | `"states": 41, "checks": 371, "failed": [], "errors": []` | `/tmp/design013-evidence/design016-round2` |
| DESIGN-014 | `"states": 24, "passed": 288, "total": 288, "errors": [], "failures": []` | `/tmp/design014-evidence/design016-round2` |

`node --check` exited 0 for `design012.cjs`, `design014.cjs`, `design016.cjs`,
`office.js`, `shell.js`, `login.js`, `today.js` and `manifest.js`, covering every
script changed in this round and the earlier slice. `npm run verify` exited 0:
typechecking passed, with `Test Files 93 passed (93)` and
`Tests 3744 passed (3744)`. The existing Vite native-config warning remains.
`git diff --check` passed.

#### Updated browser measurements

Quoted from the completed DESIGN-016 `measurements.json`, in CSS pixels:

| Surface and measurement | 1440×900 | 1920×1080 |
|---|---|---|
| Menu frame `(x, y, width, height)` | `(0, 0, 1440, 900)` | `(240, 0, 1440, 1080)` |
| Report detail frame `(x, y, width, height)` | `(0, 0, 1440, 900)` | `(240, 0, 1440, 1080)` |
| Both wrapped rails `(x, y, width, height)` | `(0, 0, 220, 900)` | `(240, 0, 220, 1080)` |
| Both wrapped top bars `(x, y, width, height)` | `(220, 0, 1220, 64)` | `(460, 0, 1220, 64)` |
| Both wrapped content paddings | `24px` | `24px` |
| Both wrapped document overflows | `0` | `0` |
| Today frame `(x, y, width, height)` | `(0, 0, 1440, 900)` | `(240, 0, 1440, 1080)` |
| Login error panel `(x, y, width, height)` | `(510, 195.5, 420, 509.015625)` | `(750, 285.5, 420, 509.015625)` |
| Notice contrast ratio | `5.234805077491828` | `5.234805077491828` |
| Today overflow header `(x, y, width, height)` | `(244, 64, 375.375, 40.9375)` | `(484, 64, 375.375, 40.9375)` |
| Today content top / scroll offset | `64 / 600` | `64 / 600` |

Thus both wrapped frames now have 240px of canvas on each side at 1920px,
matching Today, while the 1440px geometry is preserved. All 27 Login/Today
states at both target widths passed the one-landmark, empty-password and
zero-horizontal-overflow assertions, including the long name and amount.
The Today header remains at the scroll owner's top after scrolling 600px.

I inspected the generated blank-form, error and throttle screenshots at 1440px,
plus Menu and Report detail at 1920px. The Impeccable detector ran once over
the changed UI files and reported one `cramped-padding` warning on the Login
notice, claiming no inset. This is a static false positive: imported
`office.css` supplies `padding: var(--frost-space-3) var(--frost-space-4)`
(12px / 16px), and the error and throttle screenshots visibly retain that
inset. No change was made for that warning. All browser evidence stays in `/tmp`.

The retained-draft proposal, unresolved owner question and earlier documentation
conflicts remain as recorded. This round adds no token or product copy; the
oversize field messages reuse the reviewed error body. Only the authorized
design files, their checks and this Handoff changed.

DONE
