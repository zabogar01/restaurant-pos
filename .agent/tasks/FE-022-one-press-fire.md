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

### builder24 — 2026-09-24 — done, uncommitted

`npm run verify` read to the end: typecheck clean, **25 files, 1764 tests pass**
(baseline 1645 / 23 files: +119, two new files). No commit.

**What was built**
- `RoundGroup` fired: `printed: boolean` → `delivery: 'queued'|'printed'|'failed'|'unknown'|null` (`Delivery` exported). Fixtures migrated: `printed` → `'printed'`, `fireerror` r2 → `'failed'`, `overflow` r1–2 → `null`. Wording in `DELIVERY_WORDING` / `roundHeading` (orderFixtures.ts), the design's own: *sending · unconfirmed*, *printed*, *FAILED · not printed*, *UNKNOWN · may have printed*; `null` ends at the time.
- `fireOrder` in fire.ts, ARCH-002 §3 signature; a refusal returns the same `groups` by reference plus `refused`. Reads no clock.
- `store.fire(firedAt)` via `setData(prev => …)`. It reads view/lock from a ref at press time, and the 86 list through `originFacts(view)`, not `MENU_FIXTURES[view.state]` (test: an item sheet opened from `fireblocked` still refuses).
- Panel: label `Send n to kitchen` (lines, not units); injected `clock` prop (default `browserClock`, the only `Date` read); after a press focus goes to the new round's heading (made focusable at that moment, so no state carries a `tabindex` on the order's lines), and a polite `role="status"` `.order-sent` line reads *Round n sent to the kitchen* (cleared as soon as a pending line exists again). Fire is `[INLINE]`: no `?state=`, no history entry. Banner untouched: still fixture-driven.
- `fireblocked` recovery: one *Show <name>* button per blocking line inside the notice; scrolls the row into view and focuses it.
- New fixture states: `fire-ready`, `fire-queued`, `fire-printed`, `fire-failed`, `fire-unknown`, `fire-then-add` (all `keeps` in `ITEM_SHEET_ORIGINS`). Figures are the design's (485.000 → orderTotals 458.325; 520.000 with Coffee). `fire-failed`/`fire-unknown` carry the design's banner copy.
- CSS: `.round-head:focus`, `.notice__show`, `.order-sent` — registry tokens only.

**The two lessons**
1. Walking the fire control over every `ORDER_STATES` id found a real defect: **`loading` drew a live Send over a skeleton**. A press would fire lines the cashier cannot see. Send is now inert in place there, and it names no count. The rule for the count: shown while it can be shown truthfully, bare (`Send to kitchen`) under a lock, on an empty order and while loading (DESIGN-007 leaves the lock states pixel-identical), kept on a refusal (`Send 1 to kitchen` inert on 86'd Steak, as the design draws it). The heading walk covers every state and round: UNKNOWN never contains *not printed*, `null` shows no word, `loading` draws no heading.
2. Origin facts: a live fire changes nothing an origin carries (incident banner stays fixture-driven, the 86 list is the menu's, the lock is the fixture's), so nothing needed routing beyond the store reading `originFacts(view)`.

**Criteria** — 1–8 `test/fire-order.test.ts` (each with its red case in a comment; ran red 14/14 before `fireOrder` existed). 9 the count, 10 the whole walk (`PosRoutes`, add → Send 2 → Settle → exact tender → Close is a button; a control walk without the fire keeps Close inert), 11 wording table + walk, 12 idempotence (store, and a double click), 13 history (overflow keeps the voided salad and adds no word to r1–2; zero keeps the comp), all in `test/one-press-fire.test.tsx`.

**Existing tests changed (criterion 14), none loosened**
- `fire.test.tsx`: *puts the refusal between the lines and the totals…* (panel gains an empty `order-sent` child); *is drawn in no other state* (banner also in `fire-failed`/`fire-unknown`); *reads round 2 as NOT printed…* (wording is now *FAILED · not printed*); *is the only state whose print wording changes…* (also `fire-failed`); *loading: live exactly when…* (loading is now inert); *is never absent, in any table-order state…* (label is a regex; exact labels are pinned per state in the new file); the block *Send to kitchen produces no result, and above all moves nothing* (encoded "does nothing"; now: URL, history, overlays unchanged and only pending → fired); *fireblocked’s notice carries no control at all* (now exactly one, *Show Steak*).
- `order-panel.test.tsx`: state list (+6), close-bar labels (`Send 1 to kitchen`), the `asked` list (+`{ fire: true }`), overflow child classes (+`order-sent`); `PanelActions` stub gains `fire`.
- `menu-region.test.tsx`: anchors on the frame (`fire-failed`/`fire-unknown` share the banner's route).
- `settlement.test.tsx`: five `OrderStore` stubs gain `fire`. `void.test.tsx`: one fixture `printed: false` → `delivery: 'failed'`.

**Not done / for the lead**
- `fire-heading-width` (Round 12) is not a state; the heading-at-width check is a design/browser measurement I did not make. No browser check was run at all: jsdom only.
- `fireerror` keeps its old two-round data (round 2 FAILED, banner "round 2"); the design would alias it to the round-3 composition. I left it, since the task says only to migrate its round.
- The time zone stays the open owner decision: `browserClock` is local `HH:MM`.
- `store.fire` does not know about `loading` (a screen fact, not an order rule); the panel is its only caller and keeps Send inert there.

### builder24 — Round 2 — 2026-09-24, uncommitted

`npm run verify`: typecheck clean, 25 files, **1792 tests pass** (+28). Each item
had a red run first (9 new tests red before the code). Commit nothing.

- **A** The status belongs to the press: `sentRound` is cleared by the next change to the store's `groups` (identity, not a "nothing pending" condition). Test: fire-ready → Send → Add Coffee → Remove Coffee → status `''`.
- **B** After a fire the whole round is revealed: last line first, then heading, `scrollIntoView({ block: 'nearest' })`, heading focused with `preventScroll`. The effect is keyed on the status text having rendered, so the space it takes is already gone from the list. After Add from an item sheet the new pending line gets the same call. **jsdom has no layout**: tests assert *which element* got `scrollIntoView`, *with what option*, in what order, and that the status text was already drawn at the time of the call. Nothing measures a scrollTop; please re-measure at 1280×800. `reveal()` uses `?.` because jsdom lacks the method.
- **C** `fireblocked` (and any first draw with a refusal, e.g. `fireblocked-overflow`, `eightysix`) scrolls its first blocked row on mount. `default` scrolls nothing. *Show <name>* now scrolls the row's `li` (was its button) and focuses the button.
- **D** `fire-heading-width` fixture: Burger r1, Soda r2–11 (23:00, printed), r12 Steak + Fries × 2 UNKNOWN 23:59; 135.000 + 10 × 30.000 + 240.000 + 80.000 = 755.000 → 713.475. Banner names round 12. Not measured; yours to do in the browser.
- **E** `scrollIntoView` is saved and restored in both test files; stale title renamed ("only fireerror and fire-failed … say not printed"); the control/status/banner walk now opens an item sheet from every fire-* origin (7). Test lists gained `fire-heading-width` (`order-panel`, `fire`, `menu-region`).
- **F** `originFacts(view)` now returns `lock`; the panel and `store.fire` both read it. Red case: a view `sheet-item-steak` from `lock-draft` drew a live Send.
- `fireerror` data untouched.

### builder24 — Round 3 — 2026-09-24, uncommitted

`npm run verify`: typecheck clean, 25 files, **1796 tests pass** (+4). Red first (3 failed).
- **1** `dropLine` and `rewriteQuantity` return the same `groups` when no line matches, so the identity rule is exact. Tests: unknown id keeps the reference for both; a real removal still changes it; after a fire, a `?gone=` naming no line (via popstate) leaves *Round 3 sent to the kitchen* in place.
- **2** All three remaining lock reads go through `originFacts(view).lock`: the seed's `?gone=` drop, the post-mount guard (both in `orderStore.ts`), and `MenuRegion.tsx:49`. All three had a `view` in reach. Note for MenuRegion: its old read was `menuFixtureFor(view).lock` (the menu fixture's own `lock`, already origin-based), so the source is now the order fixture's lock, not the menu fixture's; all tests still pass, so the two agree today. Red case: a view `sheet-item-steak` from `lock-draft` with `?gone=steak` dropped the Steak at seed. The post-mount guard has no separate test; it uses the same accessor.
