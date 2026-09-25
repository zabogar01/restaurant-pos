# FE-024 — independent code review

**Verdict: approve after one fix. Six findings (one P2, five P3).** Reviewed the uncommitted diff on `agent/phase-0-foundations` plus untracked `apps/pos/test/off-actions.test.tsx` against FE-024 criteria 1–6. I edited only this report and committed nothing.

**`npm run verify`: typecheck clean, 27 test files, 2070 tests pass.** This matches builder26's handoff (+149 on 1921).

## What I checked and found sound

- **On/off conditions are unchanged.** Every `off` expression is the same as before: stepper `value <= MIN` / `>= MAX`, `!changed`, `sheet.unavailable`, `fireOff`, `refusal`, `balance`/`mayAdd`, `continueDisabled`, and the 86 `off`. Only the element changed.
- **Every off `onClick` is guarded.** Each is `() => {}` or an explicit guard: stepper `value > MIN &&`, Update `if (!changed) return`, PinPad `submit` `if (continueDisabled) return`. No off button has `onKeyDown`, `onPointerDown` or `onMouseDown`, so Enter and Space reach only `onClick`, which is inert.
- **No reason copy invented.** All `aria-describedby` targets are text that was already drawn. Ids were added, no strings. Where nothing is drawn (Update to n, void Continue, Close balance-outstanding, Closing…), the attribute is absent and the table asserts absence.
- **CSS keeps live styling.** `aria-disabled={false}` renders `="false"`, so `:not([aria-disabled="true"])` still matches live Update and live steppers. Specificity moves from (0,2,1) to (0,3,1) uniformly across the paired hover, active and focus-visible rules, so their relative order is unchanged. Off buttons lose only pointer cursor, hover fill and pressed ring, and keep their off classes and the global `:focus-visible`.
- **Id collisions:** none. `sheet-bound` is mounted by only one sheet at a time, and `tag-86-<id>` occurs only on the tile.

## Findings, most severe first

### 1. P2 — `liveControls` now hides off buttons from the sheet modality test, so a tab-stop leak can pass

**Location:** `apps/pos/test/sheets.test.tsx:92` (the added `&& el.getAttribute('aria-disabled') !== 'true'`), consumed at `:209` (*"every live control on the frame is inside the sheet"*). Authority: FE-024 rule 2 ("removes it from the tab order") and criterion 5 (tab-order changes must not loosen the test).

**Failure scenario:** the helper is documented as "everything a finger or a keyboard can operate". An off button is now a Tab stop, which is the whole point of FE-024. The `:209` test proves that nothing outside the open sheet can take focus. If the `inert` were dropped from a region behind the scrim whose only controls are off, such as the close bar's off *Send to kitchen* in a locked or empty state, or an 86'd tile, that region would stay Tab-reachable behind the modal. The test would still pass, because the off button is filtered out. Before FE-024 the same regression was invisible for a different reason: a span was not a stop. It is now a stop and the test is blind to it.

The same filter takes off buttons out of `destinations()` (`:124`). That is right there, since pressing them does nothing. But it means one predicate is serving two jobs.

**Fix:** split the helper.
- `tabStops()` keeps aria-disabled buttons and is used by `:209`, and by `:274` for the `type="button"` check.
- `pressable()` excludes them and is used by `destinations()`.

### 2. P3 — The guard red case is proven for one row only, and Enter/Space are not truly exercised

**Location:** `apps/pos/test/off-actions.test.tsx:113-124`, and handoff "Red first".

Two points:
- **The Enter/Space step dispatches `keydown`/`keyup`.** jsdom does not turn those into a `click`, so it is inert. Only the `click()` call proves anything. This is fine in practice, because native activation goes through `onClick` and no off button has a key handler. But the test title claims more than it shows.
- **Guard removal on the lock *Continue* is not caught.** `App` passes `onSubmit={() => {}}`, and nothing is keyed in the row. An unguarded `submit` there would change nothing in the snapshot. I reasoned this from the code and did not run the mutation. The approval row would catch it, because its `onSubmit` navigates. The stepper guards are also redundant with `step`'s clamp, so removing either alone changes nothing.

**Fix:** either say in the title that Enter/Space are covered by "no key handler exists", or add an assertion for that. For lock Continue, key a digit first so an unguarded submit would clear the dots.

### 3. P3 — Criterion 4's walk sees only fixture-initial states

**Location:** `apps/pos/test/off-actions.test.tsx:160-183`.

The walk renders each `ORDER_STATES`, `SETTLEMENT_STATES` and `LOCK_STATES` id once and does not press anything. Off states reached only by interaction are unwalked: the item-sheet + at 99, and a tender that becomes over-limit after keying. Those are in the table but not the walk.

The class test is `--off|-disabled`. A new off `<div class="x--unavailable">` with no `aria-disabled` would pass. A new off span that carries `aria-disabled` is caught, and so is a new `--off` span. That covers the realistic slip.

**Fix, optional:** add a second walk step that keys each state's obvious interaction, or say in the comment that reached-by-press states are the table's job.

### 4. P3 — Off Add can describe itself with help text that is not its reason

**Location:** `apps/pos/src/SettlementScreen.tsx:722-726`, `:921`.

`addReasonIds` includes `#tender-help` (the caption) whenever one is drawn. The caption is general entry help. It is not always why Add is off, so a screen reader may read help text as the reason. It is drawn text and no copy was invented, so rule 4 is satisfied. The lead should decide whether "any drawn help" is wanted or only the field message and refusal notice. The criterion-3 test only checks that the ids resolve.

### 5. P3 — Some rows have coverage gaps, and one reason assertion is vacuous

**Location:** `off-actions.test.tsx:88-89`, `:66-79`.

- **`reason: ''`** for the two cooldown Continue rows makes `toContain('')` always true. The dedicated tests at `:141-152` do the real check, so nothing is lost.
- **The table omits off actions that walk 4 covers only for shape:** *Send to kitchen* when the order is empty, in overflow, or in `lock-lease`, and *Settle* when off (`data-action="settle"`). Their "press does nothing" is untested.

### 6. P3 — Stale comments and one mis-indent

**Location:**
- `Sheets.tsx:151-152` ("a span … The same shape as the 86'd tile") and `:103`.
- `pos.css` comments at about `:725`, `:864` and `:1088` ("a div", "is a span").
- Test titles in `menu-region.test.tsx`.
- `SettlementScreen.tsx:950-954`, where the `caption &&` block is indented one level too deep.

The builder flagged the comments. They are wrong now and will mislead the next reader.

## Existing-test changes (the ~60 edits), one by one

**Faithful, no loosening:**
- The `SPAN`→`BUTTON` tagName swaps in fire, one-press-fire, void, own-items, settlement and order-store. Each keeps the neighbouring `aria-disabled === 'true'` assertion or adds one.
- `disabled` → `hasAttribute('disabled') === false` and `aria-disabled` in own-items. Stricter.
- The `settlement.test.tsx:185-189` table (tag → boolean plus BUTTON and aria-disabled) and `one-press-fire.test.tsx:99`. The off/live split is still asserted per state, in both directions.
- `one-press-fire.test.tsx:244`. "Live" is now `aria-disabled !== 'true'`. Same set.
- The `.order-actions button:not([aria-disabled])` count-zero tests (`fire:427`, `order-panel:330/:385`, `settlement:844`). An off→live regression still fails. The exact-list tests (`fire:213`, `fire:598`) still catch a live→off regression.
- The CSS-pin edits (`menu-region:395`, `sheets:589-591`) follow the selector change and still prove the pressed ring cannot match an off element.
- `menu-region:166`, `menu-categories:189`, `sheets:466`. The "no tab stop" assertions are replaced by their opposite, plus `aria-disabled`, no `disabled` and no link, which are stricter.

**Loosened, or unproven:**
- `sheets.test.tsx:92` (finding 1).
- `menu-region.test.tsx:303`. The lock route-out (`a, button:not([aria-disabled])`) now ignores off buttons. That is harmless there, because the lock route draws none, but it would no longer notice an off button appearing. Low risk.
- `void.test.tsx:378`. The filter to non-aria-disabled buttons before `not.toContain('Continue')` keeps the same meaning: a live Continue would still fail.

**Can a live control regress to off, or the reverse, with no test failing?**
- Off→live for the 15 tabled actions: caught (aria-disabled asserted), and the counted-zero tests catch the rest.
- Live→off: caught by the exact-list tests and the settlement/one-press per-state tables. A live control turning off inside a sheet is dropped from `destinations()` silently. The exact-destination expectations there are per gate, not per control, so a lone live→off in a sheet is the one path I could not confirm is caught.
