# FE-022 — POS-03: Send to kitchen sends, in one press

**Status:** Written 2026-09-24 by `lead`. Unassigned. **Starts after FE-021
lands**, because both touch the panel and the store.
**Source:** DESIGN-007 Part C (`032a6e9`/`2da9d75` on `agent/design-direction`,
see [FE-021](FE-021-own-items-and-quantity.md) for the paths). The ruling is
[ARCH-002](../reviews/ARCH-002-fire-confirmation.md), accepted by the owner
2026-09-24: **one press, the count on the button, and no confirmation modal.**
**ARCH-002 §3 is this task's specification.** Read it whole.
**Branch:** `agent/phase-0-foundations`.

---

## What is wrong today

*Send to kitchen* does nothing (`OrderPanel.tsx:593–608`, `:621`, `:690`). A
table order's lines therefore stay pending forever, `FR-G10` refuses Close, and
a live walk cannot pay a table order without removing its pending lines.
`RoundGroup.printed: boolean` (`orderFixtures.ts:60`) cannot represent
`FR-E3`'s outcomes. Its `not printed` is **false** for UNKNOWN, which may have
printed. A cashier who believes it asks the kitchen to cook the order again.

## What changes

1. **`RoundGroup` fired variant: `printed: boolean` →
   `delivery: 'queued' | 'printed' | 'failed' | 'unknown' | null`.** `null`
   means the drawing states no outcome, as in `overflow`'s rounds (DESIGN-007
   round 2). Migrate every fixture: `printed: true` → `'printed'`, and
   `fireerror`'s round 2 → `'failed'`. Headings take the artifact's wording
   for each value. **UNKNOWN's wording is its own and never claims that
   nothing printed.**
2. **A pure `fireOrder` in `fire.ts`**, with the signature in ARCH-002 §3. The
   refusal rules and the transition live in one module, so they cannot
   disagree. It reads **no clock**, because `firedAt` is an argument.
3. **`store.fire(firedAt)`** applies it through `setData(prev => …)`, as
   `addLine`/`removeLine` do (`orderStore.ts:172–188`). A second press in the
   same tick finds nothing pending.
4. **The fire control reads `Send n to kitchen`**, where n is
   `sendableLines(lines).length`, counting **lines, not units** (DESIGN-007
   handoff). Its handler calls `store.fire(clock())`. The **clock is
   injected**: it defaults to the browser's local `HH:MM`, and tests pass a
   fixed one. The fire is `[INLINE]`: no `?state=`, no history entry.
5. **After a fire:**
   - the new round is last, with `delivery: 'queued'` and the heading *sending
     · unconfirmed*;
   - focus moves to the new round's heading;
   - a polite `role="status"` line reads *Round n sent to the kitchen*;
   - Send is inert **in place**, and Settle is live;
   - no banner appears, because the emergency banner stays fixture-driven
     (ARCH-002 §2.3). **Do not derive it from `delivery`.**
6. **With nothing pending,** Send is off in every state. DESIGN-007 names 14
   existing states that change for this reason. A live Send there would read
   as *resend*.
7. **`fireblocked`'s *Show Steak* recovery** scrolls the blocking line into
   view and focuses it (POS-03 question 10).
8. **Fixture-only states:** `fire-printed`, `fire-failed` and `fire-unknown`
   exist as fixtures. A live press only ever produces `queued`.

## Acceptance criteria

ARCH-002's **T-1 to T-8** are criteria 1–8 here, word for word. Each is its
own test on `fireOrder`, and each has a stated red case. In addition:

9. **The count:** `fire-ready` (Steak × 1 + Fries × 2) reads **Send 2 to
   kitchen**, not 3.
10. **The whole-screen walk, as a test:** from `/pos/order`, add a line, press
    Send. The pending group is gone, Round n+1 is *sending · unconfirmed*,
    Settle is live, and **Close on POS-04 is reachable once payment is exact**.
    This is the flow `FR-G10` has blocked until now.
11. **Delivery wording:** a table test covers the heading for each of the five
    `delivery` values. **UNKNOWN never contains *not printed*.** `null` shows
    no delivery word.
12. **Idempotence:** a double click (two `fire` calls in one tick) makes
    exactly one round.
13. **History survives:** from `overflow`, Add then Fire keeps the voided
    salad and adds no delivery word to rounds 1–2. From `zero`, the comp
    survives the fire.
14. No test is loosened. Tests that encode *"Send to kitchen does nothing"*
    or `printed: boolean` may change. Name each one.
15. `npm run verify` is green, with the count stated.

## Do NOT

- Draw or build a confirmation modal.
- Let a live fire produce `printed`, `failed` or `unknown`.
- Add a resend control, hold/coursing, or a fire on a quick sale (C-2).
- Read `Date` anywhere except the injected clock's default.

## Reporting

Commit nothing. Append a handoff below, then run
`herdr agent prompt lead "<your name>: FE-022 done — <tests> tests, <one line>"`,
or `herdr agent prompt lead "<your name>: BLOCKED — <question>"`.

## Handoff
