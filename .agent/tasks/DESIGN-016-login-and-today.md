---
id: DESIGN-016
title: BO-01 Login and BO-02 Today in Frost (slice B), with DESIGN-012's three lows and the sign-in layout findings from PHASE0-011d1
category: ui
touches: [identity]
depends_on: [DESIGN-012, DESIGN-015]
owns: [docs/design/**, docs/DESIGN.md]
status: not-started
cycles: 0
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

## Handoff
