---
id: PHASE1-S2b
title: BO-08 Settings in the back office — the settings section, the rate field, the stale-draft refusal, and BO-05's partial-list alert (plan S2b, DESIGN-018, DESIGN-018b)
category: ui
touches: [money, boundaries, identity]
depends_on: [PHASE1-S2a, DESIGN-018b]
owns: [apps/back-office/src/**, apps/back-office/test/**, e2e/tests/settings.spec.ts, e2e/support/**]
status: not-started
cycles: 0
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

## Handoff

_Not started._
