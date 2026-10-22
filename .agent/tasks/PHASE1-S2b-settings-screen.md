---
id: PHASE1-S2b
title: BO-08 Settings in the back office — the settings section, the rate field, the stale-draft refusal, and BO-05's partial-list alert (plan S2b, DESIGN-018, DESIGN-018b)
category: ui
touches: [money, boundaries, identity]
depends_on: [PHASE1-S2a, DESIGN-018b]
owns: [apps/back-office/src/**, apps/back-office/test/**, e2e/tests/settings.spec.ts, e2e/support/**, apps/back-office/package.json, package-lock.json]
status: active
cycles: 1
---
# PHASE1-S2b — BO-08 Settings in the back office

**Written** 2026-10-22 by the lead, from slice S2 of the accepted Phase 1 plan
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, *S2*), the server half **PHASE1-S2a** (merged
as PR #128: the two settings routes exist and behave as its Handoff says), the design **DESIGN-018** (BO-08, merged as
PR #125) and **DESIGN-018b** (the phone rule, merged as PR #127), and the client pattern **PHASE1-S1b** built for BO-05
(merged as PR #123). Where this file, DESIGN-018 and S1b's pattern differ, the rulings below say which wins; where they
still differ, stop and write `BLOCKED: <question>`.

## Objective

A signed-in manager opens **Settings** from the back office's rail and, on BO-08, sees the installation's fixed currency
and precision, the two rates and the five receipt details as the current version states them (or the first-run state,
when no version exists), and saves a change as a new version through the two S2a routes, with every word from
DESIGN-018. This slice builds, once, the client half of ADR-012's versioned form, which BO-04 and BO-07 copy later: the
rate field (typed as a percent, converted exactly, never a float), a confirmation before a rate change, the
*settings changed* refusal (`SETTINGS_CHANGED`) with the manager's choice between their draft and the current values,
and the version facts line that always names the version in force. It also changes BO-05's partial-list alert to the
wording the owner accepted. **The payment-methods part of BO-08 is not built here: it is plan slice S3.**

## Required inputs

Read these, in this order. Everything you need is here or cited.

1. **This file**, whole.
2. **DESIGN-018's Handoff**, `.agent/tasks/DESIGN-018-settings-and-tenders.md` from `## Handoff` to the end, including
   *Round 2*. Above all: *The decisions, and why*; *Rules S2a, S2b and S3 can test* (the rate-field table and the
   lengths table); *Copy and accessible names* (the copy table; every product word comes from it, ADR-011 rule 24);
   *Focus*. Its rows for payment methods are S3's, not yours.
3. **DESIGN-018b's Handoff**, `.agent/tasks/DESIGN-018b-phone-charset.md`: the phone rule and copy **supersede**
   DESIGN-018's phone row (owner, DECISIONS 2026-10-21).
4. **`docs/DESIGN.md`**, *Configuration forms — DESIGN-017 / consult C2* (from `:1486`) and *Configuration forms —
   DESIGN-018 additions* (from `:1628` to `:1768`). Both bind this task; their headings still say "awaiting review", but
   both were reviewed and merged.
5. **The Frost artifact**, `docs/design/visual-directions/frost/back-office/settings.html` with `settings.css`,
   `settings.js` and the shared `office.css`, `tables.css`: the composition to build. Open it with `?state=<name>` (65
   states; the gallery lists them). It is a review fixture: its fixture data, response selector and disclaimers are not
   product and are not copied. Port CSS only through tokens already in `docs/design/tokens/frost.css`
   (`apps/back-office/test/no-invented-values.test.ts` enforces this).
6. **PHASE1-S2a's Handoff**, `.agent/tasks/PHASE1-S2a-settings-server.md`, *What S2b needs* and *Decisions* 1: the route
   and `ROUTES` names, the schemas (`SettingsReadView`, `SettingsVersionView`, `SaveSettingsRequest`, and the field
   schemas `RatePpm`, `OutletName`, `OutletAddress`, `OutletPhone`, `OutletNpwpd`, `ReceiptFooter`), how *unchanged*
   reads on the wire, the rate codec (`encodeRate`, `rateFromPercent` in `@pos/money`), and the **`ConfigApi`
   exclusion you now remove**.
7. **PHASE1-S1b's task file and Handoff**, `.agent/tasks/PHASE1-S1b-tables-screen.md`: its *Lead rulings* 1 to 8, its
   Handoff's *How it works, and what a later form copies* (the model, `fieldsInError`, the `Decision` dialog,
   `work/guard.ts`, `router.ts`), and its rounds 2 to 4, which changed behaviour (every visit reads; a failed visit read
   keeps a newer success; command lifetime; read reconciliation; the F4 partial state).
8. **The existing back office**: `apps/back-office/src/` (`OfficeApp.tsx`, `Reauth.tsx`, `copy.ts`, `routes`/`router`,
   `work/guard.ts`, `forms/fieldsInError.ts`, `tables/`, `session/`), and the tests beside them. **The browser
   harness**: `e2e/support/**` and `e2e/tests/tables.spec.ts` (how a spec signs in, drives a form, and scans).
9. The contract, for meaning only: PRD FR-B1, FR-M1, FR-M5, FR-A2b, AC-35; BOUNDARIES B-1, B-8, B-9, B-13, B-20, B-24.

## Decided: do not reopen

- **Owner (DECISIONS 2026-10-20, 10-21):** Q2, rates 0–100%; Q3, a non-zero service charge may be stored; Q5, currency
  and precision fixed at IDR and 0, shown, never offered for change; Q11, settings are not audited; Q12, the five
  details; the footer is required; `created_by` is kept and shown as "Saved by {name}"; DESIGN-018's questions 1, 3 to 6
  accepted (the save answers the full view; rates display with a decimal comma and input accepts `,` or `.`; BO-05
  adopts the partial-list alert); the phone accepts only digits, spaces and `+ - . ( )`.
- **Owner, drafts (2026-10-05, 10-14, 10-16, 10-20):** the same manager resuming through M-6, or signing in again at
  BO-01, gets the unsaved draft back; a different manager's sign-in destroys it; a reload destroys it.
- **ADR-012 rules 3 and 4, and C2 §6:** a command carries the version it was built on; `SETTINGS_CHANGED` keeps the
  draft and rereads; nothing is ever resent by the client; the client never infers success from a reread.
- **S1b's pattern**, as merged: reuse `fieldsInError`, `work/guard.ts`, the router's guard, the `Decision` dialog and
  the logout confirmation as they are. Change them only if this screen cannot work otherwise, and then say why.

## Lead rulings (2026-10-22)

1. **Scope: the settings part only.** Build BO-08's *Rates and receipt details* part, in every state DESIGN-018 draws
   for it. Do not build the *Payment methods* part, its heading, or a placeholder for it; S3 adds it to this page. Build
   the screen so that S3 can add the second part under DESIGN-018's **one form and one command per screen** rule
   without restructuring: the page registers once with `work/guard.ts`, and the settings part's command state is the
   screen's.
2. **Navigation.** The rail's *Configuration* group gains *Settings* after *Tables*, at the client path
   **`/back-office/settings`**; the page heading is *Settings*. Every visit to the page reads the settings (a `GET`, not
   interactive), as BO-05 reads on every visit.
3. **The rate field** follows DESIGN-018's rate table exactly: normalise (trim; one trailing `%`; `,` to `.`; leading
   zeros dropped keeping one; an empty whole part becomes `0`; an empty fraction dropped), refuse in DESIGN-018's order
   with its copy, convert with `rateFromPercent`, check the result is at most 1,000,000 ppm, and send it with
   `encodeRate`. **No float, no `Number()`, no `parseFloat` anywhere on this path (B-1).** Display a stored ppm with a
   decimal comma and no trailing zeros (DESIGN-018's display examples are the test vectors). The form's own check and
   `SaveSettingsRequest` must agree: test the pair on DESIGN-018's accepted and refused vectors, as S1b tested
   `checkLabel` against `CreateTableRequest`.
4. **The text fields** follow DESIGN-018's lengths table, with DESIGN-018b's phone row: trimmed before checking; refusal
   copy in DESIGN-018's check order; a blank NPWPD is sent as `null`. The form's checks and the contracts' field
   schemas must agree (one test over the boundary values of each row).
5. **The version facts line** names the version in force, the one most recently read or answered, never the version the
   draft builds on (DESIGN-018 round 2, `D`). `createdAt` is shown as `D Mon YYYY, HH:MM`, 24-hour, English three-letter
   month, in the **browser's time zone** (the installation runs on one machine, so it is the restaurant's), by one pure
   formatter with tests. The line is withheld while the read is loading or has failed, and after an unknown outcome
   whose reread failed.
6. **The base version.** The draft carries the version it was built on, which changes only three ways: an
   authoritative success, an *unchanged* answer, or the manager's choice in the stale state (DESIGN-018, *The
   stale-draft refusal*). A reread alone never moves it. *Unchanged* is read from an answered `current.version` equal to
   the carried `expectedVersion` (S2a).
7. **The rate confirmation** is a modal `<dialog>` that copies S1b's `Decision` pattern and the working-area dialog rule:
   under M-6 it stays open, visible and inert; at BO-01 it is closed with `close()`, its state kept, and reopened with
   `showModal()` for the same manager; a different manager's key destroys it; the save is sent only on the explicit
   *Save new rates* press, never by a reopen. It is shown before a save that changes a rate, and not at the first run or
   for a save that changes only details (DESIGN-018).
8. **Not built in S2b**, though DESIGN-018 draws it: the payment-methods part (S3); the kitchen-emergency sentences in
   the confirmation and the departure decisions (the built frame has no incident action); BO-01's held-draft sentence
   (S10); any business-day indicator. Say in the Handoff that each was left out on purpose.
9. **`ConfigApi`.** Remove S2a's `Exclude` of the two settings paths from `ConfigPath` in `session/api.ts`, add the two
   functions to `configApi()` and to `fixtureSession.ts` (a fixture settings source for fixture mode, holding one
   version), and update `config-api.test.tsx`'s key list. The fixture is fixture data, not seeded product data, and it
   must not reach the built bundle (the built-session tests already scan for fixture markers).
10. **BO-05's partial-list alert** (owner, DESIGN-018 question 4). In BO-05's F4 partial state only (a success while the
    list read stands failed), the alert reads **"The list may be out of date"** / **"Tables could not be read again. The
    rows below are the ones this page knows, including your latest change. Try again to read the full list."**, with
    *Try again* repeating the read only. A plain failed read keeps "Tables could not be loaded" / "Try again to read the
    table list." Add the new copy as a separate constant in `copy.ts`; change only the assertions on the partial state.
11. **Copy** goes in `apps/back-office/src/copy.ts` (or a BO-08 copy module beside it), each string traceable to a row of
    DESIGN-018's copy table or DESIGN-018b. No zod message, server text, error code or submitted value ever becomes
    visible text, except the manager's own values in their own fields and the read values DESIGN-018 shows.

## Acceptance criteria, each with its red proof

Each *Red* line is a mutation you apply, observe failing, revert, and report.

1. **Navigation.** The rail shows *Settings* after *Tables* in *Configuration*; `/back-office/settings` renders BO-08 and
   a reload there lands on BO-08. *Red:* drop the manifest entry: the routes test fails.
2. **Read view and first run.** With a version, BO-08 shows the facts line, currency and precision as plain text (no
   input anywhere names them), both rates with a decimal comma and `%`, and the five details (NPWPD *Not set* when
   null), each editable row with its named *Change* button; *Change tax rate* opens the form with focus in *Tax rate*,
   and so on for each row. With no version, the first-run state shows *Enter settings*; no rate is pre-filled. *Red:*
   render currency as a read-only input: the no-input test fails.
3. **The rate field.** The pair test of ruling 3 over DESIGN-018's vectors (`05` → `50000`, `10,5` and `10.50` →
   `105000`, `,5` → `5000`, `0,0001` → `1`, `100` → `1000000`; each refusal in order with its copy); the request body a
   save sends carries `taxRatePpm` and `serviceChargeRatePpm` as those canonical strings; a source test proves the
   rate module calls no `parseFloat`, `Number(` or `Math.round`. *Red:* convert with `Math.round(parseFloat(x) *
   10000)`: the source test fails. Say in the Handoff whether any vector failed too (a float often survives these
   vectors, which is why the source test exists).
4. **Text fields.** Each lengths-table row's refusals at its boundary, in order, with its copy and focus on the first
   invalid field; nothing sent while any field is invalid; a blank NPWPD sent as `null`; the phone refuses `/`. *Red:*
   allow `/` in the phone check: the pair test against `OutletPhone` fails.
5. **Confirmation.** A save that changes a rate opens *Save new rates?* naming each changed rate from and to; *Back to
   editing* sends nothing and returns focus to the first changed rate field; *Save new rates* sends exactly once. No
   confirmation at the first run or for a details-only save. *Red:* open it for every save: the details-only case
   fails.
6. **Results.** Saved: the facts line names the new version, and the read view shows the answered values; *unchanged*:
   "Nothing changed. Version {n} is still in force."; general failure (`VALIDATION_FAILED`, `invalid-request`): draft
   kept, nothing resent; session refusals as S1b. *Red:* treat an answered version equal to the carried one as *saved*:
   the unchanged case fails.
7. **Stale (`SETTINGS_CHANGED`).** Draft kept; one reread; "Now in force: {value}" beside each differing field; the
   facts line names the newer version; Save disabled with its visible reason until *Keep my changes* (the draft builds
   on the reread version; nothing sent) or *Use current settings* (fields take the current values; nothing sent);
   after *Keep*, the next Save carries the new version. *Red:* let *Keep* send the save: the "nothing sent" assertion
   fails.
8. **Unknown outcome.** `failed` or `unavailable`: one reread, never a resend. Same version read: the plain uncertainty.
   Newer version read: the uncertainty with the stale comparison, its two choices, and "It may be this save." Reread
   failed: facts withheld, *Try again* repeats the read only. *Red:* resend once after `failed`: the command count is 2.
9. **One command at a time.** While a save is pending, Save and every *Change* are inert and a second press sends
   nothing. *Red:* remove the guard: the count test fails.
10. **Departure, M-6 and BO-01.** The departure decision from Cancel, Escape, browser back and the rail, with its
    pending and unknown copy; the top bar's logout confirmation as S1b; M-6 over the form and over the confirmation
    (visible, inert); BO-01 with the draft held (form hidden, BO-01's fields live; the confirmation closed and reopened
    for the same manager; a different manager destroys both). *Red:* skip the confirmation's `close()` at BO-01: the
    BO-01 test fails.
11. **BO-05's partial alert** (ruling 10). *Red:* use the new constant for the plain failed read too: that test fails.
12. **`ConfigApi`** (ruling 9): the config-api type test and key list include the settings paths; fixture mode serves
    BO-08; no fixture marker reaches the built bundle.
13. **In the browser** (`e2e/tests/settings.spec.ts`, both engines, the harness's rules): (a) a manager saves settings
    with tax `10,5` and service `5`; the page shows `10,5%` and a facts line naming that manager; the database's current
    version holds `105000` and `50000` ppm (read through the server's `readCurrentSettings`, as other specs read through
    domain functions). If an earlier spec left a version, the case asserts the next version rather than version 1.
    (b) a manager opens the form and edits; a second harness person saves a version through the domain function;
    the manager presses Save; the stale notice shows with the draft kept, exactly one save request was sent, and the
    facts line names the second person's version.
14. `npm run verify` and `npm run test:e2e:all` green, counts in the Handoff.

## Rules

- Touch only the paths in `owns`. `e2e/support/**` is for **additions**; an edit to an existing helper's behaviour is a
  change to every spec: stop and ask. No change to `packages/`, `apps/server` or `docs/`: if a route or schema is wrong
  for the screen, that is a question, not a fix.
- Red first, per criterion: write the test, run it against the unchanged code, record the failing assertion; then the
  code.
- Every visible word from DESIGN-018's copy table, DESIGN-018b, or `copy.ts`; every style value from the Frost registry.
- Browser-test rules (ADR-011 rules 27 and 28; the 012a and 012b Handoffs): people through the harness's domain
  functions with random credentials (never `makePeople` from the server tests); both clocks moved together; requests
  made by the page; assertions on state, accessible names and codes; no screenshots or artefacts committed; sign-ins
  through the existing helpers so the credential ledger counts them; the credential scan runs as in every spec.
- Server tests need `npm run db:up` and `openssl` on `PATH`. Do not touch the development database `pos`.
- Format by hand, matching each file; there is no formatter config.

## Tests expected to change

- `apps/back-office/test/sign-in.test.tsx`: the rail assertions (now *Tables* and *Settings*).
- `apps/back-office/test/routes.test.ts`: the manifest's paths.
- `apps/back-office/test/config-api.test.tsx`: the `ConfigApi` key list (ruling 9).
- The BO-05 tests that assert the **partial** state's alert (in `tables-round2.test.tsx` or `tables-round4.test.tsx`;
  find them): the new copy (ruling 10). Assertions on the plain failed read do not change.
- New tests under `apps/back-office/test/` and the new spec `e2e/tests/settings.spec.ts`.
- **Nothing else should change.** A change anywhere else is reported in the Handoff with its reason; a weakened
  assertion is not acceptable.

## Baseline

`development` at `608f412` (S2a #128, DESIGN-018b #127 merged). Lead's runs of S2a's final tree: `npm run verify` 107
files, 4007 tests; `npm run test:e2e:all` 68 passed. Confirm the baseline before you start and state the new counts in
the Handoff. Run `npm run test:e2e:all` yourself before you finish.

## Out of scope

- The payment-methods part of BO-08, and tender types (S3). Any server, contract or transport-core change. Any other
  back-office screen. The items of ruling 8.
- A server-side field list for `VALIDATION_FAILED`; an idempotency key; polling; a read of an older version.

## Commit and report

Commit on `agent/phase1-s2b` only, after verify is green, and never push. Conventional Commits, explaining why; more
than one commit is fine if it reads better. Write the Handoff below in full prose: what was done (paths, commits), what
was decided and on what evidence, tests changed and why, each red proof (mutation, failure read, reverted), what was
found and not fixed, the real `verify` and `test:e2e:all` output, and **what S3 needs** to add the payment-methods part
(how the page registers with the guard, where the second part mounts, which state is the screen's). End with `DONE` or
`BLOCKED: <one question>`, then report to the lead through Herdr as AGENTS.md says.

## Lead ruling on the BLOCKED question, and lead verify (2026-10-22)

**The question (Handoff, *Found and not fixed* 3), ruled by the lead, overturnable by the owner or a designer:** the
builder's sentence stands as written: "The outcome could not be confirmed. The settings have been read again; nothing
is saved yet. Your draft is kept; nothing was sent again." It is DESIGN-018's own sentence with the version clause
replaced, and it claims nothing the reread does not show. `UNKNOWN_FIRST_RUN_BODY` stays, with its comment. No change is
needed, so no builder round is spent on it: the task goes to review as it is.

**Finding 1** (`@pos/money` not declared in `apps/back-office/package.json`) is real, the same as S2a's F2. The lead
rules it together with the review's findings, in the next round, with the two manifest files added to `owns`.

**Finding 2** (lengths are code points) is confirmed by the lead: zod 4.6.5's `z.string().max(2)` accepts two emoji and
refuses three. The wrong "UTF-16 units" wording is also in `packages/contracts/src/tables.ts`, `settings.ts` and
`auth.ts`, the comments in `0010` and `0011`, `docs/DESIGN.md:1607`, the inventory's sign-in rows, `tables/label.ts` and
`SignIn.tsx`. In every case the client counts UTF-16 units, which is never fewer than the code points the server counts,
so the client refuses more than the server and nothing unsafe passes. The lead queues it as its own cleanup task. Not
for this task.

**Lead verify.** At `26703db` the tree is clean. Every changed path is inside `owns`, and nothing under `e2e/support/`
changed. The lead's runs: `npm run verify` 113 files, 4316 tests; `npm run test:e2e:all` 74 passed (both browsers). **For the reviewer:** you cannot reach the database or launch a browser.
The lead's verify note, added before merge, is the evidence for both suites, and a "blocked" on that alone is ruled
clear. Review against the *Lead rulings*, DESIGN-018's copy, rate and lengths tables and DESIGN-018b's phone rule, `D`'s
configuration-form rules, and S1b's pattern. Above all, check that the rate path never uses a float, the base-version
rule (ruling 6), that the stale and unknown states never resend, and the confirmation's dialog rule at M-6 and BO-01.

## Round 2 — the review's six findings (lead rulings, 2026-10-22)

The Codex review (`.agent/reviews/PHASE1-S2b-review.md`, verdict *findings*, six) is accepted in full, each fix as the
review proposes. `owns` now also lists `apps/back-office/package.json` and `package-lock.json`, for F6 only. Every fix
gets a test that fails against round 1, which you run and record. Apply exactly this, then add a section *Round 2* at the
end of the Handoff (each finding, its test, the red you observed, the counts), and end it with `DONE`.

- **F1, the facts after a discarded save's failed reread.** A failed reread after an unknown outcome withholds the
  version facts at page level whether or not the form still exists. They stay withheld until a later successful read or
  an authoritative answer establishes the current version. The command is still cleared silently, as a discarded save
  requires. Test both timings the review names: Discard while the save is pending, and Discard during the reread.
- **F2, a gate that closes during the result's reread.** After every asynchronous reread in the unknown and stale
  branches, recheck the session gate and the local decision before presenting anything. If presentation is not
  permitted, hold the completed result and its read, and present it once, with its focus, when the same manager returns.
  Resumption never repeats the save or the reread. Make the focus request survive the gate rather than being consumed
  while signed out or idle. Test a delayed reread with M-6 and with the departure decision opening during it.
- **F3, the stale comparison follows the draft.** Derive the "Now in force: {value}" annotations and the same-or-different
  sentence from the **current draft** against the offered version. Update them on every field change and when a reread
  completes, using the existing rate and text normalisation. Nothing is rebased or sent implicitly. The unknown
  outcome's *Try again* read compares against the current draft too. Test a field becoming different and one becoming
  equal.
- **F4, the first-run context after a version exists.** `form.base` stays solely the outgoing version, as now. The
  form's title and context come from the known current state: once any version is known to exist, use the edit title
  and context ("Edit settings" / "Changes apply to orders opened after you save. …"). Use the first-run title and
  context only while the read shows none. Never claim "nothing is saved yet" while an outcome or read is unknown. Test
  the first-run stale and unknown transitions.
- **F5, money facts in the closed first-run state.** When the read succeeds with `current: null` and the form is closed,
  also render the Money group's plain facts (currency, decimal places, "Fixed for this installation."). FR-B1, ADR-012
  rule 5 and `D:1721-1726` win over the Frost artifact's `first-run-closed` drawing, which omits them. The lead records
  that drawing as owed to a designer. No rate is shown or pre-filled. Assert the facts before *Enter settings* and after
  a clean Cancel.
- **F6, the dependency.** Add `"@pos/money": "*"` to `dependencies` in `apps/back-office/package.json`, alphabetically
  after `@pos/contracts`, and the same line under `packages["apps/back-office"].dependencies` in `package-lock.json`, by
  hand (the entry at about line 23; change nothing else). Do not run `npm install`. The lead runs `npm ci` afterwards.
- **Then** `npm run verify` and `npm run test:e2e:all`, commit, and report as before. Change nothing else.

## Handoff

### What I did

BO-08's settings part is built, with the rail entry, the route, the model, the view, the rate field, the text-field checks, the
rate confirmation, the stale-draft refusal, the unknown-outcome handling, the `ConfigApi` change, the fixture-mode read, BO-05's
partial-list alert and the browser spec. It is one commit on `agent/phase1-s2b` (`git log -1` names it; a commit cannot hold its
own hash). Nothing was pushed. I touched only paths under `owns`, plus this Handoff.

New source, all in `apps/back-office/src/settings/`: `rate.ts` (the rate field: `checkRate`, `percentText`), `fields.ts` (the text
checks, `checkText`, `checkDrafts`, the field order), `when.ts` (the facts-line date), `copy.ts` (every BO-08 sentence, each a row of
DESIGN-018's copy table or DESIGN-018b), `model.ts` (the behaviour, apart from how it is drawn) and `Settings.tsx` (the view, the
rate confirmation and the departure decision). Changed: `routes.ts` (`settings` at `/back-office/settings`), `Rail.tsx` (Settings after
Tables), `Screens.tsx` (the second model, made once per working-area key beside BO-05's), `session/api.ts` (the `Exclude` removed,
the two functions in `configApi()`), `session/fixtureSession.ts` (a fixture version, ruling 9), `copy.ts` (`LIST_PARTIAL`),
`tables/Tables.tsx` (the alert switch), `office.css` (BO-08's rules, ported from Frost's `settings.css`; the payment-methods rules are
S3's), and a header comment in `OfficeApp.tsx`. New tests: `settings-rate`, `settings-fields`, `settings-when`, `settings`,
`settings-departure`, `settings-fixture` (and `settings-support.tsx`, their shared helpers); new browser spec
`e2e/tests/settings.spec.ts`.

### How it works, and what S3 copies

**The model is the screen's.** `settings/model.ts` holds `form`, `command`, `confirm`, `decision` and `page` for the whole screen, as
DESIGN-018's one form and one command per screen requires. It is made once per working-area key in `Screens.tsx`, so a save already
sent outlives the manager leaving Settings (Discard drops only the draft; the answer lands silently), exactly as BO-05's does. Its
`start()` and `setGate()` are wired beside BO-05's.

**How the page registers with the guard.** `Settings.tsx` calls `workGuard.register(model.guard)` once, in an effect, and
`model.subscribe(workGuard.changed)`. The guard answers `status()` (`clean`, `dirty`, `uncertain`) and `leave(proceed)` for the
router, the rail and the logout confirmation, unchanged from S1b. **S3 should add its method form and its status commands to the same
model** (a second `form`-like field or a union, and the same single `command`), not register a second guard: `work/guard.ts` holds
one registration. The model's `leave()` already routes every opener through the departure decision; S3's openers should call it.

**Where the second part mounts.** `Settings` renders `<h1>`, then one `<section className="settings-part">` (Rates and receipt details),
then the two dialogs (`RateConfirm`, `Decision`). S3's Payment methods is a second `<section>` after the first, and its own
dialogs go beside these. `Decision` is copied from BO-05 verbatim (S1b's handoff said a later form copies it); if S3 adds a second
copy, extract it then.

**What is the screen's state, and what is the part's.** The screen's: `command`, `decision`, `page`, `focus`, `read`. The settings
part's: `current`, `installation`, `withheld`, `form`, `confirm`. S3's methods list needs its own `read` and rows; its status
messages share `page` or get a second field, and the waiting sentence stays the screen's.

**The version rules.**
- `current` is the version in force, the one most recently read or answered. `adopt()` replaces it only with an equal or higher
  version number, so a read that began before a save was answered never undoes it (a numbered test holds this).
- `form.base` is the version a draft builds on, a whole `SettingsVersionView`. It moves in exactly three places: a success (the form
  closes), `keepMine()` and `useCurrent()`. A reread (`reread()`) never touches it. `expectedVersion` is `form.base?.version ?? null`.
- *Unchanged* is `meaningOf`: an `ok` answer whose `current.version` equals the carried `expected`. A saved answer has a version
  above it (or any version at the first run).
- The confirmation compares the draft with `form.base`, not with `current`, so after *Keep my changes* it shows another manager's
  change being undone ("Service charge from 5,5% to 5%").
- `form.sent` holds the values of the last save sent from the form; the stale and unknown comparisons ("Now in force: …") use it, so
  they hold even after the command is gone.

**The rate field.** `rate.ts` follows DESIGN-018's table exactly and never leaves strings: the whole and the fraction go to
`rateFromPercent`, the bound is `rate > RATE_SCALE` on a bigint, and the request carries `encodeRate`'s string. `percentText` is
string slicing on the canonical ppm. A source test scans `src/settings/` for `parseFloat`, `parseInt`, `Number(`, `Math.round` and
`toFixed`.

**Accessible names the browser spec drives:** link `Settings` (group `Configuration`), heading `Settings`, textboxes `Tax rate`,
`Service charge rate`, `Outlet name`, `Address`, `Phone`, `NPWPD`, `Footer line`, buttons `Enter settings`, `Change tax rate` and the
six others, `Save`, `Cancel`, `Stay`, `Discard`, `Keep my changes`, `Use current settings`, `Try again`, modal dialogs
`Save new rates?` (buttons `Back to editing`, `Save new rates`) and `Discard unsaved changes?`.

### What I decided, and on what evidence

1. **Lengths count code points, not UTF-16 units.** DESIGN-018 and S2a's handoff say "UTF-16 units, as zod counts". They are
   wrong: zod 4.6.5 counts code points (`z.string().max(2).safeParse('😀😀😀')` fails and `…('😀😀')` passes; `min(2)` refuses one
   emoji), and PostgreSQL's `char_length` does the same. A form that counted units would refuse a 33-emoji outlet name that the
   contract accepts, under a message that says "64 characters". The pair test caught it on its first run (the two emoji cases failed).
   `fields.ts` counts `[...value].length` and says why. **The sentence in DESIGN-018 and the S2a comment should be corrected, and BO-05's
   `tables/label.ts` (`label.length`, units) has the same difference** (see *Found and not fixed*). I followed the contract, which is
   what refuses, over the design sentence.
2. **A failed reread after `SETTINGS_CHANGED`.** DESIGN-018 draws no state for it (the table has the stale notice only with the reread
   in hand). I show the definite general failure ("Something went wrong / Nothing was saved. Your draft is kept. Press Save to try
   again."), which is true: Save then repeats the explicit save with its own reread. Nothing is sent without the manager's press.
3. **A failed hidden read does not take away an open form.** A visit read that began while the page was ready, and failed, leaves the
   page ready if a form is open or an answer was applied after the read began (BO-05's N1 rule, adapted: a settings save requires the
   form, so there is no separate partial state for settings).
4. **The fixture session serves a read and answers a save `unavailable`.** Ruling 9 asks for a fixture "holding one version". A fake
   save would reimplement the version rule in a second place, as BO-05's header comment says of the table commands. In fixture mode
   a save therefore shows the unknown-outcome notice. The fixture data is in `fixtureSession.ts` only (the built-bundle tests look for
   `M. Iqbal` and the marker; both are in that module and neither is in the bundle).
5. **Facts line withheld.** `withheld` is set when an unknown outcome's reread fails and cleared by any successful read or answer.
   After a discard of that form the read view shows the last version it knows without the facts line until the next read.
6. **Rate confirmation under the working-area rule.** `RateConfirm` copies `Decision`: wanted open only at `signed-in` or `idle`, `close()` in a
   layout effect at BO-01 with state kept, reopened with `showModal()` and focus on *Back to editing*, destroyed with the key for another
   manager. Opening it needs no read-view changes: `save()` sets `confirm`; `confirmSave()` is the only path that sends from it.
7. **`Save` is `aria-disabled`, never `disabled`.** Playwright waits for an `aria-disabled` button to become enabled; the browser spec's
   press on the disabled Save uses `click({ force: true })` and says why (the first run of S2 timed out on exactly this).

### Not built on purpose (ruling 8)

The payment-methods part, its heading and any placeholder (S3); the kitchen-emergency sentences in the confirmation and the departure
decisions (the built frame has no incident action); BO-01's held-draft sentence ("The previous session's unsaved changes are stored on
this tab…", S10); any business-day indicator. None is drawn and none has a hook.

### Existing tests I changed, and why

- `test/sign-in.test.tsx`: **two** assertions, not one. The rail text is now `ConfigurationTablesSettings` and the hrefs are both
  paths; the "only link" assertion now lists both rail entries. Neither is weaker: the frame still has no link other than the rail's
  destinations that exist.
- `test/routes.test.ts`: the manifest names three screens and the Settings path.
- `test/config-api.test.tsx`: the run-time key list gains the two settings paths (ruling 9).
- `test/tables-round2.test.tsx` (the F4 case) and `test/tables-round4.test.tsx` (N1): the assertion on the **partial** state's alert is
  the new wording (ruling 10). The assertions on the plain failed read (`tables.test.tsx:108`, `:444`, `config-api.test.tsx`, N1's
  second case) are untouched and still hold.
- Nothing else existing changed. No assertion was loosened.

### Red proofs (each a mutation I applied, the failure I read, and the revert)

All reverts were byte-checked against copies taken before the first mutation (`diff -r` clean).

1. **AC 1.** `settings` removed from `PATHS`: `routes.test.ts` "lists the landing, Tables and Settings" failed (`expected ['landing','tables']
   to deeply equal ['landing','settings','tables']`).
2. **AC 2.** Currency rendered as a read-only input: two tests failed ("shows the facts line, the constants as text…" and "names no
   input for the currency or the decimal places…", `expected <input> to have a length of 0`).
3. **AC 3.** The conversion replaced by `Math.round(parseFloat(x) * 10000)`: **only the source test failed** (`expected ['Math.round',
   'parseFloat'] to deeply equal []`); **no vector failed**, which is exactly why the source test exists.
4. **AC 4.** `/` allowed in the phone charset: six tests failed, the pair test against `OutletPhone` among them (`"021/555"`,
   `"021 / 555"`, `phone: too long, then the charset…`, and three UI cases).
5. **AC 5.** The confirmation opened for every save from a non-first-run form: 19 tests failed; "no confirmation for a save that changes
   only details" is the named one.
6. **AC 6.** An answered version equal to the carried one treated as saved: "unchanged: an answered version equal to the one carried is
   not a save" failed (`expected 'Settings saved as version 4…' to be 'Nothing changed. Version 4 is still in force.'`).
7. **AC 7.** *Keep my changes* made to send the save. My first mutation (`save()` after the set) failed the notice assertion only,
   because the draft changed a rate and the call opened a confirmation instead of sending; that proved nothing about "nothing sent". I
   added a test whose draft needs no confirmation ("Keep my changes sends nothing even when the next Save would need no confirmation");
   the same mutation then failed on `expected 2 to be 1`.
8. **AC 8.** A second call after `failed` or `unavailable`: 11 tests failed with `expected 2 to be 1` (the save count).
9. **AC 9.** The `state.command !== null` guard removed from `save()`: "a second press of Save while one is pending sends nothing" failed
   (`expected 3 to be 1`).
10. **AC 10.** The confirmation's `close()` skipped at BO-01: the jsdom test failed (`expected true to be false`), and **so did the browser
    spec S3 in both Chromium and WebKit**, at BO-01's Username (`toHaveValue('x')`, received `""`): a modal left open in the hidden area
    blocks BO-01's fields. I rebuilt after the revert.
11. **AC 11.** The new copy used for the plain failed read too: three tests failed (`expected 'The list may be out of date…' to be
    'Tables could not be loaded…'`).
12. **AC 12.** `configApi()` without the two settings functions: the key-list test failed (`expected [ …(5) ] to deeply equal [ …(7) ]`).
    Removing the `Exclude` is held by the type: the settings screen's calls would not compile otherwise.
13. **Extra.** `adopt()` taking any read, not only an equal or higher version: "an older version arriving late does not replace a newer
    one" failed (`expected 'Version 4…' to contain 'Version 5'`).

I wrote the pure modules and their tests in one pass and ran the tests after the modules existed, so for AC 3 and 4 the first red is
the mutation, not the absent module. The UI tests were also written with the code.

### Found and not fixed

1. **`@pos/money` is not a declared dependency of `@pos/back-office-client`** (`apps/back-office/package.json` lists `@pos/api-client`,
   `@pos/contracts` and `@pos/tokens`). `rate.ts` imports `rateFromPercent`, `encodeRate` and `RATE_SCALE`, as ruling 3 requires. It resolves
   and bundles because npm workspaces link every workspace package into the root `node_modules`; typecheck, the tests, the build and the
   browser suite all pass. It is the same finding as S2a's F2 for the server. `package.json` is not in this task's `owns`. **Proposed fix
   (the same wording the lead applied to the server):** add `"@pos/money": "*"` under `dependencies` in `apps/back-office/package.json`
   and the same line under `packages["apps/back-office"].dependencies` in `package-lock.json`, by hand or with `npm install`.
2. **DESIGN-018's and S2a's "UTF-16 units, as zod counts" is wrong** (decision 1). Proposed wording for DESIGN-018's lengths table intro
   and S2a's comment: "Lengths are counted in code points, as zod and PostgreSQL's `char_length` count them." **BO-05's
   `tables/label.ts` counts `label.length` (units)**; a label of 17 to 32 emoji is therefore refused locally though `TableLabel` accepts
   it. Not changed here (BO-05 is committed work outside my slice).
3. **DESIGN-018 has no sentence for an unknown outcome at the first run whose reread shows nothing saved.** The table's sentence names
   "version {n} is in force", and there is none. I put one constant in `settings/copy.ts`, `UNKNOWN_FIRST_RUN_BODY`, with a comment that
   it is not a row of DESIGN-018: "The outcome could not be confirmed. The settings have been read again; nothing is saved yet. Your
   draft is kept; nothing was sent again." It is the table's sentence with the version clause replaced. A test holds that it names no
   version. **This is the one question below.**
4. **A failed reread after `SETTINGS_CHANGED`** has no designed state (decision 2). The behaviour I chose is true and sends nothing, but a
   designer might want a stale notice without comparison.
5. **Process.** I appended the CSS to `office.css` with a shell heredoc (`cat >> … <<EOF`), and ran one no-op heredoc, against the one
   command per call rule. Nothing outside the worktree was touched; the rest used the file tools. I ran no formatter and no Prettier.
6. **No person looked at BO-08 served.** No browser window was available to me beyond the Playwright runs, which prove behaviour and
   accessible names and not appearance. The CSS is ported rule by rule from `settings.css` (the no-invented-values test passes); a look at
   the two-column split, the textarea and the `Now in force` lines against the Frost artifact is still worth doing.

### Verification

`npm run verify`: typecheck clean for all seven projects; **113 test files, 4316 tests passed** (baseline 107 files, 4007 tests,
confirmed by running it before I changed anything; +6 files, +309 tests). `npm run test:e2e:all`: **74 passed** in Chromium and WebKit
(baseline 68; +6: S1, S2 and S3 in each engine). The first run of the new spec failed S2 in both engines on the disabled-Save click
(decision 7); after the fix the whole suite passed, and I ran it again at the end. The built-bundle tests find no fixture marker. `git
diff --check` is clean.

### What the next agent needs and does not have

- A ruling on finding 3 (the first-run unknown sentence), and the lead's wording for the `package.json` and lockfile line (finding 1).
- S3 adds the method list and form to this model and mounts a second section (see *How it works*); the `Decision` and `RateConfirm`
  dialogs are local to `Settings.tsx`.
- Server, contracts and the transport core are untouched, as the task required.

BLOCKED: What exact sentence should the settings form show for an unknown save outcome at the first run when the reread shows nothing saved (DESIGN-018's sentence needs a version number); my proposed wording is in finding 3.
