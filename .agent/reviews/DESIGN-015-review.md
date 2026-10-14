# DESIGN-015 review — round 2 (supersedes round 1)

**Reviewer:** Claude Opus 5.5 (the other family from the Codex and OpenCode
designers).
**Reviewed:** branch `agent/design-015` at `92cc841`. The round-2 design commit
is `0df301a`; I read the diff `b7a5a56..92cc841` (round 1's head to now) against
the lead's *Round 2* rulings, the *Handover*, and the Handoff's *Round 2*
section. Date 2026-10-14.

Round 1's report (eight findings, at `b7a5a56`) is replaced by this one. Its
findings are accounted for under *Cleared* below. The commit `9e20b33` holds
the round-1 text if anyone needs it.

## 1. Verdict

**findings** — two: one medium, one low. Both are new in round 2, and both
are in the M-6 other-manager form.

All eight round-1 findings are closed as the lead ruled. The POS half is still
sound and is clear for PHASE0-011c. The back-office half is close. The medium
finding is one sentence and one trigger in one inventory row, and it should be
fixed before PHASE0-011d places M-6. Nothing else in the back-office half
needs another round.

## 2. Findings

### R2-1 (medium) — the logout cooldown sentence follows the displayed username, so in the other-manager form it tells the other manager that the idled manager's draft is theirs

**Where.** `docs/design/SCREEN-INVENTORY.md:1100` ("Logout during cooldown",
trigger "while the **displayed** account has a wait"); the Handoff's copy table,
the row "M-6 | Logout during cooldown"; the fixture
`docs/design/visual-directions/frost/back-office/shell.js:20-21`, `:41-45` and
`:116`. `logoutCooldown()` keys `remaining()` on whatever is in `#manager`.

**What is wrong.** This is one value shared across two states that hides the
state where it is wrong. The sentence was written for the fixed-username form,
where the displayed account is the idled manager's: "This username is locked
for {wait}. Logging out does not end its cooldown. Other managers can sign in
with their own usernames. Waiting here keeps your draft." Round 2 added a
second form in which the displayed account is the *other* manager's, and kept
the trigger "the displayed account". In that form every clause is wrong:

- The lock it reports belongs to the other manager's account. That account
  has no session, so Log out cannot end its cooldown or leave it running.
- Log out acts on the idled manager's session and discards the idled
  manager's draft. It has nothing to do with the account that is displayed.
- "Waiting here keeps your draft" tells the other manager that the draft is
  theirs to keep. One step earlier the same person was told "The current
  manager's unsaved changes will not be available to you" (`:1092`). That
  promise rests on the owner's ruling (`.agent/DECISIONS.md:113`, "the idled
  manager's draft is not carried over") and on FR-A2b ("never receives that
  state"). The new sentence contradicts it.

**Failing scenario.** Manager A (`m.iqbal`) idles with a draft. Manager B
chooses "Sign in as a different manager", acknowledges, and gets their own
password wrong five times. The form shows `r.ayu`'s cooldown. B presses Log
out. The discard confirmation reads "Log out and discard your changes? …"
followed by "This username is locked for 4 min 50 s. Logging out does not end
its cooldown. Other managers can sign in with their own usernames. Waiting
here keeps your draft." B is told that the lock matters to logging out, and
that by waiting B keeps a draft that is A's. I followed this path by reading
`shell.js`; I did not run it in a browser.

**Proposed fix.** Keep the appended sentence only when the fixed-username form
is showing, and key it to the idled account ("while the idled manager's
account has a wait"). In the other-manager form, append nothing: the plain
discard confirmation is correct there. If the designer wants the discard
confirmation itself to read differently when it is opened from the other form
(its "your changes" is also addressed to the person at the desk), that is the
designer's wording to give. It needs no owner answer, because it promises
neither disposal nor recovery of the draft. Update the Handoff row and the
fixture to match.

### R2-2 (low) — the other-manager form arrives with a username already in it, and keeps the last one typed after Back

**Where.** `shell.js:57-58`: `manager.value = other ? (… otherUsername || 'r.ayu') : idled`,
with `otherUsername` kept when the user goes Back. The inventory row
(`SCREEN-INVENTORY.md:1092`) says only "Editable Username and Password", and
"Back clears the secret".

**What is wrong.** On the first open, the fixture fills the editable Username
with another real-looking manager's username. After Back, it keeps whatever
the last person typed and shows it to the next person who opens the form. The
inventory does not say the field starts empty. A builder who looks at the
artifact sees a prefilled field and nothing in the copy table that says
otherwise. The leftover username is harmless on its own, but it is one
manager's identity left on screen for the next person at a shared desk.

**Proposed fix.** Add "Username starts empty each time the form opens" to the
row, and make Back clear the username as well as the secret. Keep `r.ayu`
only as a sample the fixture types into the field, not as the field's
starting value.

## 3. What I ran and what I did not

**Ran and observed.**

- `npm run verify` at `92cc841`: exit 0, typecheck clean, **70 test files and
  3,365 tests passed**, matching the Handoff. As in round 1, this suite
  touches nothing under `docs/design/`. It shows that nothing outside the
  design tree broke. It says nothing about the screens.
- Tree stability: `git status --porcelain` was empty and `HEAD` was
  `92cc841` before and after the verify run. The only file I wrote is this
  report.
- The acceptance scan `grep -rniE "attempts? remaining|deactivated|installation-wide" docs/design docs/DESIGN.md`,
  with round 1's stale phrases added ("To sign in as someone else", "alias of
  the same", the old BO-01 "Sign-in locked" title). It returned the same
  fifteen historical hits the Handoff lists (Paper, tables, presets, audit
  actors), plus nothing for the added phrases.
- Read the round-2 diff of every changed file: `DESIGN.md`,
  `SCREEN-INVENTORY.md`, `SITEMAP.md`, the BO-01 wireframe, `lock.js`,
  `mockup.js`, `manifest.js`, `shell.html`, `design012.cjs`, and all of
  `shell.js`. Also read the server's logout route
  (`apps/server/src/http/routes/back-office-auth.ts:81-87`, session
  `OPTIONAL`, always 204) and `access.ts`. I wanted to know whether a failed
  logout can loop on `UNAUTHENTICATED` under the new row. It cannot.

**Did not run.**

- **No browser run.** The *Handover* makes each browser run the owner's to
  approve, and none was approved for this review. The designer reports
  `design012.cjs` at **266 checks passed**, with no errors and no failures.
  I have not reproduced that. What I say about artifact behaviour, R2-1's
  scenario included, comes from reading the scripts.
- No mutation run.

**About the Handoff.** The dispatch asked me to update the task file's
Handoff and end it with DONE or BLOCKED. The reviewer role
(`.agent/roles/reviewer.md`) says to write only this report and never to edit
the task file. I followed the role and left the Handoff alone. Its last line
is already `DONE`, written by designer15b. If the lead wants a reviewer line
in the Handoff, the lead can add it.

## 4. Cleared

Round 1's findings, each against the lead's ruling for it:

- **F1 (M-6 other-manager choice): closed.** All eight items of *What M-6 must
  show* are met:
  - the fixed-username default;
  - "Sign in as a different manager" in every interactive same-manager state,
    including cooldown, disabled only while a request is pending (`shell.js:65`);
  - an editable form that sends an ordinary sign-in, with BO-01's copy, whose
    failures count on the submitted account;
  - Back, with draft, snapshot and waits intact;
  - an acknowledgement whose initial focus is "Stay with current manager",
    before any credential can be entered;
  - Log out kept;
  - the old sentence gone, and the throttled sentence naming both exits;
  - `reauth-other` redrawn, with `design012.cjs` changed to match.

  Both passages that cited the 2026-10-06 ruling for the Log-out-only route
  are replaced, and the inventory now cites the ruling for the choice.
- **F1's and F4's owner questions:** drawn around as ruled. Nothing promises
  that the draft is destroyed or restored. The acknowledgement, the separate
  working area (`other-signed-in`, which hides the old work without
  simulating its storage) and the deferred BO-01 sentence avoid both answers.
  Both questions are listed in the inventory and under the Handoff's
  *Questions*.
- **F2 (local format checks): closed.** The format and length rows are gone.
  Local checks are now exactly the shared schema: non-empty, and at most 256
  and 1024 UTF-16 units (`packages/contracts/src/auth.ts:26-31`). Oversize
  input reuses *error*, sends no request and truncates nothing. The inventory
  says outright that the domain's 3–32 and 8–128 rules are not to be copied,
  and that a seven-character password must reach verification. The fixture
  measures length in UTF-16 units (`shell.js:128`). The "shared-schema check"
  attribution is gone.
- **F3 (operations without a secret): closed.** There are now three rows:
  - Lookup: the sign-in shell with its controls disabled, and Try again
    repeats the lookup.
  - Back-office Log out: stay in the frame with the notice first in the
    content pane, show "Sign-out has not been confirmed.", Try again repeats
    the logout, and BO-01 appears only after the server confirms.
  - POS Release: POS-01 every time, with no notice and no retry, as ARCH-014
    question 5 binds.

  The server's logout route answers 204 to any session, so this row cannot
  loop.
- **F4 (retained-draft sentence): closed.** It is marked not placed in Phase
  0. Its deferred wording names the previous session, not the reader, and
  promises neither restoration nor disposal.
- **F5 (incident destination): closed.** `lock.js:26` sends the `incident`
  confirmation to `incidents.html` for both lock artifacts. The dead lines in
  `mockup.js` are removed.
- **F6 (duration): closed.** Zero parts are omitted. A supplied zero, or a
  countdown that reaches zero, ends the cooldown without submitting
  anything. The fixture's `wait()` (`shell.js:36`) matches.
- **F7 (BO-01 throttled title): closed.** "This username is locked for
  {wait}". The username-editing rule compares trimmed, lower-cased usernames,
  restores the original wait on return, and never resets it. This matches the
  server's normalisation (`back-office-credential.ts:25-30`).
- **F8 (SITEMAP): closed.** `SITEMAP.md:108` reads "Session ended — sign in
  again".

Also checked in round 2:

- **Per-account counting in the fixture.** Failures are kept per normalised
  username. A cooldown on the other account leaves the idled manager free.
  The count returns to zero when a cooldown ends, as FR-A5b says. The page
  says this is a simulated server response, and production clients count
  nothing.
- **No new token, value, route or contract change.** The diff touches only
  owned design paths and the task file.
- **The POS half** is unchanged since round 1 apart from F5, and it remains
  clear for PHASE0-011c.
