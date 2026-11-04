# DESIGN-023 review — BO-06 Staff in Frost

**Reviewer:** Claude Opus (`DESIGN-023-review`), by the owner's exception of 2026-11-03.
**Branch:** `agent/design-023` at `136afb9`, against `development`.
**Task:** `.agent/tasks/DESIGN-023-users.md`.

## 1. Verdict

**findings.** Nine findings. One is a copy defect that contradicts the PRD: the own-PIN warning
understates which sessions end. Two more are medium: a refusal the server sends is left undrawn,
and a premise about the browser's password manager may not hold. The other six are low. The
drawing is otherwise thorough and well aimed at the task. Every Part A state is registered. The
six moves ask for exactly their fields. The own row, kitchen rows and the former manager are
handled correctly, and the credential lifecycle matches ADR-011 rule 25.

## 2. Findings

### F1 — The own-PIN warning says only POS sessions end; FR-B3 says every other session ends (medium-high, confirmed by reading)

**Where:** `docs/design/visual-directions/frost/back-office/users.js:28`. The same wording is in
the Handoff's warning table (`.agent/tasks/DESIGN-023-users.md:652`), its command-field matrix
(`:474`), and the amended inventory (`docs/design/SCREEN-INVENTORY.md:881-882`, "Own PIN changes
end POS sessions").

**What is wrong.** The own-PIN warning reads "Your POS sessions will end on their next action. This
back-office session will continue." An own PIN change increments the manager's credential version
and re-stamps only the session it was made from (C3 §3, the increments table: "Own PIN | Yes, and
re-stamps the acting session"). Every other session of that manager therefore fails, the
back-office ones included. That covers another tab after its own sign-in, or another desk.

**Authority.** PRD **FR-B3**: "The one exception is a manager who changes their own password or
PIN … the back-office session the change was made from continues, and every other session of
theirs is invalidated." ARCHITECTURE §7.2 (`docs/ARCHITECTURE.md:582-589`) says the same of both
own changes: "Their other sessions fail as above." The task's *Server facts* (":117-118") and C3
§10 item 4 summarise this as "the POS sessions end", as does the owner's Q1(b) line in DECISIONS.
Those summaries are narrower than the requirement, but they do not contradict it. The designer
copied the task faithfully. The task's summary is what is stale.

**Failing scenario.** M. Iqbal is signed in to the back office on the office PC and on a second
browser profile, and is on the POS. On the office PC they change their own PIN. The warning
promises that only POS sessions end. Their second back-office session is answered
`UNAUTHENTICATED` on its next request and lands on BO-01 *Session ended*. Any unsaved draft there
is held behind a sign-in they were not warned about. The `design023` check cannot catch this: it
asserts the result line of the own-password walk (`design023.cjs:60`) and no own-PIN warning text.

**Proposed fix.** Give own PIN the own-password sentence: "Your other POS and back-office sessions
will end on their next action. This back-office session will continue." Correct the Handoff's
`:474` and `:652` and the inventory's `:881-882` to match: "Own PIN and own password changes end
every other session of the manager." Add a `design023` assertion on the own-PIN warning. The lead
may also want to correct the task template's server-facts line so that S8c's task does not repeat
the summary.

### F2 — `INVALID_CREDENTIALS` that starts a cooldown is drawn as a plain "Try again" (medium, confirmed by reading)

**Where:** `users.js:137-139`. The Handoff's copy table (`:598`) and focus table (`:694`), and
`D` Part B (`docs/DESIGN.md:2230-2232`), map `INVALID_CREDENTIALS` only to "Incorrect current
password. Try again." Only `THROTTLED` reaches the cooldown.

**What is wrong.** C3 §4 says the own-change verification answers "`FAILED` is 401
`INVALID_CREDENTIALS`, with `retryAfterSeconds` only when this failure started a cooldown". The
fifth wrong current password is therefore an `INVALID_CREDENTIALS` that carries the wait. BO-06
reads the code alone, so this state has no picture and no copy.

**Authority.** C3 §4 (the shape of the answer). The established reading of the same answer is
BO-01 (`SCREEN-INVENTORY.md:627`, "Throttled | `INVALID_CREDENTIALS` with `retryAfterSeconds`, or
`THROTTLED`") and POS-01 (`:69`). ADR-011 rule 24 also applies: a state with no designed sentence
stops the builder.

**Failing scenario.** Iqbal types a wrong current password a fifth time. The server starts the
five-minute cooldown and answers `INVALID_CREDENTIALS` with `retryAfterSeconds: 300`. BO-06 shows
"Incorrect current password. Try again." and leaves Current password and Save enabled. Iqbal
tries again with the right password and is refused `THROTTLED`. They believe the right password
was wrong, and they have not been told that their own M-6 and BO-01 sign-in is now locked too
(C3 §4).

**Proposed fix.** Treat `INVALID_CREDENTIALS` with a valid `retryAfterSeconds` exactly as
`THROTTLED`, as BO-01 and POS-01 do. Keep the same notice, field error, disabled controls and
focus. Say so in the Handoff's *Rules for S8c* and in `D` Part B. Add a fixture response and a
check.

### F3 — `autocomplete="new-password"` may not stop a browser offering to save a PIN or another person's password (medium, plausible, not tested in a browser)

**Where:** `users.html:30-32` (New PIN, Username, New password). `D` Part B
(`docs/DESIGN.md:2170-2175`). The premise is C3 §10 item 6 and the task's *Rulings*: "so a
browser does not offer to save a cashier's PIN as a site password".

**What is wrong.** I asked the librarian (`ask.sh librarian`). It found no source saying the
`new-password` token suppresses the save prompt. MDN describes the token as avoiding autofill
and offering password generation. web.dev and Chromium's code reviews describe the save offer as
driven by detecting a submission. The pattern BO-06 draws counts as a submission: a fetch
succeeds, then the form closes. Create-manager adds a `username` field beside it, which is the
standard sign-up pairing. The librarian could not confirm current Chrome or Firefox behaviour for
this exact case. This finding is therefore an inference from documentation, not an observation.

**Authority.** The intent is in the inventory's BO-06 *Must not invent* ("A PIN is never
displayed, echoed, or recoverable", FR-J4, B-11, B-12) and in ADR-011 rule 25 ("in no URL,
storage, …"). Against that stands the owner's 2026-10-13 ruling, recorded in ADR-011 rule 25:
"the client does not fight a browser's password manager". This is an architecture question, not a
design defect. The designer drew exactly what C3 specified.

**Failing scenario (inferred).** A manager resets Ana's PIN. Chrome offers "Save password?" for
the six digits, and the manager accepts. Ana's PIN can now be read in the browser's password
manager on a shared back-office machine. In the same way, creating a manager could save that
manager's username and password in the creating manager's browser profile.

**Proposed fix.** The lead asks the architect whether C3 §10.6's stated effect holds. S8c should
include a manual check in current Chrome and Firefox: reset a PIN, create a manager, and watch for
a save prompt. If a prompt appears, the owner decides whether the "does not fight" ruling extends
to other people's credentials. No change to the drawing is proposed until then.

### F4 — The fixture's cooldown survives a different manager's sign-in, and the rule does not scope it to the account (low-medium, inferred from code)

**Where:** `users.js:12` (one page-level `cooldown`), `:83` (every own-form opening reads it) and
`:186` (a different-manager sign-in resets the draft, decision, pending and held answers, but not
`cooldown`). The Handoff's focus table (`:695`) says "Reopening preserves the wait", with no
owner for the wait.

**What is wrong.** This is a shared value hiding the state where it is wrong. The throttle is per
account (FR-A5b, ADR-009 §4). R2 requires a different manager to land on "a clean working area;
no old draft, pending notice or focus is delivered" (`:707`).

**Failing scenario.** This is inferred by reading. My attempt to drive it in headless Chrome
needed an approval that this unattended run does not have. Load `?state=throttled-own-password`,
which throttles Iqbal. Press Cancel, then *Open M-6*. Choose Sign in as a different manager and
sign in as `r.ayu`. Press Change my password — Ratna Ayu. `openEditor` finds `cooldown > 0`, so
it shows "Password verification is cooling down" on Ayu's form and disables Save, although Ayu's
account is not throttled.

**Proposed fix.** In the Handoff, say that the wait belongs to the signed-in manager's account and
is discarded when a different manager signs in. In the fixture, set `cooldown = 0` on the
different-manager branch of `resume`.

### F5 — An unknown move whose reread shows it applied is undrawn, and the form keeps a stale "Current classification" (low, confirmed by reading)

**Where:** `users.js:55` (the context comes from `editor.subject`, a copy taken when the form
opens), `:126-127` (the unknown path rereads but never changes the subject), and the
`unknown-move-cashier-manager` fixture (the fixture's server never applies an unknown command).

**What is wrong.** Only the branch where the move did not apply is drawn. If it did apply, the
reread list shows Ana R. as Manager. The form beside it still says "Current classification:
Cashier. Promotion always sets a new password." and Save is enabled. A Save with a re-entered
password is sent as `CASHIER_TO_MANAGER` and refused `USER_CHANGED` (C3 §2). The server is safe,
but the screen contradicts itself.

**Authority.** The task's *Unknown outcomes* ruling, and the reread's purpose. The nearest
precedent is `D`'s versioned-form rule (`docs/DESIGN.md:1668-1675`). It draws the uncertainty
both when the reread matches the draft's basis and when it shows a change ("say that the newer
version may be this save; never say that it is").

**Proposed fix.** Draw `unknown-move-…` with the reread showing the destination. Do not let the
context claim the opening classification as current. For example, "When you opened this form, Ana
R. was a Cashier. The list now shows Manager; this may be your change." Then treat the form as
`USER_CHANGED` treats it: Save disabled, and Return to staff list.

### F6 — The current-password bound is counted in UTF-16 units; the schema counts code points (low, confirmed)

**Where:** `users.js:92` (`values.currentPassword.length>1024`), `D` Part B
(`docs/DESIGN.md:2221-2222`, "1–1024 UTF-16 units") and the Handoff (`:486`).

**What is wrong.** `CurrentPassword` is `min(1).max(1024)`, as `ReauthenticateRequest` is (C3 §8;
`packages/contracts/src/auth.ts:31`). In the installed zod 4.6.5 a string's `max` counts code
points, not UTF-16 units. I read this in `node_modules/zod/v4/core/checks.js:271-273`. The form
and the server disagree between 513 and 1024 astral code points. No real password can be there,
because a set password is at most 128 code points. The defect is in the stated rule rather than in
use. The lead raised this point in *Lead verify*.

**Proposed fix.** Count code points (`[...value].length > 1024`), as the name and new-password
checks already do. In `D` and the Handoff, say "1–1024 characters (code points), the request
schema's bound".

### F7 — Two sitemap entries mis-cite or mis-nest (low, confirmed)

**Where:** `docs/design/SITEMAP.md:319` and `:313`.

**What is wrong.** `[MODAL] Depart — Stay or Discard ……… C2` sits in a column where every other
entry is a PRD requirement in short form ("FR-B3, A1"). There it reads as FR-C2, which is item
variants. The lead noted this too. Separately, `[INLINE] PIN or username in use — refused` is
nested only under *Reset another person's PIN / password*. A username refusal never arises on a
reset (C3 §8: resets carry no `username`), and the PIN refusal also arises on create, on a move,
on own PIN and on reactivation.

**Proposed fix.** Cite the departure node by its real authority (for example "ADR-011", or "`D`
DESIGN-017"), or leave it uncited as other non-requirement nodes are. Move the in-use refusal up
a level under BO-06, as a sibling of the forms it serves.

### F8 — The move form pre-selects a destination, so an untouched form is one Save from a session-ending move (low; a design judgement for the lead)

**Where:** `users.js:80-81`. Opening Change role on a manager selects Cashier. On a cashier it
selects Manager, and on kitchen staff, Cashier. `dirty()` (`:36`) reports the untouched form as
clean.

**What is wrong.** C3 §2 says "the client builds the variant from the move the manager chose".
Here the screen chooses for them. For the three moves with no fields (manager → cashier, cashier
→ kitchen, manager → kitchen), Save is live as soon as the form opens. The warning is beside Save,
so the task's rule is met. But a manager who opens Change role on Ratna Ayu to look and presses
Enter demotes her and ends her sessions.

**Proposed fix, for the lead to weigh.** Open the select with no destination chosen ("Choose a new
classification"). Show no fields and no warning, and keep Save disabled until a move is chosen.
If the lead prefers the drawing as it is, the Handoff should state the default for each origin as
a rule S8c can test.

### F9 — Some of Part B's general wording reaches past BO-06 (low)

**Where:** `docs/DESIGN.md:2175`, `:2200` and `:2230-2231`.

**What is wrong.** Three sentences:

- "No reveal, confirmation field, text echo or value attribute is drawn" sits in the reusable
  credential rule. It turns BO-06's choice of no confirmation field into behaviour for every later
  form, although C3 §10.5 leaves the choice open.
- "Deactivation uses a modal confirmation" sits under the general session-warning behaviour. Read
  generally, it conflicts with DESIGN-017's status commands (`D:1546`), which deactivate a table,
  category or preset with no confirmation.
- "`THROTTLED` sits on that field with seconds remaining" conflicts with the copy actually adopted
  ("5 min", "4 min 59 s").

The task asks Part B to "change no existing rule" and to mark each rule as behaviour or as BO-06
copy.

**Proposed fix.** Move the no-confirmation-field sentence into the BO-06 copy part. Write
"Deactivating a person uses a modal confirmation". Write "with the remaining wait, in the sign-in
duration format".

## 3. What I ran and what I did not

**Observed:**

- `git log development..HEAD`: seven commits, `736112d` to `136afb9`.
  `git diff --stat development...HEAD`: 16 files. Every one is under `docs/design/`,
  `docs/DESIGN.md` or the task file. Nothing is under `apps/`, `packages/`, `db/`, `e2e/` or
  `docs/design/tokens/`.
- **The tree did not move.** `git status --short` was empty and `git rev-parse HEAD` was
  `136afb9e360bb31af2d24576605bd545426335ef`, both before my verify run and after my last
  command.
- **`npm run verify`**, run by me at `136afb9`: typecheck passed, and vitest gave **151 files
  passed, 5497 tests passed** (114 s).
- I read the zod 4.6.5 max-length check in `node_modules/zod/v4/core/checks.js:265-277` (F6).
- I asked `ask.sh librarian` about `new-password` and the browser's save prompt (F3). Its answer
  is documentary and says it could not confirm current browser behaviour.
- I read the whole task file and C3 §2 to §8 and §10. I read FR-A3, FR-A4 and FR-B3, and B-11 to
  B-13. I read ARCHITECTURE §7.2 and ADR-011 rule 25. I read `users.html`, `users.css`, `users.js`,
  `users-states.js` and `design023.cjs` in full, the diffs of `office.js`, `report-detail.html`,
  `index.html`, `P/users.html`, `design014.cjs` and `design019.cjs`, `D`'s Part B, and the
  inventory and sitemap lines that changed.

**Not run:**

- **No design check script, and no browser.** I did not run `design023` or any earlier design
  check. My one headless-Chrome probe, for F1, F4 and F5, needed an approval this unattended run
  lacks, so it did not run. F4 and F5 are inferred from reading the code. They are not observed.
  The `design023` 1874/1874 and the earlier checks' counts are the lead's run4 as recorded in
  *Lead verify*. I did not reproduce them.
- No mutation run. I claim none.
- No accessibility-tool or physical-device check.

## 4. Cleared

- **Scope and ownership.** Only design files and the task file changed. No token was added, and
  `users.css` uses registry tokens only, with no raw colour, size or weight and no success green.
  The two earlier-check changes are exactly R1 (`design019.cjs`, one expected array) and the
  `design014.cjs` count from four to three. No assertion was weakened.
- **The six moves and their fields** (`users.js:21-26`) match C3 §2. A username is asked only when
  `UserView.username` is null, so the former manager D. Putra is promoted without one and the
  retained username is shown as a fixed fact. A promotion always asks for a new password. A move
  to kitchen says the PIN is removed.
- **Create by classification**: kitchen takes a name only; a cashier a name and PIN; a manager a
  name, PIN, username and password. A switch of classification keeps the name and clears every
  credential, and switching back restores none.
- **The field rules** match C3 §8 for the name (trimmed, 1–64 code points, `\p{Cc}`, as
  `TableLabel` checks it), the PIN (six ASCII digits, so full-width digits are refused), the
  username (trimmed, ASCII lower-cased, the ADR-009 §3 pattern) and the new password (8–128 code
  points, never trimmed). F6 is the only exception.
- **The own row** offers only Change my password and Change my PIN, with no deactivate, role
  change or reset (FR-B3). `OWN_ACCOUNT` still has a state. Kitchen rows have no PIN, password or
  login action and say "No sign-in". The classification is shown, never "role: kitchen", and
  there is no waiter.
- **The other warnings** follow the subject's current classification and are correct for every
  case except own PIN (F1). A cashier, a former manager among them, has POS sessions only. A
  manager has POS and back-office sessions. Kitchen has none. The own-password warning matches
  FR-B3. Creation and reactivation carry none.
- **The credential lifecycle**: every input is native and uncontrolled and is read on submit. No
  input has a `value` attribute. Fields are emptied after every response, at every gate and M-6
  mode change, and before the same manager's draft returns. A local refusal keeps the typed text.
  Every form is `method="post"`, and the CSP sets `form-action 'none'`. There is no reveal and no
  echo. The command ledger holds field names, not values.
- **Reactivation** keeps the PIN, asks for a new PIN on `DUPLICATE`, focuses an empty New PIN, and
  resends one explicit command with "Reactivate with new PIN". Kitchen staff never get a PIN field
  (C3 §6).
- **The `DUPLICATE` PIN copy** names no holder. Both in-use refusals are placed by `details.field`
  on create, on a move, on a reset and on own PIN.
- **Walk 4's review links** follow the person: POS-01 for a cashier, POS-01 and BO-01 for a
  manager, none for kitchen.
- **The fixture counts** (five active, three inactive) agree with the rows drawn. The overflow
  state has a 64-character name and a 32-character username. Its state-scoped tight cell padding
  follows the precedent of Tables, Today, Incidents and Presets.
- **The panel-height behaviour** in `users.js:70-74` uses measured geometry, not a token. The
  shared `.office-dialog__body` already scrolls (`office.css:73`).
- **The different-manager copy** and the M-6 and BO-01 copy are shared with Tables, Settings,
  Menu, the item editor and Presets, not invented here.
- **R2** is recorded in the Handoff's focus table, with nothing drawn in `office.js`.
