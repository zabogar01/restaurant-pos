---
id: PHASE1-S10
title: BO-01 from DESIGN-016 — the desktop sign-in composition, one main landmark, the focus rules, the lock announced once, the isolated-draft sentence, and the frame centred beyond 1440px (plan S10)
category: ui
touches: [identity]
depends_on: [DESIGN-016]
owns: [apps/back-office/src/SignIn.tsx, apps/back-office/src/OfficeApp.tsx, apps/back-office/src/office.css, apps/back-office/src/copy.ts, apps/back-office/test/**, e2e/tests/tables.spec.ts]
status: review
cycles: 0
---
# PHASE1-S10 — BO-01 from DESIGN-016

**Written** 2026-11-10 by the lead. Sources:
- slice **S10** of the accepted Phase 1 plan (`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md:406-416`):
  "The sign-in screen matches DESIGN-016 …; BO-02 stays the frame"; it closes PHASE0-011d1's sign-in layout findings
  and the deferred BO-01 retained-draft sentence;
- the design **DESIGN-016** (`.agent/tasks/DESIGN-016-login-and-today.md`, merged by the owner as #112 on 2026-10-20,
  reviewed in two rounds, lead acceptance at `:342-358`): its Handoff, *Delivery and design decisions* (`:362-408`), the
  BO-01 rows of *Requirement and state map* (`:410-441`), *New copy and unresolved questions* (`:462-483`) and the final
  measurements (`:648-679`, `:723-745`); the Frost artifact `docs/design/visual-directions/frost/back-office/login.html`,
  `login.js` and `entry.css`, which is the reference for behaviour and layout (a review fixture: nothing of its fixture
  data, review controls or response chooser is product);
- the inventory, `docs/design/SCREEN-INVENTORY.md:604-667` (BO-01, the exact copy and its rules);
- `docs/DESIGN.md:805-817` (*Back office — 1440 wide*, with the wide-window sentence at `:816`) and `:1779` on
  (`--frost-office-login-width`);
- **ADR-011** rule 22 (`docs/decisions/ADR-011-browser-clients.md:711-731`): the working area is keyed by the
  signed-in `staffUserId` and **stays mounted and inert on BO-01** after `UNAUTHENTICATED`;
- the owner's rulings in `.agent/DECISIONS.md`: 2026-10-13 (a browser may offer to save the password; the form must
  not fight a password manager), 2026-10-14 (after the eight hours, the same manager signing in again in that tab gets
  their draft back), 2026-10-20 (a different manager signing in at BO-01 after the eight hours destroys it), 2026-10-20
  (oversize shows only the Error notice, each oversized field marked invalid and described by it).

No consult: copy and layout from the design documents onto a built flow (ADR-011 rule 24), as the plan says. Where this
file and the merged code disagree, or the code cannot do what this file says, stop and write `BLOCKED: <question>`.

## Objective

BO-01 (`apps/back-office/src/SignIn.tsx`) is drawn as DESIGN-016 draws it: a 420px column centred in the window, the
30px heading, the muted helper, persistent 12px labels over 40px native fields, the amber notice, and a full-width
primary *Sign in*. There is exactly one `<main>` in the document at BO-01. Focus lands where DESIGN-016 says in every
case. A cooldown is announced once, and its ticking time is not a live region. When the session ended with unsaved work
held in the tab, the notice adds DESIGN-016's sentence. Wider than 1440px, the signed-in frame stays 1440px wide and is
centred. The sign-in flow itself (the session store, the requests, the cooldown logic, the copy) does not change.

## Required inputs

Read these, in this order. Everything you need is here or cited.

1. **This file**, whole.
2. **DESIGN-016's task file**, the sections listed above, and the three artifact files. `login.js` is short; read it
   whole, because its `render`, its submit handler and its `input` listener are the behavioural reference.
3. **The inventory's BO-01 section** (`I:604-667`) for the exact copy. Every sentence BO-01 draws is in `copy.ts`
   already, except the one ruling 6 adds.
4. **The existing code:** `SignIn.tsx` (the provisional form; its comments say which rules it already keeps);
   `OfficeApp.tsx:148-202` (the frame, the `bo`/`bo-signin` wrapper, the hidden `<main className="bocontent">` and the
   keyed working area); `office.css:11-31` (the page, the frame, the provisional sign-in rules); `copy.ts` (the sign-in
   copy, `lockedFor`, `waitText`); `session/types.ts:53-70` (the signed-out snapshot: `why`, `attempt`, `waits`,
   `busy`, `held`); `work/guard.ts` (`workGuard.status()`: `clean`, `dirty`, `uncertain`).
5. **The tests beside them:** `sign-in.test.tsx`, `session-lifecycle.test.tsx`, `session-harness.tsx`,
   `reauth.test.tsx`; and `e2e/tests/tables.spec.ts:185-215` (the eight-hour case that holds an unsaved table edit
   across BO-01 and gets it back).
6. The contract, for meaning only: PRD FR-A2b, FR-A5b, FR-A7, AC-28, AC-35; BOUNDARIES B-12, B-13.

## Decided: do not reopen

- **The copy is DESIGN-015's**, as `copy.ts` holds it and the inventory lists it; the only new sentence is ruling 6's.
- **The session store and its behaviour** (sign-in, retry, the per-account waits, `busy`, one cookie-changing request at
  a time, the first lookup) are built and settled. This slice changes only how BO-01 draws and focuses.
- **The credentials** stay as built: native uncontrolled inputs, read once on submit, the password emptied at once,
  never React state, never a `value` attribute (B-12); `name="username"`/`"password"`, `autocomplete="username"`/
  `"current-password"`, `autocapitalize="none"`, `spellcheck` off on Username; no reveal, remember-me or recovery
  control. Local validation stays as built: emptiness is `=== ''` (never `trim()`), the limits are 256 and 1024 as
  `USERNAME_LIMIT` and `PASSWORD_LIMIT` count them, nothing is truncated, a whitespace username goes to the server.
  The code-point/UTF-16 question for these limits is queued separately; do not change the counting here.
- **ADR-011 rule 22:** the working area is keyed by `staffUserId` and stays mounted, hidden and inert under BO-01 after
  `UNAUTHENTICATED`, so the same manager gets the draft back and anyone else's sign-in destroys it. Nothing in this
  slice may unmount it.
- **BO-02 stays the Phase 0 frame** (the plan's section 4): no business day, no incident, no Today content.
- **The frame's focus after a different manager signs in** (`OfficeApp.tsx:89-91`, Log out) is queued separately; do
  not change it.

## Lead rulings (2026-11-10)

1. **One `<main>`, without unmounting the work.** DESIGN-016 says "a builder must unmount the authenticated frame while
   signed out, including its main landmark … merely hiding another `main` is insufficient" (`:375-377`). ADR-011 rule
   22 forbids unmounting the working area, and the ADR is binding; DESIGN-016's own `session-ended-draft` state assumes
   the draft is still in the tab. Both are met this way: the frame's chrome (rail, top bar) is already absent while
   signed out (`framed &&`); the content pane becomes a `<div className="bocontent">` that carries `role="main"` only
   while framed, and is `hidden` (and inert) while signed out, with the keyed working area inside it unchanged. BO-01's
   own `<main>` is then the only `main` element and the only main landmark at BO-01; while framed, the pane is the only
   one. Keep the element type stable across phases (a change of element type would remount the work). If this cannot
   be done without remounting the working area, stop and ask.
2. **The composition is `entry.css`'s login rules, ported into `office.css`**, replacing the provisional
   `.office-signin` rules (`office.css:28-31`) and using only Frost tokens: the page pads by
   `--frost-office-content-padding` and centres the panel in the window both ways (`margin: auto` in a column flex page
   of `min-height: 100dvh`), so at a short height the page grows and scrolls and nothing is clipped; the panel is
   `width: var(--frost-office-login-width); max-width: 100%` with `padding-block: var(--frost-space-6)`; the heading at
   `--frost-text-30`, medium, headline tracking; the helper muted, with `--frost-space-8` below; each field block with
   `--frost-space-5` below and its label `display: block`, `--frost-text-12`, muted, `--frost-space-1` above the field;
   the notice amber (the existing `office-notice--amber`), its Try again `--frost-space-3` below the text; Sign in
   `width: 100%`. Keep the built class names where they exist (`office-field`, `office-button primary`,
   `office-notice office-notice--amber`, `office-error`); name new ones after the artifact's (`login-page`,
   `login-panel`, `login-intro`, `login-field`, `login-submit`). No literal colour, size or weight.
3. **The order inside the panel** is the artifact's: the heading, the helper, the notice (when there is one), the
   visually hidden lock announcement (ruling 5), then the form: Username's label, field and its inline error, Password's
   label, field and its inline error, and Sign in. Keep `method="post"`, `noValidate` and the prevented submission.
4. **Focus** (DESIGN-016 `:394-408`, confirming the lead's reading). Implement each case and test it:
   - first load signed out (resting, `ended`, `refused`), and after an explicit logout: **Username**;
   - local validation: every missing field gets its inline message and `aria-invalid`; every oversized field gets
     `aria-invalid` and `aria-describedby` pointing at the notice body, with **no inline text** (owner, 2026-10-20);
     Password is cleared on oversize; focus goes to **the first invalid field in document order**; a field that is not
     invalid has no `aria-describedby` at all; editing Username clears its own invalid marking and description;
   - after an `INVALID_CREDENTIALS` refusal and after the two general failures (`failed`, `unavailable`): Username kept,
     Password cleared, focus on **Password**; *Try again* after a general failure asks for fresh entry, resends nothing,
     and focuses **Password**;
   - a failed first lookup: both fields and Sign in off, focus on **Try again**; a lookup that then succeeds: focus on
     **Username**;
   - a cooldown answer: focus stays where the manager can edit, that is on **Username** (Password and Sign in are off);
     editing Username away from or back to a locked account never moves focus;
   - a wait reaching zero: entry comes back without a submission; if focus is in Username it stays there, otherwise it
     goes to **Password**;
   - during loading both fields and Sign in are off, and Sign in reads *Signing in…*.
   Where the built behaviour already matches (for example the password emptied after every answer), keep it and say so.
   The built `aria-disabled` on Sign in stays as it is; this slice does not change disabled semantics.
5. **The cooldown is announced once** (DESIGN-016 Part 0 N3, review F4). The visible notice of a lock is not a live
   region: no `role="alert"`, `aria-live="off"`, its title still counting down through `lockedFor` and `waitText`. A
   separate visually hidden element with `role="status"` and `aria-atomic="true"` receives `title + '. ' + body` once,
   when a lock newly appears for the username shown, or when the locked account key changes; it is emptied when no lock
   is shown. Ticking, a trailing space or a change of case on the same account writes nothing to it. Every other notice
   keeps `role="alert"`. If `office.css` has no visually hidden utility, add one from tokens and plain CSS (no colour).
6. **The isolated draft** (DESIGN-016 Part A item 4, reviewed; the owner's 2026-10-14 and 2026-10-20 rulings). When
   BO-01 shows *Session ended* (`why === 'ended'`) **and** a working area is held (`held !== null`) **and** the work
   guard reports unsaved work (`workGuard.status()` is not `'clean'`), the notice keeps Session ended's title and body
   and adds, as its own paragraph with an id, the sentence *"The previous session's unsaved changes are stored on this
   tab and are not submitted automatically."* (typographic apostrophe, exactly as `I:629` has it; add it to `copy.ts`).
   It names no manager and shows nothing of the draft. It is absent in every other state. `OfficeApp` already
   subscribes to the guard; pass the fact to `SignIn` as a prop rather than reading the guard inside `SignIn`.
7. **Wider than 1440px** (`D:816`): the signed-in frame stays `--frost-office-width` wide and is centred, the canvas
   filling both sides (`margin-inline: auto` on `.bo`, as DESIGN-016 F1 did on the artifact); the sign-in column
   centres in the window (ruling 2). Nothing else about the frame changes.
8. **Test first, for every criterion:** write the test; run it against the merged code and record the failing assertion
   **before** changing production code; then write the code; then apply the criterion's *Red* to the finished code and
   record that failure too. Both records go in the Handoff. A criterion that pins behaviour already built says so, and
   its *Red* is a mutation of the code, made in your working copy, recorded, and restored with `git status` shown clean
   for that file.

## Acceptance criteria, each with its red proof

1. **One main.** At BO-01 in every signed-out case (resting, ended with and without held work, refused, a lookup
   failure), `document.querySelectorAll('main')` has length 1 and it is BO-01's, and the held working area is still
   mounted (its input keeps a typed value) and hidden; signed in, exactly one element has the main role and it is the
   content pane. *Red:* give the pane back its `<main>` tag; the count is 2.
2. **The draft survives BO-01 exactly as before.** The existing same-manager and other-manager tests in
   `session-lifecycle.test.tsx` and the e2e eight-hour case in `tables.spec.ts` pass unchanged in what they assert.
   *Red:* render the pane only while framed; the same-manager restoration test fails.
3. **Focus**, each case of ruling 4 its own test. *Red:* remove the cold-start focus; the first-load test fails (and,
   separately, focus Username after an `INVALID_CREDENTIALS` refusal; that test fails).
4. **Validation marking**, ruling 4's second bullet: a blank submit marks both fields with their messages and focuses
   Username; a double oversize marks both, describes both by the notice body, shows no inline text, clears Password and
   focuses Username; at rest neither field has `aria-describedby`. *Red:* mark only the first missing field; the blank
   submit test fails.
5. **The lock is announced once** (ruling 5): one write to the status element when a lock arrives; none after a tick,
   a trailing space, or a case change on the same account; a new write after editing to another locked account and
   back; the visible notice has no `role="alert"` while locked. *Red:* put `role="alert"` back on the locked notice; the
   test fails.
6. **The draft sentence** (ruling 6): present for `ended` with held unsaved work; absent for `ended` with held clean
   work, for `ended` with nothing held, for `resting` and for `refused`. In the browser, `tables.spec.ts`'s eight-hour
   case also asserts that the sentence's element is visible at BO-01 (by its id, not its words) before the manager
   signs in again. *Red:* drop the guard condition; the clean-work case fails.
7. **The composition.** A jsdom test asserts the structure (the panel and its order, ruling 3) and the classes; the
   geometry is measured by the lead in a real browser (below), not by you. *Red:* move the notice below the form; the
   order test fails.
8. **The frame is centred beyond 1440px** (ruling 7). jsdom cannot measure it; the lead measures it. State in the
   Handoff the one CSS rule you added.
9. `npm run verify` and `npm run test:e2e:all` green, counts in the Handoff. Every existing B-case and D-case still
   passes by accessible name.

The lead will measure after you finish, in headless Chromium at 1440×900 and 1920×1080, against DESIGN-016's table
(`:654-666`, `:727-739`): the login panel's box (420 wide, centred both ways), the field size (420 × 40), the notice's
contrast (≥ 4.5:1; DESIGN-016 measured 5.23), no horizontal overflow, the frame at `(0, 0, 1440, …)` and at
`(240, 0, 1440, …)`.

## Rules

- Touch only the paths in `owns`. In `e2e/tests/tables.spec.ts` change only `:199`'s selector (`main.bocontent` becomes
  `.bocontent`, because ruling 1 removes the tag, not the hiding; the assertion stays `toBeHidden`) and add criterion
  6's one assertion. No change to `packages/`, `apps/server`, `apps/pos`, `db/`, `docs/`, the session store or the
  work guard.
- **Create and change files with the Write and Edit tools only,** never with shell heredocs, `python3` or `sed`: they
  have stopped builders on approval prompts for over an hour. One simple command per shell call.
- Every visible word from the inventory's BO-01 table and `copy.ts`; every style value a Frost token.
- No credential value in a fixture, a test name, a log or the Handoff beyond what the existing tests already type.
- Browser-test rules as in the other specs: random credentials drawn as `people.ts` draws them; assertions on state,
  accessible names and ids, never copy; no screenshots committed.
- Server-backed tests need `npm run db:up` and `openssl` on `PATH`. Do not touch the development database `pos`.
- Format by hand, matching each file; there is no formatter config.

## Tests expected to change

- `apps/back-office/test/sign-in.test.tsx`: assertions this slice changes by design, and only those: where focus lands
  (after logout, after a lookup failure, after a cooldown answer), the notice's `role` while locked, any structural
  selector the new composition moves (for example a query for `main.office-signin`). Name each changed assertion in the
  Handoff with its reason.
- Tests that select the content pane by its `main` tag, the selector only (`main.bocontent` becomes `.bocontent`,
  ruling 1); what they assert stays: `reauth.test.tsx:50` and `tables-departure.test.tsx:390` and `:402`, and any
  other you find (name it).
- `e2e/tests/tables.spec.ts:199` (the selector) and criterion 6's added assertion.
- New tests under `apps/back-office/test/` (for example `sign-in-layout.test.tsx`, `sign-in-focus.test.tsx`).
- Nothing else should change: the staff, menu, item, presets, tables, settings and methods tests, `reauth.test.tsx`,
  the boundaries and decision tests, and every other e2e spec. A weakened assertion is not acceptable.

## Baseline

`development` at `c89e11b`: `npm run verify` 177 files, 6229 tests (the lead ran it on that commit, 2026-11-10);
`npm run test:e2e:all` 150 passed (S8c2's tree; no spec has changed on `development` since). PHASE1-S9 (#180) is not
merged and touches only `apps/pos` and `e2e/tests/identity.spec.ts`; ignore it. Run `npm run db:migrate` before the
server tests (nothing should be pending). Confirm the baseline before you start and state the new counts in the Handoff.

## Out of scope

- M-6 (`Reauth.tsx`): DESIGN-016's N1 close guard and N3/F4 announce-once for M-6's countdowns. The lead checks them
  separately and queues a task if the built M-6 differs.
- BO-02 Today; the business day; incidents in the frame.
- The frame's focus after a different manager signs in (`OfficeApp.tsx:89-91`).
- The code-point/UTF-16 counting of the sign-in limits (queued).
- DESIGN-016's stale-paragraph proposals for the inventory, M-6 and `D` (a designer's task), and `D`'s "awaiting
  review" wording for DESIGN-016.
- Any server, contract, migration, POS or design-document change.

## Commit and report

Commit on `agent/phase1-s10` only, after verify is green, and never push. Conventional Commits, explaining why. Write
the Handoff below in full prose:
- what was done (paths, commits), and how ruling 1 keeps one `main` without remounting the work;
- what was decided and on what evidence; each focus case of ruling 4 mapped to its test;
- tests changed and why, each changed assertion named;
- for each criterion, **both** failures (before the change, and the *Red* on the finished code);
- what was found and not fixed;
- the real `verify` and `test:e2e:all` output.

End with `DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr as AGENTS.md says.

## Lead verification, 2026-11-10 (before review)

The lead's evidence for what the reviewer cannot reach (the database and a browser).

- **Branch:** `69266ba` (task file), `df4f1d5` (the change). Every changed path is inside `owns`. Changed tests beyond
  the three the task named are selector-only (`main.bocontent` to `.bocontent`, `.office-signin > p` to
  `.login-intro`), each named in the Handoff; no assertion was weakened.
- **`npm run verify`** in the worktree, run by the lead: `Test Files 179 passed (179)`, `Tests 6269 passed (6269)`.
- **`npm run test:e2e:all`**, run by the lead: `150 passed (2.2m)`, Chromium and WebKit, including the new
  `#bo-draft-note` assertion in `tables.spec.ts` C3.
- **Measurements, headless Chromium, fixture mode** (`vite` on the worktree; screenshots in
  `../restaurant-pos-wt/evidence/PHASE1-S10/`). Boxes are `(x, y, width, height)` in CSS pixels.

  | Measurement | 1440×900 | 1920×1080 | DESIGN-016 |
  |---|---|---|---|
  | `main` elements at BO-01 | 1 | 1 | 1 |
  | Focus on first load | `bo-username` | `bo-username` | Username |
  | Panel, resting | `(510, 274.72, 420, 350.58)` | `(750, 364.72, 420, 350.58)` | 420 wide, centred |
  | Panel, with the Sign-in failed notice (oversize username) | `(510, 229.42, 420, 441.17)` | `(750, 319.42, 420, 441.17)` | x 510 / 750 |
  | Username field | `420 × 40` | `420 × 40` | `420 × 40` |
  | Sign in | `420 × 36` | `420 × 36` | full width, 36 |
  | Notice text on its surface | `rgb(131, 97, 28)` on `rgb(255, 245, 218)`, **5.235 : 1** | same | 5.2348 |
  | Horizontal overflow (resting, notice, frame) | 0, 0, 0 | 0, 0, 0 | 0 |
  | Signed-in frame | `(0, 0, 1440, 900)` | `(240, 0, 1440, 1080)` | same |
  | Rail / top bar | `(0, 0, 220, 900)` / `(220, 0, 1220, 64)` | `(240, 0, 220, 1080)` / `(460, 0, 1220, 64)` | same |
  | Signed in: `main` elements / `[role=main]` | 0 / 1 | 0 / 1 | one landmark |

  The panel is 89 px shorter than DESIGN-016's because the artifact's panel also holds its review-fixture disclosure.
  At 1440×300 the page scrolls (`scrollHeight` 399 over 300) and Sign in's bottom (350.6) is inside it: nothing is
  clipped. The look on the owner's own desk remains the owner's.
- **For the reviewer, a deviation to weigh.** With one field missing and the other oversize, `login.js` marks only the
  missing field and shows no notice (its submit returns after the missing check); the build marks both, so the
  oversize one shows the Sign-in failed notice beside the missing field's inline message. The builder read ruling 4
  ("every missing field … every oversized field") as requiring it (Handoff, *Decisions and evidence*). Ruling 2 names
  `login.js` as the behavioural reference. The lead has not ruled; say which you think is right and why.

## Handoff

**Builder, 2026-11-10. Branch `agent/phase1-s10`; the commit hash is the one that adds this Handoff (see `git log -1`).**

### What I did

- `apps/back-office/src/SignIn.tsx`: BO-01 redrawn as `main.login-page > div.login-panel` holding, in order, `h1`, `p.login-intro`, the notice (when there is one), the visually hidden `span[role=status][aria-atomic=true].office-announcement`, and the `form` (`method="post"`, `noValidate`) of two `div.login-field` blocks (label, native input, inline error) and the `button.office-button.primary.login-submit`. Credential handling is untouched (uncontrolled inputs, read once on submit, password emptied at once, `===''` emptiness, 256/1024 limits). The component takes a new prop `unsavedWork`.
- `apps/back-office/src/OfficeApp.tsx`: the content pane is now `<div className="bocontent" role={framed ? 'main' : undefined} hidden={!framed}>`; `SignIn` receives `unsavedWork={work !== 'clean'}` from the guard subscription OfficeApp already holds.
- `apps/back-office/src/office.css`: the provisional `.office-signin` and `.office-stack label` rules are replaced by `entry.css`'s login rules (`.login-page`, `.login-panel`, `.login-intro`, `.login-field`, `.login-submit`, the notice's button margin) plus `.office-announcement` (from the artifact's office.css; no colour). Every value is a Frost token.
- `apps/back-office/src/copy.ts`: `DRAFT_ISOLATED` (typographic apostrophe, as `I:629`).
- Tests: new `apps/back-office/test/sign-in-layout.test.tsx` (criteria 1, 6, 7) and `sign-in-focus.test.tsx` (criteria 3, 4, 5); selector-only edits listed below; `e2e/tests/tables.spec.ts` (two lines).

### How ruling 1 keeps one `main` without remounting the work

The pane was `<main>` in every phase. It is now a `<div>` in every phase, so React reconciles the same element and the keyed `.office-work` inside it is never remounted; only the `role` attribute and `hidden` change. While framed (signed in or idle under M-6) the pane carries `role="main"` and is the only main landmark (there is no `<main>` element then). While signed out the pane has no role, is `hidden` and `inert` (the existing layout effect), and `SignIn`'s `<main>` is the only one. Criterion 2's same-manager and other-manager tests pass unchanged in what they assert.

### Decisions and evidence

- Lock notice: `role` absent and `aria-live="off"` while locked; all other notices keep `role="alert"`. The announcement is written by an effect keyed on (lock shown, `accountKey(username)`), so a tick, trailing space or case change cannot write; clearing the lock empties it.
- Draft note: id `bo-draft-note`; the notice body `<p>` has id `bo-notice-body`, which an oversize field's `aria-describedby` points at. The note is attached to Session ended's notice only, so it cannot appear under a lock, a failure or an oversize notice (test: `error` attempt with held unsaved work shows no note).
- Validation now computes both fields in one pass (missing, else oversize, else clean) and marks every invalid field. **This changes one built behaviour:** previously a missing field returned before the oversize check ran, so "username oversize + password empty" marked only the password. Ruling 4's "every missing field … every oversized field" requires marking both, so it now does (test: "an oversize username with the password empty"). An oversize mark is shown only while the oversize notice is the one on screen, so it never describes a lock notice.
- Editing: each field's `onInput` clears only its own local marking (previously any edit cleared both) and calls `store.dismiss()` as before. Ruling 4 says "editing Username clears its own invalid marking"; the artifact keeps Password's mark when Username is edited. I followed the artifact. If you wanted the old clear-everything behaviour, it is one line in `onEdit`.
- Focus is a mount/transition effect on `lookup` (Username on arrival or when a lookup recovers; Try again while the first read has failed), the existing after-verifying effect now choosing Username when the password is off (a cooldown answer) and Password otherwise, a wait-reaching-zero effect (Password only if focus is not in Username), and Try again's click handler (Password at once for a general failure; nothing for a lookup failure, because retry unmounts and remounts BO-01 through `starting`).
- The remaining `office-muted` and `office-actions` classes are still used elsewhere; I removed only the BO-01 uses.

### Focus cases of ruling 4 mapped to tests (`sign-in-focus.test.tsx` unless stated)

First load resting / refused / ended / after logout: "where focus lands when BO-01 first draws" (four tests). Validation: "local validation: marking and focus" (rest, blank, password only, both oversize, password-only oversize, mixed, editing Username). INVALID_CREDENTIALS, `failed`, `unavailable`, Try again: "after an answer that was not a sign-in" (INVALID_CREDENTIALS also in the existing `sign-in.test.tsx` case 2, which already asserted Password and still does). Failed lookup then success: "a failed first lookup". Cooldown answer, editing away and back, wait to zero with focus in Username and elsewhere: "a cooldown" (four tests). Loading: "loading" (already built; pinned, fields off, `Signing in…`, `aria-disabled`).

### Tests changed

Selector only, `main.bocontent` to `.bocontent` (assertions unchanged): `reauth.test.tsx:50`, `tables-departure.test.tsx:390,402`, and the ones the task did not name: `item-departure.test.tsx:354`, `methods-departure.test.tsx:550`, `menu-departure.test.tsx:460`, `settings-departure.test.tsx:284,406`, `presets-departure.test.tsx:628`, `session-lifecycle.test.tsx:44`. `sign-in.test.tsx:42`: `.office-signin > p` to `.login-intro` (structural selector the new composition moves). No other assertion changed. `e2e/tests/tables.spec.ts`: the `:199` selector to `.bocontent` and one added `expect(office.locator('#bo-draft-note')).toBeVisible()` before the manager signs in again.

### Both failures per criterion

"Before" was run on the merged code with the new tests in place and the production code untouched: `sign-in-layout` 10 of 16 failed, `sign-in-focus` 17 of 24 failed (the others pin behaviour already built). "Red" is a mutation on the finished code, then restored (I kept a copy of the finished files and copied it back; `git status` showed only the intended files, and the final diff was read).

1. One main. Before: `host.querySelectorAll('main')` had length 2 (BO-01's and the pane's), signed in the `[role=main]` count was fine but `main` count 1 not 0. Red (pane given its `<main>` tag back): length 2 at all three signed-out cases and at "ended with held work"; signed in, `main` count 1, expected 0.
2. Draft survives BO-01. Pinned by the existing tests, which pass. Red (working area rendered only while framed): 5 of `session-lifecycle.test.tsx`'s same-manager and held-child tests fail (`childInput` null), and my layout test fails.
3. Focus. Before: 4 first-load tests failed (`activeElement` was `body`). Red 1 (cold-start Username focus removed): the 4 first-load tests and the lookup-recovery test fail. Red 2 (focus Username after an answer): INVALID_CREDENTIALS, general failure and unavailable tests fail, and so does the existing `sign-in.test.tsx` case 2.
4. Validation marking. Before: the oversize tests failed (no `aria-invalid`, no `aria-describedby`). Red (password marked only when the username is not missing): the blank-submit test fails (`aria-invalid` null on Password).
5. Lock announced once. Before: no status element, all five announcement tests failed. Red 1 (`role="alert"` on the locked notice): "writes … once" fails at `hasAttribute('role')` (true). Red 2 (write on every tick): the same test fails at `seen.writes()` (3, expected 0).
6. Draft sentence. Before: `DRAFT_ISOLATED` undefined, all failed. Red (guard condition dropped, `held !== null` only): "held and clean" fails both in the full app (the sentence is appended) and on `SignIn` directly. Browser Red (note never drawn): `tables.spec.ts` "form open and no decision" fails at `#bo-draft-note`, element not found.
7. Composition. Before: failed (no panel). Red (notice moved below the form): the order test fails (`H1, P, SPAN, FORM, SECTION` against `H1, P, SECTION, SPAN, FORM`).
8. Frame centred beyond 1440px: not measurable in jsdom. The one rule added: `margin-inline: auto` on `.bo` (`office.css:19`).

### Found and not fixed

- `OfficeApp.tsx:89-91` (focus to Log out after a different manager signs in), the UTF-16 limits and M-6's N1/N3 were out of scope and untouched.
- A cooldown that is also an oversize marking can leave a stale `aria-invalid` on a cleared Password until it is edited; the mark is hidden while the lock notice is shown, but the password stays flagged. Harmless (a lock disables Password), noted for the lead.
- I could not measure geometry or contrast; no browser measurement was attempted by me (the e2e run is Chromium and WebKit, state only).

### Real output

- Baseline on `c89e11b`-based tree: `npm run verify` 177 files, 6229 tests passed.
- Final: `npm run verify` typecheck clean, 179 files, 6269 tests passed (+2 files, +40 tests: 16 in `sign-in-layout`, 24 in `sign-in-focus`).
- `npm run test:e2e:all`: 150 passed (2.2 min), Chromium and WebKit. `db:migrate`: no pending migrations.
- No formatter was run. An Edit of mine briefly dropped a space in `copy.ts` (`lockedFor =(`); I caught it in the diff and restored it.

### The next agent needs

The lead's browser measurements (panel 420 wide and centred, fields 420×40, notice contrast, no overflow, frame at x=0 and x=240 at 1920). Nothing else is missing.

DONE
