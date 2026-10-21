# DESIGN-017 review — BO-05 Tables (slice E1), round 2

Reviewer: Claude (Opus 5.5), 2026-10-21. Branch `agent/design-017` at `dbf371e`, in the worktree
`restaurant-pos-wt/DESIGN-017`. Round 1 reviewed `026ef6e` and reported ten findings, F1 to F10. This round checks
each of them against the lead's rulings (task file, *Round 2 — the review's ten findings*, `:207-253`) and the
designer's *Round 2* Handoff (`:718-798`), and looks for anything the fixes broke. The round 2 change is `fe6931e`,
read as `git diff 026ef6e..HEAD`.

Authorities used, as in round 1: the task file; consult C2 (`.agent/reviews/ARCH-019-first-back-office-form.md`), §3,
§4, §6 and §7; `docs/DESIGN.md`'s configuration-forms section (`:1484` onwards); `docs/design/SITEMAP.md` §1; and the
built M-6 copy in `apps/back-office/src/copy.ts:46-71`.

## 1. Verdict

**findings.** All ten round 1 findings are resolved as the lead ruled. Three new findings come from the fixes: one of
medium severity and two of low severity. There are also two cosmetic notes. The medium finding concerns identity: a
command still in flight crosses a different manager's sign-in. Nothing breaks a boundary as written, and nothing in
the round 1 *Cleared* list has regressed.

## 2. Round 1 findings, rechecked

| Finding | Lead's ruling | What I found at `dbf371e` | Status |
|---|---|---|---|
| F1 status panel resent the command | No form for Deactivate or Reactivate; the page status names the command; unknown shown in the page status; the row action is the only path; the rule goes in `D` | `changeStatus` → `send` (`F/tables.js:110-133`) opens no panel. Pending disables the row action and focuses `#table-status`, which reads "Deactivating {label}…". Unknown rereads once and shows "{label}: the outcome could not be confirmed. The list has been refreshed. Nothing was sent again." (`:73`, `:79-80`). No Save exists for status commands. `D` has a *Status commands* paragraph. The copy table has rows at `:390-393` | Resolved |
| F2 copy table contradicted built M-6 | Reproduce the built titles, bodies and actions verbatim; the top-bar Log out reuses the built confirmation | The acknowledgement and the other-manager form use `CHOOSE_OTHER_*` and `OTHER_*` word for word (`F/tables.js:185`, `:188`, compared with `copy.ts:50-56`). Log out from the top bar and from M-6 uses `DISCARD_TITLE`/`DISCARD_BODY` with "Keep this draft" / "Discard changes and log out" (`:141-143`, compared with `copy.ts:62-64` and `F/shell.html:53`). Log out is hidden in the acknowledgement, as `F/shell.js:73` hides it. The pending/unknown sentence is a separate paragraph (`tables.html`, `#departure-uncertain`) | Resolved |
| F3 Discard dropped the answer | A late answer still updates the list silently | `closeForm` marks the in-flight command `discarded` (`:44`). `finish` applies it with `silent` (`:93-94`, `:61`). A held answer is flushed after Discard (`:137`, `:155`). `D` *Departure* states it | Resolved (but see N2) |
| F4 invented unknown on a session change | Delete the state and the answer-dropping; settle by C2 §6 | `generation` is gone. `finish` holds an answer while the session is not active (`:91`), and `resume` flushes it (`:170`). `SESSION_IDLE` clears pending and keeps the draft with no reread (`:87-89`). The copy row is removed. `D` *Command results* states it | Resolved for the same manager (see N1 for a different manager) |
| F5 33-unit label | 32 units; `invalid-long` exactly 33; a length assertion | `grep -noE "'Terrace [A-Z]{24}'"` matches `F/tables.js:6`, so the label is 8 + 24 = 32 units. `invalid-long` is that label plus `Z`, 33 units. `design017.cjs` asserts length 32 at both sizes, saves the unchanged label, and asserts 33 for `invalid-long` | Resolved |
| F6 stale page result | Cleared when a form opens or a command is sent; `#phase-note` with it | `clearStatus()` (`:17`) is called by `openForm` (`:37`) and `send` (`:111`), and it hides `#phase-note`. `D` states it | Resolved (but see N3) |
| F7 undefined sitemap tags | Existing tags only | `SITEMAP.md:271-273` use `[INLINE]` throughout, plus a dated note at `:47-50` | Resolved (one cosmetic note) |
| F8 dismiss-only Try again; "ask a manager" | Remove the button; write a body for a signed-in manager; leave `I:88` alone | The button is gone (`notice()`, `:18`). The body reads "Nothing was saved. Your draft is kept. Press Save to try again." (`:10`). `I:88` is unchanged. The read failure's real Try again remains | Resolved |
| F9 focus unspecified or lost | Pending on a focusable status; failure and unknown on the label; Discard to the opener; no double `closeForm` | `#form-notice` and `#table-status` have `tabindex="-1"` and receive focus while pending (`:114`, `:116`). Failure and unknown focus the label (`:83`, `:100`). The departure actions no longer call `closeForm`; `depart()` closes once (`:137`) and `focusOpener` falls back correctly (`:35`). `D` states it | Resolved |
| F10 (1) to (4) | Inert while pending, live after unknown; reconcile `D:1471`; suppress the business day; a text marker for the holder | (1) New table is `aria-disabled` with tabindex −1, row Edit buttons are `aria-disabled`, toggles are `disabled`, and the click handlers return while pending (`:24`, `:31`, `:194-195`). After unknown they are live, and another record goes through the departure decision. `D` *Command results* says exactly this. (2) `D:1470-1476` now points to the configuration-form rule. (3) `$('.office-day')?.remove()` (`:9`). (4) A visible "Label in use" span sits in the holder's cell (`:31`), with no underline (`tables.css`) | Resolved |

The new CSS uses only tokens that exist (`--frost-weight-regular`, `--frost-unavailable`, `--frost-unavailable-text`,
`--frost-disabled-border`, `--frost-text-12`, `--frost-space-1`, `--frost-muted`; each is defined under
`docs/design/tokens/`). The check script's changes add assertions and adapt two to the new button names ("Keep this
draft" for logout; the departure body region for the extra paragraph). I found none weakened. The only removed
assertion is the dismiss-only Try again test, which F8 required to go and which is replaced by a stronger one.

## 3. New findings

### N1 (medium) — A command in flight crosses a different manager's sign-in

**Where.** `F/tables.js:176` (`resume(false)`). It closes the form, which marks a *form* command `discarded`, then calls
`clearStatus()` and `flushAnswer()`. It never resets `pending` or `inFlight`, and a status command (whose `snapshot` has
`editor:null`, `:50`) is never marked discarded. The answer then arrives in `finish` (`:85-107`) with the session
active, and it is announced.

**What is wrong.** Removing the answer-dropping (F4) was right for the same manager. But the fixture still keeps one
`pending` flag and one `inFlight` command across both identities, so manager B's fresh working area inherits manager
A's command:

- While A's answer is outstanding, B's page has New table and every row action inert, and no status says why.
- If A's command was a status command, its result is then announced to B in the page status ("Table 2 deactivated. It
  is kept for history.") and focus moves to that row's Edit.

**Authority.** C2 §7: "A different manager's sign-in destroys it with the working-area key" (ADR-011 rule 22), and the
owner's draft rulings as the task quotes them ("a different manager destroys it"). The Handoff's own claim (`:767`):
"A different manager still destroys the prior editor state."

**Failing scenario.** On `?state=default`, choose "Keep pending" and press "Deactivate Table 2". Press Alt+I, choose
*Sign in as a different manager*, then *Continue to sign-in*, then sign in as `r.ayu`. Ratna Ayu's Tables page has New
table and every row action inert, with no explanation, for as long as A's answer is outstanding (indefinitely with
"Keep pending"). Now choose "Saved" and press *Finish pending command*. The page announces "Table 2 deactivated. It is
kept for history." to Ratna Ayu and moves her focus. A form save gives the same inert page; its answer is then applied
silently. `design017.cjs`'s F4 loop exercises only the same manager, so the green run does not reach this. In S1b
the keyed tree is replaced, so building from this fixture would mean carrying presentation state across the key.

**Proposed fix.** In `resume(false)`, mark any in-flight command `discarded`, whatever its kind, and start B's area
with `pending=false` and no `inFlight`. A late answer may then update the shared list silently, or be ignored, since
B's real area reads the list afresh. Add one sentence to `D`'s modal-dialog paragraph: a different manager's area
starts with no pending command, and the previous manager's command is never announced or focused in it. Add the
different-manager case to the F4 loop in `design017.cjs`.

### N2 (low) — After Discard during a pending save, the page goes inert with no words

**Where.** `F/tables.js:137` and `:155`. Discard closes the form, which carried the "Saving…" notice, while `pending`
stays true until the answer arrives (correctly, by F3 and F10(1)). `send` cleared the page status (`:111`), and
nothing replaces it. `D` *Command results* says "An inert Edit opener may receive programmatic focus after Discard,
but cannot start another command until the pending one settles". The copy table has no row for this state.

**What is wrong.** This is a state the fixes created, and it has no copy. The list is shown with every control
dashed and inert, and nothing tells the manager that an earlier save is still outstanding. A real command can wait up
to its timeout and the health read before settling. Under ADR-011 rule 24 S1b cannot invent the words, so as drawn it
would show nothing.

**Failing scenario.** On `?state=rename`, type, choose "Keep pending", press Save, Cancel, then Discard. The page shows
the table with New table and all row actions inert, no notice, and focus on an `aria-disabled` Edit.

**Proposed fix.** Keep a page status while a discarded save is outstanding, for example "Waiting for an earlier save
of {label} to finish. Nothing will be sent again." Clear it when the answer settles, silently, as F3 requires. Add the
row to the copy table and the sentence to `D`.

### N3 (low) — A status command refused `SESSION_IDLE` leaves "Deactivating {label}…" on screen

**Where.** `F/tables.js:87-89`. For `idle` and `ended` answers, `finish` clears `pending` and the form notice but not
`#table-status`. After resumption, `resume(true)` (`:173`) lands on `default` with the stale text still visible. `D`'s
*Status commands* paragraph covers pending, unknown, definite failure and success, but not a session refusal.

**What is wrong.** C2 §6's `SESSION_IDLE` row is a definite "not applied". For a form the draft carries the
recovery. A status command has no draft, so the only signal is the page status, and it still says the command is in
progress.

**Failing scenario.** On `?state=default`, choose "Session idle" and press "Deactivate Table 2". M-6 opens. Resume as
m.iqbal. The page shows "Deactivating Table 2…" over an Active row, with no command pending.

**Proposed fix.** On a session refusal of a status command, show the existing definite-failure sentence "Something
went wrong. {label} was not changed. Use its row action to try again." after resumption, or clear the status.
State this in `D`'s *Status commands* paragraph.

### Cosmetic

- `SITEMAP.md:47`: the dated BO-05 note has no blank line before it, so in rendered Markdown it runs into the
  previous paragraph about the line-editor sheet.
- With a kitchen emergency, the logout decision's emergency sentence still reads "Decide whether to stay or discard
  before opening print incidents." (`tables.html`, `#departure-emergency`), while its buttons are now "Keep this draft"
  / "Discard changes and log out". A per-reason sentence would match the buttons.

## 4. What I ran and what I did not

**Observed.**

- `git status --porcelain` was empty before and after my runs, and `git rev-parse HEAD` returned
  `dbf371e2fffb98498f5efacb732ff8f910215c12`. The tree did not move during the review.
- `git diff --stat 026ef6e..HEAD`: eight paths. The review report, the task file, `docs/DESIGN.md`,
  `docs/design/SITEMAP.md`, `design017.cjs`, and `F/tables.css`, `F/tables.html`, `F/tables.js`. Nothing under
  `apps/`, `packages/`, `db/`, `e2e/` or the tokens.
- `npm run verify`: typecheck passed; **94 test files, 3,753 tests passed**. The only warning was the existing Vite
  native-config warning.
- `grep -noE "'Terrace [A-Z]{24}'"` matched `F/tables.js:6`, which confirms the 32-unit label.
- Every custom property the round 2 CSS adds is defined under `docs/design/tokens/`.
- The F2 comparison is a direct read of `apps/back-office/src/copy.ts:46-71`, `F/shell.js:67-73` and
  `F/shell.html:50-53` against `F/tables.js` and the copy table.

**Not run.**

- **No browser check.** As instructed, I did not try. The lead's results on this tree (`design017.cjs` 305/305,
  `design016.cjs` 399/399, `design014.cjs` 288/288, `design013.cjs` and `design012.cjs` clean) are the lead's; I
  quote them and have not observed them.
- **No mutation run.** N1, N2 and N3 are traced from the source by following `pending`, `inFlight`, `discarded`,
  `settledResponse` and `#table-status` through `send`, `finish`, `closeForm`, `depart` and `resume`. I have not
  executed them. Each scenario names the fixture controls that reproduce it in a browser.
- I did not edit the task file or its Handoff. My role prompt limits me to this report. The lead's request to update
  the Handoff is answered here instead, and this report ends with the required last line.

## 5. Cleared

The round 1 *Cleared* items still hold at `dbf371e`: no seats, area, current order or timestamps; B-24's empty
starting state; the non-modal panel with Log out, the rail and the incident actions live; C2 §7's modal-dialog rule in
`D` and in the `bo01-decision` and `reauth-decision` walks; C2 §4's label rules, now drawn at the true 32-unit boundary;
the reactivation-refusal recovery, which now reopens the inactive record's editable label from a status command
(`duplicate()` → `openForm`, `:68`); no confirmation for status commands; `DUPLICATE`, `NOT_FOUND` and
`VALIDATION_FAILED` handling; the unknown outcome for forms; subject-correct walks and derived counts; the marked
Phase 2 refusal; Part C's links and manifest (37 states, unchanged); the BO-01 held-draft copy; and no `beforeunload`.

DONE
