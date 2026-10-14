---
id: DESIGN-015
title: Sign-in copy and states for POS-01, BO-01 and M-6, with no attempt count and no state the server cannot signal
category: ui
touches: [identity]
depends_on: [DESIGN-012]
owns: [docs/design/**, docs/DESIGN.md]
status: not-started
cycles: 0
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

## Handoff
