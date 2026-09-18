# FE-006 — Manager approval prompt, M-1 (F2g)

**Status:** Done 2026-09-18, lead-verified. Awaiting the owner's look.
**Roadmap item:** F2g
**Branch:** `agent/phase-0-foundations`
**Assigned:** `builder8`

---

## Why this is one slice on its own

Two families of gated work lead here — the discount sheets (F2i) and the void
sheets (F2j) — so the prompt is built **once, before either**, rather than twice
or as a side effect of whichever came first.

**This is the most boundary-sensitive screen built so far.** It touches `B-12`,
`B-13` and `B-14` directly, and SCREEN-INVENTORY gives M-1 a six-item
*"Must not invent"* list, which is longer than any other node's. Read that list
before you write anything; most of this task is obeying it.

---

## Objective

The manager approval prompt renders as a modal over the order screen in the four
states the artifact draws, with **no PIN value observable anywhere** and **no
approval that outlives the single action it authorises**.

---

## Required inputs

Read these first. Do not work from this file's summary of them.

1. **`docs/BOUNDARIES.md`, `B-12`, `B-13`, `B-14`.** Inviolable. A change that
   breaks one is a defect regardless of what else it achieves.
2. **`docs/design/SCREEN-INVENTORY.md` — M-1**, in the worktree at
   `../restaurant-pos-design`. Its *"Must not invent"* list is six items and
   each is a requirement.
3. **`docs/design/visual-directions/frost/pos/order.html`** — the approval modal
   is the `data-when="approval approval-error approval-throttled approval-denied"`
   block.
4. **`apps/pos/src/PinPad.tsx` and `apps/pos/test/pin-pad.test.tsx`** on this
   branch — the lock screen's pad and the `B-12` test that guards it.
5. **`.agent/tasks/FE-005-ungated-sheets.md`** — the handoff and the lead's
   rulings. Its reachability guard is the standard for the kind of test that
   earns trust here.

---

## What to build

### The four states the artifact draws

`?state=` on `/pos/order`, over the order screen.

| State | What it shows |
|---|---|
| `approval` | Awaiting the PIN. Six dots, the keypad, what is being approved |
| `approval-error` | Wrong PIN. *"3 attempts remaining before manager approvals are locked for five minutes"* |
| `approval-throttled` | *"Manager approvals locked for 4 min 38 s."* Five failed attempts |
| `approval-denied` | A cashier PIN where a manager is required. *"That PIN is not a manager. The attempt has been recorded."* |

`approval-error` and `approval-denied` are **different failures** and the copy
distinguishes them: one is a wrong credential, the other is a valid credential
of the wrong authority. Do not collapse them.

### `B-12` — acceptance criterion 1, and the sharpest test here

**No PIN value appears anywhere observable — including partially masked.**

`pin-pad.test.tsx` already guards the lock screen's pad by entering `123456` and
`987650` and asserting the rendered `innerHTML` is **byte-identical**. That
test, or one exactly as strong, must cover this pad too. Entry shows a *count*,
never a digit, never a masked digit, never a length-revealing hint beyond the
dots the artifact draws.

`console-free.test.ts` already bans console, storage, cookies, `fetch`, XHR and
beacons across `src`, which closes the other obvious leaks. Check it covers your
new files.

### `B-14` — the approval authorises one action, and does not persist

From SCREEN-INVENTORY, all of these are forbidden and each is worth a test:

- **No "approve all"**, no batching, no "apply to the rest of this order".
- **No remaining-time indicator on the approval itself.** The *throttle*
  countdown is a different thing and is drawn; an approval that shows time left
  is an approval with a lifetime, which is what `B-14` forbids.
- **No re-use.** Nothing is cached, nothing is carried to a subsequent action,
  nothing extends into a session.
- **Never a route, never a mode, never a session.** It is a modal over the
  screen that triggered it. **There is no "manager is here now" state.**

**A manager already holding a back-office session still enters a PIN here**
(`FR-A2c`, `AC-27`). If you find yourself writing anything that would let that
manager skip the prompt, stop — that is the boundary, not an optimisation.

### What is being approved is shown, and a required reason travels with it

The artifact's head reads:

> **Manager PIN**
> Void a fired line — Burger 135.000 — reason: customer changed their mind

So the prompt **displays** the action and, where the PRD requires one, the
reason — captured upstream, before the PIN. Where a reason is required
(`FR-H4` fired-line void, `FR-H5` refund) it is **required, not optional**.

In this slice the upstream sheets do not exist yet, so the action and reason
arrive as fixture data. Model them as data the prompt is *given*, not as
something it collects — the sheets in F2i and F2j will supply them.

### Cancel is evidence, not a no-op

The artifact's footer says *"Cancelling changes nothing on the order."* That is
`B-20` on screen. But note what SCREEN-INVENTORY adds:

> Cancelling writes an audit entry naming the actor with approver null
> (`FR-J3`, `AC-18`) — the cancel path is evidence, not a no-op.

Nothing is real in this slice, so you write no audit entry. **Do not draw
anything that contradicts it either** — no "nothing happened" reassurance beyond
the artifact's own line, which is about the *order*, not about the record.

### Two states M-1 names that the artifact does not draw

M-1 lists *loading* and *no manager available* (PRD §6, blocked, nothing
written) among its states. The artifact draws neither.

**Do not invent either one.** Instead:

- For *loading*: check whether the lock screen's existing verifying treatment
  covers it. If it does, reusing it is not inventing — say so in your handoff.
  If it does not, leave the state out and name the gap.
- For *no manager available*: if nothing in the artifact or the wireframe draws
  it, it is a design gap of the same shape as A7's three missing states. **Name
  it; do not fill it.** It goes to a designer and through review, not into this
  task.

### The keypad — reuse or duplicate is a real decision

The lock screen's pad is 88×88 keys. This modal's artifact draws 72px keys in a
three-column grid. `PinPad.tsx` exists.

Decide whether to reuse it with the geometry parameterised, or build a second
pad, and **say which and why**. If reuse would force either pad to drift from
its reviewed geometry, do not reuse — but do not duplicate the `B-12` guarantee
by accident either: whichever way you go, **one test must cover both pads**.

### Values, and controls

- **Check the registry before concluding a value is absent.** Three task files
  of the lead's have now asserted absences that were present, because tokens are
  named for role rather than number. If a value is genuinely absent, omit it,
  comment it, and name it.
- **Every acting control is a `<button>`** (ruled 2026-09-17). Keys, Cancel,
  the confirm key. The artifact draws the confirm key as an anchor; that is
  fixture shorthand.
- The modal is a dialog: `role="dialog"`, `aria-modal="true"`, focus moves in,
  Escape and Cancel return it. Same as the sheets in F2c.

---

## Constraints

- **No boundary is subject to your judgement.** If this task appears to require
  breaking `B-12`, `B-13` or `B-14`, the task is wrong — stop and say so.
- **Build the prompt, not its callers.** No void sheets, no discount sheets.
  Those are F2i and F2j and they will call into this.
- **Do not edit the panel, menu region, or existing sheets** beyond what mounting
  a modal over them requires.
- **Do not edit `frost-states.css`, the fixture, the registry, or any contract
  document.**
- **No fetch, storage, or console.** **Money stays a `bigint`.** Every hover
  inside `@media (hover: hover)`.
- **Do not write `.agent/MEMORY.md` or `.agent/ROADMAP.md`.**

---

## Acceptance criteria

1. **`B-12`: two different PINs of the same length produce byte-identical
   rendered output**, proven by a test covering this pad — and you have seen it
   fail when deliberately broken.
2. The four drawn states render at 1280×800 over the order screen and are
   reachable by `?state=`.
3. `approval-error` and `approval-denied` remain distinct in copy and meaning.
4. **Nothing in the build caches, batches, re-uses, or times an approval**, and
   there is no path by which a back-office session skips the prompt. Tested.
5. The prompt displays the action and its reason as data it is given.
6. The modal is a dialog: focus moves in, Escape and Cancel return it.
7. Every acting control is a `<button>`.
8. A pressed key draws the ring. **Verified in a browser with the press held.**
9. `npm run verify` passes. FE-005 left 356 tests across 14 files; state the new
   count. Typecheck clean.
10. `loading` and `no manager available` are either reused from an existing
    reviewed treatment or **named as gaps** — never invented.

---

## Out of scope

- `sheet-discount`, `sheet-freeform`, `sheet-remove`, `zero` — **F2i**.
- `sheet-voidline`, `sheet-voidorder`, `sheet-voidorder-fired` — **F2j**.
- `error`, `fireerror`, `fireblocked` — F2h. `quick`, `quick-line` — F2d.
- Converting F2a's and F2b's anchors to buttons — F2e.
- Any real authentication, audit write, or throttle enforcement. Fixtures only.

---

## Handoff

Write your handoff here when the work is done. Name the command, the URL, and
the `?state=` values.

**Raise judgement calls rather than taking them.** The last four slices raised
them and four times the task file turned out to be wrong where a reviewed
document was right — twice about which tokens exist, once about which states a
screen has, once about which actions are gated. This file is derived; **where it
disagrees with BOUNDARIES.md or SCREEN-INVENTORY, those win and this is the
defect.**

If a check was skipped, say which and why. The lead verifies with `git log`, a
browser, and by injecting the defect your tests claim to catch.

### 2026-09-18 — implementer (claude, Opus 5)

**Done. All four drawn states are built. `loading` and `no manager available`
are named as gaps and not built.** Nothing in this task required breaking
`B-12`, `B-13` or `B-14`. Five places where the task file, the artifact and
the reviewed documents disagree are raised below. None of them is settled by
my choice.

**Not committed.** Working tree on `agent/phase-0-foundations`:

- new: `apps/pos/src/Approval.tsx`, `apps/pos/src/approvalFixtures.ts`,
  `apps/pos/test/approval.test.tsx`
- modified:
  - `PinPad.tsx`: one prop, `geometry`, which adds a class and nothing else
  - `OrderPanel.tsx`: **`OrderScreen` only**. It mounts the prompt, makes the
    background inert, returns focus, and replaces history on exit
  - `orderFixtures.ts` and `menuFixtures.ts`: the four states, drawn over the
    table order and the default grid
  - `pos.css`: a new M-1 section
  - `order-panel.test.tsx`: the exact-states list
  - `sheets.test.tsx`: "no sheet in any other state" now excludes the
    approval states, which hold a dialog of their own
  - `pin-pad.test.tsx`: the `B-12` block now runs over both pads

`.agent/MEMORY.md` was already modified when I started. I did not touch it or
`ROADMAP.md`. `frost-states.css`, the fixture, the registry and every contract
document are unedited. No panel, menu or sheet markup changed.

#### What the owner opens

```
npm run dev -w apps/pos        # http://127.0.0.1:5173/pos/order?state=approval
```

The new `?state=` values are **`approval`, `approval-error`,
`approval-throttled` and `approval-denied`**. The twelve earlier states still
work. The Vite server on 5173 was **already running** (pid 31567, not mine,
the same one FE-002 to FE-005 found). I used it and left it running.

#### The keypad: reuse, with the geometry as a class

**I reused `PinPad`.** `geometry="approval"` adds `keypad--approval`, and two
CSS rules set that class to `--frost-approval-columns` and
`--frost-approval-key-height`. **Both tokens already exist in the registry**,
sourced from this artifact's own inline styles, and DESIGN.md names them:
"Manager-approval key 72×72px". Nothing new was needed.

Why reuse:

- **`B-12` lives in the pad's logic, not its geometry.** The digits are held
  in a ref, the pad renders a count, and it clears on submit and unmount. A
  second pad would be a second copy of the one piece of code that must not
  drift.
- **Reuse costs neither pad its geometry.** The lock pad's rules are
  untouched. I captured the lock screen's `innerHTML` in all 8 states, at rest
  and after three digits, before and after the change. **`cmp` found them
  byte-identical.** In Chrome the approval keys measure **72×72**, at columns
  x = 522, 604, 686, which is a 10px gap.

#### Acceptance criteria

1. **`B-12`: one test over both pads, and I watched it fail.**
   `pin-pad.test.tsx` runs the `B-12` block with `describe.each` over two
   mounts: the lock screen, and `OrderScreen` at `?state=approval`. Each mount
   runs four checks:
   - Two different PINs render byte-identical HTML.
   - **New:** two PINs render byte-identical HTML after *every* digit.
   - No entered digit appears in any attribute.
   - Nothing reaches the console, storage, cookies or the title, and no digit
     reaches the URL.

   A further test asserts that both mounts find one keypad with the same
   twelve keys.

   I injected each defect, ran the tests, and restored the file (`cmp` clean):

   | Injected | Failed |
   |---|---|
   | Approval pad only: a hidden span shows `•••••6`, a partial mask | 2, both in the **M-1** block |
   | Lock pad only: `data-last={last digit}` | 3, all in the **POS-01** block |
   | Approval pad only: the dot class leaks whether each digit is odd | 1: **only the new per-length test.** The original test passed it, because 123456 and 987650 share the odd/even pattern 1-0-1-0-1-0 |
   | `console.debug` in the prompt's submit | `console-free` and the M-1 console check |
2. **Four states at 1280×800, reachable by `?state=`.**
   - In Chrome the device measures 1280×800 and the scrim covers all of it.
   - The modal is 560 wide at x 360. It is 610 tall with no notice and 696
     tall with one, at y 52, so it fits inside the frame.
   - I looked at `approval-error`, `approval-throttled` and the held-Space
     screenshots myself.
3. **`approval-error` and `approval-denied` stay distinct.** The copy is the
   artifact's, verbatim. A test asserts the two differ in title and body, that
   the error never says "not a manager" or "recorded", and that the denial never
   says "recognised" or "attempts remaining". Injecting the error copy into
   `approval-denied` failed 2.
   - **The task file misquotes the denial.** It gives *"That PIN is not a
     manager. The attempt has been recorded."* The artifact has the title
     *That PIN is not a manager* and the body *This action needs a manager.
     The attempt has been recorded.* I used the artifact's copy.
4. **Nothing caches, batches, re-uses or times an approval, and nothing lets a
   session skip the prompt. Tested.** Each defect below was injected and each
   was caught:

   | Injected | Caught by |
   |---|---|
   | A module-level "approved once" flag that swaps the pad for an Approve button: the *manager is here now* state | 10 tests: re-use, carry, every-state-asks, the source scan, and the M-1 `B-12` block |
   | "This approval stays valid for 30 s" in the head | the time tests. See the note below the table |
   | An "Approve all voids on this order" button | 6 tests: exactly twelve keys plus Cancel, and the copy check |
   | A `session` prop; `'back-office'` approves without a pad | the runtime check (the pad must still be there), the source scan, **and `tsc`** (an unused `@ts-expect-error`) |
   | A `setTimeout` that closes the prompt | the source scan |
   | An `/approval` route in `main.tsx` | the never-a-route test |
   | Exit by `pushState` (back-stackable) | 4: the history-length test |

   The time injection also exposed **a weakness in my own test.** The check
   "the only time on the prompt is the throttle's" missed "30 s". The reason
   was that `textContent` glued it to the keypad's digits ("30 s1…"), so the
   regex found no word boundary. The time and copy checks now test each text
   node separately, and they catch it.

   What the tests assert:
   - The only live controls are the twelve keys and Cancel.
   - The only time-shaped text is the throttle's "4 min 38 s", in
     `approval-throttled`.
   - There is no `progress`, `meter`, `time`, `timer` or `progressbar`
     element.
   - Approving and then reopening shows zero dots and a live pad.
   - Digits entered and cancelled, or entered on a failed attempt, never carry
     into any state.
   - No storage and no cookie are written.
   - `ApprovalPrompt` and `ApprovalFixture` accept no session or
     manager-present input. `@ts-expect-error` proves this under `tsc`.
   - `Approval.tsx`, `approvalFixtures.ts` and `PinPad.tsx` contain no timer,
     clock, session, cookie, cache, token or module-level state. The detector
     has self-tests.
5. **The action and reason are given, not collected.**
   - `ApprovalRequest` is a union over the six actions SCREEN-INVENTORY lists.
     For `void-fired-line`, `void-fired-order` and `refund`, `reason` is a
     required `string`.
   - Three `@ts-expect-error` lines prove that a missing reason fails to
     compile. Making `reason` optional failed `tsc` three times.
   - The subject amount is a `bigint` (`135_000n`). A `Number(...)` injection
     failed two tests.
   - The prompt has no input, textarea, select or contenteditable.
   - **On `void-fired-order`:** SCREEN-INVENTORY's parenthesis names only the
     fired-line void and the refund. FR-H4's text, however, reads "Voiding a
     `FIRED` line, **or an order holding one**, requires a manager PIN and
     reason". The artifact's `sheet-voidorder-fired` also draws "Reason —
     required". I followed FR-H4. The inventory's parenthesis is shorthand, and
     the two documents do not conflict.
6. **A dialog.**
   - `role="dialog"`, `aria-modal="true"`, labelled by its `h2`, and described
     by the request line.
   - Focus moves to the dialog. In Chrome, `activeElement` is the dialog, and
     the dialog draws no ring.
   - Cancel and Escape both land on `default` with focus on the fired Burger
     row. In Chrome, Escape after four digits landed on `?state=default` with
     `:focus-visible` on the Burger row, and `history.length` was unchanged.
   - A real click through the scrim on the Soda row left the URL at
     `?state=approval`, so `inert` holds in the browser.
7. **Every control is a `<button type="button">`.** The dialog contains zero
   anchors. The artifact's anchor confirm key became a button.
8. **Pressed ring, verified in Chrome with the press held.** I used the same
   method as FE-002 to FE-005: headless Chrome over CDP, 1400×1000 at DPR 2,
   `mousePressed` held for 150ms, then `:active`, the computed style and a
   screenshot were read, then release away from the target.

   | Held | `:active` | box-shadow |
   |---|---|---|
   | Key 5 | true | `rgb(3,33,37) 0 0 0 2px inset` |
   | Delete | true | ink inset |
   | Continue | true | `rgb(255,255,255) … inset` |
   | **Continue, `approval-throttled`** | true | **`none`** |
   | Key 5, throttled | true | ink inset |
   | Cancel | true | ink inset |
   | **Key 1 focused by Tab, Space held** | true | **`rgb(171,255,174) 0 0 0 6px, rgb(3,33,37) 0 0 0 2px inset`**: the focus ring and the pressed ring together. On keyUp, one dot filled |

   At rest, every one of these is `none`. The evidence is in this session's
   scratchpad (`press-approval.mjs`, `shots/*.png`, `shots/results.json`). It
   is temporary and **not in the repo**.
9. **`npm run verify`: 15 files, 472 tests passed**, up from 14 and 356.
   Typecheck clean. The 116 new tests:
   - 80 in `approval.test.tsx`
   - 16 in `order-panel.test.tsx`: the I-12 block over four states
   - 8 in `no-invented-values`
   - 6 in `pin-pad.test.tsx`
   - 4 in `menu-region.test.tsx`
   - 2 in `money-display`

   `console-free.test.ts` reads every `.ts`/`.tsx` in `src` and covers the new
   files; the injection above proved it. `npm run build -w apps/pos` succeeds.
10. **`loading` and `no manager available` are gaps.** See the next section.

#### The two undrawn states — named, not built

**`loading` is not built, and the lock screen's treatment does not fully cover
it.** I checked. The lock screen's verifying state fills the dots, withdraws
the keypad and shows VERIFYING, and `PinPad`'s `verifying` prop already draws
that. The approval modal adds one thing the lock screen never had: **Cancel
stays in the footer while the PIN is in flight.** The lock screen has no
Cancel, so its treatment says nothing about this.

- If Cancel stays live during verification, the footer's *"Cancelling changes
  nothing on the order"* may be false. The server can approve and execute the
  action after the cashier has pressed Cancel. That is `B-20` territory.
- If Cancel is withdrawn, that is a new decision.

Either way, it is a decision about the modal, not a reuse. Separately, the
lock screen's verifying style is itself unreviewed (DESIGN.md open item 6,
"Loading and skeleton treatment — inherited"). **This goes to a designer:**
state what Cancel does while approval is verifying, and whether the copy
holds. Once that is ruled, the rest is one fixture entry with
`verifying: true`.

**`no manager available` is not built.** It appears in PRD §6 ("blocked, no
partial state written") and in M-1's states. **Neither the Frost artifact nor
the wireframe (`prototype/pos/order.html`) draws it.** It has the same shape as
A7's three missing states, so it goes to a designer and then through review.

#### Judgement calls — each is a lead ruling, not mine

1. **`approval-throttled` draws Continue inert, which the artifact does not.**
   Both the artifact and the wireframe share one keypad across all four
   states, with a live `a.key` → `?state=default`. Taken literally, that draws
   an approval succeeding during the `MANAGER_APPROVAL` cooldown, which
   contradicts FR-A5 and AC-19. M-1 lists FR-A5 as a requirement of the
   throttled state.
   - I reused POS-01's reviewed LOGIN-cooldown Continue: dashed, grey arrow,
     `aria-disabled`, no ring. Digits can still be entered, as on the lock
     screen.
   - The alternative is to draw exactly what the artifact draws. **Please
     rule.** It is one flag in `approvalFixtures.ts`.
2. **Exits replace history instead of pushing it.** SITEMAP §1's table says a
   `[MODAL]` is neither a route nor back-stackable. Cancel, Escape and confirm
   therefore use `replaceState`, and Back never reopens an approval. The
   sheets still push, per FE-005's call 10.
   - **`?state=approval` is a review harness, not a route.** F2i and F2j
     should open the prompt as component state from their sheets, never by
     writing an approval URL. An approval URL is exactly what the SITEMAP
     forbids.
3. **The dots start empty.** The artifact draws four filled in every state.
   FE-001 made the same call on the lock screen, where the artifact draws
   three: the pad renders the live count. Drawing a fixed count would mean
   rendering a number the pad did not produce.
4. **The confirm key lands on `default`, whatever was entered.** This is the
   artifact's routing, and it matches the lock screen's no-op `onSubmit`: no
   length gate, because there is nothing to verify against. A reviewer who
   presses → with two digits will see the prompt close as though approved.
   That is fixture shorthand, not behaviour.
5. **Focus returns to the fired Burger row.** The sheet that raised the prompt
   does not exist yet (F2j). When it does, the opener should probably be that
   sheet's Continue, or the sheet should reopen. The artifact sends Cancel to
   `order.html`, so it does not say.
6. **The reason is lower-cased in the fixture** ("customer changed their
   mind"), exactly as the artifact's running text has it. The void sheet
   offers "Customer changed their mind". When F2j passes the sheet's string,
   it will render capitalised unless someone decides to transform the case. I
   did not transform it.
7. **The notices carry no ARIA role**, the same as the lock screen's notices.
   A wrong PIN is announced only if the screen reader re-reads the dialog.
   `role="alert"` on the notice is the obvious fix. I left it out because
   neither pad has one, and the two pads should agree.

#### Found, not fixed

1. **The task file is wrong in one place and imprecise in one.** It misquotes
   the denial copy (criterion 3 above). Its reason list ("FR-H4 fired-line
   void, FR-H5 refund") omits the fired-order void that FR-H4's own text
   covers. That makes five consecutive slices in which the task file diverged
   from a reviewed document. Neither divergence here changed what was built.
2. **Focus is not trapped in the dialog.** It is the same gap as FE-005's
   finding 2: Tab leaves the dialog for the dev fixture links below the frame.
   It never reaches the inert order.
3. **The artifact's order behind the modal says "2 items"**, the artifact's
   default order. Ours says "3 items", because F2a's default order carries the
   pending Steak. That was settled in F2a, and nothing in this slice
   changes it.

#### Not checked

- **Screen-reader announcement** of the dialog name, the description and the
  notices. I have no assistive technology here.
- A real touch device, and `vite preview`.
- **Hover.** This slice adds no hover rule. Cancel inherits F2c's
  `button.action:hover`, which is already inside `@media (hover: hover)`, and
  the keys have no hover rule on either pad.

---

### Lead verification and rulings, 2026-09-18

**`npm run verify`: 15 files, 472 tests passed**, typecheck clean, up from 356.

**`B-12` proven by leaking a digit.** The lead added `data-d={entry[i]}` to a
single PIN dot — the subtlest leak available, an attribute on an element that
already exists — and **all 13 tests in `pin-pad.test.tsx` failed**. Restored,
all 13 pass. The suite is parameterised over *both* pads, reporting as
*"B-12 on 'the lock screen (POS-01)'"* and *"B-12 on 'the manager approval
prompt (M-1)'"*, and it checks byte-identical markup at **every partial
length**, no digit in any attribute, and nothing reaching console, storage,
cookies, the title or the URL. That is the requirement met exactly: one test,
both pads.

**Looked at `approval-throttled`:** the confirm key is dashed and grey while the
digits stay live, over a scrimmed order screen, with the action and reason in
the head and Cancel live below.

#### The artifact is wrong here, and the implementer was right not to copy it

**Judgement call 1, accepted.** The artifact and the wireframe share **one
keypad markup across all four approval states**, with a live
`<a class="key" href="order.html?state=default">` confirm. The lead checked the
fixture: the `.keypad` block carries no `data-when`, so it is genuinely shared.

Taken literally that **draws an approval succeeding during the
`MANAGER_APPROVAL` cooldown**, which contradicts `FR-A5` and `AC-19` — and M-1
lists `FR-A5` as a requirement of the throttled state. `builder8` reused POS-01's
**reviewed** LOGIN-cooldown treatment instead: dashed, grey, `aria-disabled`, no
pressed ring, digits still enterable. Reuse of a reviewed treatment is not
invention, and the alternative was to draw a state the requirements forbid.

**This is the second time implementation has found a defect in a reviewed design
artifact, and both are the same shape:** DESIGN-004's critical finding was a
live close offered on a stale balance; this is a live confirm offered during a
lockout. **A control shared across states is the place to look** — the sharing
is what hides the one state where it is wrong. Worth carrying to the design
branch as a note.

#### Rulings on the rest

**Accepted:**

- **Modals replace history; they never push.** SITEMAP §1 says a `[MODAL]` is
  neither a route nor back-stackable, so Back never reopens an approval. The
  important corollary, and it binds F2i and F2j: **`?state=approval` is a review
  harness, not a route.** Those slices open the prompt as component state from
  their sheets — writing an approval URL is exactly what SITEMAP forbids.
- **Dots start empty**, rendering the live count rather than the artifact's
  decorative four. Same call FE-001 made. Drawing a fixed count would render a
  number the pad did not produce.
- **The confirm key lands on `default` whatever was entered**, with no length
  gate, because there is nothing to verify against. Fixture shorthand, matching
  the lock screen's no-op submit. Stated plainly so no reviewer mistakes it for
  behaviour.
- **The reason is rendered exactly as given, lower-case included.** Not
  transformed. **F2j owns the case** when it passes the sheet's own string.
- **Keypad reuse with the geometry as a class.** The right call: it is what
  makes one `B-12` test cover both pads, which is worth more than either pad's
  independence.

**Ruled, and scheduled rather than done here:**

- **`role="alert"` on the failure notices.** `builder8` left it out because
  neither pad has one and the two should agree — correct reasoning, wrong
  outcome to leave standing: a wrong PIN that is never announced is a real
  defect for a screen-reader user. **Both pads get it in F2e**, which is already
  going to touch both files for the button conversion. Batching it there keeps a
  third slice from reaching into reviewed work for one attribute.

#### The two undrawn states — named, not built, and one is more than a gap

**`loading` was checked properly and is not a reuse.** The lock screen's
verifying treatment fills the dots and withdraws the keypad, and `PinPad`
already has the prop. But the approval modal adds something the lock screen
never had: **Cancel sits in the footer while the PIN is in flight.**

`builder8` saw the consequence: if Cancel stays live during verification, the
footer's *"Cancelling changes nothing on the order"* **may be false**, because
the server can approve and execute after the cashier has pressed it. That is
`B-20` territory, not a styling question. If Cancel is withdrawn instead, that
is a new decision. **Neither is an implementer's to take**, and it was right to
stop.

**To a designer, with the lead's framing:** state what Cancel does while an
approval is verifying, and whether that copy survives it. Note the lock
screen's verifying style is itself unreviewed (`docs/DESIGN.md` open item 6).

**`no manager available`** (PRD §6) is drawn by neither the artifact nor the
wireframe. Same shape as A7's three missing states: **named, not filled**, and
it goes to a designer and through review.

#### Carried forward

- **Focus is not trapped in the dialog** — Tab reaches the dev fixture links
  below the frame, never the inert order. Acceptable in a harness whose leak is
  a dev-only element, **not acceptable at ship**. Same finding as FE-005's.
- **The task file diverged twice more** — it misquotes the denial copy, merging
  the artifact's two lines into one, and its reason list omits the fired-order
  void that `FR-H4` covers. **Five consecutive slices.** Neither changed what
  was built, because the implementer read the sources.
