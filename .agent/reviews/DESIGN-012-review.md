# DESIGN-012 review — back-office shell, global alerts, M-6 and shared patterns

**Reviewer:** Claude Opus 5.5 (the designers were Codex and OpenCode on `gpt-6-astra`).
**Round 2 reviewed:** branch `agent/design-012` at `8c256ba` (fix commit `9931a8f`), diffed
against the round-1 commit `b0ee42f`.
**Round 1 reviewed:** `b0ee42f` against `development`.
**Date:** 2026-10-06.

## 1. Verdict

**findings** — all nine round-1 findings are **closed**. Round 2 leaves three new findings, all
low, none of which I would hold the task for. No boundary in `docs/BOUNDARIES.md` is broken, and
round 2 touched nothing outside `docs/design/`, `docs/DESIGN.md` and the task file.

I did not run a browser in either round. Where a closure depends on rendered behaviour, I say
whose observation it rests on: the lead's (F2, and the round-1 confirmation of F6) or the
designer's round-2 check run as reported in the Handoff (F3, F6, and the walks). My own evidence
is the committed source, `npm run verify`, and the static checks listed in section 4.

## 2. Round-1 findings, re-reviewed

| # | Round-1 finding (severity then) | Round 2 | Basis |
|---|---|---|---|
| F1 | A pending or unknown command silently cancelled every link in the frame, including the kitchen banner's action and *Log out* (high) | **Closed** | Read in source |
| F2 | M-6 stayed open on *Escape* only through one cancelable event (medium, inferred; the lead confirmed it and raised it to high) | **Closed** | Source, plus the lead's Chrome confirmation |
| F3 | The long dialog's body could not be scrolled from the keyboard (medium, inferred) | **Closed** | Source; the scroll itself is the designer's observation |
| F4 | `reauth-other` told a guesser the password was valid for another manager, and counted toward the lockout (medium) | **Closed**; one owner question remains | Read in source |
| F5 | Logging out during the lockout discarded the draft without saying that sign-in was locked too (low) | **Closed** | Read in source |
| F6 | Rows were visible above the sticky table header (low, inferred; the lead confirmed it) | **Closed** | Source; the rendered result is the designer's observation |
| F7 | Focus and selection were restored exactly only on the `Alt+I` path (low) | **Closed** | Read in source |
| F8 | `docs/DESIGN.md` contradicted its own supplement (low) | **Closed** | Read in source |
| F9 | Six smaller items (low) | **Closed**, all six | Read in source |

**F1.** `patterns.js:89` now routes every link through `leave()` whenever the form is dirty or
busy, and `leave()` (`:87`) opens the decision in both cases. `leaveCopy()` (`:81–86`) says, when
busy, that the save "may or may not have succeeded" and that leaving "does not send it again",
and relabels the action *Leave without resending*. *Leave this sample* is no longer disabled
while busy (`:43`). If the result arrives while the decision is open, `command()` updates the
copy instead of the URL state (`:41`, `:54`), so the dialog does not go on describing an
uncertainty that has ended. The check's old assertion that navigation is blocked is gone;
`design012.cjs:83–91` walks both states against all four destinations. `docs/DESIGN.md` states
the rule.

**F2.** Three independent defences are now in place: `closedby="none"` on the dialog
(`shell.html:33`), a capturing `keydown` handler that cancels *Escape* while M-6 is open
(`shell.js:82`), and a `close` listener that reopens the dialog while `reauthRequired` is true
(`shell.js:83`). `reauthRequired` is cleared only on success (`:59`) and on confirmed logout
(`:102`). The check now presses *Escape* four times on a direct load before any other input,
four times after `Alt+I`, and closes the dialog from script to prove the guard
(`design012.cjs:36–39`, `:43`). The lead reports five *Escape* presses leave M-6 open in Chrome.

**F3.** `office.js:65–67` makes an overflowing `.office-dialog__body` focusable, gives it
`role="region"` and names it by the dialog title, and removes all three when the body fits. The
focus loop's selector already includes `[tabindex="0"]`, so the region is in the loop. The check
reaches it with `Shift+Tab` from *Close*, presses *Page Down* and waits for `scrollTop` to
increase (`design012.cjs:77–79`). That the key scrolls is the designer's reported result.

**F4.** The disclosing string is deleted. Both refusals render `credentialCopy.wrong`
(`shell.js:53`); `reauth-other` survives as a named state with a visible reviewer's note
(`shell.html:41`); only a wrong secret increments the counter (`shell.js:94`). The check asserts
the two messages are identical (`design012.cjs:53`). Whether another manager's valid credential
counts as a `LOGIN` failure is listed in the Handoff as the owner's, with Q4. That question is
open by ruling, not by omission.

**F5.** `logoutCooldown()` (`shell.js:31–35`) puts the remaining time, "installation-wide", and
"Waiting here keeps your draft" into the confirmation whenever a cooldown is running, and the
running interval keeps it current. The round-1 edge where an expiring cooldown re-rendered M-6
underneath an open confirmation is also fixed (`:40`).

**F6.** The header now uses `top: calc(-1 * var(--frost-office-content-padding))`
(`office.css:85`), an existing token and no raw value. The check asserts the header at y = 64 and
that the element at (300, 65) is a header cell, and captures the state after scrolling
(`design012.cjs:95`).

**F7.** `remember()` (`shell.js:23–26`) records whatever element is active, with its selection
when it has one, and runs once per timeout (`:28`), so returning from the logout confirmation
does not overwrite it with the *Keep this draft* button. The check restores focus to the
*Simulate* button, a navigation link and *Log out* (`design012.cjs:54–60`).

**F8.** The token count (frontmatter and `:495–503`), the form-controls passage (`:1270–1273`)
and the coverage passage (`:1297–1302`) are corrected in place and marked as updated by
DESIGN-012; the two sentences in the supplement that pointed back at stale text are removed.

**F9.**

1. The accessible name starts with the visible text: "View sample: Sample 13"
   (`patterns.js:16`).
2. A read-only form no longer becomes dirty (`patterns.js:7`, `:66`).
3. The incident's title and identity come from `Office.kitchenIncident` in both places
   (`office.js:38`, `shell.js:20–21`).
4. Closing a dialog restores the state it was opened from (`patterns.js:8`, `:22`, `:70`, `:75`,
   `:78`, `:90`); plain navigation away from the shell draft is a new, registered state `unsaved`
   and declining it restores the prior state and focus (`shell.js:68`, `:79`, `:100`, `:109`;
   `manifest.js`). Shell and manifest agree at 13 states.
5. The Handoff states that `alerts` takes precedence over a named alert state.
6. The *All screens* link follows the page's own direction (`mockup.js:60`); both Paper
   back-office pages declare `data-direction="paper"`, and round 2 changed no file under
   `paper/`.

## 3. New findings in round 2

### N1 (low, inferred) — The logout confirmation reached from M-6 has no close guard of its own

**Location:** `frost/back-office/shell.js:83–84`.

**What is wrong.** The reopening guard listens on `#reauth-dialog` only. While the confirmation
is open over a required re-authentication, M-6 is closed and `#logout-dialog` is the only thing
between the keyboard and the draft. It has no `closedby`, and its protection is a `cancel`
handler that clicks *Keep this draft*. My reading is that this is safe: the `cancel` event fires
even when Chrome will not let it be cancelled, so the handler still returns the user to M-6.
That is the same class of reasoning that was wrong about M-6 in round 1, and neither the lead's
five presses nor the check exercise it, since both test `#reauth-dialog`.

**Authority.** Task Part B, `reauth`: "*Escape* does not dismiss it"; FR-A2b.

**Failing scenario, if my reading is wrong.** Open `shell.html?state=reauth-logout` directly and
press *Escape* repeatedly. If the confirmation ever closes without the handler running, the draft
is live with no dialog over it.

**Proposed fix.** Add a `close` listener on `#logout-dialog` that calls `start()` whenever
`reauthRequired` is true and neither dialog is open, and add that key sequence to the check. This
costs two lines and removes the inference.

### N2 (low) — The new rule in `docs/DESIGN.md` is broader than what is drawn

**Location:** `docs/DESIGN.md`, DESIGN-012 supplement, "No page state makes the kitchen action,
receipt chip or Log out inert"; `frost/back-office/shell.js:77`.

**What is wrong.** The rule is the right one and I asked for it. As worded, though, a slice
designer could read it against the two modal cases this task draws on purpose. Under M-6 the
banner behind the scrim is inert and the in-dialog copy offers a queued action instead; in the
logout confirmation the repeated emergency has its action removed (`shell.js:77`) and offers
none. Both are defensible, and the Handoff argues the first. The document should say so, or the
next slice will either break the rule or think this one did.

**Authority.** FR-E3; task Part B, `reauth-kitchen` ("argue it in the Handoff").

**Proposed fix.** One sentence after the rule: while a modal decision is open, the emergency is
repeated inside it and its action is deferred until the decision is made; no other state may
defer it.

### N3 (low) — Two countdowns announce themselves every second

**Location:** `frost/back-office/shell.html:42` and `:49`; `shell.js:34`, `:38`, `:56`.

**What is wrong.** `#cooldown` and the new `#logout-cooldown` are `role="status"` and have their
text replaced once a second for five minutes, so a screen reader re-reads the whole sentence
each time. `#cooldown` was present in round 1 and I did not raise it then; round 2 adds the
second one, and this is the pattern BO-01's throttle will copy.

**Authority.** `docs/DESIGN.md` item 9 of the unreviewed list already records that
assistive-technology checks have not been done; this is a note for that pass, not a contract
breach.

**Proposed fix.** Announce the lockout once, and put the ticking time in an element that is not
a live region (or update the live text once a minute).

One smaller observation, not a finding: after a direct load of `?state=row-detail&return=…`,
`showDetail()` rewrites the `return` parameter before the requested value is applied
(`patterns.js:26`, `:117`), so a second reload forgets it. It affects only the review fixture.

## 4. What I ran and what I did not

**Observed, round 2.**

- `npm run verify` at `8c256ba`: typecheck clean, **45 test files and 2,737 tests passed**, with
  Vite's existing `configLoader: 'native'` warning and nothing else.
- The tree did not move: `git status --short` was empty before and after the verify run, and
  `git rev-parse HEAD` returned `8c256bacd633c650ff9147106bca2c95fe7a82ae`.
- `grep -c "prototype/"`: `menu.html` **40**, `report-detail.html` **11**, `shell.html` 1,
  `patterns.html` 0, unchanged from round 1.
- `git diff --stat b0ee42f HEAD` over `paper/`, `docs/design/tokens/`, `apps/`, `packages/`,
  `db/`, the four product documents, `SITEMAP.md` and `SCREEN-INVENTORY.md` is empty.
- I read the current `office.js`, `patterns.js`, `shell.js`, `shell.html` and `design012.cjs` in
  full, and the round-2 diff of `office.css`, `manifest.js`, `mockup.js`, `docs/DESIGN.md` and
  the task file.

**Not run, and why.**

- **No browser, in either round.** Each run of the check needs the owner's approval and both
  sessions were unattended. The Handoff's "216 of 216 assertions across 47 states", every
  measurement in it, and the four captures it says were inspected are the designer's report. I
  confirmed that the check script contains assertions for each closure I credit to it; I did not
  see them pass.
- **No evidence captures.** `/tmp/design012-evidence/round2/` is outside the directories this
  session may read.
- **No mutation run.** Nothing was re-proven by mutating code.
- I did not re-read the cited product documents in round 2; nothing in the round-2 diff changes
  which requirement applies.

**Round 1, for the record.** Verify was green with the same counts at `b0ee42f`. Three of the
nine findings (F2, F3, F6) were inferred from source without a browser; the lead later confirmed
F2 and F6 in Chrome. A librarian query in round 1 could reach only MDN and confirmed only that
`closedby="none"` exists.

## 5. Cleared

- **Boundaries and scope.** Still no POS operation, PIN pad, approval wording, SSO, success
  green or dark mode. Neither alert can be dismissed and nothing implies that opening BO-13
  clears an incident (FR-E3, B-15). Whole rupiah, 24-hour times.
- **Tokens.** Round 2 adds none. The sticky offset composes an existing token; `office.css`
  still holds no literal pixel value.
- **State registration.** Shell 13, patterns 20, menu 10, report detail 4: 47 states, matching
  the manifest. The new `unsaved` shell state is reachable directly and returns to `none`.
- **M-6 behaviour around the new guards.** Success, confirmed logout and the queued incident
  route all clear or respect `reauthRequired` in the right order, so the reopening guard does not
  fight a legitimate close. The lockout survives *Keep this draft*, and an expired lockout
  returns to the resting state.
- **Uncertain-save decision.** *Stay* restores `pending` or `unknown` with *Save* still
  disabled; a refusal arriving while the decision is open turns it back into an ordinary discard
  decision; a confirmed save turns it into a plain leave.
- **Handoff.** The Round 2 section maps each finding to its change, names what the second
  designer inherited, lists the open Q4 counting question, and corrects the round-1 statements
  the fixes made untrue.

DONE
