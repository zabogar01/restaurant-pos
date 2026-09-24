# ARCH-002 — Should firing to the kitchen ask for confirmation?

**Recommendation: no confirmation modal. One press fires.** The pending group already on screen is the confirmation: it lists exactly what will go, and the button should say how many (*Send 2 to kitchen*). The press appends a new fired round in place, from a pure transition that the order store owns. Its heading reads the delivery outcome from a four-value enum (queued, printed, failed, unknown), not from today's `printed: boolean`.
**What the owner's instinct gets right, and how this keeps it:** before a fire everything is free to undo (FR-D5, FR-H2), and afterwards it needs a manager PIN (FR-H4). So the cashier should see what is about to go. The count on the button and the pending group show them that without an extra tap.
**If the owner still wants the modal,** it is buildable without breaking any boundary. The limits it must respect are in §1.4. It would overturn ruling I-11 and go against PRODUCT.md:35-37, and §1.5 proposes wording for both. **The owner has to decide that.**

Author: `architect2`, 2026-09-24. Read-only; this file is the only write.

---

## 1. Confirm step or not?

### 1.1 The documents already answer it, three times

- **PRODUCT.md:35-37** describes the cashier as someone who *"works standing up, at speed, and will not read a confirmation dialog."* That sentence is in the product contract, not only in design notes.
- **SCREEN-INVENTORY.md:36-38** says the POS protects destructive paths in two ways only: *"either ungated by design (FR-H2) or gated by a PIN that cannot be dismissed by muscle memory (FR-A6)."*
- **Ruling I-11 (SCREEN-INVENTORY.md:895)** is confirmed by the lead and is a *standing rule*: *"confirmations on the back office, PIN gates on the POS, nothing in between."* The back office's only confirm modal is BO end-of-day (SITEMAP.md:251), and it confirms something irreversible, B-9.
- **SITEMAP.md:12-13** fixes the POS at **6 modals**, and every one of them is either an approval or a lease/session modal. A fire confirmation would be the 7th, and the only POS modal that neither checks identity nor resolves a lease.

A confirmation on POS-03 is therefore a middle path that I-11 names and rules out. It is not a gap the documents left open.

### 1.2 Reversibility: what the owner is right about

| | Before the fire | After the fire |
|---|---|---|
| Edit or remove a line | Free, no prompt, not audited (FR-D5, FR-H2, AC-3) | Only by voiding it: manager PIN and reason, audited, and a cancellation ticket (FR-H4, B-16, AC-22) |
| Paper | None | One immutable KitchenTicket (ARCHITECTURE.md:247, :317-321) |

The asymmetry is real. But the protection belongs **before** the press, and it is already there: the *Pending · not sent to the kitchen* group (`orderFixtures.ts:138-140`) is on screen for the whole time the cashier builds the round. A modal would copy that same list into an overlay that must be dismissed. On a busy floor, that dismissal becomes a reflex within a shift, which is exactly what SCREEN-INVENTORY.md:36-38 warns about. Once the reflex forms, the modal protects nothing and costs one tap on every round, all night.

Mainstream POS systems agree: **Toast** — *Send* fires the highlighted items and returns to table service, and *Stay* fires and stays on the order ([Toast: Send, Stay, Hold](https://support.toasttab.com/en/article/Differences-Between-the-Send-Stay-and-Hold-Buttons)). **Square for Restaurants** — tapping *Send* sends the check. Its only pacing control is per-course hold/fire, not a confirmation ([Square: coursing](https://squareup.com/help/us/en/article/7748-coursing-with-square-kds)). **Lightspeed K-Series** — the button reads ***Send – x items*** and fires on one press ([Lightspeed: placing basic orders](https://k-series-support.lightspeedhq.com/hc/en-us/articles/360050308894-Placing-basic-orders)). None of these support pages mentions a confirmation dialog. Lightspeed's count on the button is the pattern recommended here. Hold and coursing are out of scope, because FR-E1 fires *every* PENDING line.

### 1.3 Boundaries a fire touches, and why none of them needs a modal

- **B-16 / FR-E2 — only unfired lines.** `sendableLines` (`fire.ts:62-64`) already selects only PENDING lines. After a fire nothing is pending, so the control goes inert in place (`OrderPanel.tsx:294-296`, `:342`). A double tap cannot send twice, and the transition must return the groups unchanged when nothing is pending (§3, T-2). On the server, a retry with the same idempotency key replays the original result (ARCHITECTURE.md:323-325, :546-549). **Those are the protections against duplicates. A confirmation dialog is not one.**
- **B-17 / FR-E4 — 86'd pending line.** Already refused *before* the press (`fire.ts:67-72`, the notice at `OrderPanel.tsx:336`). The transition must check it again when it runs (FR-C6: *"the server independently revalidates availability … when firing"*), not rely on what the screen drew.
- **B-15 / FR-E3 — printing never gates.** The fire commits first and delivery comes afterwards. Nothing about delivery may undo the round.
- **B-20 — no partial state.** A refused fire leaves the order unchanged. If a modal existed, *Cancel* on it would have to do the same.
- **B-13 / FR-J3 — audit.** **A fire is not an audited action** (FR-J3 lists void, discount, refund, takeover and approvals only). So no modal is needed to capture who fired or why. The kitchen ticket records what went.
- **B-14 — approval.** The PRD grants no approval on firing. Any confirm step that asks for a PIN or a reason, or is limited to one role, would be a gate the PRD does not grant.
- **FR-G12 / FR-G13.** Fire is one of the five actions a lock blocks. The transition must refuse it under either lock, just as the `?gone=` drop does (`orderStore.ts:168`).
- **FR-E5 / C-2.** A quick sale has no fire control. The transition must refuse `quick_sale`.

### 1.4 If the owner overrules: what the confirmation may and may not do

It **lists** exactly `sendableLines(lines)`: the pending group, with each line's quantity, name and modifiers, a count (*2 items*), and the table. It has two actions: **Send to kitchen** and **Back**.

It **must not**:
1. Let the cashier choose a subset. FR-E1 collects *every* PENDING line, so per-line checkboxes or a hold toggle would break the requirement.
2. Edit quantities or remove lines inside the modal. That is the line editor's job (FR-D5), which already exists.
3. Ask for a PIN or reason, or be limited by role. That is a gate the PRD does not grant (§1.3, B-14).
4. Write an audit entry for *Back*, or change any state on *Back* (B-20).
5. Run the fire from the list the modal was opened with. *Send* must check B-17 again against the order as it is now. If an item was 86'd while the modal was open, the modal gives way to the existing fire-blocked notice.
6. Appear on a quick sale (C-2) or under a lock (FR-G12/G13).
7. Take the place of the idempotency key.

### 1.5 Wording the owner would need to approve, if the modal is chosen

These are proposed only. Nothing has been edited.
- **SCREEN-INVENTORY.md:895, I-11** — replace the ruling with: *"Confirmations on the back office and PIN gates on the POS, with one exception: a table-order fire lists its pending lines for one confirming tap, because a fire is the one POS action that is ungated before and PIN-gated after. No other POS confirmation."*
- **SITEMAP.md:12-13** — change the modal count *"6 modals"* to *"7 modals"*, and add under POS-03: `[MODAL] Confirm fire — lists pending lines, Send / Back ... FR-E1, E4`.
- **PRODUCT.md:35-37** is contract. Leave *"will not read a confirmation dialog"* as it is. Record the exception in I-11 instead of weakening the user description.

---

## 2. What firing shows once it succeeds

### 2.1 Reuse the round rendering already in the code, and fix its heading

`RoundGroupView` (`OrderPanel.tsx:399-445`) already draws a fired round, with the heading at `:421`:
`Round {n} · fired {firedAt} · {printed ? 'printed' : 'not printed'}`.
A successful fire **adds one more `kind: 'fired'` group through this same component**. No second rendering is needed. The heading, though, is binary, and that is wrong in two places:

- **`printed: boolean` cannot represent FR-E3.** FR-E3 and ARCHITECTURE.md:250, :664 name three outcomes, `PRINTED`, `FAILED` and `UNKNOWN`. There is also a fourth, earlier state, which ARCHITECTURE.md:317-321 creates: the lines are committed as `FIRED` *before printer delivery begins*. `RoundGroup` (`orderFixtures.ts:60`) should carry `delivery: 'queued' | 'printed' | 'failed' | 'unknown'`.
- **`not printed` is false for UNKNOWN.** UNKNOWN means *bytes may have reached the printer* (ARCHITECTURE.md:666-667). If the cashier reads *not printed* on an UNKNOWN round and asks the kitchen to cook it again, that is the duplicate food B-16 exists to prevent. The copy is the designer's to write (open MEMORY question 4), but the wording must be different for each value.

**The task says `SENT`. FR-E3 says `PRINTED`.** Use the PRD's term. There is no `SENT` outcome anywhere in the contract or the architecture.

### 2.2 The time source

This app has no clock, and FE-011 kept the time back rather than invent one (`OrderPanel.tsx:599-608`). The answer:

- **With a server:** the time is the KitchenTicket's creation time, taken from PostgreSQL time (ARCHITECTURE.md:806-808) and returned in the fire command's result. The client displays it and never computes it.
- **Now, with no server:** the transition takes `firedAt` as an **argument** and never reads a clock itself. The caller at the edge (the press handler) passes it from an **injected clock** (ARCHITECTURE.md:806 already requires clocks to be injectable), which defaults to the browser's local time *at the press*. This does not invent data: it is the true time the cashier pressed the button in this client. Tests inject a fixed time. When the server arrives, the only change is that the argument comes from the response instead.
- **Flag:** the displayed time zone is still an open owner decision (MEMORY.md, *Owner decisions owed: PRD §9 time zone*). For now, show the browser's local time as `HH:MM`, like the fixtures' `19:42`.

### 2.3 What a frontend with no server can honestly show for delivery

There is no printer and no dispatcher. So:
- A round fired live in the store is **`queued`**: committed, delivery not yet known. That is true. It is **never `printed`**, which would claim paper that does not exist. It is also never `failed` or `unknown`, which would set off a false emergency (FR-E3, AC-23).
- With no dispatcher, a live round stays `queued`. That is honest and it does not block anything: **FR-G10 only needs no PENDING lines, so the table can go on to Settle, and B-15 means delivery never gates it.** This clears MEMORY item 3's blocker.
- `printed`, `failed` and `unknown` stay reachable through fixtures (the existing `fireerror` state, `orderFixtures.ts:336-352`, becomes `delivery: 'failed'`). The emergency banner at `OrderPanel.tsx:203` still reads the fixture's `incident`. **It is not derived from the store, and in this slice it must not be.** Deriving the banner from a round's delivery is the server slice's job.

---

## 3. Where the rule lives

**Yes: the fire belongs in the order store as a pure transition, with the rule in `fire.ts`.**

- `fire.ts` already owns *what can be sent* (`sendableLines`) and *what refuses it* (`blockingLines`, `fireRefusal`). Its header forbids the panel from deciding on its own (`fire.ts:3-5`). The transition is the same question with the answer applied, so it goes here too. That way the refusal and the transition cannot disagree:
  `fireOrder(groups, { type, unavailable, locked, firedAt }) → { groups } | { refused: FireRefusal | 'nothing' | 'locked' | 'quick_sale' }`
- The store (`orderStore.ts:147-195`) is the one owner of `groups` since FE-019. It exposes `fire(firedAt)`, which applies `fireOrder` through `setData(prev => …)`. That is the same pattern as `addLine` and `removeLine`, which call the pure helpers `appendPending` and `dropLine` (`orderStore.ts:84-92`). Using the functional updater means a second press in the same tick sees no pending lines and does nothing.
- The panel's `FIRE_BTN` (`OrderPanel.tsx:621`) gets a handler that calls `store.fire(clock())`. It still names no `?state=`, for the reason given at `OrderPanel.tsx:593-597`. The fire result is `[INLINE]` (SITEMAP.md:135), so the route does not change, and neither does history.

**Criteria the implementer must meet (each premise gets its own test, per the MEMORY lesson):**
- **T-1** The new fired round is numbered `max(existing round) + 1`, or `1` if none. It holds exactly the lines that were pending, in their order, each with `status: 'fired'`. It is placed after the last fired round, and the pending group is gone.
- **T-2** With no PENDING lines, the result is `refused: 'nothing'` and the groups are returned unchanged, by reference. There is never an empty round.
- **T-3** A PENDING 86'd line refuses the fire *inside the transition*, even when the caller skipped the UI check (B-17, FR-C6). The groups are unchanged (B-20).
- **T-4** A lock or `quick_sale` refuses, and the groups are unchanged (FR-G12/G13, FR-E5).
- **T-5** Amounts and totals are unchanged by the fire (`orderFixtures.ts:323-325`: *"firing changes no price"*).
- **T-6** `firedAt` is the argument, exactly as given. The module reads no clock.
- **T-7** A new round's `delivery` is `'queued'`.
- **T-8** Lines added after the fire go into a new pending group, and the next fire makes round n+1 (FR-D3, FR-E2).

---

## 4. States DESIGN-007 must draw (POS-03, table variant)

All of these are `[INLINE]`. Nothing new is a modal. Each state is described by what is on screen.

1. **`fire-ready`** — pending group with 1 or more lines, nothing 86'd, and the fire control live. **The control says how many:** *Send 2 to kitchen* (the count is the number of `sendableLines`). This state takes the place of a confirmation. The designer should decide whether the count counts lines or quantities, and say which.
2. **`fire-queued`** (the moment after the press, and the steady state in the fixture era) — the lines that were pending now form a new last round. Heading: *Round 3 · fired 20:14 · sending* (wording is the designer's). The tag is the fired tag (`MANAGER TO VOID`), and each line's trailing slot is reserved and empty (I-12). The pending group is gone. The fire control is **inert in place** (`OrderPanel.tsx:294-296`) and Settle is live. Draw **where focus lands** after the pressed control goes inert (suggested: the new round's heading), and a polite `role="status"` announcement (*Round 3 sent to the kitchen*).
3. **`fire-printed`** — the same as 2 with the heading reading *printed*. No banner.
4. **`fire-failed`** — the heading reads the FAILED wording, and the emergency banner shows above everything with a reprint path to POS-07 (FR-E3, AC-23, AC-33). The fire control stays inert, **so it cannot be read as "send again"** (`fire.ts:58-60`). This is today's `fireerror`, redrawn with the enum.
5. **`fire-unknown`** — its **own wording, different from FAILED**. It must not claim that nothing printed, and it must tell the cashier to check the kitchen before asking for a reprint. It uses the same banner class and the same reprint path as FAILED (FR-E3), and the fire control is inert.
6. **`fire-then-add`** — rounds 1 to n fired, plus a new pending group below them, and the fire control live again with a new count (FR-D3, FR-E2). This proves a second fire sends only the new lines (B-16).
7. **`fire-blocked`** (exists) — unchanged. The designer should confirm it still reads correctly next to the new count label, and MEMORY item 10 (the notice naming a line that has scrolled out of view at 1280×800) is still open.
8. **Heading at width** — the longest heading (*Round 12 · fired 23:59 · \<longest UNKNOWN wording\>*) at 1280×800. It must not wrap under the tag, and it must stay legible in greyscale (SCREEN-INVENTORY.md:145).

**Only if the owner picks the modal (§1.4):** also draw `fire-confirm` (the list, the count, the table, *Send to kitchen* / *Back*) and `fire-confirm-86` (an item 86'd while the modal is open: the modal gives way to state 7).

**Out of scope for DESIGN-007:** quick sale (no fire control, C-2), hold/coursing (FR-E1), and a "resend round" control (SCREEN-INVENTORY.md:197-198: *"Ever."*).
