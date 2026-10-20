# DESIGN-016 review — BO-01 Login and BO-02 Today (slice B)

**Reviewer:** Claude Opus 5.5. The work was built by Codex `gpt-6-astra` (design016) and finished, including round 2, by
an OpenCode `gpt-6-astra` stand-in (design016b).
**Round 2:** `agent/design-016` at `e913c87` (fix commit `6aa4881`), against round 1 at `3ec72c9` and `development` at
`82876b4`.
**Date:** 2026-10-19. This file replaces the round 1 report. Round 1's five findings are summarised in section 2 with
their round 2 outcome.

## 1. Round 2 verdict

**findings** — two low, and nothing medium or above.

All five round 1 findings (F1 to F5) are fixed as the lead ruled them under *Round 2 — the review's five findings*. I
traced each fix through the source and it does what the ruling asks. The fixes introduced one new low issue, and
re-reading the form surfaced one older low issue I missed in round 1:

- **R2-1** (new in round 2) concerns F2's oversize handling. It repeats the reviewed error body beside each oversized
  field. That puts the reviewed words in a placement the reviewed copy does not grant, and the provisional build does
  not do it. So no, the oversize handling does not stay within the reviewed presentation.
- **R2-2** (present since round 1, which I missed) concerns the inline error spans. They are always referenced by
  `aria-describedby`, so a valid field still carries an error description for assistive technology.

Neither issue breaks a boundary or blocks the design review. Both should be settled before a frontend task copies the
form. They need a fix or a lead ruling, not a new design round.

As in round 1, I could not run the browser checks (see section 4). Everything about runtime behaviour below is traced
from the source, not observed in a browser.

## 2. Round 1 findings — status at `e913c87`

| Finding | Ruling | Status | What I checked |
|---|---|---|---|
| **F1** (medium): wide-window centring missed `menu.html` and `report-detail.html` | Centre the outer frame element; assert the wrapped frames at 1440 and 1920; one sentence in DESIGN *Layout* | **Fixed** | `office.css:15` now gives `.device.device--bo` `margin-inline: auto`. With `.devicewrap` as a full-width block (`office.css:14`), the 1440px wrapper centres, and `.bo` inside it resolves to zero margin, so the wrapped frames land at x = 240 at 1920 and at x = 0 at 1440. `design016.cjs:56-63` now measures frame, rail, top bar, padding and document overflow on both pages at both sizes. The DESIGN sentence at `docs/DESIGN.md:816-817` sits in *Layout*, after the 1440 back-office paragraph, and matches the ruling's wording. `.device--bo` is used only by the two wrapped pages under this stylesheet, so nothing else moves. |
| **F2** (medium): local validation marked one field and trimmed the username | Mark every missing (then every oversized) field; emptiness is `=== ''`; draw and register a blank-form state; assert it | **Fixed**, with R2-1 below | `login.js:62-65` computes the missing set with `=== ''` and, only if nothing is missing, the oversize set. Each set goes to `render`, which marks every member (`:34-39`) and focuses the first in document order (`:51-52`, Username for `invalid-both` and a double oversize). The cooldown key still trims and lower-cases (`:6`). `invalid-both` is registered identically in `login.html` and `manifest.js`. `design016.cjs` asserts both errors and both `aria-invalid` on a blank submit and on the deep link, a double oversize with an untruncated username, and three spaces reaching `loading`. The missing-before-oversize order matches the build (`SignIn.tsx:101-119`). |
| **F3** (low): direct throttle locked an empty username | Prefill `m.iqbal`, password empty; drop the blank-username rationale | **Fixed** | `login.js:82` sets `m.iqbal` before registering the wait, so the lock belongs to that key and the empty key is never locked. `design016.cjs` asserts the retained username, the disabled secret and that clearing the field unlocks. The fixture text (`login.html:19`) and the Handoff's rationale were replaced. |
| **F4** (low): M-6 re-announced on every locked re-render; the title and body ran together | Port `announcedKey`; snapshot as `title + '. ' + body`; keystroke cases in `design012.cjs` | **Fixed** | `shell.js:87-93` writes the snapshot only when a lock is present and the trimmed, lower-cased key differs from `announcedKey`, and clears both on any unlocked render. The other-manager snapshot is built from `otherCooldown(left).join('. ')`. In the idled form it is the single-sentence `#cooldown` text, as before. Returning from the logout confirmation through `start(returnState())` keeps the same key, so it does not re-announce. `design012.cjs` adds a separator regex, a MutationObserver over a tick, a trailing space and a case change, then leave and return. |
| **F5** (low): N1 guard focused a hidden control and left a stale state | Both guards reopen through `start()`'s focus rule and restore the pre-logout state; forced-close cases in `design012.cjs` | **Fixed** | Both `close` listeners call `reopenReauth` (`shell.js:38-40`). It restarts in the current state, or in `returnState()` when the state is `reauth-logout`. That is the same normalisation *Keep this draft* now shares, and `start` renders and sets the state. Focus comes from the one `reauthFocus` rule (`:36`). The `other` flag and the typed username survive, because `render` keeps `manager.value` when `wasOther`. A guard firing during `-verifying` re-renders the pending state, and the pending timer still resolves because the dialog is open again. `design012.cjs` force-closes M-6 in four states and the logout confirmation in three, asserting focus, the document state and the URL. |

## 3. Round 2 findings

### R2-1 (low) — F2's oversize fix repeats the notice body beside each field, which the reviewed copy does not grant

**Location:** `docs/design/visual-directions/frost/back-office/login.js:38` (for an oversize state each marked field's
inline error becomes `copy.error[1]`), together with `:26-30` (the same state still raises the Error notice with that
body, under `role="alert"`). The Handoff records it in round 1's state map (*"the reviewed generic error body beside
it, alongside the shared error notice"*) and in the round 2 table.

**What is wrong.** The reviewed copy for local oversize input is the Error notice and nothing beside the fields:
*"Reuse Error: 'Sign-in failed' / 'Check your username and password, then try again.' Send no request; clear the
password and focus the oversized field."* (`docs/design/SCREEN-INVENTORY.md:599`). Only local invalid input has
per-field messages (`:598`). The ruling for F2 says to mark every member *"with its message and `aria-invalid`"*. An
oversized field has no message of its own in the reviewed table, so the honest reading is `aria-invalid` plus the shared
notice. The artifact instead prints the same sentence up to three times on one screen: once in the notice, once under
Username and once under Password. Under Username alone it reads *"Check your username and password, then try again."*,
which points the manager at a field that may not be at fault. A screen reader gets the sentence from the alert, and
again as the focused field's description.

The words are verbatim, so acceptance criterion 3's literal test (*"any drawn sentence differs"*) passes. However, the
placement is new presentation that the Handoff does not list as new for review. The provisional build shows oversize as
the notice only, with no per-field text and no `aria-invalid` (`apps/back-office/src/SignIn.tsx:47`, `:151-174`). The
same shared state value also labels the double-oversize picture `oversize-username`, because `render` receives
`'oversize-'+oversized[0]` (`login.js:65`). The gallery therefore has no state that shows a double oversize; only the
check reaches it.

**Authority.** `I:599`; acceptance criterion 3 (the only new copy is Part A item 4's, *"marked as new for the
review"*); the lead's F2 ruling.

**Failing scenario.** Type 257 characters as the username and 1025 as the password, then press Sign in. By
`login.js:34-39` and `:26-30`, the notice reads *Sign-in failed / Check your username and password, then try again.*,
and the same body appears under both fields. The URL then says `state=oversize-username`. I traced this from the script
and did not render it.

**Proposed fix.** Either (a) keep the oversize presentation inside `I:599`: set `aria-invalid="true"` on every oversized
field, show no inline text for oversize, and point each oversized field's `aria-describedby` at `#notice-body`. Or (b)
if the lead prefers the per-field text, list it in the Handoff as a presentation addition for the design review, and
draw it as a registered `oversize-both` state. Under (a), `design016.cjs`'s double-oversize assertion should check
`aria-invalid` on both fields and the absence of inline text, instead of the repeated body.

### R2-2 (low, present since round 1) — the inline errors are always the fields' descriptions, even when valid

**Location:** `docs/design/visual-directions/frost/back-office/login.html:14-15` (`aria-describedby="username-error"`
and `aria-describedby="password-error"` are static), and `login.js:37-38` (the referenced spans are hidden, not
emptied, and their text is rewritten on every render).

**What is wrong.** Text that is referenced directly by `aria-describedby` contributes to the accessible description
even when the element is `hidden`. That is the accessible-name computation's rule for directly referenced nodes, and
the reason hidden description text works at all. So in `default`, `error`, `throttled` and every other state, Username
is described as *"Enter your username."* and Password as *"Enter your password."*, although neither field is invalid.
After an oversize render, until the next render rewrites them, both are described with the oversize sentence. This was
true at `3ec72c9` too, and I did not report it in round 1. The provisional build gets it right, attaching
`aria-describedby` only while the field is missing (`SignIn.tsx:151-152`, `:169-170`).

**Authority.** `I:598` (each message belongs beside *its* invalid field), and DESIGN-012's field rule that each
invalid field names its error with `aria-describedby` (`docs/DESIGN.md:1438-1439`). The rule is conditional on
invalidity.

**Failing scenario.** Load `login.html` with no state and Tab to Password. By the markup and the computation rule, a
screen reader announces *"Password, secure edit text, Enter your password."* before anything has been submitted. I
inferred this and did not hear it through a screen reader.

**Proposed fix.** In `render`, set `aria-describedby` to the error span's id only while that field is invalid, and
remove it otherwise, as the build does. Drop the static attributes from `login.html`. Add one assertion to
`design016.cjs` that a valid field in `default` has no `aria-describedby`, or that its computed description is empty.

### Not findings

- The Handoff's *Delivery and design decisions* still says *"No credential is prefilled in the new artifact"*
  (`.agent/tasks/DESIGN-016-login-and-today.md:345-346`), two sentences before it says the throttle state retains
  `m.iqbal`. That is true only under the B-12 reading that a username is not a credential value, which the F3 ruling
  adopts. The fixture text now says *"No password is prefilled"*. It is worth aligning the Handoff's word when the lead
  next touches it.
- The round 1 results in *Finished by design016b* (381/381, 281/281) are historical and are correctly superseded by the
  round 2 table (393/393, 293/293).

## 4. What I ran and what I did not

**Observed:**

- `npm run verify` at `e913c87`: typecheck passed; `Test Files 93 passed (93)`, `Tests 3744 passed (3744)`, with the
  known Vite native-config warning.
- `git status --porcelain` was empty, and `git rev-parse HEAD` returned `e913c87a`, both at the start of this round and
  after the verify run. The tree did not move.
- `git diff --check development...e913c87` printed nothing.
- I read the complete round 2 diff (`git diff 3ec72c9 e913c87 -- docs/`): `DESIGN.md`, `office.css`, `login.html`,
  `login.js`, `shell.js`, `manifest.js`, `design012.cjs` and `design016.cjs`. I also read the provisional
  `apps/back-office/src/SignIn.tsx` for comparison.

**Not run, and why:** `design016.cjs` was refused again in this unattended session as needing the owner's approval, so
I did not attempt the other three browser checks or `node --check`. The round 2 figures (DESIGN-016 393/393, DESIGN-012
293/293, DESIGN-013 371/371, DESIGN-014 288/288; the wrapped frames at `(240, 0, 1440, 1080)` at 1920) are
design016b's, quoted in the Handoff, and I have not verified them. They are consistent with the cascade and scripts as
I traced them. I made no mutation run. Every runtime statement in sections 2 and 3 is traced from source.

## 5. Cleared in round 2

- **Scope.** Round 2 touched only `docs/DESIGN.md` (the one sentence the lead allowed), files under `docs/design/`,
  this report (round 1, committed by the lead) and the task file. Nothing under `apps/`, `packages/` or `db/` changed,
  no token changed, and the four product documents are untouched.
- **Checks.** No round 1 assertion was removed or weakened. The only edits to existing lines in `design012.cjs` and
  `design016.cjs` are indentation, and the new assertions are additive. The DESIGN-014 link counts are unchanged from
  round 1.
- **Copy.** The local-invalid messages are produced as `'Enter your '+field.id+'.'`, which yields exactly *"Enter your
  username."* and *"Enter your password."* for the two ids. No other product string changed. `invalid-both`'s gallery
  label is review chrome, not product copy.
- **Handoff.** It was updated where round 2 made round 1 untrue: the focus and validation paragraph, 18 and 27 states,
  the F3 sentence, and the oversize row. It adds a Round 2 section that maps each finding to its change and its quoted
  evidence, and it ends with `DONE`.
- **Round 1 clearances.** These still hold, because round 2 did not touch the code they rest on: one `<main>`, the
  password-manager semantics, the retained-draft proposal and owner question, BO-02 read-only content and Phase 0, the
  link ledger, and the token registration.

**For the lead:** the dispatch asked me to update the Handoff. My role prompt and the same dispatch say to write only
this report and never edit the task file, so I have not touched the task file. The final line below closes this report
instead.

DONE
