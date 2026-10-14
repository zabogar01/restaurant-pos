# DESIGN-015 review — sign-in copy and states (POS-01, BO-01, M-6, M-1)

**Reviewer:** Claude Opus 5.5 (the other family from the Codex designer).
**Reviewed:** branch `agent/design-015` at `b7a5a56`, diff against `development`
(the design commit is `4600ca5`), on 2026-10-14.

## 1. Verdict

**findings** — eight: two high, two medium, four low.

The POS half is sound and I see nothing in it that should hold PHASE0-011c: the
count is gone, *permission-denied* is gone, the session sentence claims only
what `UNAUTHENTICATED` proves, the short-PIN behaviour is decided and agrees
with the shared schema, and the two general states exist. The back-office half
should not go to PHASE0-011d as written. M-6 contradicts the owner's recorded
ruling and cites that ruling as its authority, and the BO-01 and M-6 tables
tell the builder to validate locally against a "shared schema" rule that the
shared schema deliberately does not contain.

## 2. Findings

### F1 (high) — M-6 removes the other manager's choice, and cites the owner's ruling for the opposite of what it says

**Where.** `docs/design/SCREEN-INVENTORY.md:1061` (the sentence "To sign in as
someone else, log out."), `:1064` (`reauth-other` "is only a review alias"),
`:1072-1078` (the closing paragraph, which ends "(owner ruling, 2026-10-06)");
`docs/DESIGN.md:1371-1375` ("The owner's 2026-10-06 ruling is settled: changing
manager goes through Log out, explicit draft discard and BO-01");
`docs/design/visual-directions/frost/back-office/shell.html:37` and `:41`;
`docs/design/visual-directions/frost/back-office/shell.js:95`;
`docs/design/visual-directions/manifest.js` (`reauth-other`, "Wrong password
(alias)"); the Handoff's M-6 rows.

**What is wrong.** The ruling as recorded is `.agent/DECISIONS.md:113`
(2026-10-06, the line that *refines the lead's delegated M-6 line*): M-6 "asks
the idled manager only for the password, and offers a choice for a different
manager to enter their own username and password instead; that is an ordinary
sign-in as the other manager, whose failures count against their own account,
and the idled manager's draft is not carried over". The delivery follows the
earlier delegated line (`DECISIONS.md:102`, "another manager's credential
cannot be entered there"), which line 113 replaced on that point. The only way
to change manager in the delivery is Log out, the discard confirmation, and
BO-01. That path remains legitimate and satisfies FR-A2b and AC-35 on its own,
but it is not the choice the owner asked for, and two documents now state the
contrary of a ruling while naming the ruling as their source. That
misattribution is the more damaging part: the next agent who reads DESIGN.md
will take "the ruling is settled" at its word.

As the lead's note says, the misreading began in the task's *Required inputs*
summary ("M-6 is password-only"), not with the designer. The delivery is
judged here against line 113.

**Failing scenario.** Manager A idles at a desk with an unsaved draft. Manager
B needs the back office. The owner's words: "there is an option if its another
manager then he can choose to input their own username". In the delivery B
finds a read-only `m.iqbal`, one password field, and the instruction to log
out; B must press Log out and confirm "Discard changes and log out" to reach a
username field at all. If A's account is cooling down, M-6 says only "Log out
is still available", although AC-35 says A's cooldown affects no other
username.

**What M-6 must show.** This is what the ruling, FR-A2b, AC-35 and ADR-009 §4
together require; the wording is the designer's.

1. The default view stays as drawn: the idled manager's username read-only, one
   Password field, Continue. A failure there counts on the idled account.
2. A visible, keyboard-reachable choice inside M-6 for a different manager
   (for example "Sign in as a different manager"). It must be available in
   every M-6 state in which the dialog is interactive, including *throttled*:
   the idled account's cooldown does not block another username (AC-35,
   FR-A5b).
3. Choosing it gives an editable Username and a Password inside M-6. Submitting
   is an ordinary sign-in: it uses BO-01's *error* and *throttled* sentences
   for the typed username, and its failures count on that account, never on
   the idled one (`DECISIONS.md:113`, ADR-009 §4). The body the builder sends
   is the login request, not the re-authentication request, which carries only
   a password (`packages/contracts/src/auth.ts:26-31`); that is a note for the
   lead and the architect, not for the designer.
4. A way back to the idled manager's password-only view that loses nothing.
5. Before the other manager's sign-in completes, a plain statement that the
   idled manager's unsaved changes will not be available to them
   (`DECISIONS.md:96` and `:113`; FR-A2b "never receives that state"). The
   existing pattern, a confirmation whose initial focus keeps the draft, is the
   obvious model.
6. The Log out path stays as it is, beside the choice.
7. The sentence "To sign in as someone else, log out." goes, and the throttled
   sentence stops implying that Log out is the only exit.
8. `reauth-other` becomes the picture of that choice instead of an alias of
   `reauth-error`. `docs/design/checks/design012.cjs:52-53` asserts the alias
   behaviour and will need to change with it.

**One thing the ruling does not settle.** "Not carried over" says the other
manager never sees the draft. It does not say whether the draft is destroyed
when the other manager signs in or kept for the idled manager. The task's
constraint applies ("Do not decide an owner question. If a sentence would need
one, draw around it and list it"): the designer should list this rather than
choose, and the lead should put it to the owner.

**Proposed fix.** Redraw M-6 per the list above in SCREEN-INVENTORY, DESIGN.md,
`shell.html`, `shell.js` and the manifest; replace both passages that
attribute the Log-out-only route to the 2026-10-06 ruling; update the Handoff
table's M-6 rows.

### F2 (high) — BO-01 and M-6 specify a local format check that the shared schema deliberately does not make

**Where.** `docs/design/SCREEN-INVENTORY.md:589` (BO-01 "Local invalid
format"), `:1062` (M-6 "invalid length"), `:91-93` ("Local field validation has
its own copy below"); the Handoff rows "Invalid username format — Local
shared-schema check, after trim/lowercase" and "Invalid password length — Local
shared-schema check".

**What is wrong.** The Handoff attributes both checks to the shared schema. The
shared schema says otherwise. `packages/contracts/src/auth.ts:26-31` checks a
username for 1 to 256 units and a password for 1 to 1024, and its comment
(`:9-12`) gives the reason: "A username and a password are checked for type and
size only: the domain is the one authority on what a valid credential is, and
256 and 1024 UTF-16 units are no tighter than its rule (a password of 128 code
points can be 256 units long)." The 3-to-32 and 8-to-128 rules live only in
the server's domain (`apps/server/src/domain/back-office-credential.ts:14-17`,
ADR-009 §3), and the server answers a credential outside them as an ordinary
wrong one: `INVALID_CREDENTIALS`, counted (`back-office-credential.ts:137-140`).

So the two rows are states no shared code produces. For the short PIN the
consult sanctioned a local stop precisely because the shared schema makes it
(question 9, last bullet). Nothing sanctions this one, and question 7 forbids
the builder to compose it. To place these rows the 011d builder would have to
write a second copy of the domain's credential rule in the client, where the
two can drift, or stop and ask, which is what this task exists to prevent.

**Failing scenarios.**

- A manager's password is 100 emoji: 100 code points, valid on the server, 200
  UTF-16 units. A client that implements "Use 8–128 characters" with string
  length, the natural reading, refuses it locally and that manager can never
  sign in. The contract comment anticipates exactly this.
- The username sentence omits the domain's first-character rule
  (`^[a-z0-9]…`). A validator built from the sentence accepts `.ab`; the
  server treats it as no account. The sentence and the rule already disagree.
- A manager types a wrong seven-character password five times at M-6. The
  server's design counts each as a failure and writes security telemetry
  (FR-A5b, ADR-009 §4). With the local stop none is sent, and the screen tells
  whoever is typing the password policy instead of "Incorrect password".

**Proposed fix.** Delete the two format rows and the M-6 length half-row. Keep
"Enter your username." and "Enter your password.", which match the schema's
`min(1)`. Everything else goes to the server and is shown as BO-01 *error* or
M-6 *error*. Decide what the form does with a value over the schema's upper
bounds (256 and 1024 units), which the schema does stop: I suggest the same
*error* sentence with no request, since it cannot be a valid credential, but
that is the designer's sentence to give. Correct the Handoff's "shared-schema
check" attribution.

### F3 (medium) — "Try again" is one action shared by requests that carry a secret and requests that do not, and it is only specified for the first kind

**Where.** `docs/design/SCREEN-INVENTORY.md:80-93` (shared general failures),
`:587` (BO-01 resting trigger), `:634-642` (the Phase 0 frame).

**What is wrong.** The two general states are defined with one action, "Try
again", whose behaviour is given for sign-in and M-6: clear the secret, return
focus to the pad or the password, never resend. That is right where a secret
was submitted. Three requests on these same surfaces carry no secret, and for
them the rule either does nothing useful or is undefined:

- **The initial session lookup.** POS-01's and BO-01's resting rows name only
  `UNAUTHENTICATED` as the lookup's answer. If the lookup gets `UNAVAILABLE` or
  no response, the inventory does not say which screen is shown, and a "Try
  again" that only moves focus never repeats the lookup.
- **Log out at the back office.** The accepted Phase 0 frame has exactly one
  control that makes a request, and the frame "needs no message" and has no
  notice location. "Elsewhere … retry must use that screen's existing
  reconciliation/read path" names a path the frame does not have.
- **Explicit release at the POS**, likewise.

**Authority.** Acceptance criterion 1 through question 9's second list:
`UNAVAILABLE` is "needed on both clients, on every screen that can make a
request".

**Failing scenario.** A manager at a shared desk presses Log out while the
server is restarting. The request gets no response. The builder has no drawn
answer. The dangerous guess is to show BO-01 as though signed out while the
server session is still alive for up to thirty idle minutes; the safe one,
staying in the frame with the unavailable notice and a retry that repeats the
logout, is not written anywhere.

**Proposed fix.** Add three rows: the lookup failing (which screen, and that
"Try again" repeats the lookup), logout failing (stay in the frame, say where
the notice sits, "Try again" repeats the logout, never show BO-01 until the
server confirms), and POS release failing.

### F4 (medium) — BO-01's retained-draft sentence promises something the same paragraph declines to define, and is shown to whoever is at the desk

**Where.** `docs/design/SCREEN-INVENTORY.md:593`, `:600-607`, `:1067`;
`docs/DESIGN.md` (the DESIGN-015 paragraph: "Neither response opens a different
editable version of the old draft").

**What is wrong.** After the eight hours BO-01 appends "Your unsaved changes
are kept on this tab and will not be submitted automatically." The owner's
ruling (`DECISIONS.md:104`) says the draft is kept locally and never resent,
so "kept" and "not submitted" are supported. But the inventory then says the
task "adds no draft-recovery or cross-session restore workflow" and that
neither response reopens the draft. A manager is told the changes are kept and
is given no stated way to see them again; whether the same manager signing in
again finds them is left for the builder to decide. Separately, the sentence is
addressed to "you" on a sign-in screen that the next person to sit down may be
a different manager, who is told that unsaved changes of theirs exist.

No draft can exist in Phase 0 (the pane is empty), so this does not block 011d;
it does mean the sentence should not be placed yet.

**Proposed fix.** State what happens when the same manager signs in again
(restored, or not), or mark the appended sentence as not placed in Phase 0 and
list the question for the owner. Reword so it does not address an unknown
reader as the draft's owner.

### F5 (low) — Frost POS-01 `incident`: the confirmation now leads to Floor, not to print incidents

**Where.** `docs/design/prototype/pos/lock.js:26`;
`docs/design/visual-directions/mockup.js:109-110` (unchanged, now dead).

**What is wrong.** `mockup.js` retargets the confirm key to `incidents.html`
in the `incident` state by selecting `.keypad a.key:not([hidden])`. The keypad
is now made of buttons, so that selector matches nothing, and `lock.js` sends
every non-draft confirmation to `floor.html`. The C-6 path drawn before this
change ("Sign in to view" → PIN → the incident) no longer ends at the
incident. The Handoff says the incident path "inherits six-digit
confirmation"; it does, and loses its destination. I read this from the two
files; I did not run it in a browser.

**Proposed fix.** In `lock.js`, send the `incident` state's confirmation to
`incidents.html`, and remove the dead lines in `mockup.js`.

### F6 (low) — the one duration format reads badly at the two ends

**Where.** `docs/design/SCREEN-INVENTORY.md:51-53`; `shell.js:31`.

`{minutes} min {seconds} s` is shared by POS-01, BO-01, M-1 and M-6. Under a
minute it gives "Sign-in locked for 0 min 41 s"; at the start of a cooldown,
"5 min 0 s". The contract also allows `retryAfterSeconds: 0`
(`packages/contracts/src/errors.ts:62`, non-negative), which would render
"0 min 0 s" on a locked screen; the inventory treats only a missing or invalid
value. **Proposed fix:** drop the minutes part under sixty seconds, and say
that zero is treated as the cooldown having ended.

### F7 (low) — BO-01's throttled title borrows the POS's installation-wide claim

**Where.** `docs/design/SCREEN-INVENTORY.md:592`;
`docs/design/prototype/back-office/login.html` (*throttled*).

"Sign-in locked for {wait}" is true at the POS, where the `LOGIN` class locks
everyone (FR-A5). At BO-01 only one username is locked (FR-A5b), and the body
has to correct the title in the next line ("Other managers can sign in"). The
row also keeps Username editable but does not say that the notice goes and the
password is enabled once the username no longer matches the locked one.
**Proposed fix:** a title that names the scope (for example "This username is
locked for {wait}"), and one sentence on what editing the username does.

### F8 (low) — SITEMAP still names the cause the new copy refuses to infer

**Where.** `docs/design/SITEMAP.md:108` ("[INLINE] Session invalidated by back
office"). POS-01's row now says "Do not infer the cause", and the client
cannot tell a back-office invalidation from any other `UNAUTHENTICATED`.
**Proposed fix:** "Session ended — sign in again", keeping FR-B3 as one of its
sources.

## 3. What I ran and what I did not

**Ran and observed.**

- `npm run verify` at `b7a5a56`: exit 0, typecheck clean, **70 test files and
  3,365 tests passed**, matching the Handoff. This suite does not exercise
  anything under `docs/design/`, so it is evidence that nothing outside the
  design tree broke and no evidence about the screens.
- Tree stability: `git status --porcelain` was empty and `git rev-parse HEAD`
  returned `b7a5a56` both before and after the verify run. The only file I
  wrote is this report.
- The acceptance scan `grep -rniE "attempts? remaining|deactivated|installation-wide" docs/design docs/DESIGN.md`:
  the same fifteen hits the Handoff lists. Two are in the rejected Paper
  direction; the rest concern tables, presets and audit actors. None is a
  claim on POS-01, M-1, M-6 or BO-01.
- A second scan of the current design files for other stale sign-in claims
  ("ended by a manager", "Five failed", "five-minute", "staff number", "not a
  manager", `LOGIN`). The surviving `LOGIN` and "5 min" mentions are the POS
  PIN class in SITEMAP and state labels, which FR-A5 supports.
- Read in full: the task file, the whole diff of all fourteen design files,
  `shell.js`, Frost `lock.html`, `design012.cjs`,
  `packages/contracts/src/errors.ts` and `auth.ts`, PRD FR-A1 to FR-A7, FR-B3
  and AC-19, AC-28, AC-32, AC-35, ADR-009 §3 and §4, the 2026-10-05 and
  2026-10-06 lines of DECISIONS.md, and the server's
  `back-office-credential.ts` and `session-guard.ts` where they decide what
  the client is told.

**Did not run.**

- **No artifact was opened in a browser.** Acceptance criterion 3 (no console
  error) rests on the designer's report alone. F5 and every statement here
  about artifact behaviour is inferred from reading the HTML and scripts.
- **`docs/design/checks/design012.cjs` was not run** by me, and the Handoff
  says the designer did not run it either. It needs Playwright and an
  environment variable. Its one changed assertion (`:49`) has therefore never
  been executed against the changed `shell.js`. By reading, the new regular
  expressions match the new sentence, and `:52-53` still hold while
  `reauth-other` is an alias.
- No mutation run of any kind.
- I did not measure geometry; the Handoff's 1280×800 and 1440×900 figures are
  unchecked.

**For the lead, not findings against the designer.**

- `.agent/reviews/ARCH-014-client-shells.md`, which the task cites, is not in
  this worktree. I reviewed against the sections the task copies verbatim and
  could not check questions 4 to 6 (the keyed working area), which bear on F4.
- The task cites an owner ruling of 2026-10-13 in DECISIONS.md. No line of
  that date is in this checkout, as the Handoff also reports.
- The task says `THROTTLED` "always carries" `retryAfterSeconds`; the server
  does always send it (`apps/server/src/http/verification.ts:18`), but the
  client schema marks it optional (`errors.ts:67-70`). The delivery's rule
  for a missing value (the general failure, no invented duration) is sound.

## 4. Cleared

- **POS-01 against the server's signals.** *Error* has no count; the body
  claims nothing the server does not say. *Permission-denied* is removed from
  the inventory and both artifacts, with the reason stated. *Session
  invalidated* claims only that the session ended, and a fresh
  `UNAUTHENTICATED` on the first lookup is correctly resting, not "ended".
  `SESSION_IDLE` says nothing. No sentence hard-codes five minutes or five
  attempts; DESIGN.md says the fixture's five-failure step and five-minute
  timer are samples and that a production client counts nothing.
- **Short PIN.** Confirmation needs exactly six digits and sends nothing
  before that, which is the shared schema's own rule
  (`auth.ts:14`, six ASCII digits). The drawing counts masked positions only;
  `lock.js` holds a length, never a digit (B-12).
- **M-1.** `approval-error` and `approval-denied` carry identical copy, no
  count, and no distinction between a cashier's PIN and an unknown one;
  "Manager PIN not recognised" is true of both. The throttled body matches
  AC-19. The inventory says no M-1 state is wired in Phase 0.
- **The per-account cooldown wording** at BO-01 and M-6 matches FR-A5b and
  ADR-009 §4, including that M-6 and Login share one count per account and
  that logging out does not end a cooldown.
- **`FORBIDDEN`.** The state matches the one place the server emits it
  (`session-guard.ts:145-146`, a back-office session whose role is not
  manager) and does not claim the account was deactivated.
- **The general group.** The six codes an honest client never causes share
  "Something went wrong", as the constraint asks, and no raw code is shown.
- **SITEMAP `:247-248` and BO-01's requirements line** now say FR-A5b and a
  per-account cooldown; M-1's inline entry no longer says "attempts
  remaining".
- **M-6's three stale places**: "LOGIN five-minute cooldown" and
  "installation-wide" are gone, the open owner question is gone (though
  replaced by the wrong reading, F1), and the username is shown, agreeing with
  the inventory.
- **The Phase 0 frame.** Accepting the empty rail and pane invents nothing and
  needs no route; the top bar shows only what the session view carries. The
  exception is recorded in both DESIGN.md and BO-02 (but see F3 for its one
  request).
- **No PIN at the back office and no recovery control** anywhere in the
  delivery (ADR-009 §7). The BO-01 wireframe's staff-number and PIN fields are
  replaced.
- **No new token or value.** The artifacts' new rules use existing variables.
- **Ownership.** The diff touches only `docs/design/**`, `docs/DESIGN.md` and
  the task file; nothing under `apps/`, `packages/` or `db/`, and no contract
  document.
- **BO-12.** Not changed, as the task asked; I did not re-verify DESIGN-014's
  drawing beyond the designer's note.
