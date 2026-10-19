# DESIGN-016 review — BO-01 Login and BO-02 Today (slice B)

**Reviewer:** Claude Opus 5.5, reviewing work built by Codex `gpt-6-astra` (design016) and finished by an OpenCode
`gpt-6-astra` stand-in (design016b).
**Branch:** `agent/design-016` at `3ec72c9`, against `development` at `82876b4`. 23 files changed, 959 insertions, 24
deletions.
**Date:** 2026-10-19.

## 1. Verdict

**findings** — two medium and three low. None of them breaks a boundary, and the slice is close to clean. However, the
frontend task will be written from these artifacts, and both medium findings would carry a defect into it: the first
contradicts a layout decision the Handoff records, and the second contradicts the reviewed copy specification and the
provisional build.

I could not run the four browser checks or `node --check`: this unattended session refuses both commands for want of the
owner's approval (see section 3). The findings below come from reading the cascade and the scripts, not from a browser.
Each one says which.

## 2. Findings

### F1 (medium) — the wide-window centring does not reach the Frost menu and report pages

**Location:** `docs/design/visual-directions/frost/back-office/office.css:16` (the new `margin-inline: auto` on `.bo`),
together with `office.css:15` (`.device.device--bo { width: var(--frost-office-width); … }`) and the wrappers at
`frost/back-office/menu.html:17` and `frost/back-office/report-detail.html:15`.

**What is wrong.** The slice decides that wider than 1440px the signed-in frame stays 1440px wide and is centred, and the
Handoff says *"This placement rule applies to all consumers of `office.css`"*. The rule centres `.bo` inside its
parent. On `today.html`, `shell.html`, `patterns.html`, `incidents.html` and `audit.html`, `.bo` is a child of `body`,
so it centres. On `menu.html` and `report-detail.html`, `.bo` sits inside `.devicewrap > .device.device--bo`, and
`office.css:15` fixes that `.device` at exactly 1440px with no inline margin. `structure.css:58-60`, `visual.css:56-59`
and `office.css:14` add no centring either. Inside a 1440px parent, `margin-inline: auto` resolves to zero. Those two
Frost frames therefore stay pinned to the left edge on a wide window, while the other five centre. The single shared rule
hides the state where it is wrong, because `design016.cjs:47-49` measures the frame only on `today.html?state=incident`.

**Authority.** The task's Part A item 3, *Beyond 1440px* (*"for BO-01 and for the signed-in frame alike"*), and
acceptance criterion 7 (*"the chosen wide-window behaviour at 1920"*). The Handoff's own claim is the decision being
contradicted.

**Failing scenario.** Open `frost/back-office/menu.html` at 1920×1080. By the cascade, `.bo` sits at x = 0, the 480px of
canvas all falls on the right, and the frame does not match `today.html`, which sits at x = 240 at the same size. The
same holds for `report-detail.html`. I inferred this from the stylesheets. I did not measure it in a browser.

**Proposed fix.** Give `.device.device--bo` in `office.css:15` `margin-inline: auto`, or move the centring onto the
outermost frame element for both page shapes. Then extend the frame-geometry assertion in `design016.cjs` to
`menu.html` and `report-detail.html` at 1920, so that the decision is measured on every consumer the Handoff names.

### F2 (medium) — local validation is drawn as a single-field state and trims the username

**Location:** `docs/design/visual-directions/frost/back-office/login.js:34` (one `invalid-<field>` state marks exactly
one field), `login.js:57-60` (the first failing test wins, and the username test is `!username.value.trim()`), and the
assertion at `docs/design/checks/design016.cjs:66`.

**What is wrong.** There are two related problems.

1. The artifact's state is one string, so it can only mark one field as invalid at a time. Pressing Sign in on a blank
   form is the most common local failure. In that case the artifact shows *"Enter your username."* only, and Password
   carries no message and no `aria-invalid`. The same applies to oversize input: a username and a password both over
   their bounds produce only the username's state. The reviewed copy places each message "beside its field" and says to
   "focus the first invalid field". That only makes sense if more than one field can be invalid at once. The provisional
   build already does this correctly: `apps/back-office/src/SignIn.tsx:101-108` marks both missing fields and focuses
   the first, and `:110-117` does the same for oversize.
2. A username made only of spaces is treated as missing, so no request is sent. The inventory says the office sign-in
   validates only the shared request shape (*"nonempty strings … A nonempty credential within those bounds goes to the
   server"*), and the contract schema is `username: z.string().min(1).max(256)` with no trim
   (`packages/contracts/src/auth.ts:27`). The build tests `user === ''` (`SignIn.tsx:102`). Trimming belongs to the
   cooldown account key (`I:602`), not to emptiness.

The check confirms the narrow behaviour rather than catching it: `design016.cjs:66` asserts that the username error is
visible and Username is focused after a blank submit, and never looks at Password.

**Authority.** `docs/design/SCREEN-INVENTORY.md:598` (local invalid input), `:599` (oversize), and `:626-631` (the
shared request shape only); acceptance criterion 2 (every inventory state mapped to what shows it) and criterion 4.

**Failing scenario.** (a) Load `login.html`, leave both fields empty and press Sign in. Reading `login.js:57` and `:34`,
only `#username-error` appears and `#password` keeps `aria-invalid="false"`. (b) Type three spaces as the username and
any password, then press Sign in. The artifact shows *"Enter your username."* and sends nothing, where the contract and
the build would send the request. Both come from reading the script. I did not run them in a browser.

**Proposed fix.** In `login.js`, compute a set of missing fields (and separately a set of oversize fields), mark every
member, and focus the first in document order. Test emptiness with `=== ''`, not `trim()`. Add a blank-form state, or
extend `invalid-username` to show both messages, and register it in `manifest.js`. In `design016.cjs:66`, also assert
`#password-error` and `aria-invalid` on a blank submit, and add a whitespace-username case that reaches `loading`.
Record in the Handoff that local validation marks every invalid field.

### F3 (low) — the direct `throttled` picture locks an empty username

**Location:** `docs/design/visual-directions/frost/back-office/login.js:77` (`waits.set(key(), …)` while Username is
empty), and the Handoff's sentence *"The direct cooldown drawing leaves its submitted username blank to avoid publishing
a credential fixture."*

**What is wrong.** The gallery's *Account cooldown* picture shows *"This username is locked for 4 min 41 s"* above an
empty Username field, with Password and Sign in disabled. Production cannot reach that picture. A cooldown only arrives
for a submitted username, local validation refuses an empty one, and the inventory keeps the username after a failure
(`I:615`). The fixture also locks the empty key itself, so clearing the field relocks the form. The reason given does not
hold, because a username is not a credential value under B-12 (*"No PIN or password value …"*), and the sibling artifact
`shell.html:39` already shows `m.iqbal` read-only in M-6. The greyscale `P/login.html:32` showed `m.iqbal` in this
state too.

**Authority.** `I:602` (*"Disable password and Sign in for the submitted username; keep Username editable"*) and `I:615`
(*"Keep the username after a failure"*). B-12 is the boundary the Handoff cites, and it does not require the blank.

**Failing scenario.** Open the gallery's `login.html?state=throttled`. The reviewer sees a lock over an empty field, and
a builder copying the picture has no example of the submitted username staying in place.

**Proposed fix.** Prefill the direct `throttled` state with the fixture manager's username (`m.iqbal`, as M-6 uses), and
keep the password empty. Drop the blank-username explanation from the review fixture text and the Handoff.

### F4 (low) — M-6's N3 announcement is rewritten on every locked re-render

**Location:** `docs/design/visual-directions/frost/back-office/shell.js:81` (the snapshot is written on every `render`
of a locked state), `shell.js:141` (`manager.oninput` re-renders on every keystroke in the other-manager form), and
`shell.js:37-40` with `:48` (the other-manager cooldown text is a `<strong>`, a `<br>` and a text node).

**What is wrong.** N3 asks for a lockout to be announced once. `login.js:40` guards that with `announcedKey`, so typing
`" REVIEW-ACCOUNT "` over a locked `review-account` does not announce again. `shell.js` has no such guard. In the
other-manager form, any keystroke that leaves the typed account still locked re-renders `reauth-other-throttled` and
writes a fresh snapshot to `#cooldown-announcement`. That happens with a trailing space or a change of case, because
`account()` trims and lower-cases. A live status region with new text is announced again. The snapshot is taken with
`textContent`, so in that form it also runs the title and body together as *"…locked for 4 min 37 sThis username is
cooling down…"*. `design012.cjs:44-47` checks only a direct load of the idled-form `reauth-throttled`, a path that never
re-renders.

**Authority.** The lead's ruling on N3 (DESIGN-012 task file, carried into this task's Part 0: *"announce a lockout
once"*), and acceptance criterion 4's N3 clause. M-6 and BO-01 share one per-account cooldown
(`docs/DESIGN.md:1383`), so the two surfaces should announce it the same way.

**Failing scenario.** Open `shell.html?state=reauth-other-throttled` (the fixture locks `r.ayu`). Type a space after
`r.ayu` in Username. By the script, the status region receives a new string with the current remaining seconds. I
inferred this from the script and did not hear it through a screen reader.

**Proposed fix.** Port `login.js`'s `announcedKey` guard to `shell.js`, so the snapshot is written only when the locked
account key changes or a lock newly arrives. Build the snapshot as `title + '. ' + body` rather than from
`textContent`. Add a keystroke case to `design012.cjs`'s N3 block.

### F5 (low) — N1's new close guard focuses a control that can be hidden, and leaves a stale state

**Location:** `docs/design/visual-directions/frost/back-office/shell.js:122`.

**What is wrong.** When the logout confirmation is forced closed while re-authentication is required, the new guard
reopens M-6 and focuses `#other-manager` whenever the secret is disabled. In the other-manager form, `render` hides
`#other-manager` (`shell.js:64`), so the requested focus does nothing and the dialog's own default focusing decides
where focus lands. The sibling guard at `shell.js:120` uses a different target (`#reauth-logout`), and `start()`
(`shell.js:34`) uses a third rule. The guard also does not re-render, so `html[data-state]` and the URL still say
`reauth-logout` after the confirmation has gone. M-6 still reopens, which is what N1 requires, so this is hardening
only.

**Authority.** The lead's ruling on N1, carried as Part 0 (the guard *"reopens M-6 while re-authentication is
required"*), and `docs/DESIGN.md:1361-1364` (M-6 retained, with defined focus).

**Failing scenario.** Open `shell.html?state=reauth-other-throttled`, press Log out, then run
`document.querySelector('#logout-dialog').close()`. By the script, M-6 reopens, focus does not land on the intended
control, and the state still reads `reauth-logout`.

**Proposed fix.** Reopen through the same focus rule `start()` uses (stay, Username in the other-manager form,
`#other-manager` when that is visible, otherwise the secret), and restore the pre-logout state with `O.setState`. Make
both guards share that rule. In `design012.cjs`, add the forced close from `reauth-other-throttled` and assert focus.

## 3. What I ran and what I did not

**Observed:**

- `npm run verify`, in the worktree, at `3ec72c9`: typecheck passed; `Test Files 93 passed (93)`, `Tests 3744 passed
  (3744)`, with the known Vite native-config warning. This matches the Handoff.
- `git status --porcelain` was empty, and `git rev-parse HEAD` returned `3ec72c95`, both before my review and after
  the verify run and my last read. The tree did not move.
- `git diff --check development...agent/design-016` printed nothing.
- `grep -c "prototype/"`: `menu.html` 36, `report-detail.html` 7, `shell.html` 0, `office.js` 1 (the Handoff matches),
  plus `today.html` 1 (its End of day link to the existing greyscale BO-09), and 0 in `login.html`, `login.js` and
  `today.js`. `grep -rn "prototype/back-office/login|today"` over `docs/design/visual-directions` found only the rejected
  `paper/` direction, so no Frost artifact links to the old login or today wireframes.
- Every token `entry.css` consumes exists in `frost.css`. The warning pair is `#83611c` on `#fff5da`, and I computed the
  WCAG ratio by hand as about 5.23:1, which agrees with the Handoff's 5.2348.

**Not run, and why:** `design016.cjs`, `design012.cjs`, `design013.cjs`, `design014.cjs` and `node --check` were each
refused in this unattended session as needing the owner's approval. I therefore have no browser observation of my own.
The Handoff's figures (381/381, 281/281, 371/371, 288/288; the 1440 and 1920 geometry; sticky header at y = 64) are
quoted from design016b and are unverified by me. I made no mutation run. F1 to F5 are inferred from reading the CSS
cascade and the scripts, and each is stated as such above.

## 4. Cleared

- **Scope and ownership.** Only `docs/design/**`, `docs/DESIGN.md` (the token supplement and N2, as the task allows) and
  the task file changed. Nothing under `apps/`, `packages/` or `db/` changed. The four product documents are untouched.
- **Part 0.** N1's guard exists and `design012.cjs` adds its key sequence and the forced close (see F5 for hardening).
  N2 is the ruled sentence, verbatim, placed directly after the inert-action rule at `docs/DESIGN.md:1461-1463`. For
  N3, `#cooldown` and `#logout-cooldown` are `aria-live="off"` with no role, `logout-cooldown` joins the dialog's
  description, and BO-01 announces through a separate status span with a per-account guard (see F4 for M-6).
- **BO-01 copy.** Every product string in `login.html` and `login.js` matches `I:587-606` and the shared failures at
  `I:87-88`, including the throttle title and body and POS-01's duration format (`I:52-55`). The only new sentence is
  DESIGN-015's deferred one, marked in the inventory row as a DESIGN-016 proposal.
- **States.** 17 BO-01 and 9 BO-02 states are registered identically in `WF.states` and `manifest.js`. Success and idle
  are explained in the gallery and fixture text, not drawn.
- **One `<main>`.** BO-01 has no frame and one `main`. The Handoff tells a builder to unmount the frame, not hide it.
- **Focus policy.** It is coherent with `I:598-599` and `I:99` (a credential failure keeps the username, clears and
  focuses Password, and never resends). The lead's reading is confirmed in writing. Initial lookup focuses Try again,
  which repeats only the lookup.
- **Password managers.** The fields use `name="username"`/`autocomplete="username"` and
  `name="password"`/`type="password"`/`autocomplete="current-password"`, with no reveal, remember-me or recovery
  control.
- **Retained draft.** The sentence names no manager and shows no content, promises no restoration and says nothing is
  submitted automatically. It is absent in `session-ended`. The owner question has a proposed answer. The stale
  inventory and DESIGN paragraphs are raised with exact wording rather than edited, as Part C requires.
- **No back-office PIN.** `P/login.html`'s only PIN mention distinguishes the password cooldown from the POS PIN classes
  (`:58`), and `S:247-248` says password cooldown.
- **BO-02.** It is read-only: the only main-pane control outside `error`'s Try again is a link to End of day. There is
  no settle, fire, void, refund, reopen or POS link. The day is named by its opening date (`Tue 6 Oct 2026 · Opening
  date, WIB`), with no start or end time, consistent with FR-I1 and PRD §9. The summary's claim that End of day cannot
  close while orders are open matches FR-I2. Amounts are whole rupiah. The overflow state uses the long name and
  `999.999.999`. The emergency, receipt chip and day indicator are slice A's, and the emergency link reaches Frost BO-13.
  The read-failure wording follows slice I's precedent (`audit.js:73`). The Phase 0 state empties the rail and pane,
  titles the top bar "Back office", names M. Iqbal and offers Log out, with no day or alerts, as `I:659-665` says.
- **Tokens.** `--frost-office-login-width: 420px` is registered with `source: null` and a designed record in the JSON,
  CSS and DESIGN, as the task's *Tokens* ruling permits. The token tests pass unchanged. I found no raw colour, size or
  weight in the new or changed artifacts.
- **Links.** `office.js` resolves Today to Frost and falls back to `login.html` on logout. `menu.html`,
  `report-detail.html` and `shell.html` are repointed. The design014 count change (38/9 to 36/7) is the only
  expectation edit, and no assertion was removed.

**For the lead, not a finding:** the wide-window decision for the signed-in frame is recorded only in the Handoff and
`office.css`, because the task did not allow `docs/DESIGN.md` beyond the token supplement and N2. `docs/DESIGN.md:1343`
still describes only the 1440 target. The frontend task should cite the Handoff, or a later design task should add the
rule to DESIGN.
