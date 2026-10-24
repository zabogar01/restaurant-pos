---
id: PHASE1-S3b
title: BO-08 Payment methods in the back office — the methods list, the method form, its status commands, and the ConfigApi inclusion (plan S3, DESIGN-018, consult C2 §8)
category: ui
touches: [boundaries, identity]
depends_on: [PHASE1-S3a]
owns: [apps/back-office/src/**, apps/back-office/test/**, e2e/tests/payment-methods.spec.ts, e2e/support/**]
status: active
cycles: 0
---
# PHASE1-S3b — BO-08 Payment methods in the back office

**Written** 2026-10-24 by the lead, from slice S3 of the accepted Phase 1 plan
(`docs/superpowers/plans/2026-10-19-phase-1-back-office-and-catalog.md`, *S3*), the server half **PHASE1-S3a** (merged
as PR #134: the five tender-methods routes exist and behave as its Handoff says), the design **DESIGN-018** (BO-08,
merged as PR #125), **consult C2** (`.agent/reviews/ARCH-019-first-back-office-form.md`, §8 and the pattern of §1 to §7),
and the two client slices whose code this one extends: **PHASE1-S1b** (BO-05, the list-and-panel pattern, merged as PR
#123) and **PHASE1-S2b** (BO-08's settings part, merged as PR #130). The plan sizes S3 as one task; the lead split it
into S3a (server) and this client half, as S1 and S2 were split. Where this file, DESIGN-018 and the two slices'
patterns differ, the rulings below say which wins; where they still differ, stop and write `BLOCKED: <question>`.

## Objective

On BO-08, below the settings part S2b built, a signed-in manager sees **Payment methods**: cash and card as two fixed
rows that hold no control, then the restaurant's custom methods, active before inactive, names in order. The manager
creates a custom method, renames it, deactivates it and reactivates it through the five S3a routes, with every word from
DESIGN-018. The list behaves as BO-05's does (every visit reads; refusals on the name; the list reread behind a
`DUPLICATE`; the F4 partial state; unknown outcomes reread and never resend), and the screen keeps DESIGN-018's **one
form open and one command in flight per screen** rule across both parts. With this slice, FR-B7 is built end to end.
Nothing tenders with a method until Phase 4.

## Required inputs

Read these, in this order. Everything you need is here or cited.

1. **This file**, whole.
2. **DESIGN-018's Handoff**, `.agent/tasks/DESIGN-018-settings-and-tenders.md` from `## Handoff` to the end, including
   *Round 2*. **Its payment-methods rows are yours:** *The decisions, and why* (above all *Two forms on one screen*,
   *Cash and card*, *No confirmation for deactivate or reactivate*, *F4*); *Rules S2a, S2b and S3 can test* (the
   *Method name (S3)* row); *Copy and accessible names* (every row from *Methods part* to *Method form pending / failure
   / unknown*; every product word comes from it, ADR-011 rule 24); *Focus* (every method row). Its settings rows were
   S2b's and are built.
3. **`docs/DESIGN.md`**, *Configuration forms — DESIGN-017 / consult C2* (from `:1486`) and *Configuration forms —
   DESIGN-018 additions* (from `:1628` to `:1768`). Both bind this task; their headings still say "awaiting review", but
   both were reviewed and merged. The DESIGN-019 and DESIGN-020 additions are the catalog's and do not apply.
4. **The Frost artifact**, `docs/design/visual-directions/frost/back-office/settings.html` with `settings.css`,
   `settings.js`, the shared `office.css` and BO-05's `tables.css`, whose list and non-modal panel classes the methods
   part reuses. Open it with `?state=<name>`; the method states are `default`, `methods-empty`, `methods-overflow`,
   `method-create`, `method-rename`, `method-rename-inactive`, `method-invalid-*`, `method-duplicate-create`,
   `-rename`, `-reactivate`, `method-saving`, `method-saved`, `method-failure`, `method-unknown`,
   `method-pending-deactivate`, `method-unknown-deactivate`, `method-deactivated`, `method-reactivated`,
   `method-partial`, `method-unsaved`, `method-unsaved-switch` and `unsaved-switch` (the gallery lists them all). It is
   a review fixture: its fixture data, response selector and disclaimers are not product and are not copied. Port CSS
   only through tokens already in `docs/design/tokens/frost.css` (`apps/back-office/test/no-invented-values.test.ts`
   enforces this). S2b ported the settings rules into `office.css` and left the payment-methods rules to you.
5. **PHASE1-S3a's Handoff**, `.agent/tasks/PHASE1-S3a-tender-methods-server.md`, *What S3b needs*: the routes, the
   `ROUTES` names, the contract names, the `ConfigApi` exclusion you now remove, and how `DUPLICATE`, `NOT_FOUND` and
   `VALIDATION_FAILED` arrive.
6. **PHASE1-S2b's task file and Handoff**, `.agent/tasks/PHASE1-S2b-settings-screen.md`: *How it works, and what S3
   copies* (the screen's model, how the page registers with the guard, where the second part mounts, which state is
   the screen's and which the part's), and *Round 2* (the gate recheck after every asynchronous reread, the held
   result, the focus request that survives the gate). These apply to the method commands as they do to the settings
   save.
7. **PHASE1-S1b's task file and Handoff**, `.agent/tasks/PHASE1-S1b-tables-screen.md`: its *Lead rulings*, its
   Handoff's *How it works, and what a later form copies*, and its rounds 2 to 4, which changed behaviour (every visit
   reads; a failed visit read keeps a newer success; command lifetime; read reconciliation; the F4 partial state;
   N1). **The methods part is BO-05's list and panel inside BO-08**: copy `tables/model.ts`'s list behaviour, not its
   screen-level wiring, which BO-08 already has.
8. **The existing back office**: `apps/back-office/src/` (`settings/`, `tables/`, `copy.ts`, `Screens.tsx`,
   `work/guard.ts`, `forms/fieldsInError.ts`, `session/`), and the tests beside them. **The browser harness**:
   `e2e/support/**`, `e2e/tests/settings.spec.ts` and `e2e/tests/tables.spec.ts`.
9. The contract, for meaning only: PRD FR-B7, FR-A2b, AC-35; BOUNDARIES B-5, B-20, B-24.

## Decided: do not reopen

- **Owner, 2026-10-20 (DECISIONS):** FR-B7 is Phase 1, as slice S3 (plan Q4). C2's OQ1: a deactivated custom method may
  be **reactivated**. Nothing in Phase 1 is audited except user management (Q11).
- **C2 §8, as the lead ruled and the owner accepted with DESIGN-018 question 1 (DECISIONS 2026-10-21):** cash and card
  are **fixed kinds, not rows**: always offered, never created, renamed or deactivated, and their display names
  ("Cash", "Card") are client copy. Only custom methods are records. **A custom name may equal "Cash" or "Card"**; the
  screen neither refuses nor warns.
- **DESIGN-018, accepted:** no confirmation before deactivate or reactivate; the method form is BO-05's **non-modal
  panel**; one form open at a time and one command in flight at a time **per screen**; the F4 partial alert's words
  (BO-05 already uses its own version, from S2b).
- **Drafts (owner, 2026-10-05, 10-14, 10-16, 10-20):** the same manager resuming through M-6, or signing in again at
  BO-01, gets the unsaved draft back; a different manager's sign-in destroys it; a reload destroys it.
- **C2 §6 and ADR-011 rule 20:** an unknown outcome rereads and never resends; the client never infers success from a
  reread; there is no "send again" control.
- **Lengths are code points.** zod 4.6.5's `max` and PostgreSQL's `char_length` count code points (S2b Handoff,
  decision 1). DESIGN-018's "UTF-16 units" sentence is wrong. Count with `[...value].length`, as S2b's `fields.ts`
  does, never `value.length`; do not copy the old wording into a new comment. (BO-05's `tables/label.ts` still counts
  units; correcting it is a separate queued cleanup, not this task.)
- **S1b's and S2b's patterns**, as merged: reuse `fieldsInError`, `work/guard.ts`, the router's guard, the `Decision`
  dialog and the logout confirmation as they are. Change them only if this part cannot work otherwise, and then say why.

## Lead rulings (2026-10-24)

1. **Scope: the payment-methods part of BO-08, in every state DESIGN-018 draws for it.** A second `<section>` after
   the settings part, under the heading *Payment methods*, with the count line, the table (caption, headers, the two
   fixed rows, the custom rows), *New payment method*, the method panel, and the methods status. No route, rail entry
   or page heading changes: it is the same `/back-office/settings` page.
2. **One screen model.** The methods part's state and its commands live in **the same screen model** S2b built
   (`settings/model.ts`), as S2b's Handoff says: one `workGuard` registration, one `command` slot for the whole screen,
   one `decision`. Pure method helpers (the name check, the sort, the copy) may live in their own files under
   `settings/` (for example `methods.ts`), but no second model and no second guard registration. The screen's guard
   status is the open form's, whichever part it belongs to.
3. **Two forms, one at a time** (DESIGN-018, *Two forms on one screen*). Every opener on BO-08 (each settings *Change*,
   *Enter settings*, *New payment method*, each method's Edit, Deactivate and Reactivate) goes through the departure
   decision of whichever form is open when that form is dirty or its save is pending or unknown, and simply closes a
   clean form. While **any** command on the screen is pending (a settings save, a method save, a method status command,
   or a discarded save still outstanding), every opener on the screen is inert and a second press sends nothing; the
   waiting sentence appears in the status of the part that sent it. After an unknown outcome the openers are live
   again. The departure decision's copy stays BO-05's verbatim.
4. **The list read.** Every visit to BO-08 reads the settings **and** the methods: two `GET`s, neither interactive,
   independent of each other (a failed methods read never withholds the settings part, and the reverse). The methods
   read follows S1b's rules as merged: a failed visit read keeps a newer success; a read that began before a command
   was answered never undoes the answered record; the F4 partial state when a command succeeds while the list read
   stands failed, with DESIGN-018's *Methods partial (F4)* copy; *Try again* repeats the methods read only.
5. **The order.** The two fixed rows first, "Cash" then "Card", status "Always offered", the actions cell empty, no
   control, no link. Then the custom methods, **sorted by the client** (the server answers creation order): active
   before inactive, then by name with the collator BO-05 uses (`Intl.Collator('en', { numeric: true, sensitivity:
   'base' })`), ties kept in the server's order. The count line (`{active} active · {inactive} inactive custom
   methods`) counts custom methods only and is withheld unless the list read succeeded. The empty state's note shows
   when the read succeeded with no custom method; cash and card are still listed.
6. **The method name.** Trimmed before checking, then DESIGN-018's *Method name (S3)* row in its order: empty → too
   long (more than 32 code points) → control character (`\p{Cc}`), each with its copy, focus on Method name. The trimmed
   name is sent. The check and `TenderMethodName` must agree: one pair test over the boundary values (empty, spaces
   only, 32 and 33 code points including 32 and 33 emoji, a tab, ESC, U+0007, an inner space, and a name with leading
   and trailing spaces, which the check accepts after trimming and the schema accepts once trimmed), as S1b tested
   `checkLabel` against `CreateTableRequest`. Uniqueness is the server's: there is no local duplicate check.
7. **Commands and their answers.** Create sends `{ name }`; Save on an existing method sends `{ tenderMethodId, name }`
   (to `update`) whether the method is active or inactive, and a rename **never reactivates** (the inactive context
   sentence says so); Deactivate and Reactivate send `{ tenderMethodId }`. Each `ok` answer is the record as committed:
   apply it to the list, announce DESIGN-018's *Method results* sentence, and focus that method's Edit. A no-op answer
   (the server's record unchanged) is treated as the success it is; do not invent an *unchanged* sentence for methods.
8. **`DUPLICATE`** (409, no details). On create or rename: the form stays with the draft, *An active payment method
   already uses this name. Choose another name.* on Method name with focus there, the list reread once behind it, and
   the holder's name cell marked *Name in use* (text, not a link) once the reread shows which active method holds the
   name (compare case-insensitively with the same collator, `sensitivity: 'base'`; if no active row matches after the
   reread, show no marker). On reactivation: open that inactive method's form, with *An active payment method already
   uses this name. Rename this inactive method, save, then reactivate it.* on Method name, the list reread, and the
   holder marked. Nothing is ever resent.
9. **`NOT_FOUND`** (404) on update, deactivate or reactivate can only mean the record is gone, which nothing in Phase 1
   does. Treat it as the general failure of that command (*Something went wrong …*), with the list reread once, and say
   in the Handoff that it is unreachable today. No new copy.
10. **Status commands.** Deactivate and Reactivate send at once from the row (no confirmation, ruling of DESIGN-018),
    with *Deactivating {name}…* / *Reactivating {name}…* in the methods status (focusable), every opener inert
    meanwhile. Unknown: one reread, never a resend, *{name}: the outcome could not be confirmed. The list has been
    refreshed. Nothing was sent again.* (or *The list could not be refreshed.*), the row action reflecting the reread.
    Failure: *Something went wrong. {name} was not changed. Use its row action to try again.* A session refusal (M-6 or
    BO-01 during the command): after the same manager resumes, *{name} was not changed. Use its row action to try
    again.*, as S1b built it for tables.
11. **The working-area rules, unchanged.** The method panel is non-modal: under M-6 it stays visible and inert; at
    BO-01 it is hidden with the draft held; the same manager gets it back with Method name focused holding the unsaved
    value; a different manager destroys it. The departure decision about a method draft is S2b's `Decision` and follows
    the working-area dialog rule. **S2b's round 2 F2 applies to every method command**: after each asynchronous reread
    (unknown, `DUPLICATE`), recheck the session gate and the open decision before presenting; if presentation is not
    permitted, hold the finished result with its read and present it once, with its focus, when the same manager
    returns, never repeating the command or the reread.
12. **`ConfigApi`.** Remove S3a's `Exclude` of the tender-methods paths from `ConfigPath` in `session/api.ts`, add the
    five functions to `configApi()`, add the five paths to `fixtureSession.ts` answering `unavailable`, as the table
    paths do (fixture mode then shows the methods read failure under the fixture settings; no fixture method list),
    and update `config-api.test.tsx`'s key list.
13. **Copy** goes in `apps/back-office/src/settings/copy.ts` (S2b's BO-08 copy module), each string traceable to a row
    of DESIGN-018's copy table, or to `copy.ts` where DESIGN-018 says BO-05's words are reused verbatim (the method
    form's pending, failure and unknown notices; the departure decision). "Cash", "Card" and "Always offered" are copy.
    No zod message, server text, error code or submitted value ever becomes visible text, except the manager's own
    value in Method name and the names the read returns.
14. **Not built in S3b**, though DESIGN-018 draws them: the kitchen-emergency sentences in the departure decision (the
    built frame has no incident action); BO-01's held-draft sentence (S10). Say in the Handoff that each was left out on
    purpose. `Decision` is copied once already (BO-05 and BO-08 each have one); extract it into a shared module only if
    this task would otherwise add a third copy, and say which you did.

## Acceptance criteria, each with its red proof

Each *Red* line is a mutation you apply, observe failing, revert, and report.

1. **Order and fixed rows.** With custom methods `qris` (inactive), `Bank transfer`, `GoPay 2` and `GoPay 10`, the
   table reads Cash, Card, Bank transfer, GoPay 2, GoPay 10, then qris; Cash and Card say *Always offered* and hold no
   button, link or input; the count line reads `3 active · 1 inactive custom methods`. *Red:* sort with `a.name <
   b.name`: the order test fails.
2. **Empty and read failure.** A successful read with no custom method shows the two fixed rows and the empty note; a
   failed read shows the read-failure alert with *Try again*, withholds the count, and does not touch the settings part;
   a failed settings read does not touch the methods part. *Red:* withhold the methods part when the settings read
   fails: the independence test fails.
3. **The name check.** The pair test of ruling 6, and the UI refusals in order with their copy and focus on Method name;
   nothing is sent while the name is invalid; the request body carries the trimmed name. A source test or assertion
   shows the check counts code points (a 32-emoji name is accepted locally). *Red:* count with `name.length`: the
   32-emoji case fails.
4. **Create, rename, deactivate, reactivate.** Each sends exactly one request with the body of ruling 7, applies the
   answered record, announces its sentence and focuses that method's Edit; the sort applies to the answered record (a
   deactivated method moves below the active ones). Renaming an inactive method leaves it inactive. *Red:* send
   `{ id }` instead of `{ tenderMethodId }` on deactivate: the body assertion fails.
5. **`DUPLICATE`.** Create and rename: draft kept, the refusal on Method name with focus, one reread, the holder marked
   *Name in use*. Reactivation: that method's form opens with its own copy, one reread, the holder marked. Request
   count stays one per press in every case. *Red:* resend the create once after the reread: the count is 2.
6. **Unknown outcomes.** A method save or a status command answered `failed` or `unavailable`: one reread, never a
   resend, the copy of ruling 10 or the method form's unknown notice, with and without a failed reread. *Red:* resend
   once after `failed`: the command count is 2.
7. **One form, one command per screen** (ruling 3). With the settings form dirty, *New payment method* and a method's
   Deactivate each meet the departure decision first; with a method draft dirty, a settings *Change* does the same;
   with a clean form, the opener simply hands over. While a settings save is pending, every method opener is inert and
   a press sends nothing; while a method command is pending, every settings *Change* is inert. *Red:* let the methods
   openers ignore the screen's command slot: the count test fails.
8. **Partial state (F4).** A method command succeeds while the list read stands failed: the known rows with the
   answered record applied, the result announced, its Edit focused, New live, the count withheld, DESIGN-018's partial
   alert; *Try again* reads only. *Red:* show the plain read-failure copy in the partial state: that test fails.
9. **Departure, M-6 and BO-01** (ruling 11). The departure decision from Cancel, Escape, browser back and the rail with
   a method draft; M-6 over the method panel (visible, inert); BO-01 with a method draft held, returned to the same
   manager with focus and value, destroyed for a different manager; a method command's result arriving while M-6 is up
   is held and presented once on return. *Red:* present the held result while signed out: the M-6 test fails.
10. **`ConfigApi`** (ruling 12): the config-api type test and key list include the five tender-methods paths; fixture
    mode serves BO-08 with the methods read failure; no fixture marker reaches the built bundle. *Red:* leave one
    function out of `configApi()`: the key-list test fails.
11. **In the browser** (`e2e/tests/payment-methods.spec.ts`, both engines, the harness's rules): (a) a manager opens
    Settings, creates `QRIS`, sees it listed under Card with the count `1 active · 0 inactive custom methods` (or the
    next counts, if an earlier spec left methods; assert the change, not absolute numbers), deactivates it and sees it
    *Inactive*; the database holds it inactive (read through `listTenderMethods` in
    `apps/server/src/domain/tender-method.ts`, as `settings.spec.ts` reads through `readCurrentSettings`). (b) a second
    method created through `createTenderMethod` holds the name
    `GoPay`; the manager's create of `gopay` shows the *Name in use* refusal on Method name, exactly one create request
    was sent, and the holder's row is marked. Clean up nothing by deletion (there is no `DELETE`); use names made unique
    per run if a rerun would otherwise collide.
12. `npm run verify` and `npm run test:e2e:all` green, counts in the Handoff.

## Rules

- Touch only the paths in `owns`. `e2e/support/**` is for **additions**; an edit to an existing helper's behaviour is a
  change to every spec: stop and ask. No change to `packages/`, `apps/server`, `db/` or `docs/`: if a route or schema
  is wrong for the screen, that is a question, not a fix.
- Red first, per criterion: write the test, run it against the unchanged code, record the failing assertion; then the
  code.
- Every visible word from DESIGN-018's copy table or `copy.ts`; every style value from the Frost registry.
- Browser-test rules (ADR-011 rules 27 and 28; the 012a and 012b Handoffs): people through the harness's domain
  functions with random credentials (never `makePeople` from the server tests); requests made by the page; assertions
  on state, accessible names and codes; no screenshots or artefacts committed; sign-ins through the existing helpers so
  the credential ledger counts them; the credential scan runs as in every spec.
- Server tests need `npm run db:up` and `openssl` on `PATH`. Do not touch the development database `pos`.
- Format by hand, matching each file; there is no formatter config. One command per shell call; no heredoc edits
  (S2b's Handoff, *Found and not fixed* 5): use the file tools.

## Tests expected to change

- `apps/back-office/test/config-api.test.tsx`: the `ConfigApi` key list (ruling 12).
- `apps/back-office/test/settings-support.tsx`: its fake API gains the five tender-methods paths, so the existing
  settings tests run with a methods read that succeeds (an empty list unless a test says otherwise).
- `apps/back-office/test/settings-fixture.test.tsx` and `fixture-session.test.tsx`: only where they assert the whole
  fixture page, for the methods read failure (ruling 12).
- Any existing settings test whose host-wide assertion now meets the methods part (for example a count of buttons or
  open dialogs): the assertion is scoped to the settings part, never weakened; list each in the Handoff with its reason.
- New tests under `apps/back-office/test/` and the new spec `e2e/tests/payment-methods.spec.ts`.
- **Nothing else should change**, BO-05's tests and `e2e/tests/settings.spec.ts` included. A change anywhere else is
  reported in the Handoff with its reason; a weakened assertion is not acceptable.

## Baseline

`development` at `8722770` (S3a #134, DESIGN-020 #135 and the lead's #136 merged). Lead's runs of S3a's final tree:
`npm run verify` 116 files, 4367 tests; `npm run test:e2e:all` 74 passed. Confirm the baseline before you start and
state the new counts in the Handoff. Run `npm run test:e2e:all` yourself before you finish.

## Out of scope

- Any server, contract, transport-core or migration change. Any other back-office screen. The items of ruling 14.
- Tendering with a method (Phase 4); a warning for a custom name equal to "Cash" or "Card" (DESIGN-018 question 1, a
  Phase 4 design question); the code-point cleanup of BO-05 and the older comments (queued).
- A server-side field list for `VALIDATION_FAILED`; an idempotency key; polling; a single-record read.

## Commit and report

Commit on `agent/phase1-s3b` only, after verify is green, and never push. Conventional Commits, explaining why; more
than one commit is fine if it reads better. Write the Handoff below in full prose: what was done (paths, commits); how
the methods part sits in the screen model (state, the one command slot, the guard status, where a later form on
another screen would copy from); what was decided and on what evidence; tests changed and why; each red proof
(mutation, failure read, reverted); what was found and not fixed; the real `verify` and `test:e2e:all` output. End
with `DONE` or `BLOCKED: <one question>`, then report to the lead through Herdr as AGENTS.md says.

## Lead verify and rulings (2026-10-24)

**Verify.** At `cc8a88a` the tree is clean. `git diff --name-only development...HEAD`: the task file and paths inside
`owns` only; the existing tests changed are the two listed (`config-api.test.tsx`, `settings-support.tsx`, additions
only), plus four new test files and the new spec; nothing under `e2e/support/` changed. The lead's runs: `npm run verify`
**120 files, 4480 tests**; `npm run test:e2e:all` **78 passed** (Chromium and WebKit; the new M1 and M2 in both). The
lead read `settings/methods.ts`, the `session/` diff and the spec's outline against rulings 5, 6, 7, 8 and 12: the sort,
the code-point name check, the request bodies, the `ConfigApi` inclusion and the fixture entries are as ruled. **For the
reviewer:** you cannot reach the database or launch a browser. This note is the evidence for both suites, and a
"blocked" on that alone is ruled clear.

**Ruling on the Handoff's decision 1 (the builder's one question).** It stands: a `DUPLICATE` is presented at once, on
Method name with focus there, and the list reread runs behind it, as BO-05 does. Nothing is presented after that reread's
await, so there is nothing for the gate recheck of ruling 11 to hold; the *Name in use* marker is derived at render from
whatever rows the list holds. Ruling 11's gate recheck applies to the unknown outcome, which presents after its reread,
and the builder's tests hold it there.

**Lead finding L1, for the next round (with any review findings).** `sameName` in `settings/methods.ts` compares with
the collator at `sensitivity: 'base'`, which folds accents as well as case (`Cafe` equals `Café`). That is what ruling 8
said, but ruling 8 was wrong: the server's index is `lower(name)`, which folds case only, so the marker can name a row
the server would not count as the holder. Fix: compare `a.toLowerCase() === b.toLowerCase()`, correct its comment, and
add a test that `Cafe` and `Café` are not the same name while `QRIS` and `qris` are. The sort keeps the collator
(ruling 5). The reviewer may weigh this; it is not a blocker.

**Review against:** the *Lead rulings*, DESIGN-018's method copy, focus and *Two forms on one screen* rules, `D`'s
configuration-form rules, S1b's list behaviour (rounds 2 to 4) and S2b's round 2 F2. Above all, check that no method
command is ever resent, that one command slot covers both parts, that the held result is presented once, and that cash
and card hold no control in any state.

## Round 2 — the review's F1 and F2 (lead rulings, 2026-10-24)

The Codex review (`.agent/reviews/PHASE1-S3b-review.md`, verdict *findings*, two P2) is accepted in full. Every fix gets a
test that fails against round 1, which you run and record. Apply exactly this, then add a section *Round 2* at the end of
the Handoff (each finding, its test, the red you observed, the counts), and end it with `DONE`.

- **F1, a superseded reread must not claim the list was refreshed.** `loadMethods` returns its own response's success
  even when a newer read has superseded it and its rows were never applied. Fix: the value a caller receives describes
  **the list on screen**. A read that is still the newest returns whether it succeeded, as now. A read that was
  superseded waits for the newest read in flight and returns that read's outcome (repeat if that one is superseded in
  turn), so the refreshed or could-not-be-refreshed sentence always matches what the list shows. The gate and decision
  recheck after the await (ruling 11) stays where it is, after the final outcome is known, and a held result keeps that
  outcome. No extra request is sent: the caller waits on a read already in flight, never starts one. Test the
  reviewer's rail scenario in both completion orders (the older reread succeeds after the newer visit read fails: "could
  not be refreshed"; the newer visit read succeeds after the older reread fails: "has been refreshed"), with exactly one
  command sent and no extra read. **BO-05's `load` in `tables/model.ts` has the same defect** (it returns `rows !==
  null` whether or not `mine === readSequence`), and later forms copy this pattern: apply the same fix there, with the
  same pair of tests through BO-05's unknown outcome. This widens the slice to one BO-05 function on purpose; change
  nothing else in BO-05, and list the new BO-05 tests in the Handoff.
- **F2 and lead finding L1, the holder marker.** `sameName` compares `a.toLowerCase() === b.toLowerCase()`, matching the
  server's `lower(name)` index; correct its comment. The sort keeps the collator (ruling 5). Tests: `QRIS` and `qris`
  are the same name; `Cafe` and `Café` are not; `GoPay 2` and `GoPay 02` are not; and on screen, with active `Cafe` and
  `Café`, a `DUPLICATE` for `cafe` marks only `Cafe`.
- **Then** `npm run verify` and `npm run test:e2e:all`, commit, and report as before. Change nothing else.

## Handoff

### What was done

Commit `a1e85ae` on `agent/phase1-s3b` (the Handoff itself is a second commit on the same branch). BO-08 now has a second
`<section>`, *Payment methods*, below the settings part: the count line, the table (caption, headers, Cash and Card as
two fixed rows reading *Always offered* with an empty actions cell, then the custom methods), *New payment method*, the
non-modal method panel, and the methods status. No route, rail entry or page heading changed.

New: `apps/back-office/src/settings/methods.ts` (the pure half: `checkMethodName`, `orderedMethods`, `sameName`,
`upsertMethod`, `methodMeaning`); `apps/back-office/test/methods.test.tsx`, `methods-departure.test.tsx`,
`methods-name.test.ts`, `methods-fixture.test.tsx`; `e2e/tests/payment-methods.spec.ts`.
Changed: `settings/model.ts` (the methods state and commands), `settings/Settings.tsx` (the `Methods` view, the focus
targets, Escape), `settings/copy.ts` (every DESIGN-018 row from *Methods part* to *Method status, session refusal*),
`office.css` (the methods rules ported from `settings.css`, tokens only), `session/api.ts` (the `Exclude` removed, five
functions added to `configApi()`), `session/fixtureSession.ts` (five `unavailable` entries).

### How the methods part sits in the screen model

There is still one model, one `workGuard` registration and one `decision`. `SettingsState` gained `methodsRead`,
`methods` (rows in the server's order; the view sorts), `methodsPartial` (the F4 flag), `methodEditor` and
`methodsPage`. **At most one of `form` (settings) and `methodEditor` is open.** `command` is the one slot for the whole
screen and is now a union (`kind: 'settings'` or `kind: 'method'`); `held` is a union the same way, and `flush()`
dispatches on `kind`. Every opener goes through `leave(next)`, which closes a clean form and asks about a dirty or
uncertain one, and every opener tests `state.command === null`, so all are inert while any command is pending. `dirty`,
`uncertain` and `status` look at whichever form is open, so the guard's status is the open form's. `depart` closes both
forms, flushes a held result, runs the destination, and puts the waiting sentence in the status of the part that sent the
discarded command. The numbering of forms (`formSequence`) is shared, so a command's key names exactly one form on the
screen. The methods list read (`loadMethods`) is `tables/model.ts`'s `load` with its own clock, its own
applied-record map and its own sequence, so a settings read and a methods read never touch each other's state.
A later screen with two parts copies this: one state object, one command slot (a union), one `leave`, one held result.

### Decisions, and on what evidence

1. **`DUPLICATE` presents before its reread, not after.** Ruling 11 lists `DUPLICATE` among the rereads after which the
   gate is rechecked. I followed `tables/model.ts`: the refusal is presented at once and the reread runs behind it
   (`void loadMethods(false)`). Nothing is presented after that await, so there is nothing for the gate to hold, and the
   holder marker is derived at render from whichever rows the list holds, so it appears when the reread lands. The gate
   is already checked in `methodAnswered`, before the refusal is presented. The unknown outcome, which does present after
   a reread, rechecks the gate and the open decision after it (tests in `methods-departure.test.tsx`). If you meant the
   `DUPLICATE` presentation to wait for its reread, say so; it is a small change.
2. **Lengths count code points** with `[...name].length`. The pair test proves `TenderMethodName` does the same: 32 emoji
   is accepted by the schema and 33 refused.
3. **The marker comparison** uses the collator with `sensitivity: 'base'`, as ruling 8 says. That also folds accents
   (`Cafe` and `Café` compare equal), which is wider than the server's `lower(name)` index. The refusal itself always
   comes from the server; only which row is marked could differ. I left it as ruled.
4. **`aria-disabled` and `tabIndex={-1}` on inert openers**, as BO-05 does. The artifact's `disabled` on the row's
   Deactivate is not copied (the project rule says never `disabled`).
5. **New payment method stays in the header in the empty state**, as the artifact draws it (BO-05 moves it into the empty
   block). The empty note is a `<p>` under the table, which still lists Cash and Card.
6. **The `B-1` source guard** in `settings-rate.test.ts` greps every file in `settings/` for `Number(`. My first sort used
   `Number(isActive)` on a boolean and tripped it. I changed my code (`rank()`), not the guard.
7. **`Decision` was not extracted.** BO-08 has one `Decision` and the methods part uses it, so no third copy was added.

### Left out on purpose (ruling 14)

The kitchen-emergency sentences of the departure decision (the built frame has no incident action) and BO-01's
held-draft sentence (S10). `NOT_FOUND` is treated as the general failure with one reread; it is **unreachable today**
because nothing deletes a method. No new copy was invented.

### Tests changed, and why

- `config-api.test.tsx`: the run-time key list now holds the five tender-methods paths (ruling 12); I also added one
  typed-surface case showing the five are on `ConfigApi` and a sixth, `…/delete`, is not.
- `settings-support.tsx`: additions only (the five route keys, four sample methods, helpers), and `openSettings` gained an
  optional third argument and replies to the methods read with an empty list by default. Every existing settings test runs
  against it unchanged.
- Nothing else existing changed. `settings-fixture.test.tsx` and `fixture-session.test.tsx` passed as they are (they do not
  assert the whole page); the fixture-mode methods assertion is the new `methods-fixture.test.tsx`. No assertion was
  weakened or scoped.

### Red proofs (mutation, failure read, reverted)

I wrote the pure helpers and their pair test first and ran it green, then proved it red. The screen's code was written
before its UI tests, so the proof for the UI criteria is the mutation, not a test that failed against missing code.
Each mutation below was applied, the failure read, and reverted; the final tree holds none of them.

1. *Sort with `a.name < b.name`* (criterion 1): `methods-name.test.ts` (2) and `methods.test.tsx` (3) failed, e.g.
   `GoPay 10` before `GoPay 2`.
2. *Withhold the methods part when the settings read fails* (criterion 2): the independence test failed
   (`expected [] to deeply equal ['Cash', 'Card', …]`).
3. *Count with `name.length`* (criterion 3): the 32-emoji pair case and the code-point case failed (`expected 'long' to be null`).
4. *Send `{ id }` on deactivate* (criterion 4): seven tests failed. The transport core's own schema check refuses the
   body, so no request exists and the body assertion fails at `h.keyed(key)[0].body` ("Cannot read properties of
   undefined"), then the status and F4 tests fail because the command was never sent.
5. *Resend the create once after a `DUPLICATE`* (criterion 5): `expected 2 to be 1` on the create count.
6. *Resend the create once after `failed`/`unavailable`* (criterion 6): six tests failed on the create count (2, and 3 on the
   explicit-resend case).
7. *Let the new/edit openers ignore the command slot* (criterion 7): the "every row action is inert" test and the "every
   method opener is inert while a settings save is pending" test failed (a panel and a decision opened).
8. *Plain read-failure copy in the partial state* (criterion 8): both F4 cases failed (`Payment methods could not be loaded…`).
9. *Present while signed out*, in two forms (criterion 9): removing `!gate` from `methodAnswered` failed the M-6 and BO-01
   held-result tests (`Voucher saved.` shown behind M-6); removing the gate recheck after the unknown outcome's reread failed
   the three F2 tests (the result was presented while M-6 or the decision was up).
10. *Leave `deactivate` out of `configApi()`* (criterion 10): the key-list test failed (the path missing).

### Verification

`npm run verify`: typecheck clean; **Test Files 120 passed (120), Tests 4480 passed (4480)** (baseline 116 files, 4367 tests;
+4 files, +113 tests). `npm run test:e2e:all`: **78 passed** (baseline 74; my spec adds M1 and M2 on both engines). I confirmed
the baseline before starting: 116 files, 4367 tests.

### Found and not fixed

- BO-05's `tables/label.ts` still counts UTF-16 units (the queued cleanup; not touched).
- I had no screenshot step, so I did not look at the ported CSS in a browser. `no-invented-values.test.ts` passes (tokens
  only), the e2e cases see the panel and the table, and the structure follows the artifact's markup, but nobody has looked at
  it at 1440×900. The lead may want a visual pass.
- Nothing ran a formatter.

### What the next agent needs

Nothing is blocking. The development database `pos` was not touched.

### Round 2

Commit `f22cee1`. Both findings applied as ruled; nothing else changed. This supersedes decision 3 above (the collator
marker comparison).

**F1, a superseded reread must not claim the list was refreshed.** `loadMethods` in `settings/model.ts` is now a thin
wrapper over the old body (`readMethods`): it records the newest read's promise, and a read that finds itself superseded
(`mine !== methodsReadSequence`) returns that newest promise instead of its own `rows !== null`. If the newest is
superseded in turn it does the same, so the value always describes the list on screen. It sends no request. The gate and
decision recheck after the await is untouched and sits after the final outcome is known, and a held result keeps that
outcome. BO-05's `load` in `tables/model.ts` had the identical defect and got the identical fix (`load` wrapping
`readList`, with `newestRead`); nothing else in BO-05 changed.
*Tests:* `methods-round2.test.tsx` runs the reviewer's rail scenario in both completion orders through an unknown
deactivate (older reread succeeds after the newer visit read fails, so "The list could not be refreshed."; newer succeeds
after the older fails, so "The list has been refreshed."), with one deactivate sent and exactly three methods reads.
**New BO-05 tests:** `tables-round5.test.tsx`, the same pair through an unknown deactivate on Tables, one command, three
list reads. *Red observed against round 1:* all four fail with the opposite sentence (the first expected "could not be
refreshed" and got "has been refreshed"; the second the reverse).

**F2 and L1, the holder marker.** `sameName` is now `a.toLowerCase() === b.toLowerCase()`, with its comment corrected; the
sort keeps the collator. *Tests:* `methods-name.test.ts` gained `QRIS`/`qris` same, and `Cafe`/`Café` and `GoPay 2`/`GoPay 02`
different; `methods-round2.test.tsx` has the on-screen case (active `Cafe` and `Café`, a `DUPLICATE` for `cafe`, only
`Cafe` marked). *Red against round 1:* `sameName('Cafe','Café')` returned true, and the screen showed two markers (expected
1, got 2).

I took the round-1 red by restoring the three source files from `HEAD`, running the new tests (6 failed, 21 passed), then
re-applying my edits by hand. A first attempt to save the changes as a patch file did not write the file, so one verify
run during that step failed on the same six tests before the edits went back in; the final run below is of the final tree.

**Counts.** `npm run verify`: **122 files, 4486 tests passed** (round 1: 120 and 4480; +2 files, +6 tests).
`npm run test:e2e:all`: **78 passed**, unchanged.

DONE
