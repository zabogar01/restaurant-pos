---
id: DESIGN-015
title: Sign-in copy and states for POS-01, BO-01 and M-6, with no attempt count and no state the server cannot signal
category: ui
touches: [identity]
depends_on: [DESIGN-012]
owns: [docs/design/**, docs/DESIGN.md]
status: active
cycles: 1
---
# DESIGN-015 — Sign-in copy and states (POS-01, BO-01, M-6, M-1)

**Written** 2026-10-13 by the lead, from the architect consult ARCH-014
(`.agent/reviews/ARCH-014-client-shells.md`, *For the lead* 2 to 6 and its question 9), which found
that the first builders to wire a sign-in to the real server (PHASE0-011c at the POS, 011d at the
back office) would have to invent copy or show states the server never signals. ADR-010 rule 1: the
server sends a code and no message; **the wording belongs to the design documents**. The builder
places it; you write it.
**Owner:** a Codex designer on `gpt-6-astra`, effort high, opened by hand in its own pane.
**Branch and place:** `agent/design-015`, cut from `development`, in the worktree
`../restaurant-pos-wt/DESIGN-015`. Touch nothing under `apps/`, `packages/` or `db/`, and nothing in
the main checkout at `../restaurant-pos`.

This is not design slice B. It does not draw BO-01 or BO-02 as full screens. It gives the sign-in
states their words and, where a picture already exists, corrects it. Nothing is built from this task;
a design review follows.

## Objective

When this task is done, every answer the two sign-ins and M-6 can receive from the server has a
reviewed sentence, and no drawn state claims something the server does not say. At the POS: POS-01's
*error* has a body with no count of attempts; *permission-denied* is gone; *session invalidated*
claims only that the session ended; what the pad does with fewer than six digits is decided; and the
POS has the two general states ("the system is unavailable", "something went wrong"). At the back
office: BO-01 has its states and copy, drawn in Frost or written as a table the provisional form of
011d can place; M-6's cooldown text matches FR-A5b and the owner's ruling; `FORBIDDEN` and M-6 after
the eight hours each have a state; the back office has the same two general states. M-1's two
pictures that show what the server never signals are corrected. The empty rail and empty pane of the
Phase 0 back-office frame are either accepted or replaced by a drawing.

## Required inputs

- **The consult's sections copied below.** Question 9 is the inventory of what is drawn and what is
  owed; question 7 is what the back-office builder may and may not compose; *For the lead* 2 to 6 is
  the list of work.
- **The screens:** `docs/design/SCREEN-INVENTORY.md` (POS-01, BO-01, BO-02, M-1, M-6, the
  inventory's I-rules), `docs/design/SITEMAP.md` (`:104`, `:247-248`), `docs/DESIGN.md` (Frost, the
  DESIGN-012 section, the *Open* list), and the Frost artifacts that draw POS-01, M-1, M-6 and the
  back-office frame (`shell.html` among them).
- **What the server says, exactly:** the error codes and their details in
  `packages/contracts/src/errors.ts` (read only). `INVALID_CREDENTIALS` carries `retryAfterSeconds`
  only on the failure that starts a cooldown; `THROTTLED` always carries it; nothing ever carries a
  count of attempts remaining. A deactivated user's PIN is answered exactly as a wrong PIN.
  `APPROVAL_FAILED` does not tell a cashier's PIN from an unknown one.
- **Earlier findings this task closes:** ARCH-012 *For the lead* 1 to 3
  (`.agent/reviews/ARCH-012-auth-routes.md`, near its end: SITEMAP and BO-01 naming `FR-A5` and a
  `LOGIN` cooldown; POS-01's *permission-denied*; the attempt count) and ARCH-013 *For the lead* 3 and
  4 (`.agent/reviews/ARCH-013-manager-approval.md`: M-1's `approval-error` and `approval-denied`; BO-12
  showing `APPROVAL_THROTTLED` as its own outcome, which DESIGN-014 already drew, so check only).
- **Owner rulings** in `.agent/DECISIONS.md`: 2026-10-06 (the other manager's failures at M-6 count on
  their own account; M-6 is password-only), ADR-009 (username and password at the back office, a
  per-account cooldown), 2026-10-13 (the served POS shows fixture screens under a real sign-in).
- **Contract:** PRD FR-A2, FR-A2b, FR-A5, FR-A5b, AC-19, AC-32, AC-35; ADR-009 §4 and §7; ADR-010
  rule 1.

## From ARCH-014, question 9: copy for each code (verbatim; binding)

### 9. Copy for each code

Authority: ADR-010 rule 1: "There is no `message` field … What a person reads is the client's own
copy, chosen by code; **the wording belongs to the design documents**."

PHASE0-009b's Handoff says the exact copy for each code is "the client's to write". That is right
about where the sentence lives (in the client, never in the server) and wrong if it is read as
who writes it. **The designer owns the wording. The builder places it.** FE-001 already met this:
it flagged its one undrawn notice as provisional copy rather than passing it off as reviewed
(`fixtures.ts:46-48`).

#### What the screens already carry

| Screen | Server signal | Drawn state | Can it be shown as drawn? |
|---|---|---|---|
| POS-01 | 200 in flight | *loading* ("VERIFYING") | Yes |
| POS-01 | `INVALID_CREDENTIALS`, no details | *error*: "PIN not recognised" / "2 attempts remaining before a five-minute cooldown." | **Title yes, body no.** The server reports no count, deliberately (ARCH-012 §5) |
| POS-01 | `INVALID_CREDENTIALS` with details, or `THROTTLED` | *throttled*: "Sign-in locked for 4 min 12 s" and its body | Yes, with the time taken from `retryAfterSeconds` |
| POS-01 | `UNAUTHENTICATED` on a held session | *session invalidated*: "Your session was ended by a manager" | The state yes; the sentence overclaims (question 5) |
| POS-01 | `SESSION_IDLE` | *empty* | Yes; nothing is said, and nothing need be |
| POS-01 | a payment session in the tab | *tender draft waiting* | Yes, with figures from the store |
| POS-01 | none exists | *permission-denied* ("This account is deactivated", provisional) | **Never.** A deactivated user's PIN is answered as a wrong PIN, by design (ARCH-012 *For the lead* 2) |
| POS-01 | none exists yet | *emergency print incident present* | Not in Phase 0; no route |
| M-1 | `APPROVAL_FAILED`, `APPROVAL_THROTTLED` | four pictures | Not wired in Phase 0 (question 8) |
| M-6 | `INVALID_CREDENTIALS` | "Incorrect password. Try again." | Yes |
| M-6 | `INVALID_CREDENTIALS` with details, or `THROTTLED` | a "LOGIN five-minute cooldown", "installation-wide" | **No.** The password throttle is per account (FR-A5b, ADR-009 §4), not the `LOGIN` class and not installation-wide |
| BO-01 | every signal | nothing in Frost | **No state is drawn at all** |

#### Codes with no drawn state on any screen

- **`UNAVAILABLE`, and no response at all**: "the system is unavailable". Needed on both clients,
  on every screen that can make a request, POS-01 and BO-01 first.
- **`INTERNAL`, an unparseable failure**: "something went wrong". The same.
- **`FORBIDDEN`** at the back office: a signed-in person who is no longer a manager.
- **`UNAUTHENTICATED` at M-6**: the eight hours have passed. DESIGN-012 says "absolute expiry
  belongs to BO-01 and is not drawn here", and BO-01 is not drawn.
- **`VALIDATION_FAILED`, `CSRF_REFUSED` after the one retry, `ORIGIN_REFUSED`, `NOT_FOUND`,
  `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`**: an honest client never causes any of them. I
  recommend all six share the "something went wrong" state and get no sentence of their own;
  telling a cashier that an origin was refused helps nobody.
- **A PIN of fewer than six digits at POS-01.** The shared schema stops it leaving the client
  (question 4, rule 2), so the server is never asked. What the pad does instead is not drawn for
  POS-01. `PinPad` already has `requireFull`, drawn for the refund approval; using it on the lock
  screen is the obvious answer, and it is the designer's to give.

So the designer owes, before 011c: a body for POS-01's *error* without a count; a sentence for
*session invalidated* that claims only what is known; and the two general states for the POS.
Before 011d: the same two states for the back office, the corrected M-6 cooldown, BO-01's states,
and the two orphans (`FORBIDDEN`, and M-6 after eight hours). It is one small design task, not
slice B.

## From ARCH-014, question 7: the back-office shell without slice B (verbatim; context for BO-01)

### 7. The back-office shell without slice B

Authority: NFR-5; ADR-009; DESIGN.md, *Open* item 2 and item 5 and the DESIGN-012 section; the
DESIGN-012 review (all nine findings closed; three low ones open); SCREEN-INVENTORY BO-01, BO-02
and M-6.

What exists in Frost for the back office: the frame (a 220px rail, a 64px top bar, the scrolling
content pane), the alerts, M-6, dialogs, and native text, secret, select and radio fields with
their focus, invalid, read-only and disabled states. What does not: BO-01, which "exists only in
the greyscale wireframe", and BO-02, the landing screen, which is `[MY CALL]` and undesigned.

**011d builds the back office now. It does not wait for slice B.** The reasons: the roadmap's
Phase 0 demonstrable is a manager signing in there; the risk in this slice is behaviour (the
session, M-6, the keyed working area), none of which a drawing changes; and every visual piece a
sign-in needs is already a DESIGN-012 pattern. A restyle later is a small frontend task.

It builds three things.

1. **Everything behavioural**, from questions 4 to 6.
2. **M-6 as DESIGN-012 draws it**: the native modal dialog that Escape and an outside click
   cannot dismiss, the focus loop, the inert background. Its copy is stale in three places (see
   *For the lead* 4); the designer corrects those before 011d is dispatched.
3. **A provisional sign-in**: one username field and one password field from the 40px field
   pattern with its label, the office primary button, and the amber invalid message or notice,
   stacked as the dialog forms stack them. It is marked provisional in the source and in the
   Handoff, as FE-001 marked its one undrawn notice, and slice B's frontend task replaces it.

**What the builder must not invent:**

- **No value.** No colour, length, weight or token that is not in the Frost registry.
  `no-invented-values.test.ts` is copied to the back office and reads `office.css`' ported rules
  the same way.
- **No landing content.** After sign-in the frame is shown with an empty content pane. BO-02 is
  not designed.
- **No navigation entry.** The rail is empty. DESIGN-012's destinations all lead to screens that
  do not exist, and a link into the fallback is a lie the manager finds by clicking it.
- **No business-day indicator and no incident banner or chip.** Each needs a route Phase 0 does
  not have. A date or an incident drawn from a fixture, in a served build, under a real
  manager's name, is the fixture-where-a-real-call-is-owed of question 3.
- **No copy.** Where DESIGN-012 gives a sentence, that sentence. Where it gives none, the builder
  stops and asks (question 9).
- **No PIN field, no "remember me", no password reveal, no strength meter, no "forgot password".**
  Recovery is the script (ADR-009 §7).
- **Nothing from `apps/pos`.** Not `PinPad`, not a stylesheet, not a hook. A test fails on any
  import across the two applications in either direction (NFR-5).

The empty rail and the empty pane are deviations from the drawn frame, and I am not the one to
bless them. They are the smallest honest thing a builder can do, and they go to the designer as
one question (*For the lead* 5).

## From ARCH-014, For the lead 2 to 6 (verbatim; the work list)

2. **One small design task before 011c, and its second half before 011d** (question 9). For the
   designer, in SCREEN-INVENTORY and the Frost artifacts:
   - POS-01 *error*: a body with no count of attempts. ARCH-012 *For the lead* 3 asked this on
     2026-10-09 and it is still open; it now blocks a builder.
   - POS-01 *permission-denied*: delete it (ARCH-012 *For the lead* 2, still open). Until then
     011c leaves the fixture picture alone and wires nothing to it.
   - POS-01: what the pad does with fewer than six digits. I recommend `requireFull`.
   - Both clients: "the system is unavailable" and "something went wrong".
   - BO-01: its states and copy, in Frost or as a table 011d can place into the provisional form.
   - The back office: `FORBIDDEN`, and M-6 after the eight hours.
3. **POS-01's "Your session was ended by a manager" claims more than `UNAUTHENTICATED` proves**
   (question 5). Proposed, for the designer: a sentence that says the session ended and to sign
   in again, and that a manager can help if the PIN no longer works.
4. **M-6 in DESIGN.md and `shell.html` is stale in three places.** It calls the cooldown the
   "LOGIN five-minute cooldown" and "installation-wide"; it is per account (FR-A5b, ADR-009 §4).
   It says "whether the `reauth-other` fixture affects LOGIN counting remains an owner question";
   the owner ruled on 2026-10-06 that the other manager's failures count on their own account.
   And it shows "the manager's name read-only" where the lead's delegated ruling of 2026-10-06
   says the username; `BackOfficeSessionView` carries both, so either can be shown, but the two
   documents should agree.
5. **A question for the designer: the Phase 0 frame.** With no destination, no business day and
   no incident route, 011d shows the frame with an empty rail and an empty pane (question 7). If
   the designer would rather it showed something else, that is a drawing to make before 011d.
6. **SITEMAP `:247-248` and BO-01's inventory entry still say `FR-A5` and a `LOGIN` cooldown**
   (ARCH-012 *For the lead* 1, wording proposed there, still unapplied). The brief noted it; it
   is repeated here only because 011d's builder will read both.

## What to deliver

1. **POS-01** (blocks PHASE0-011c): the *error* body without a count; *permission-denied* deleted
   from the inventory and the artifact; *session invalidated* reworded as *For the lead* 3 proposes
   or better; the short-PIN behaviour (the consult recommends `requireFull`); the two general states.
2. **The back office** (blocks PHASE0-011d): BO-01's states and copy for every row of question 9's
   table that reaches it (in Frost, or as a table of state, trigger code and exact sentence that
   011d places into the provisional form of question 7); `FORBIDDEN`; M-6 after the eight hours; the
   two general states; M-6's three stale places in DESIGN.md and `shell.html` corrected.
3. **M-1:** `approval-error` without "3 attempts remaining"; `approval-denied` no longer telling a
   cashier's PIN from an unknown one (ARCH-013 *For the lead* 3). Nothing is wired to M-1 in Phase 0;
   this keeps the picture honest for Phase 2.
4. **SITEMAP `:247-248` and BO-01's inventory entry:** `FR-A5b` and a per-account cooldown, as
   ARCH-012 *For the lead* 1 proposes.
5. **The Phase 0 back-office frame** (*For the lead* 5): say whether the empty rail and empty content
   pane are acceptable, or draw what it should show instead. Nothing it shows may need a route Phase 0
   does not have.

## Constraints

- **No state the server cannot signal**, and no number it does not send: no attempt count, no "account
  deactivated", no distinction between a cashier's PIN and an unknown one. A cooldown's length comes
  from `retryAfterSeconds`; a sentence may not hard-code "five minutes" as a number the client would
  have to display (B-24); words like "a few minutes" are your call.
- **The general states** cover every code an honest client never causes (`VALIDATION_FAILED`,
  `CSRF_REFUSED` after the one retry, `ORIGIN_REFUSED`, `NOT_FOUND`, `PAYLOAD_TOO_LARGE`,
  `UNSUPPORTED_MEDIA_TYPE`) under "something went wrong", unless you show a reason to separate one.
- **Frost values only.** Any new token is proposed in `docs/DESIGN.md` with its reason; nothing is
  invented in an artifact.
- **No PIN at the back office** anywhere (ADR-009). **No password recovery** in the interface (the
  script is the recovery, ADR-009 §7).
- **Do not decide an owner question.** If a sentence would need one, draw around it and list it.

## Tests expected to change

None under `apps/` or `packages/`. If an artifact's change would break an existing artifact check
in `docs/design/`, name it in the Handoff.

## Acceptance criteria

1. Every row of question 9's two lists has a state and an exact sentence, or an explicit "no state,
   with the reason", in `SCREEN-INVENTORY.md`.
2. `grep -rniE "attempts? remaining|deactivated|installation-wide" docs/design docs/DESIGN.md` shows
   no surviving claim on POS-01, M-1, M-6 or BO-01; the Handoff shows the output and explains any
   remaining hit.
3. Each changed artifact opens in a browser with no console error; the Handoff lists each file and
   state changed.
4. The Handoff lists every sentence written, by screen, state and trigger code, as one table the
   builders of 011c and 011d can place without reading the artifacts.

## Out of scope

- Design slice B (BO-01 and BO-02 as full screens), slices D to H, BO-12 and BO-13 beyond the check in
  *Required inputs*.
- A warning before the POS idle lock (the consult says none is designed; that would be the owner's
  request and its own task).
- Any code, any contract document, any ADR.

## Reporting

When done, run exactly one of:

    herdr agent prompt lead "designer15: DESIGN-015 done — <one line>"
    herdr agent prompt lead "designer15: BLOCKED — <question>"

## Lead check before review (2026-10-14)

Addressed to the reviewer, and to the designer for any round 2.

The Handoff removes M-6's choice for a different manager and routes that manager through Log out and
BO-01 ("To sign in as someone else, log out"). The owner's ruling of 2026-10-06 (DECISIONS.md, the line
that *refines the lead's delegated M-6 line*) says M-6 "offers a choice for a different manager to enter
their own username and password instead; that is an ordinary sign-in as the other manager, whose
failures count against their own account, and the idled manager's draft is not carried over", in the
owner's words "there is an option if its another manager then he can choose to input their own
username". The lead's *Required inputs* summarised that day's rulings as "M-6 is password-only", which
left the choice out; the misreading started there, not with the designer. Reviewer: judge the delivery
against the ruling as recorded, not against the lead's summary, and say what M-6 must show.

## Round 2 — the review's eight findings (lead rulings, 2026-10-14)

The review is `.agent/reviews/DESIGN-015-review.md` (Claude, eight findings). All eight are accepted.
Addressed to designer15. Each finding's *Proposed fix* in the review is the instruction unless a ruling
below says otherwise.

1. **F1: restore the other-manager choice on M-6**, following the review's list *What M-6 must show*,
   items 1 to 8, and replace both passages that attribute the Log-out-only route to the 2026-10-06
   ruling. Note for the builders, not for you: that choice sends the ordinary back-office sign-in, not
   the re-authentication request; ARCH-014 question 5's table already says so.
2. **F1's open question and F4's are with the owner** (asked 2026-10-14): when a different manager signs
   in from M-6, is the idled manager's draft destroyed, or kept for the idled manager? And after the
   eight hours, does the same manager signing in again get the draft back? Draw around both: no
   sentence may promise either answer. If the owner answers before you finish, the lead writes the
   answer here and you follow it. List them under *Questions* in your round-2 Handoff either way.
3. **F2:** delete the BO-01 username-format row and the password-length rows on BO-01 and M-6, and the
   "shared-schema check" attribution. Keep "Enter your username." and "Enter your password.". Give one
   sentence, or reuse *error*, for a value over the schema's bounds (256 username units, 1024 password
   units), sent with no request.
4. **F3:** add the three rows: the initial session lookup failing (which screen; *Try again* repeats the
   lookup), back-office Log out failing (stay in the frame; where the notice sits; *Try again* repeats the
   logout; BO-01 never shown until the server confirms), and POS Release failing. **For Release, the
   architect's rule binds:** "the screen goes to POS-01 whatever the answer" (ARCH-014 question 5, the
   POS table), because a cashier who pressed Release must never stay signed in on screen; draw that, with
   no notice, rather than a retry. The back-office logout keeps the review's safer rule.
5. **F4:** mark the retained-draft sentence on BO-01 as not placed in Phase 0, and reword it so it does
   not address whoever is at the desk as the draft's owner.
6. **F5 to F8** as proposed: the incident confirmation goes to `incidents.html` (and the dead lines in
   `mockup.js` go); under sixty seconds the duration drops the minutes part and zero means the cooldown
   has ended; BO-01's throttled title names the username's scope, with one sentence on editing the
   username; SITEMAP `:108` reads "Session ended — sign in again".
7. Update the Handoff's copy table for every changed row, append a *Round 2* section (do not rewrite
   round 1), commit on this branch, and report with the same two lines as before.

## Handover (lead, 2026-10-14): round 2 continues on OpenCode

designer15 (Codex) reached its usage limit early in round 2, after reading the review and starting edits.
The owner asked for OpenCode on `openai/gpt-6-astra` (a separate account) to carry on, as on 2026-10-06.
**Finish the inherited work; do not restart.** Uncommitted in this worktree when Codex stopped: `docs/DESIGN.md`, `docs/design/SCREEN-INVENTORY.md`, `docs/design/SITEMAP.md`, `docs/design/prototype/back-office/login.html`, `docs/design/prototype/pos/lock.js`, `docs/design/visual-directions/mockup.js`.
Read `git diff` first: those edits are designer15's partial round 2, made against the round-2 rulings above.
Keep what is right, finish what is missing, and say in your round-2 Handoff section what you inherited and
what you changed. Codex also wrote a helper at `/private/tmp/design015-round2-docs.py`, outside this
worktree; do not rely on it. Do not commit screenshots or measurements (run output). Each browser run and
each command outside the allowed list is the owner's to approve.

## Handoff

### Delivered by designer15 — 2026-10-14

Completed the code-to-state copy specification in SCREEN-INVENTORY and aligned
Frost and the behavioral wireframes with it. POS-01 has no separate credential
permission refusal, no count, and no claim that a manager ended the session.
Its confirmation requires all six digits; the drawing counts masked positions
only and neither stores a PIN nor makes a request. The two general failure
states have their exact sentences and recovery actions. BO-01 is delivered as
the permitted provisional-form table, including access refusal and M-6's
return after session loss. The full Frost BO-01/BO-02 compositions remain slice B.

M-6 now fixes the username, labels Password without a provisional qualifier,
and describes a per-account cooldown. Its old `reauth-other` picture is a
review alias of the same password failure and increments the same local fixture
counter. A different manager uses Log out, explicit draft discard, and BO-01;
that manager's failures belong to their own account. This follows the recorded
2026-10-06 refinement and ADR-009, rather than creating a new owner ruling.
M-1's two refusal pictures use identical copy and no count; the cooldown picture
has an inert confirmation and cleared dots. Its old `approval-denied` URL is
only an alias, not a client state that distinguishes PIN owners.

The Phase 0 office frame with an empty rail and empty content pane is accepted,
with only “Back office”, the real manager name and Log out in the top bar.
No new token, full screen composition, business-day value, incident or
navigation destination was invented. The populated shell remains a review
fixture for later phases. DESIGN.md and BO-02 explicitly document this exception.

The branch was clean at `3f4585c`, the task-file commit directly above the stated
base `2dfc26d`. Only owned design paths and this Handoff were edited. No product
contract, ADR, application, package or database file was changed. The task's
2026-10-13 served-POS ruling was not present under that date in DECISIONS.md in
this checkout; this task did not change served-client behavior or decide it.

### Exact product copy for the builders

This is one placement table for PHASE0-011c and PHASE0-011d, also carrying M-1's
future copy. Quotation marks delimit strings and are not rendered. `{wait}` is
`{minutes} min {seconds} s`, derived solely from `retryAfterSeconds` and the
remaining deadline. The fixture durations are examples. A missing/invalid
server duration uses the general failure; there is no guessed duration.

“General failure” below means `INTERNAL`, an unparseable failure,
`VALIDATION_FAILED`, `CSRF_REFUSED` after the one permitted recovery/retry,
`ORIGIN_REFUSED`, `NOT_FOUND`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, or
an unexpected code for that surface. Before that single CSRF recovery fails,
there is no new visible error. No raw code or server text becomes product copy.

| Screen | State | Trigger | Exact title, body, labels and action |
|---|---|---|---|
| POS-01 | Resting | Cold start, release, initial unauthenticated lookup, or `SESSION_IDLE` | Heading “Enter PIN”; helper “Six digits”; confirmation accessible name “Continue”; backspace accessible name “Delete last digit”. No idle sentence. |
| POS-01 | Short PIN | Local entry of zero to five digits | Same resting copy. Confirm disabled and Enter ignored; no request. Six digits enable Confirm and a seventh is ignored. Drawing's masked-position description is “{count} of 6 digits entered”, which counts local entry, never failures. |
| POS-01 | Loading | Verification in flight | “VERIFYING”. Entry and duplicate submission disabled. |
| POS-01 | Error | `INVALID_CREDENTIALS` without cooldown details | “PIN not recognised” / “Enter your six-digit PIN again. Ask a manager if you need help.” |
| POS-01 | Throttled | `INVALID_CREDENTIALS` with details, or `THROTTLED` | “Sign-in locked for {wait}” / “Sign-in is cooling down. Wait for the countdown to finish, then enter your PIN.” Whole pad disabled until zero. |
| POS-01 | Session invalidated | `UNAUTHENTICATED` on a held session | “Your session has ended” / “Sign in again. Ask a manager for help if your PIN no longer works.” |
| POS-01 | Tender draft waiting | Draft in this tab's store | “Payment in progress on this tab” / “{order label} — {outstanding} outstanding, {tender count} tenders drafted. Sign in to continue. Nothing has been recorded yet.” Use “1 tender drafted” for one. |
| POS-01 | Future emergency presence | Future incident route; no Phase 0 state | “Kitchen printer needs attention” / “Tap to sign in and view. No order details are shown before sign-in.” Existing “Sign in to view” action. The future fixture is retained, not a Phase 0 data claim. |
| POS-01, BO-01, M-6; shared by both clients | Unavailable | `UNAVAILABLE`, or no response | “The system is unavailable” / “Wait a moment, then try again.” Action “Try again”. |
| POS-01, BO-01, M-6; shared by both clients | Something went wrong | General failure group above | “Something went wrong” / “Try again. If the problem continues, ask a manager for help.” Action “Try again”. |
| BO-01 | Resting and common form | Cold start, explicit logout, or initial `me` returns `UNAUTHENTICATED` | “Back office” / “Sign in with your manager username and password.” Labels “Username”, “Password”; action “Sign in”. |
| BO-01 | Missing username | Local validation | “Enter your username.” |
| BO-01, M-6 | Missing password | Local validation | “Enter your password.” |
| BO-01 | Invalid username format | Local shared-schema check, after trim/lowercase | “Use 3–32 letters, numbers, dots, underscores or hyphens for your username.” |
| BO-01, M-6 | Invalid password length | Local shared-schema check; never trim the password | “Use 8–128 characters for your password.” |
| BO-01 | Loading | Sign-in in flight | Action “Signing in…”. Fields and repeat submission disabled. |
| BO-01 | Error | `INVALID_CREDENTIALS` without cooldown details | “Sign-in failed” / “Check your username and password, then try again.” |
| BO-01 | Throttled | `INVALID_CREDENTIALS` with details, or `THROTTLED` | “Sign-in locked for {wait}” / “This username is cooling down. Other managers can sign in with their own usernames.” Keep Username editable; retain known wait when switching back. |
| BO-01, from M-6 or other protected office work | Session ended | `UNAUTHENTICATED` on a held session, including absolute expiry | “Your session has ended” / “Sign in again to continue.” If a draft was retained locally, append “Your unsaved changes are kept on this tab and will not be submitted automatically.” |
| BO-01, from M-6 or other protected office work | Access refused | `FORBIDDEN` | “Manager access required” / “This account cannot use the back office. Sign in with a manager account.” Remove protected work and show the ordinary sign-in form. |
| BO-01 / BO-02 | Successful sign-in | Success | No success sentence. Phase 0 top bar “Back office”, real manager name, “Log out”. Empty rail and pane; no empty-data claim. |
| BO-01 | Idle | `SESSION_IDLE` on a held session | No BO-01 sentence or navigation; open M-6. |
| M-6 | Re-authenticate | `SESSION_IDLE` | “Your session timed out” / “Your unsaved changes are kept. Continue as {username} to resume them. To sign in as someone else, log out.” Labels “Username”, “Password”; actions “Log out”, “Continue”. |
| M-6 | Verifying | Re-authentication in flight | Action “Verifying…”. |
| M-6 | Error; `reauth-other` review alias | `INVALID_CREDENTIALS` without cooldown details | “Incorrect password. Try again.” |
| M-6 | Throttled | `INVALID_CREDENTIALS` with details, or `THROTTLED` | “This username is cooling down. Try again in {wait}. Log out is still available.” |
| M-6 | Logout during cooldown | Local Log out while a wait remains | Append to existing discard confirmation: “This username is locked for {wait}. Logging out does not end its cooldown. Other managers can sign in with their own usernames. Waiting here keeps your draft.” |
| M-6 | Discard confirmation, retained existing copy | Local Log out | “Log out and discard your changes?” / “The unsaved changes to this draft will be lost. Anyone signing in next starts a separate session.” Actions “Keep this draft”, “Discard changes and log out”. |
| M-6 | Resumed, retained existing copy | Successful same-manager re-authentication | “Your session has resumed.” / “Your changes are still here. Nothing has been submitted.” |
| M-1 | Error; `approval-denied` review alias | `APPROVAL_FAILED` without cooldown details | “Manager PIN not recognised” / “Ask a manager to enter their PIN again.” |
| M-1 | Throttled | `APPROVAL_FAILED` with details, or `APPROVAL_THROTTLED` | “Manager approvals locked for {wait}” / “Wait for the countdown to finish. Signing in at the POS does not end this cooldown.” Cancel stays available. |

Clear secrets after every response, including success. General-failure retry at
sign-in/M-6 asks for fresh secret entry, preserves username and protected draft,
and never automatically resends a credential. Elsewhere it uses the screen's
existing reconciliation/read path, not repetition of an uncertain command.
At absolute expiry keep the draft local and isolated; no automatic submission
or invented cross-session restore workflow. A new manager never receives it.
There is no separate credential permission refusal on either sign-in and no
M-1 production route in Phase 0. Approval codes on a sign-in are unexpected and
use the general failure group. Overflow adds no sentence: POS-01 fits its target;
the office form scrolls if necessary.

### Artifacts and states changed

| File | Changed states / supporting change |
|---|---|
| `docs/design/visual-directions/frost/pos/lock.html` | `default`, `error`, `throttled`, `invalidated`; added `short-pin`, `ready`, `unavailable`, `unexpected`; existing draft/incident paths inherit six-digit confirmation. |
| `docs/design/prototype/pos/lock.html` | Same copy and states, so the behavioral authority agrees with Frost. |
| `docs/design/prototype/pos/lock.js` | Shared, local-only masked-position drawing behavior for both lock artifacts; disables the entire cooldown pad and prevents short confirmation. |
| `docs/design/visual-directions/frost/pos/order.html`, `docs/design/prototype/pos/order.html` | `approval-error`, `approval-denied`, `approval-throttled`; identical refusal, no count, empty dots, disabled cooldown picture. |
| `docs/design/visual-directions/frost/back-office/shell.html`, `shell.js` | `reauth`, `reauth-error`, `reauth-other`, `reauth-throttled`, and logout during cooldown; fixed username, per-account wording, alias counted on the fixed account. |
| `docs/design/prototype/back-office/login.html` | `default`, `loading`, `error`, `throttled`; removed unsupported `denied`; username/password and FR-A5b replace the old credential drawing. This remains greyscale, not the full slice B screen. |
| `docs/design/prototype/index.html`, `docs/design/visual-directions/manifest.js` | State selectors match the changed pictures and aliases. |
| `docs/design/checks/design012.cjs` | The logout check now expects the per-account sentence and `min`/`s` duration; its old global-cooldown/colon-duration assertion would have failed intentionally. |

### Verification and limits

- `npm run verify` passed: 70 test files, 3,365 tests, including typecheck.
  The first sandboxed run could not reach PostgreSQL (`EPERM 127.0.0.1:5433`);
  the approved rerun passed. Vite emitted its existing native-config warning.
- Browser inspection used Chrome through CUA with a loopback-only preview of
  `docs/design`. Direct `file:` navigation was blocked by browser policy, and
  the preview port required sandbox approval. No repository files were served
  outside the design subtree.
- Opened every changed HTML artifact and both galleries. Inspected all eleven
  Frost POS-01 states, the three changed M-1 states in both directions, all four
  BO-01 wireframe states, and M-6's re-authenticate, verifying, error, alias,
  cooldown, logout and resumed states. Console error/warning reads were empty.
- At 1280×800, POS keys measured 88×88 and the longest new notice left the pad
  bottom at 723px. M-1's longest changed modal stayed between approximately
  42px and 758px. At 1440×900, the M-6 dialogs measured 640px wide and remained
  within the viewport. Screenshots were inspected in the browser tool.
- Exercised five-digit Enter (no navigation), sixth-digit enablement, backspace
  disabling confirmation, Try again focus restoration, six-digit navigation to
  Floor, draft navigation to the existing settlement re-authentication fixture,
  M-1 Cancel, M-6 Escape resistance, keep-draft cooldown preservation, five alias
  failures reaching cooldown, empty password after refusal, and confirmed
  logout reaching BO-01. The final confirmation pass checked neutral disabled
  styling and cleared approval dots. These are fixture checks, not real auth.
- `node --check` passed for the new lock runtime, changed shell runtime,
  manifest and DESIGN-012 check. `git diff --check` passed.
- The full legacy headless `design012.cjs` suite was not run; its relevant
  changed assertion and alias behavior were exercised in the CUA browser.
  BO-01/M-6 general failures, `FORBIDDEN` and absolute expiry are supplied in the
  permitted copy tables; they are not claimed as newly drawn Frost screens.
- BO-12 was checked only: DESIGN-014's `audit.js` retains the distinct
  “Approval request refused · cooldown” outcome with null approver. No BO-12 or
  BO-13 change was made.

### Required stale-claim scan

Command: `grep -rniE "attempts? remaining|deactivated|installation-wide" docs/design docs/DESIGN.md`.
Output at handoff:

```text
docs/design/checks/design014.cjs:60:  long:['CATER-0610','Ratna Ayu Kartikasari Prameswari','Deactivated','999.999.999']
docs/design/checks/design014.cjs:107: await p.locator('#filter-person').selectOption('former');check((await rowIds()).join(',')==='long','deactivated actor remains searchable');
docs/design/visual-directions/paper/pos/order.html:623:          <div>3 attempts remaining before manager approvals are locked for five minutes.</div>
docs/design/visual-directions/paper/pos/lock.html:46:        <div>2 attempts remaining before a five-minute cooldown.</div>
docs/design/visual-directions/frost/back-office/audit.js:38:    Object.entries(labels).forEach(([value,label])=>filters[key].add(new Option(label+(value==='former'?' · Deactivated':''),value)));
docs/design/visual-directions/frost/back-office/audit.js:58:  function person(key){return escape(people[key])+(key==='former'?'<small>Deactivated</small>':'');}
docs/design/prototype/pos/floor.html:160:      <li>A deactivated table disappears here, but cannot be deactivated at all while
docs/design/prototype/back-office/tables.html:39:        <div class="banner__t">Table 1 was not deactivated</div>
docs/design/prototype/back-office/tables.html:97:    <li>A table holding an open order cannot be deactivated, and the rejection names
docs/design/prototype/back-office/tables.html:105:  refresh. A deactivated table is kept, not deleted, so history still resolves. <span class="req">B-8</span></p></div>
docs/design/SCREEN-INVENTORY.md:134:- *table deactivated* — a table deactivated in the back office is gone from
docs/design/SCREEN-INVENTORY.md:718:table holds an OPEN order* (FR-C8, AC-32) · *deactivated table retained for
docs/design/SCREEN-INVENTORY.md:723:**Must not invent.** A table holding an OPEN order cannot be deactivated
docs/design/SCREEN-INVENTORY.md:763:*overflow* · *deactivated preset — hidden from the POS picker but still
docs/design/SCREEN-INVENTORY.md:1022:Deactivated presets are absent from the picker but readable on orders holding
```

The two remaining attempt-count hits are in the rejected Paper direction,
which the designer role explicitly leaves untouched. They are historical, not
current POS-01/M-1 instructions; DESIGN.md makes the new inventory authoritative.
All other hits concern deactivated tables, presets or historical audit actors,
including DESIGN-014 checks. None is a POS-01, BO-01, M-1 or M-6 credential claim.
There is no surviving `installation-wide` wording in the scanned current design
files. POS PIN throttling still correctly applies across the installation;
only back-office password throttling is per account.

No owner question remains for this delivery. The copy and provisional frame
exception await the task’s planned design review.

DONE
