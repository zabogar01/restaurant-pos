---
id: DESIGN-012
title: The back-office shell, its global alerts, M-6 re-authentication over a preserved draft, and the shared desktop patterns, in Frost
category: ui
touches: [identity]
depends_on: [DESIGN-011]
owns: [docs/design/**, docs/DESIGN.md]
status: not-started
cycles: 0
---
# DESIGN-012 — Back-office shell, global alerts, M-6 and shared patterns (slice A)

**Written** 2026-10-06 by the lead. Slice A of the nine back-office design slices proposed in
DESIGN-011 (`.agent/reviews/DESIGN-011-back-office-audit.md`, on `development`).
**Owner:** a Codex designer on `gpt-6-astra`, effort high, opened by hand in its own pane.
**Branch and place:** `agent/design-012`, cut from `development` at `d7384a7`, in the worktree
`../restaurant-pos-wt/DESIGN-012`. Touch nothing under `apps/`, `packages/` or `db/`, and nothing
in the main checkout at `../restaurant-pos`.

Nothing is built from this task. A design review follows, and the back-office frontend is
built against fixtures only after every slice it needs is reviewed. The identity rules below
are owner rulings already recorded, so no architect consult precedes this task.

## Objective

Thirteen back-office screens wait on the same few undesigned pieces: the frame every screen sits
in, the two print alerts that must stay visible on every screen, the re-authentication dialog
that keeps a manager's unsaved work, and the shared form, dialog, table and result patterns.
DESIGN-011 found all of them missing or greyscale (findings S1 to S3, the M-6 section and
*Shared pieces*). When this task is done, a Frost artifact draws each of them, every state is
reachable by `?state=`, and slices B to I can draw their screens inside it without inventing a
frame, an alert or a control of their own.

## Required inputs

Read these, in this order. Everything you need is here or cited.

1. `.agent/reviews/DESIGN-011-back-office-audit.md`, all of it. Its abbreviations (`I`, `D`, `S`,
   `P/`, `F/`, `W`, `V`, `T`) are used below. The parts this task acts on are S1, S2, S3, S5, the
   M-6 section (`:325–336`), *Shared pieces* (`:391–405`), *Tokens: proposals only*
   (`:407–431`), *Gallery readiness* (`:387–389`), and questions Q3, Q9, Q10, Q11 and Q12.
2. `docs/design/SITEMAP.md` `:236–250` (the back-office chrome), `:310–319` (what the back
   office must never offer) and `:325–349` (the two incident classes).
3. `docs/design/SCREEN-INVENTORY.md`: conventions `:16–41`; BO-01 `:539–562` (for what M-6 is
   not); M-6 `:970–974`; ruling I-11 in the table from `:984`.
4. `docs/DESIGN.md`, especially the office type and density (`D:707–730`, `D:745–754`), the
   shell (`D:801–811`), actions (`D:963–970`), fields and dialogs (`D:1043–1075`), tables
   (`D:1138–1157`), navigation and empty states (`D:1187–1199`), what is not yet reviewed
   (`D:1265–1305`) and token provenance (`D:486–506`). Then `docs/design/tokens/frost.css` and
   `frost.tokens.json`.
5. The two existing Frost back-office artifacts, `F/menu.html` and `F/report-detail.html`, their
   imports, and `docs/design/visual-directions/mockup.js` and `manifest.js`. The navigation in
   `F/menu.html:16–36` is the starting composition.
6. The wireframes for behaviour: `P/today.html` (the two alerts at `:38–51`, M-6 at `:94–108`)
   and `P/incidents.html`. They are greyscale and pre-IDR; restyle, do not copy.
7. The contract, for the rules below: `docs/PRD.md` FR-A2b, FR-A2c, FR-A5, FR-E3, FR-E6, FR-I1;
   `docs/BOUNDARIES.md`.

## Rulings that bind this task

- **Same manager only** (owner, 2026-10-05, DESIGN-011 Q3): a draft kept behind M-6 is resumed
  only by the manager whose session went idle. Another manager never adopts it. The dialog names
  that manager and offers *Log out* as the way for anyone else to sign in.
- **The back-office credential is open** (owner, 2026-10-05, Q4): it will not be the staff PIN,
  and Google SSO comes after the MVP; which credential the MVP uses is not decided. Lead ruling
  for this task: draw M-6 with the manager's name shown read-only and **one secret field labelled
  *Password***, and keep every credential word in one place in the artifact. The Handoff lists
  each string that would change if the owner chooses otherwise. Do not draw SSO.
- **Eight-hour absolute expiry is not M-6** (`I:543–545`). It goes to BO-01 Login, which is
  slice B's. Draw no absolute-expiry state here.
- **Business-day indicator** (Q2 is open with the owner): show the day by the WIB date on which
  it opened, for example *Business day · Tue 6 Oct*. Draw no start or end time. Slices B, G and H
  settle the rest after the owner rules.
- **Tokens** (lead, accepting DESIGN-011 Q12): use registry tokens first. A value the registry
  lacks may be registered in `frost.tokens.json`, `frost.css` and `docs/DESIGN.md` with
  `source: null` and a `designed` record, and each one is listed in the Handoff for review. No
  raw colour, size or weight in an artifact. No new colour family: no success green.
- **Desktop recovery sizes** (Q9, yours): DESIGN-011 proposes a 36px emergency action and a 28px
  receipt action with solid red doing the urgency work. Decide, measure and record it.

## What to draw

Organise the files as you judge best, with one shared back-office stylesheet that every
back-office artifact imports so that later slices consume the shell instead of copying it. The
Handoff names each file. A suggested split is `frost/back-office/shell.html` (parts A and B) and
`frost/back-office/patterns.html` (part C).

### Part A — the frame and its global alerts

1. The frame at 1440 wide: a 220px left navigation with a 64px brand block, a 64px top bar,
   24px content padding, 14px body. Navigation keeps the destinations and order of
   `F/menu.html:16–36`, with the selected state of `D:1187–1193`. The top bar holds the page
   title, the business-day indicator, the signed-in manager's name and *Log out*.
2. Four alert states, each shown on the same page and identical on any page:
   - **none**;
   - **kitchen** (FR-E3): a kitchen ticket failed to print. Solid red, unmissable, never
     dismissible from the banner, persists across navigation, with one action that opens print
     incidents (BO-13);
   - **receipt** (FR-E6): a receipt failed to print. A low-urgency chip in the top bar, opening
     BO-13;
   - **both**: kitchen and receipt together, each keeping its own urgency.
   The incident's identity (which ticket or receipt, how many) reads the same everywhere. BO-13
   has no Frost artifact yet, so its link stays on `P/incidents.html` until slice C.
3. Decide which container scrolls (Q10): the frame and alerts stay put, the page content scrolls.
   A kitchen banner never scrolls out of view.

### Part B — M-6, re-authentication over a preserved draft

Draw it over a **genuinely changed form**: a page whose fields hold edited values, one selected
choice and one field showing an invalid message, before the idle timeout. Use a neutral fixture
form (say so in the artifact), not a screen another slice owns. States:

- `reauth`: resting. The dialog sits over the dimmed form, which stays visible and unchanged.
  It names the manager, says the unsaved changes are kept, and offers *Continue* and *Log out*.
  No close button, and *Escape* does not dismiss it.
- `reauth-verifying`: *Continue* pending; nothing behind it is reachable.
- `reauth-error`: wrong password; the field keeps focus, its content is cleared, the message is
  one line.
- `reauth-other`: a valid credential belonging to a different manager is refused, and the draft
  stays. (If the owner's credential choice makes this unreachable, the Handoff says so; draw it
  anyway.)
- `reauth-throttled`: five failures lock verification for five minutes (FR-A5, the LOGIN class
  BO-01 uses), with the time remaining. *Continue* is not live during the lockout; *Log out* is.
- `reauth-logout`: *Log out* with unsaved changes asks first, and says the changes will be lost.
- `reauth-kitchen`: the dialog is open while a kitchen print failure arrives. Decide how the
  emergency stays unmissable over the scrim, and argue it in the Handoff.
- `resumed`: success returns to the same form with every value, the selection, the invalid
  message and the focused field exactly as before.

A back-office re-authentication is never a POS approval (FR-A2c): no approval wording, no PIN
pad, no POS action anywhere.

### Part C — shared desktop patterns

Each is walkable in the artifact with local fixtures (DESIGN-009's standard), not a picture:

1. **Fields:** text, secret, select and radio group, each resting, focused, invalid with a
   one-line message, read-only and disabled; native controls, labelled, with the error
   associated to its field. A label and field grid that later forms reuse.
2. **Dialog:** 640px, focus moves in on open, *Tab* and *Shift+Tab* stay inside, focus returns
   to the opener on close, the body scrolls inside the viewport while the head and actions stay.
   DESIGN-011 found focus escaping the Frost category dialog; this one must not.
3. **Destructive confirmation:** names its subject, uses the system's destructive palette at
   office size, and never borrows the POS PIN gate (I-11).
4. **Reading a page:** loading (context kept, no false content), empty (counts and actions match
   the empty facts), and failed to load (with *Try again*).
5. **The result of a command:** pending, saved, refused (a definite refusal, edits kept), and
   **outcome unknown** (the request may have succeeded: the page rereads before saying anything,
   and never offers to send it again automatically, Q11). Neutral colours only.
6. **Leaving with unsaved changes:** a decision to stay or discard, before navigation.
7. **Table:** a sticky header inside its scroll owner, named row actions, right-aligned whole
   rupiah (`155.925`, no `Rp`), 24-hour `HH:MM` times, a long name that wraps, and paging.

### Part D — the two existing Frost pages and the gallery

1. `F/menu.html` and `F/report-detail.html` adopt the shared frame (navigation, top bar,
   business-day indicator, alert slot), each with a `kitchen` alert state. Their content and
   their 51 wireframe links (40 and 11) are otherwise unchanged; they belong to slices D and H.
2. Register every new artifact and state in `manifest.js` and the gallery, and add BO-03's
   missing `category-invalid` state to the manifest.
3. Fix the generated *All screens* link that points at the missing `frost/index.html`
   (`mockup.js:60`), so it returns to the gallery.

## Constraints

- Light only, desktop only, 1440 wide. Whole rupiah at precision 0 in every fixture.
- No POS operation, no cashier view, no dark mode, no success green, no SSO, and nothing the
  inventory or the PRD does not grant. *Invent, revert, ask*: a need the documents do not
  cover goes in the Handoff as a question, not into the artifact.
- The four product documents, `SCREEN-INVENTORY.md` and `SITEMAP.md` are not edited. A conflict
  you find is raised with exact proposed wording.
- Measure in a browser at 1440×900. A headless Chrome run outside the repository needs a
  sandbox escalation, which goes to the owner; ask each time.

## Tests expected to change

None outside `docs/design/`. If a token is registered, `packages/tokens/test/tokens.test.ts`
must still pass unchanged; if it does not, stop and raise it.

## Acceptance criteria

1. The artifacts exist, use the shared back-office stylesheet, and every state named above is
   reachable by `?state=` and listed in `manifest.js`. Red if a state is missing or unreachable.
2. The Handoff maps each requirement of Parts A to D to the state that shows it.
3. Browser measurements at 1440×900 in the Handoff: navigation 220px, brand 64px, top bar 64px,
   content padding 24px, body 14px, buttons 36px and 28px, fields 40px, dialog 640px; the kitchen
   banner still visible after scrolling the longest page.
4. Shown in the browser, with the method in the Handoff: *Tab* and *Shift+Tab* stay inside the
   open dialog and focus returns to the opener; every form value, the selection, the invalid
   message and the focused field are identical before `reauth` and after `resumed`.
5. No raw colour, size or weight in a new or changed artifact; every new token is registered
   with designed provenance and listed. `npm run verify` is green if anything under
   `docs/design/tokens/` changed.
6. `grep -c "prototype/"` gives 40 for `F/menu.html` and 11 for `F/report-detail.html`, and no
   new artifact links into `prototype/` except the BO-13 alert link.
7. The Handoff lists every credential string that depends on Q4, every question raised and not
   ruled with a proposed answer, and the token proposals it chose not to register.

## Out of scope

- Any screen's content: BO-01 to BO-13 belong to slices B to I.
- The eight-hour expiry, the login page, and the first-manager bootstrap (Q4, slice B).
- BO-13's incident table and recovery (slice C).
- Building anything.

## Reporting

Commit on `agent/design-012` only, after verify is green where it applies, and never push. Then:

    herdr agent prompt lead "design012: DESIGN-012 done — <one line>"
    herdr agent prompt lead "design012: BLOCKED — <question>"

## Handoff

*(Written by the designer.)* It ends with `DONE` or `BLOCKED: <one question>`.
