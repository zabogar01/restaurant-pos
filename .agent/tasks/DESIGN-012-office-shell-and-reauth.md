---
id: DESIGN-012
title: The back-office shell, its global alerts, M-6 re-authentication over a preserved draft, and the shared desktop patterns, in Frost
category: ui
touches: [identity]
depends_on: [DESIGN-011]
owns: [docs/design/**, docs/DESIGN.md]
status: active
cycles: 1
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

## Lead ruling, 2026-10-06 (design012's question on navigation links)

Acceptance criterion 6 meant content links, and contradicted Parts A and D for navigation. The
shared navigation keeps its existing destinations: an entry whose screen has a Frost artifact
(Menu, BO-03) links to it, and every other entry keeps its current `prototype/back-office/`
destination until its slice lands, as do *Log out* (BO-01) and the alert links (BO-13). No new
content link into `prototype/`. Criterion 6 now reads: the two existing pages keep their 40 and
11 authored links, and the Handoff lists every `prototype/` link in the new artifacts, each one a
navigation, *Log out* or alert link.

## Lead rulings, 2026-10-06 (handover)

1. **Handover.** The first designer (Codex `gpt-6-astra`, `design012`) hit its usage limit
   before writing the Handoff. Its work is uncommitted in this worktree: the shared stylesheet
   and script (`office.css`, `office.js`), `shell.html` and `patterns.html` with their scripts,
   the two existing pages moved onto the frame, new tokens in `frost.css`, `frost.tokens.json`
   and `docs/DESIGN.md`, gallery and manifest changes, the check script
   `docs/design/checks/design012.cjs`, and evidence in `docs/design/evidence/design012/`. Its
   last reported state: `npm run verify` green, the browser check had passed most states, and a
   fix to text selection and the sticky-header assertion awaited one confirmation run. The
   second designer (OpenCode `gpt-6-astra`) finishes the task from there: it reviews that work
   against every part and criterion of this file, completes what is missing, runs the checks,
   writes the Handoff, and commits. It does not start over, and it says in the Handoff which
   parts it inherited, which it changed, and why.
2. **Evidence is not committed.** Screenshots and `measurements.json` are run output: move
   `docs/design/evidence/` outside the repository (to `/tmp/design012-evidence/`) and quote the
   measurements in the Handoff, as DESIGN-011 did. The check script may stay in
   `docs/design/checks/` if it runs from a fresh checkout; its Playwright path must come from the
   environment, not from one agent's runtime cache.
3. **Browser runs.** Each run of the check script still needs the owner's approval in the pane;
   ask before it, not after.

## Round 2 — the review's nine findings (lead rulings, 2026-10-06)

The review is `.agent/reviews/DESIGN-012-review.md` (Claude Opus 5.5, at `b0ee42f`). Read it in
full. Every finding is accepted; fix all nine in this round, which is fix cycle 1 of 2. The lead
settled the reviewer's two browser inferences in Chrome at 1440×900:

- **F2 is confirmed and raised to high.** On a direct load of `shell.html?state=reauth`, one
  *Escape* left M-6 open, but two more *Escape* presses closed it with no password, leaving the
  draft form live while the URL still read `reauth`. Apply the reviewer's fix in full
  (`closedby="none"`, cancel the *Escape* keydown while open, a `close` listener that reopens it
  while re-authentication is required) and extend the check with both sequences: repeated
  *Escape*, and *Escape* on a direct load before any other input.
- **F6 is confirmed.** On `patterns.html?state=table` after scrolling, a row ("Sample 03") shows
  in the band between the top bar and the stuck header. Fix as proposed, and capture the state
  after scrolling.

Rulings on the rest:

- **F1 (high):** as proposed. No page state makes the kitchen action, the receipt chip or
  *Log out* inert. During `pending` and `unknown`, navigation goes through the leave decision with
  copy that says the outcome is not known and leaving does not send it again. Change the check's
  assertion, and state the rule in `docs/DESIGN.md`.
- **F3:** as proposed: the overflowing dialog body is focusable, named and in the focus loop; the
  check presses *Page Down* and asserts the body scrolled.
- **F4:** one refusal string for a wrong password and for another manager's password, the
  existing *Incorrect password. Try again.* Keep the `reauth-other` state as a named fixture with
  a visible note that it is deliberately indistinguishable from `reauth-error`. Do not tell the
  person at the keyboard whose credential they typed. Whether a different manager's valid
  credential counts as a LOGIN failure is the owner's, with Q4; list it under open questions.
- **F5:** as proposed: in `reauth-throttled`, the logout confirmation says sign-in is unavailable
  for the time remaining, installation-wide, and that waiting keeps the draft.
- **F7:** as proposed: record the active element and its selection at the timeout, whatever it
  is, and restore exactly that; the *Simulate* button must show what it claims.
- **F8:** correct the three passages of `docs/DESIGN.md` in place, each marked "updated by
  DESIGN-012, awaiting review"; the supplement keeps only new material.
- **F9:** items 1 to 4 as proposed (for item 1, the accessible name starts with the visible text).
  Item 5: one sentence in the Handoff. Item 6: the gallery's default direction becoming Frost is
  accepted (the owner chose Frost); the *All screens* link on a Paper page must keep Paper's
  direction, since Paper is left untouched.

**Round 2 handover (2026-10-06, 13:52).** OpenCode `design012b` hit its usage limit after
editing nine files for these findings (uncommitted in this worktree: `docs/DESIGN.md`, the check
script, `office.css`, `office.js`, `patterns.js`, `shell.html`, `shell.js`, `manifest.js`,
`mockup.js`) and before its browser run. Codex, after its reset, finishes round 2 from there:
check each of the nine findings against the uncommitted diff, complete what is missing, then
verify, run the browser check and write the Round 2 Handoff section, naming what it inherited.

Re-run `npm run verify` and the browser check (each run is the owner's to approve). Add a
**Round 2** section to the Handoff mapping each finding to its change and its evidence; do not
rewrite round 1's sections except where a fix makes a statement in them untrue.

## Handoff

### Delivery and inheritance

Completed by design012b on 2026-10-06, continuing design012's uncommitted work on
`agent/design-012`. This is a Frost design-fixture delivery awaiting design review.

I inherited the shared frame, both new artifacts and their state models, the
existing-page adoption, the form-grid token, the DESIGN supplement, gallery changes,
and the browser check. I retained their composition and interaction approach,
including the predecessor's text-selection restoration and sticky-header assertion.
My finishing changes were:

- Make the browser check require `PLAYWRIGHT_MODULE` from the environment, permit
  `CHROME_PATH`, create its external output directory, and remove the runtime-cache
  path from committed code. Move inherited evidence to `/tmp/design012-evidence/`.
- Give incoming `alerts` context precedence over a page's default state so a return
  to the shell does not silently lose a kitchen or receipt incident.
- Apply the existing tabular-number token to the standalone shared stylesheet;
  these new artifacts do not inherit `visual.css`'s body rule.
- Initially prevent shared-pattern navigation during pending or unknown command
  outcomes. Review finding F1 rejected this choice; round 2 replaces it with an
  explicit leave decision while preserving the uncertain result.
- Keep gallery selection valid when a requested state is excluded from Paper's
  options. The historical Paper artifacts were not edited.
- Extend the inherited browser check with per-state captures, field focus and
  read-only checks, different-manager refusal, queued incident navigation,
  failed-read recovery, destructive completion, unresolved-save navigation,
  cross-page alert persistence and a rendered prototype-link ledger.
- Write this Handoff and complete the verification recorded below.

### Files and entry points

All artifact paths in the requirement map below are relative to
`docs/design/visual-directions/frost/back-office/`.

| File | Responsibility |
|---|---|
| `office.css` | Shared frame, alert classes, native fields, actions, dialogs, tables and result treatment; imports `../../../tokens/frost.css`. |
| `office.js` | Shared navigation, day and manager context, alert identity and URL continuity, dialog open/close and keyboard containment. |
| `shell.html`, `shell.js` | Neutral changed-form fixture and thirteen shell/M-6 states, including the round-2 unsaved departure state. Credential-dependent copy lives in `shell.js`. |
| `patterns.html`, `patterns.js` | Twenty walkable desktop-pattern states with synthetic reads, commands and table paging. |
| `menu.html`, `report-detail.html` | Existing page content inside the shared frame, including each page's new `kitchen` state. |
| `../../manifest.js`, `../../review.js`, `../../index.html` | Gallery registration, direction-aware selection and updated scope copy. |
| `../../mockup.js` | Correct gallery return destination and report currency-context placement. |
| `docs/design/tokens/frost.tokens.json`, `frost.css` | One designed form-grid token, in registry and CSS. |
| `docs/DESIGN.md` | Shared-pattern specification and designed-token provenance supplement. |
| `docs/design/checks/design012.cjs` | Re-runnable browser measurements and interaction assertions. |

The gallery entry is
`docs/design/visual-directions/index.html?direction=frost&screen=back-office/shell.html&state=none`.
The artifacts are local fixtures; no service, authentication or print command is sent.

### Requirement-to-state map

Every state in this table is directly reachable with `?state=` and registered in
`manifest.js`. The check compared each artifact's complete declared state list to
its manifest registration in round 1: shell 12, patterns 20, menu 10, report detail 4, **46 total**. Round 2 adds shell `unsaved`, bringing the current total to 47.

| Requirement | Artifact and state or walk |
|---|---|
| A1: shared frame, ordered navigation, title/day/manager/logout | `shell.html?state=none`; the same frame is consumed by patterns, menu and report. Menu and Reports show their selected navigation state. |
| A2: no alerts, kitchen, receipt, both | Shell `none`, `kitchen`, `receipt`, `both`. Kitchen has no dismissal action; both incident actions open BO-13. |
| A3: scroll ownership and persistent emergency | Shell `both`, scroll its long sample section; `.bocontent` alone scrolls beneath the frame and alert. |
| B: genuinely changed form | Every shell state: original name “Evening service” becomes “Evening service — revised”; First choice becomes Second choice; Standard becomes Alternate; `12` becomes `twelve` with “Enter a whole number.” |
| B: resting re-authentication | Shell `reauth`: read-only M. Iqbal, Password, Continue, Log out, preserved draft, no close control; Escape is prevented. |
| B: verification pending | Shell `reauth-verifying`; Continue reads “Verifying…” and verification controls are disabled. Submit from `reauth` also traverses this state. |
| B: incorrect credential | Shell `reauth-error`; secret is cleared and focused, with “Incorrect password. Try again.” |
| B: different manager | Shell `reauth-other`; cleared focused secret and refusal, never draft adoption. |
| B: LOGIN throttle | Shell `reauth-throttled`; five failed local responses also enter this state, starting at 5:00. Continue is disabled, Log out works, keeping the draft retains the cooldown. |
| B: logout decision | Shell `reauth-logout`; names the loss of unsaved changes, focuses Keep this draft, offers explicit discard and logout to BO-01. |
| B: emergency over re-authentication | Shell `reauth-kitchen`; a solid-red alert inside the native dialog stays above the scrim. Its queued route is walked through same-manager success and a discard/stay decision. |
| B: exact resumption | Shell `resumed`, reached by Continue with the Same manager fixture response; Alt+I simulates idle without first moving field focus. |
| C1: text, secret, select and radio field states | Patterns `fields`, `fields-focused`, `fields-invalid`, `fields-readonly`, `fields-disabled`. Each control can receive focus where enabled; Tab/click walks focus beyond the initially focused text field. Errors are associated through `aria-describedby`; radio has a fieldset and legend. |
| C2: scrolling dialog and focus | Patterns `dialog`, also opened through Open long dialog; head/footer stay visible, body scrolls, Tab/Shift+Tab remain inside, Close/Escape return to the opener. |
| C3: named destructive confirmation | Patterns `destructive` → `removed`; Keep Evening sample cancels, Remove Evening sample completes the local demonstration. Final action uses desktop destructive styling. |
| C4: read states | Patterns `loading`, `empty`, `load-error`; counts/rows are withheld until known, empty has zero samples and Create sample, Try again traverses loading to `table`. |
| C5: command result | Patterns `pending`, `saved`, `refused`, `unknown`, `reconciled`. Save sample uses the review response selector; refusal keeps edits; unknown disables submission and starts a simulated reread. Direct `unknown` exposes Check saved sample, a read-only reconciliation action. |
| C6: unsaved navigation | Patterns `unsaved`; Leave this sample or navigation after editing offers Stay and keep editing / Discard changes and leave. Shell `unsaved` similarly protects its changed draft without labelling ordinary navigation as re-authentication. |
| C7: table | Patterns `table`, `table-page-2`, `row-detail`; 24 samples in pages of 12, sticky headers, wrapping long name, `155.925`, HH:MM WIB times, and subject-specific accessible names on View sample actions. |
| D1: existing pages adopt shell | Menu and report `default` / `kitchen`; retained content and authored 40/11 prototype links. Report date/currency and Print report move to a content subbar to leave room for global context. |
| D2: gallery and missing state | All 47 current states registered (46 in round 1); BO-03 `category-invalid` added; shell/patterns explicitly Frost-only. |
| D3: All screens | Generated back-office link reaches the existing `../../index.html` gallery with its current Paper or Frost direction. Both new artifacts also expose an explicit gallery link. |

### Design decisions and downstream use

**Desktop urgency (Q9).** Keep the existing 36px office action for the kitchen
banner and the 28px action for the receipt chip. The kitchen receives a full-width
80px-minimum red field with white 18px heading; the receipt remains a pale amber
top-bar chip. Coverage, placement, wording and persistence carry urgency together.
These are entry actions to BO-13; its recovery table remains slice C's work.

**Scroll ownership (Q10).** The viewport holds the frame; `.bocontent` owns page
scrolling. The rail may independently scroll on a shorter viewport. The alert sits
between the top bar and the content, outside the page scroll owner. The table uses
`position: sticky` with the negative existing content-padding token inside that
owner, with layer 1 above its rows. Round 2 moves the stuck header to the visible
scroll edge so rows cannot show in a band above it. Native
dialogs use the browser top layer and a body-only scroll region; no fixed 900px
height or extra layer token is introduced.

**Emergency during M-6.** The same incident identity is repeated in a solid-red
section inside the modal, before its scrollable body. It therefore stays visible
and undimmed even when the original banner is behind the scrim. Open print incidents
after sign-in queues navigation; it does not make the background interactive or
bypass same-manager re-authentication. On success, leaving the unsaved draft still
requires an explicit discard decision. The logout decision also retains the alert.
No acknowledgement or clearing is implied by any of these actions.

**Uncertainty (Q11).** Pending keeps values and disables editing/submission. A
definite refusal returns the editable draft without claiming success. An unknown
outcome does not offer a second save: it rereads the saved fixture, then reports
the confirmed outcome. The demonstration's reread resolves to saved. A production
slice must supply its authoritative read/result contract; this is not an invented
server reconciliation API or a persistence policy.

### Browser evidence and verification

The owner approved one execution of the following command in this pane before it
ran. The script launched installed headless Chrome at **1440×900** and passed all
assertions, with **zero page JavaScript errors** and **zero horizontal document
overflow in all 46 states**:

```sh
PLAYWRIGHT_MODULE=/Users/fajars/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright node docs/design/checks/design012.cjs
```

That module location is this machine's invocation, not a committed script default.
From a fresh checkout, provide an installed Playwright module through
`PLAYWRIGHT_MODULE`; provide `CHROME_PATH` when not using installed macOS Chrome.
The script creates `/tmp/design012-evidence/` itself. Every later browser execution
still requires a fresh owner approval. Captures and `measurements.json` are external
run output and are not part of the commit.

| Browser measurement | Observed value |
|---|---|
| Frame / navigation width | 1440px / 220px |
| Brand / top-bar height | 64px / 64px |
| Content padding / office body | 24px / 14px |
| Kitchen action / receipt action | 36px / 28px high |
| Native input | 40px high; sample input 562.672px wide |
| Dialog | 640px wide; long dialog top 24px, bottom 876px |
| Long dialog body overflow | 988px, scrolled independently while head and Close remain visible |
| Persistent kitchen banner | x=220, y=64, width=1220, height=80, identical before and after content scrollTop=857 |
| Sticky table header, round 1 | y=88 after scrolling; this left a visible band of rows above it and is superseded by the round-2 correction below. |
| LOGIN cooldown | “Five attempts failed. Try again in 5:00. Log out is still available.” |

**Preservation method.** The check edits the name to “Owner-edited fixture”, chooses
First choice and Standard, leaves invalid `twelve`, focuses `draft-limit`, selects
characters 1–4 and presses Alt+I. After same-manager Continue, it compares complete
FormData entries, the validation text, `aria-invalid`, active element and selection
endpoints. Before and after are exactly equal: name “Owner-edited fixture”, choice
“First choice”, mode `standard`, limit `twelve`, “Enter a whole number.”,
`aria-invalid="true"`, focus `draft-limit`, selection `[1,4]`.

**Keyboard method.** The check sends eight Tabs and eight Shift+Tabs in M-6, and
four of each in the ordinary dialog, asserting every active element remains in
the open dialog. Round 1 tested one Escape after Alt+I; that did not establish resistance to repeated
Escape. The stronger round-2 checks are recorded below. Closing the ordinary dialog returns focus
to `open-dialog`. The wrong-secret and different-manager states clear/focus the
secret; five submitted failures disable Continue, and keep-draft from logout does
not reset the cooldown. Read-only select/radio values survive attempted changes.

The browser also walked refused-save preservation, unknown-result reconciliation,
the pending-navigation guard, unsaved Stay, failed-read retry, destructive completion,
page 2 and Sample 13 detail, queued incident navigation, and both alerts across a
navigation to Menu. I visually inspected the combined alerts, kitchen-over-M-6,
wrong-secret and throttled M-6, regular and invalid fields, long dialog, long-name
table, and menu/report kitchen captures. No second browser run was needed.

`npm run verify` was run in this worktree and passed: typechecking plus **45 test
files and 2,737 tests**, including the unchanged token tests. Vite emitted its
existing future-native-config-loader warning. JavaScript syntax checks passed for
the three office scripts, gallery/runtime/manifest scripts and browser check.
`git diff --check` passed. The required `grep -c "prototype/"` check returned **40**
for menu and **11** for report detail. The initial equivalent `rg` invocation could
not run because ripgrep is not installed; the task's grep command supplied the counts.

Impeccable context, polish/craft guidance and one mechanical detector pass were used.
The context tool selected the superseded comparison DESIGN, so the task's
`docs/DESIGN.md` remained authoritative. Detector padding findings on token-based
notices, emergency sections and dialog wrappers were checked against their CSS and
captures: text is inset by the padded sections, not flush with the outer wrapper.
Inherited 10px menu/report tags and legacy report typography remain findings for
slices D/H under the task's content boundary. The scrim warning refers to the
existing registered Frost scrim; em-dash advice includes table placeholders.
These are documented exceptions, not a claim that the detector returned no findings.
Screen-reader, physical-device and other-browser testing were not run.

### Prototype-link ledger

The lead's navigation ruling is applied. Both new artifacts receive the following
links from `office.js`; paths are beneath `../../../prototype/back-office/`:

| Label / occurrence | Destination | Class |
|---|---|---|
| Today | `today.html` | Navigation |
| End of day | `end-of-day.html` | Navigation |
| Reports | `reports.html` | Navigation |
| Audit | `audit.html` | Navigation |
| Tables | `tables.html` | Navigation |
| Staff | `users.html` | Navigation |
| Discount presets | `presets.html` | Navigation |
| Settings | `settings.html` | Navigation |
| Printing | `incidents.html` | Navigation |
| Log out | `login.html` | Logout |
| Open print incidents, in the shared kitchen banner | `incidents.html` | Alert |
| Receipt warning chip, when present | `incidents.html` | Alert |
| Shell Discard changes and log out | `login.html` | Logout confirmation |
| Shell queued incident destination after re-authentication | `incidents.html` | Alert navigation after explicit discard |

Menu navigation points to the existing Frost `menu.html`. Shell confirmation can
also reuse a clicked navigation destination; patterns Discard does the same. These
are the listed navigation links passing through the unsaved-work decision, not
new content destinations. Active `alerts` parameters carry fixture context. Existing
prototype destinations do not yet render the new frame, as anticipated by the
lead ruling; subsequent screen slices must adopt it. New content links stay in
Frost. The pre-existing menu/report authored ledger remains 40+11; runtime-generated
alert links are separate from those authored counts.

### Credential dependency, tokens and remaining questions

**Q4-dependent strings**, all in `shell.js`'s `credentialCopy` object:

1. `Password`
2. `Incorrect password. Try again.`
3. `Enter your password.`

If the credential changes, review those three strings plus the secret field's
`type="password"` and `autocomplete="current-password"` semantics. No staff PIN or
SSO is drawn. Both refusal fixtures now use the same second string; the old
other-manager disclosure was removed under F4. If the chosen credential verifies only against the named manager's
account, a different manager's otherwise valid password is merely incorrect for
that account, making `reauth-other` unreachable. It remains drawn as requested;
the eventual identity contract determines which refusal can actually occur.

**Registered token:** `--frost-office-form-columns` =
`minmax(0, 1fr) minmax(0, 2fr)`, with `source: null` and a DESIGN-012 designed record
attributing the original author, date, rationale and fixture states, awaiting review.
The registry contains 175 entries: 170 sourced and five designed. No new colors,
sizes or weights were introduced into the shared artifacts; dimensions and type
consume existing tokens, with intrinsic/fractional layout composed where appropriate.

**Proposals deliberately not registered:** login width and narrow credential/numeric
widths (slice B or the owning form); menu column recipes (slice D); report internal
figure recipes (slice H); generic fixed table widths (intrinsic wrapping suffices);
sticky offset/layer tokens (negative existing content padding, one local sticky
layer, native dialog top layer); modal maximum-height token (viewport minus twice existing 24px space);
custom 16px radio marks (native controls); multiline minimum (no assigned multiline
field); skeleton dimensions (contextual loading text is sufficient); 60px large-empty
padding (existing 48px token); emergency/receipt action-size tokens (existing 36/28px);
new readonly/destructive/status colors (existing semantic palette); incidental
spacing tokens (existing scale). No fixed 900px height, 28px type or success green.

**Unresolved dependencies, not new rulings:** Q4's MVP credential remains the owner's
choice; proposed interim answer is exactly the lead's single Password field, with
the copy centralized above. Q2's full business-day labeling remains open; proposed
interim answer is the opening WIB date alone, as drawn. The same-manager decision
and the navigation-link question are already ruled. Q9/Q10/Q11's presentation
answers are documented above for review. I found no additional blocking question
requiring a new product or boundary decision. The previously audited BO-03/BO-11
content gaps remain assigned to slices D/H; the stale inventory/incident audit
language remains the lead's reconciliation from DESIGN-011, not a designer edit.

### Round 2

Completed by design012 on 2026-10-06, continuing design012b's uncommitted round-2
work described in the lead's handover. I inherited changes in nine files:
`docs/DESIGN.md`, `docs/design/checks/design012.cjs`, `office.css`, `office.js`,
`patterns.js`, `shell.html`, `shell.js`, `manifest.js` and `mockup.js`. I checked
each change against the full review and the lead's rulings and retained those
implementation fixes. My finishing changes correct the DESIGN frontmatter's
designed-token count, record individual browser assertions, strengthen the
keyboard-scroll evidence with header/footer geometry, and update this Handoff
where round 1's statements became untrue. No product policy or token was added.

| Finding | Change and evidence |
|---|---|
| F1 — uncertain saves blocked recovery | Pending and unknown saves now offer a leave decision for shared navigation, kitchen incidents, receipt incidents and logout. Copy says the outcome is unknown and leaving does not resend. DESIGN states the rule. All eight browser combinations (two states × four destinations) reached the selected destination after explicit Leave. |
| F2 — repeated Escape bypassed M-6 | M-6 has `closedby="none"`, consumes Escape keydown and reopens after an unauthorized close while re-authentication is required. Direct-load Escape before other input, four further Escape presses, repeated Escape after Alt+I, and a scripted close all left the gate open and the background inert. |
| F3 — keyboard could not scroll the dialog | An overflowing dialog body becomes a focusable region named by its title and participates in the focus loop. Shift+Tab from Close reached the body; Page Down changed its scroll position. After further keyboard scrolling, the dialog remained at y=24–876, with its heading at y=25 and footer bottom at y=875. |
| F4 — refusal disclosed credential identity | Both refusal fixtures show “Incorrect password. Try again.” The different-manager fixture has the required visible reviewer note explaining that it is deliberately indistinguishable. Browser checks confirmed the shared refusal copy and cleared, focused secret. LOGIN counting remains the open Q4 dependency below. |
| F5 — throttled logout omitted its consequence | Logout confirmation now reports the remaining installation-wide sign-in cooldown, says logout does not end it, and explains that waiting keeps the draft. The five-failure flow displayed 5:00 in both M-6 and confirmation; Keep returned to the still-throttled gate. |
| F6 — rows appeared above the sticky header | The header offsets the existing content padding with its negative token value. After content scroll, the header starts at y=64, flush with the top bar; the element at (300,65) is a header cell. The post-scroll capture shows no row above it. |
| F7 — timeout restored an older field | Timeout captures the actual active element and its selection. Browser checks restored the Simulate button, Menu navigation and Log out exactly. The edited draft, validation, focused numeric field and selection [1,4] also matched before and after authentication. |
| F8 — DESIGN contradicted its supplement | The three earlier passages now describe five designed tokens, the existing native controls, and the shared shell/M-6 alongside eleven unconverted content pages. Each carries the required review marker; the supplement retains new material. Frontmatter also reports 170 sourced plus five designed tokens. |
| F9 — six smaller inconsistencies | Row names begin with visible “View sample”; read-only changes do not dirty the form; kitchen title/identity come from `Office`; dialog dismissal restores the underlying state and Sample 13 survives reload; alert-query precedence is stated below; Paper's All screens link preserves its direction. The browser exercised row/reload/close, page-2 cancellation, read-only departure without a prompt, shell Leave/Stay state and focus, and Paper's gallery destination. Shell's explicit unsaved state brings the gallery/check total to 47 states. |

An explicit `alerts` query takes precedence over the named fixture state, so
`state=receipt&alerts=kitchen` displays the kitchen alert.

**Verification.** `npm run verify` passed in this worktree after the inherited
implementation changes: typechecking, 45 test files and 2,737 tests. The existing
Vite future-native-config-loader warning remains. Syntax checks passed for the
six changed JavaScript/check files. The authored prototype-link counts remain
40 in menu and 11 in report detail; the prototype ledger above still applies.
Static checks found no unregistered office token references, no literal pixel
dimensions in the shared office CSS/JavaScript, and no inline style attributes
in the four adopted HTML pages.

The owner-approved round-2 Chrome execution used the command recorded above at
1440×900. It passed **216 of 216 assertions across 47 states**, with no page
JavaScript errors, no failed assertions and no horizontal document overflow.
Evidence is outside the repository in `/tmp/design012-evidence/round2/`, including
`measurements.json` and the post-scroll table, keyboard-scrolled dialog,
unknown-save leave decision and throttled-logout captures. Those four captures
were visually inspected. Frame dimensions remain 220px navigation, 64px brand
and top bar, 24px content padding, 14px body text, 36px kitchen and 28px receipt
actions, 40px input height and 640px dialog width. The kitchen banner remains
at x=220, y=64, width=1220, height=80 across content scrolling. No second browser
execution was needed. Screen-reader, physical-device and other-browser checks
were not run.

**Open question for Q4, not a new policy decision:** Does another manager's valid
credential count as a LOGIN failure? The fixture does not add that separate
refusal to its failure counter. Proposed answer if the final contract verifies
only the named manager: an incorrect secret is an ordinary failed attempt, and
a separately identified other-manager outcome is unreachable. The owner must
settle the credential and counting contract; this round changes only the
non-disclosing presentation required by the lead.

DONE
