# ARCH-021 — Consult C4: the POS catalog (plan slice S7)

Written by `architect21` on 2026-10-30 for the lead's S7a and S7b task files. A consult, not an ADR: where it and an
accepted ADR differ, the ADR wins.

## For DESIGN-021

Committed ahead of the rest of the report, as the task asks. Each line below says what the architecture fixes; the
words and the look are the designer's. "Decided" means this consult decides it and the reasons follow in the body of
the report. "Owner" means it waits on a ruling, with the answer to draw meanwhile.

### 1. What reaches the POS

- **One projection, read as a whole.** It holds the active categories, their active items with each item's 86 state,
  each item's active variants and active modifiers, and (see 7) the active presets. All of it is in display order; the
  client does not sort.
- **It never holds** an archived category or anything in one, an archived item, a removed variant or modifier, or a
  deactivated preset. The POS cannot tell "archived" from "never existed". Draw nothing that names an archive at the POS.
- **An 86'd item stays on the grid**, disabled in place with its price (ruling C-3, already drawn). An item that is
  available again re-enables in place.
- **A category with no active items is still in the rail** and selectable. Its grid is empty, so it needs a one-line
  empty-grid state. Neither the inventory nor the artifact has one.
- **Only an 86 is in place.** An archive, restore, new item or reorder reflows the grid at the next refresh. AC-12's
  no-reflow promise is about an 86, and an archived item has no slot to keep.
- **The rail's selection follows the category's id.** If the selected category disappears, the selection moves to the
  first category, with no notice. A fresh mount starts on the first category.

### 2. POS-03's catalog states, and when each is entered

All four concern the menu region only. The order panel stays live in every one of them. Under either settlement lock
the menu region is the lock notice and none of these shows.

| State | Entered when | Left when | The menu |
|---|---|---|---|
| **Loading** | The tab's first read is out and no menu is held. Never again after a menu has been held: not on a refresh, not after a lock | The read answers | None |
| **First read failed** | That read failed, or got no answer within the bound in D2. Nothing is held, so there is no threshold: one failure enters it | A later read succeeds. The poll keeps retrying every two seconds and the menu then appears with no press. *Try again* asks at once | None. Needs *Try again*, which repeats the read only |
| **Empty catalog** | A read succeeded and holds no category. This is a new installation (B-24). It is not an error, there is no *Try again*, and a menu made in the back office appears by the poll | The read holds a category | None |
| **Possibly out of date** | A menu is held and **two checks in a row** have failed | The next check that leaves the client current | **Stays fully usable**: tiles, sheets and Add all work |

- **One failed check shows nothing.** Two failures mean about four seconds since the last good answer, which is past the
  three-second budget, so the POS can no longer claim the budget. Hence two, not one and not five. The notice is
  non-blocking and states a doubt, not a failure of anything the cashier did.
- **A background retry does not flicker.** While *First read failed* stands, the poll's retries change nothing on
  screen. Only a press of *Try again* may show loading.
- **"The system is unavailable" and "something went wrong" are one state here.** The core distinguishes them, and the
  cashier can do nothing different. If you want two sentences, say so and the client will carry them; the entry rules
  do not change.
- **After a lock**, the held menu returns at once and is checked immediately. There is no loading state on sign-in, so a
  cashier returning every 90 seconds never sees a blank grid.
- **Not a Phase 1 state:** the existing `catalog` picture ("The menu changed while you were ordering… Nothing was
  added"). No POS command carries the version until Phase 2 (Q13), so that sentence could never be true in a served
  build. It stays a fixture picture. Do not repurpose its words for *Possibly out of date*. The `error` picture
  ("Could not add that line") is the same: no Phase 1 command is refused.

The other POS screens draw no catalog state. The floor stays fixture until Phase 2 (Q14).

### 3. M-2 for any served item

- **The sheet has at most two groups, and they have no names of their own.** The catalog stores two flat lists on an
  item (FR-C2, FR-C3, FR-C4; no group, no parent). The fixture headings ("Size", "Doneness", "Extras") have no source in
  a served item. **You need two fixed labels**: one for the variants (choose one), one for the modifiers (choose any). A
  list with nothing in it draws nothing, as Soda does today.
- **Nothing is preselected.** There is no default variant in the schema (C1 §2.2), and preselecting one would be a price
  the cashier did not choose. The fixtures' preselections are pictures of a cashier mid-choice. The sheet opens at
  *empty*, which M-2 already lists.
- **An item with variants needs exactly one chosen before Add** (FR-C2 as ADR-012 reads it, enforced by the server from
  Phase 2 and mirrored here). **New state:** Add is off, with a plain reason, until a variant is chosen. This is
  distinct from the 86 state and from the ceiling in D1. Until a variant is chosen the line total shows the base price
  plus any modifiers, floored at zero.
- **Negative deltas and the floor** (FR-C2, AC-26): a variant's delta may be negative and the resolved unit floors at
  zero. The existing *resolved unit price floors at zero* state applies to real items.
- **Long names:** an item name is 1–64 code points, a variant or modifier name 1–32, and prices run to 99.999.999. An
  item may have any number of options, so *overflow* applies.

### 4. The open sheet between polls

The sheet renders the live item from the current menu, never a copy taken when it opened. The cashier's choices are
held as option ids and survive every refresh. In every row below the sheet stays open: nothing is pulled from under a
finger. **Add never asks for an acknowledgement:** a pending line is freely removable (FR-H2), so ARCH-002's test finds
no irreversible harm to guard.

| While the sheet is open | The sheet | Add |
|---|---|---|
| **The item is 86'd** | Choices kept, marked unavailable, explained (AC-12; `sheet-item86` as drawn) | Off |
| **The item is available again** | The notice goes, choices kept | On, subject to the rest of this table |
| **The item is archived, or its category is** (it left the projection) | **New state.** The last-known name, options and choices stay readable. A notice says it is no longer on the menu. Do not reuse the 86 sentence: "a manager marked it 86" would be false. Cancel returns to a grid without that tile | Off |
| **It reappears** (restored) | As the row for available | On |
| **Its price, an option's delta or a name changes** | **New state.** The figures update at once, so what is shown is what Add adds. A notice says the item changed while the cashier was choosing, and stays until the sheet closes. One notice, whatever changed | On |
| **A chosen modifier is removed** | **New state.** It leaves the choices and the total. The same notice names what was removed | On |
| **The chosen variant is removed** | **New state.** No variant is chosen now. The same notice names it | Off until one is chosen (section 3) |
| **A new option is added, or options are reordered** | Drawn unselected, in place. No notice | Unchanged |
| **Checks are failing** (*Possibly out of date*) | Nothing changes; the sheet does not show that notice | Unchanged |

The sheet is opened by component state in served mode, as the line editor and the discount sheets already are, not by
`?state=sheet-item-<id>`. Nothing about it is in the URL and it is not back-stackable (SITEMAP §1). If the session
locks, POS-01 replaces the screen and the sheet's draft is gone, since the next person may be someone else. That is
existing behaviour and needs no drawing.

### 5. A pending line whose item is 86'd later

**The stand-in's fire-blocked state applies to real items in Phase 1** (FR-E4, B-17 as presentation). The refusal and
the row tag are already read off the order by `fire.ts`, and the served path gives them the real unavailable list, so
restoring the item clears the block. No new drawing. The plural copy in `fire.ts` is still marked provisional (FE-011),
and a served order can now reach it: **please supply the plural wording.**

A pending line whose item was **archived** does not block in Phase 1, and nothing marks it. FR-E4 and ADR-012 rule 12
name availability only, and the line is a snapshot (FR-C8). Whether a fire refuses an archived item is Phase 3's.

### 6. `?state=` pictures

Every menu picture you keep working from (`eightysix`, `loading`, `catalog`, `error`, `pressed`, `sheet-item*`) stays in
**fixture mode only**. In a served build those states draw the real catalog's facts and no fixture sheet. New pictures
for sections 2 to 4 are fixture-mode pictures on the same terms. Fixture order lines keep their names and prices beside
a served menu, under the owner's 2026-10-13 stand-ins. Do not draw a connection between them and the menu.

### 7. The discount picker's served states

**Owner question, not yet ruled.** Q14 speaks of a real menu item; it does not literally cover applying a real preset.
This consult recommends real presets in served mode, and the lead will put that to the owner. **Draw the recommended
answer.** If the owner says no, the fixture list stays and only the states below go unused.

- **What it shows:** active presets only, in the server's order (oldest created first, as BO-07). A zero-valued preset
  is shown. Nothing is approval-gated (FR-F2). The free-form path and FR-F8's gates do not change.
- **New states, all in the picker:**
  - **Loading** and **first read failed:** the presets are read with the menu, so these are the same two facts as
    section 2. *Other amount* stays offered in both.
  - **No active presets:** the presets group is absent or says so (yours to choose), and *Other amount* stays.
- **Values:** a percent can carry four decimal places. Show it with a decimal comma and no trailing zeros, as BO-07
  does (owner, DESIGN-018 Q6). The fixture `10%` form is the whole-number case. A fixed amount larger than the
  subtotal is listed as stored and capped when applied (FR-M5), with the capped figure on the totals.
- **Between polls:** the open picker follows the live list. A deactivated preset's row goes and an edited preset's row
  updates, with no notice and no in-place rule, because applying the wrong preset is replaced without approval. An
  applied preset is a snapshot on the order and is unaffected (FR-F4, FR-F5).

### 8. Copy the client needs that no design document holds (ADR-011 rule 24)

1. *First read failed*: title, body, *Try again*. 2. *Empty catalog*. 3. *Possibly out of date*. 4. The empty grid of a
category with no items. 5. The two fixed group labels of M-2. 6. Add off until a variant is chosen. 7. M-2's *no longer
on the menu* notice. 8. M-2's *item changed* notice, including its form naming a removed option. 9. D1's ceiling
reason. 10. The picker's loading, failed and no-presets states. 11. The plural of `fire.ts`'s refusal (section 5).

### D1. FR-M5's ceilings in the Phase 1 stand-in — answered

**Yes, in both, as the lead's provisional answer says, with three additions.** The rule is one pure function that M-2
and the store both call, so the drawn state and the refusal cannot disagree. It is presentation in Phase 1 and stays as
presentation in Phase 2, when the server's refusal becomes the control. Enforcing it costs one state now, and that
state is needed in Phase 2 anyway. Without it, a legal served item would show a line total the server will later refuse.

- **M-2.** When the line or the order would pass 99.999.999, Add is off with a plain reason, and the plus key is off when
  the next quantity would pass it. Minus stays live.
- **Addition 1: a choice can pass the bound at quantity 1.** A base of 99.999.999 plus a positive delta passes it before
  any quantity. So the off-state follows the choices as well as the keys: choosing an option may turn Add off, and
  unchoosing it turns Add on. The option itself is never refused, and the reason names the limit. Draw the state with
  the quantity at 1.
- **Addition 2: the order figure is the order's `total`** as the panel shows it, after discount and service charge, with
  the new line in it. In Phase 1 that uses the fixture rates (ADR-012 *Consequences*). The reason should not quote a
  computed excess.
- **Addition 3: the line editor uses the same check.** Its *Update to n* (M-5's form too) is off, with the same reason,
  when the new quantity would pass either ceiling. Otherwise the rule is walked around by adding one and raising the
  quantity. This is a ceiling, not a lock, so it does not disturb the plan's deferral of `setQuantity`'s lock check to
  Phase 2.
- **Not checked in the stand-in:** removing or replacing a discount, which can raise the total past the ceiling. Nothing
  is stored, and refusing a discount change needs a state no one has drawn for a case that needs a near-limit order. The
  server owns it from Phase 2.

The reason's wording is item 9 in section 8. The ceiling needs no new constant in `tender.ts`'s sense: a shared
`LINE_TOTAL_LIMIT`, and an order limit of the same value, belong beside `SINGLE_TENDER_LIMIT`.

### D2. The first read with no response — answered

**No new timer: the core's bound ends it. But the bound is up to 20 seconds, not 10, and the lead's provisional answer
understates it.** A request that times out at `DEFAULT_TIMEOUT_MS` is a fault, and a fault makes the core ask
`GET /api/health` before it returns a result (ADR-011 rule 20; `healthDecides`, `client.ts:299`). That read has its own
ten-second timer. So:

| What the server does | *Loading* lasts |
|---|---|
| Refuses the connection, or answers an error | About as long as one round trip, plus the health read |
| Holds the read, then answers health | About 10 seconds |
| Holds both | Up to 20 seconds |

Draw nothing that promises a duration. *Loading* needs no second stage for the long case. The order panel is usable
throughout, and a hung server on the same machine is rare. A separate 10-second timer in the catalog store would put
the state on a second clock, ahead of a result the core has not returned yet, and the late answer would then have to be
reconciled. Rejected.

## Summary

The POS gets two routes: a revision read answering one number and a menu read answering the whole projection, both an
active POS session, not interactive. A single client catalog store above the routes polls while signed in and visible,
one cycle at a time. The served and fixture menus come through one constant, as the session does, and the screen has
one path over either. Add feeds the stand-in with a snapshot and refuses in the store under a lock, for an 86'd item and
past FR-M5's ceilings. S7b should split into three.

**One owner question:** OQ1, real presets in the POS picker (item 9). Nothing in this report contradicts the contract, an
accepted ADR or a DECISIONS line, and no ADR's wording needs to change (item 6).

**One fact to confirm before S7b's test is written.** The librarian found that the documentation and the 1.64.1 source
disagree on whether the page clock flows after `install()`, and said to verify it. The repository answers it in
practice: `e2e/tests/idle.spec.ts:24`'s `settle` awaits a page `setTimeout` under an installed clock that nothing
advances, in a suite recorded green, so it flows. The design below does not depend on the answer, because it pauses the
clock explicitly, but item 4's steps are unproved until the builder has seen them run. I ran no test or browser for this
consult.

## The decisions

### 1. The POS projection

**Decided: one read, `GET /api/pos/catalog/menu`, answering one snapshot.**

```ts
// packages/contracts, a new pos-catalog.ts. Strict objects, as everywhere; a sketch for the builder.
PosMenuResponse = {
  version: CatalogVersion,
  categories: [{ categoryId, name }],
  items: [{
    itemId, categoryId, name,
    basePrice: BasePrice,                       // canonical string
    isAvailable: boolean,
    variants:  [{ variantId,  name, priceDelta: VariantPriceChange }],
    modifiers: [{ modifierId, name, priceDelta: ModifierPriceChange }],
  }],
  presets: [{ presetId, name, value: PresetValue }],   // subject to OQ1
}
```

- **It holds** what the POS may show, and only that. **It omits** archived categories and their items, archived items,
  removed options and deactivated presets by filtering in SQL, so they are never loaded. It also omits `isActive`
  (always true here, and absent means no client can branch on it) and `displayOrder` (the array is the order).
- **Order:** categories, the items of each and each item's options by display order, ties by name with BO-03's collator
  (`Intl.Collator('en', { numeric: true, sensitivity: 'base' })`), then id. The database gives order and id, as
  `readCatalog` does; a small pure function in the domain settles ties by name. Presets stay in `listPresets`'s order
  (`created_at`, id), which is BO-07's. The client draws the order it is given.
- **The version** comes from the same `REPEATABLE READ READ ONLY` transaction as the contents (ADR-012 rule 11). A new
  domain function, `readPosMenu()`, takes the version first, as `readCatalog` does. It cannot be built from `readCatalog`
  and `listPresets`, which are two snapshots.
- **Size.** Two hundred items with five options each is on the order of 100 KB, and it does not matter, because this
  read does not run every two seconds. It runs once per catalog change at most, and at most once per poll interval
  during an editing session.

| Alternative | Why it lost |
|---|---|
| Reuse `readCatalog` and filter | Loads what the POS must never hold. A forgotten filter would put an archived item on the grid |
| Filter in the client, sending `isActive` | The same, one step later. It also puts archived names in a POS response |
| Separate reads for the menu and the presets | Two snapshots and two versions, where ADR-012 rule 12 says add-line and preset apply each carry "the catalog version of the projection it was built on": one projection |
| One read per category, or the sheet's options on demand | More requests, a new loading state on every tile, and a sheet whose options come from a later version than its tile |

### 2. The revision read

**Decided: a separate route, `GET /api/pos/catalog/revision`, answering `{ version }`.** Declared
`{ session: 'ACTIVE', audience: 'POS', interactive: false }`, with `{ method: 'GET', path, interactive: false }` in the
route table; the menu read is declared the same. I found no reason to differ from the plan's access line.

**What each poll costs:** one session resolution and one single-row read, if the two points below are taken.

- **It opts out of the client-instance hook** (`config.clientInstance: false`, as health does). Otherwise every poll is
  an `UPDATE client_instance`, a write every two seconds per tab, for a telemetry stamp the poll has no need to move.
  The first API request is still `me`, so FR-A7's first contact is unaffected. The menu read keeps the hook.
- **It should not log at the default level.** I found no `disableRequestLogging` in `apps/server/src`, so at the default
  `info` Fastify's request logging should write its lines for every poll. A log dominated by polls is a worse log.
  *Recommended:* a per-route `logLevel` of `warn` on this route only. This is a library fact I have not confirmed:
  the S7a builder asks the librarian, checks that a 500 still logs, and reports it. It changes no rule of ADR-010.

| Alternative | Why it lost |
|---|---|
| A conditional read of the projection (`If-None-Match`, 304) | The core sends `cache: 'no-store'` and treats a non-2xx with no envelope as a fault, so it needs a change to the transport core and to ADR-010's envelope rule, and the server would still build or hash the projection on each poll |
| Polling the projection itself | Parses a whole menu every two seconds to learn that nothing changed |
| Server push (SSE, WebSocket) | ARCHITECTURE §4.3 and FR-C6 name a poll. It would be a new transport with its own session rules |

### 3. The poll

**Decided:** a store with no React, `apps/pos/src/catalog/catalogStore.ts`, modelled on `realSession.ts`, with its timer
injected. It sits above the routes, as the session store does, and is handed exactly the two read functions, so it has
no way to reach `activity` (FR-A2b).

**One cycle at a time.** A cycle reads the revision, and if the answer differs from the held version, or no menu is held,
reads the menu. With no menu held it goes straight to the menu read. The next cycle is timed two seconds after the
previous one settles, so cycles cannot overlap. Worst case for an 86: committed just after a revision read, seen two
seconds later, plus two round trips on loopback, which is inside the three-second budget. A refresh requested during a
cycle joins that cycle.

| Condition | The poll |
|---|---|
| Signed in, on any POS screen | **Runs.** Not only on POS-03: a quick sale's close on POS-04 reads availability too (`orderStore.ts`, `close`), and a store that woke only on POS-03 would start every order on stale facts |
| Under POS-01, for any reason | **Stopped**, with no request. Every request would be a refusal, and a reply about a session this tab no longer holds. An answer settling after the stop is dropped by an epoch that advances on every stop and start |
| A sign-in | **Starts with an immediate cycle.** The held menu stays on screen meanwhile. It is not person-specific, so another cashier's sign-in does not drop it |
| Tab hidden | **Paused**, resuming with an immediate cycle on `visibilitychange` to visible. Nobody can see a hidden tab, browsers throttle its timers anyway, and §4.3's focus refresh covers the return |
| Window `focus` with the tab visible | An immediate cycle (ARCHITECTURE §4.3) |
| One failed check | Nothing visible. Next cycle on schedule |
| Two in a row | *Possibly out of date*, or stays at *First read failed* if nothing is held. Cleared by the first check that leaves the client current |
| Session-ending answer | Nothing of the store's own. See below |

**No backoff.** There is one tab and one server on one machine, so nothing needs protecting from a stampede, and backoff
would delay recovery past the budget just when the server comes back. A failure costs two requests instead of one
(rule 20's health read).

**A menu already shown stays usable while refreshes fail** (*For DESIGN-021* section 2). Polling is never the integrity
control (§4.3), and nothing is stored in Phase 1. From Phase 2 the server refuses a stale add. Blocking the cashier
because a refresh failed would stop the restaurant over a doubt.

**Why the poll cannot mask or race the session.** Read from `packages/api-client/src/client.ts`:

- A session-ending answer goes through the same `settle` as any request: `SESSION_IDLE` and `UNAUTHENTICATED` end the
  session in the core, which tells `realSession.ts`. The poll adds no handling and needs none. As a result the POS can lock
  on a poll's answer, slightly before its own deadline read, and that satisfies rule 21 ("any request answered…").
- **A poll's 2xx moves no deadline:** the routes have no session spec and are not interactive (`client.ts:350-358`).
- **A poll never ends a session on a fault:** a fault goes only to the health read.
- **A race with `me`** at the deadline or on becoming visible is one winner and one `session-gone` loser, already
  handled by the generation.
- **A GET carries no anti-CSRF token**, so a poll is never `CSRF_REFUSED` and never triggers rule 18's retry. In the
  two-tab case a poll under the other person's cookie answers one global number with no name in it. It neither shows
  nor acts as that person, and it extends nothing. Rule 18's protection still fires on the tab's next mutation.
- The store treats `refused`, `failed`, `unavailable`, `invalid-request` and `session-gone` alike as "not a check that
  succeeded". It reads no code, so it needs no entry in `meaningOf` (rule 20's exhaustive map is the session's).

| Alternative | Why it lost |
|---|---|
| A fixed `setInterval` | Overlaps when a read is slow, and the answers can then arrive out of order |
| Polling only on POS-03 | See the table. It also adds a stale first draw on every entry |
| Continuing while hidden | Requests with nothing to show, on a throttled, unpredictable timer |
| Dropping the held menu at a lock | A blank grid and a loading state every time a cashier returns from the 90 seconds |
| Merging by version, as BO-03 does (FE-037) | BO-03 needs it because reads race with answers from its own commands. The POS has no commands and one read at a time, so arrival order is already correct. The server is the authority even if a number goes backwards, as after restoring a database, so the store adopts whatever a read answers. Phase 2's add-line brings its refresh through the same single cycle |

### 4. The three-second proof

**Decided, for S7b's new `e2e/tests/pos-catalog.spec.ts`:** `twoProfiles`, the back office in one and the POS in the
other. No real waits (rule 27), and requests only by the page.

1. Build the menu through the back office's own screens (the *Demonstrable* says "through the back-office routes"), and
   sign in at both. `pos.clock.install()` comes before the POS's first `goto`.
2. With the tiles drawn, **pause the POS's clock** and wait until the POS has no catalog request outstanding, from the
   profile's own request and reply lists. From here no POS timer fires unless the test advances it. So there is no race
   between the two clocks. The only clock that matters in this test is the page's, because nothing here ages a session.
3. Mark the item 86 from its BO-03 row, and await its page status. **Assert the POS tile is still enabled**, which proves
   the change can only arrive by the poll.
4. `pos.clock.runFor(2000)`. The last cycle settled at or before the pause, so the next one falls due within those
   2000 ms. Then `expect` the tile's `aria-disabled` with Playwright's ordinary retry, which spends real time on the
   network and no page time. **Page time spent: 2000 ms, against a budget of 3000.**
5. Assert in place: the tile order and its bounding box are unchanged (AC-12's no reflow), it carries the tag named by
   `aria-describedby`, and a press opens no sheet.
6. The reversal, the same way. Then the sheet: open another item, choose a variant and a modifier, 86 it, `runFor(2000)`,
   and assert the sheet is open, the options still `aria-pressed`, and Add `aria-disabled`.
7. **Focus refresh:** with the clock still paused, make a change and dispatch `focus` on the window. The tile changes
   with no page time spent.

**The first 2xx body read in the page** (plan `:456`): `pos.evaluate(() => fetch('/api/pos/catalog/menu').then((r) =>
r.json()))`. Assert that its `version` equals `readCatalog().version` read through the domain, and that an item archived
in the test is absent. The harness keeps reading only error bodies (`fixtures.ts:127`, because a sign-in's 2xx holds the
token), so nothing changes there and rule 27 holds. The projection holds no credential.

**Assertions** are on state, accessible names and `data-item`, never copy (rule 27). The scan runs as usual.

**Polling extends nothing, in a browser:** one case in `idle.spec.ts`. Let polls run, age the session past the limit
with both clocks, and assert the tab locks, with no `activity` sent. The precise proof that the stamp does not move is
S7a's route test (rule 28).

**Why it does not flake.** The clock is paused across the assertion, so no timer depends on real time, and the only real
time spent is network, under retrying assertions. The one sensitivity is the POS's real 90 seconds in PostgreSQL while
the test runs, far longer than the test should take. Neither of the two pages must be `hidden` in either engine, or the
poll pauses: the builder confirms this in Chromium and WebKit, and it is the first thing to look at if the poll seems
not to run.

**Red proofs:** set the interval to 3500 ms, and step 4's assertion fails. Skip the version advance on an 86 (S5's own
red), and it fails. Remove the store's held-menu update on an unchanged item list, and it fails.

### 5. Menu sources under rule 23

**Decided: one more use of the one constant.** `session/source.ts` is the only module that names the fixture catalog,
as it already is for the session: `createCatalogStore` picks the fixture store or the real one, and a
`FixtureMenuFacts`-style export is `null` in a build, as `FixtureLockPictures` is. `import.meta.env.DEV` is not the switch.

**One screen path, two sources.** Both stores give the screen the same client shape, with money already decoded by
`decodeMoney` at the one point the wire enters. The fixture store makes no request and starts no timer. `MenuRegion` and
the sheets read the store and do not know which it is. There is no fallback in either direction: an empty served catalog
is empty, and a served failure is a failure, never the fixture menu (B-24).

**This requires a split, and it is the bulk of the work.** Today `menuFixtures.ts` mixes copy and rules with fixture data,
and `orderStore.ts`, `MenuRegion.tsx` and `OrderPanel.tsx` import it directly:

| Now | Becomes |
|---|---|
| `MENU_CATEGORIES`, `MENU_ITEMS`, `MENU_FIXTURES`, `itemDestination`, item-sheet fixtures | A fixture-only module, reached only through `source.ts`, holding the marker |
| `LOCK_NOTICE`, `REJECTED_NOTICE`, `LOADING_LABEL`, the types | A plain module, kept in the bundle |
| `originFacts(view).lock` and `.incident` | Stay, read from `ORDER_FIXTURES`: they are the order stand-ins'. `.menu` goes behind the source |
| `priceOf(itemId)` in `orderStore.ts` | Gone. `NewLine` carries the base price (item 7) |
| `sheetFixtures.ts` | The line-editor stand-in (`panelLine`, `SHEET_FIXTURES`' line states) stays. The item sheets move out |
| `CategoryId`, a union of four literals | `string` |

**The bundle marker (B-24), made as the fixture-session proof is.** Export `FIXTURE_MENU_MARKER` from the fixture-only
module and add it to `FIXTURE_ONLY` in `apps/pos/test/built-session-support.ts`, which already builds twice, plainly and
with `NODE_ENV=development`. Add to the list one or two option names the fixture sheets use and no fixture order does
(the builder confirms by search, for example `Chilli mayo`). **Item names cannot be needles:** "Burger" and "Steak" are in
`ORDER_FIXTURES`, which stays by the 2026-10-13 ruling. So the proof is about the fixture *menu*, as the Definition of
Done says, and not about every fixture word.

The librarian could not confirm from Rollup's documentation that a module is dropped when its only import folds away;
it depends on the module being free of side effects. **That is why the marker test is the proof, not the reasoning,** and
why the fixture module should hold only data and pure functions. The existing fixture-session test shows that the
mechanism works in this build.

*Red:* import the fixture module directly from `MenuRegion.tsx`. Test 27 fails in both builds.

**Fixture orders beside a served menu.** A line is a snapshot, so they sit together without contradiction (Q14). A fixture
line's `itemId` is a slug such as `steak`, and a served item's is a UUID, so a fixture line can never match the served
unavailable list, and `holdsUnavailable` needs no change. **`OrderLine.itemId` stays optional and is not made a guarantee.**
Nothing may look a line up in the catalog: a line reads from its snapshot alone, and its `itemId` answers only FR-E4's
question. Names are never compared. The comment at `orderFixtures.ts:37` that names `MENU_ITEMS` needs rewording.

| Alternative | Why it lost |
|---|---|
| `import.meta.env.DEV` | Follows `NODE_ENV`. Rule 23 rejects it by name |
| Fixture menu as a fallback when the server is unreachable | Rule 23's "never mix", and B-24: a price nobody set, on a real sign-in |
| Fixtures served by a stub API in fixture mode | Fixture mode makes no request (rule 23) |
| Two component trees | Every fix would be made twice, and the fixture path would stop testing the real one |

### 6. POS-03's `?state=` pictures

**Decided.** In a served build `?state=` keeps its job as the order stand-in's routing (`go`, `?gone=`, the floor's
openers), since the stand-ins are the owner's until Phase 2. It stops choosing anything about the menu.

| Picture | Fixture mode | Served build |
|---|---|---|
| `eightysix`, `fireblocked`, `fireblocked-overflow`, `sheet-item86` | Stays: the fixture store reports the 86 | The order is drawn as today, and availability is the catalog's. A fixture Steak does not block |
| `loading`, `catalog`, `error`, `pressed` | Stays | No effect on the menu. `catalog` and `error` depict commands that do not exist yet (*For DESIGN-021* section 2) |
| `sheet-item`, `sheet-item-<id>` | Stays | Opens no sheet |
| New pictures from DESIGN-021 | Added on the same terms | Absent |
| Every other order-panel state | Stays | Unchanged |

**The gate.** `OrderPanel.tsx:357`'s state list is gated by `import.meta.env.DEV` today, and it lists these pictures, so
S7b moves that one gate to the constant. *Red:* with `NODE_ENV=development`, `built-session-development` finds the list's
marker in the bundle. The floor, settlement and closed-order gates stay as they are, for Phase 2.

**ADR-011 needs no change.** Its *Not decided here* says each switch goes with its stand-in in Phase 2, and that a task
keeping a switch must use the build-command constant. This does what the second clause asks, one screen earlier. The
sentence is a record of the state on 2026-10-19 and stays as it is, and plan `:472` already sends this to C4. **Proposed
for the lead:** note it in S7b's task file, not in the ADR.

| Alternative | Why it lost |
|---|---|
| Deleting the menu pictures | They are how the designer and the owner review states with no server. Fixture mode exists for that |
| Keeping them live in served builds | A served POS showing an invented 86 from a URL |
| A second URL parser in served mode | The stand-ins need the one that exists |

### 7. Add into the stand-in (Q14)

**Decided: `NewLine` becomes the snapshot.**

```ts
type NewLine = {
  itemId: string;     // required, as now: FR-E4 depends on it
  name: string;
  quantity: number;
  basePrice: Money;
  modifiers?: ReadonlyArray<Modifier>;   // the chosen variant and modifiers: name and delta
};
```

- **Snapshotted:** the names, the component deltas and the resolved unit price with FR-C2's floor (AC-26), through the
  existing `resolveUnit`. A zero delta is written as the bare name, as today.
- **Not snapshotted: option ids.** Lines are snapshots and read nothing back. The stand-in goes when Phase 2's add-line
  arrives, and that command sends ids from the sheet's choices, not from a stored line. An id nobody reads is a field to
  mistake for a guarantee.
- **`basePrice` replaces `priceOf`,** which is what lets the fixture menu leave the store.

**`addLine` closes ARCH-004's gap under a lock**, and returns an outcome rather than nothing, as `changeDiscount` does. It
reads its facts at the press, through the same ref `fire` uses, and it follows `changeDiscount`'s pattern of advancing
`bookRef` so that a second call in one tick sees the first:

| Refusal | Read from | Note |
|---|---|---|
| `closed` | `isOpen` | Already silently refused by `update` |
| `locked` | `locked || originFacts(view).lock !== undefined` | **ARCH-004's gap.** Own draft or another's lease |
| `unavailable` | The catalog store's current list, at the press | **FR-C5, as a stand-in only.** A check in a browser controls nothing; the server's refusal in Phase 2 is the control (ADR-012 rule 12) |
| `over-limit` | D1's pure function | D1 |

A refusal changes nothing and returns the same book (B-20), and the sheet stays open. The screen should never offer any
of these, so the store check is reached only if the screen is wrong, which is exactly why it exists. A comment must say
*stand-in* in the words `discountChange.ts` uses, and name the server command that replaces it.

`removeLine` and `setQuantity` keep their lock gap until Phase 2 (plan `:466`). D1's ceiling does apply to the line
editor's *Update*, in the screen and in `setQuantity`, because it is a different rule from the lock.

**The sheet opens by component state in served mode** (`itemOpened`, beside `lineOpened` and `discountOpened`): a UUID is
not an `OrderState`, and the sheet is not back-stackable. Cancel and Add leave the view as it is. Focus returns to the
tile, or to the selected category's button if the tile has gone.

### 8. The open sheet between polls

Fixed in *For DESIGN-021* section 4. **The mechanism:** `ItemSheet` keeps its `picked` state of option ids and receives
its `sheet` from an adapter that builds it from the live item at each render, so `Sheets.tsx` changes little. It remembers
the last-known item for the archived case, and it compares what the sheet opened on with what it now holds to raise the
*changed* notice.

**Why Add stays live on a price change.** FR-C7's promise is "never added at a price other than the one displayed". A
live sheet keeps it by construction: what is displayed is what Add adds. Holding the old price would break it in Phase 2,
where the server would refuse. Requiring an acknowledgement fails ARCH-002's test: a pending line is removed in one press,
with no approval. **Pending lines are not repriced:** a line is a snapshot (FR-D4, B-8).

**One thing I found and did not decide.** The comment above `ItemSheet` says an 86'd sheet draws no stepper ("There is no
quantity to commit then"), but the code draws a live `QuantityStepper` in that state, with the bound line. AC-12 does not
care. DESIGN-021 should draw which it means, and the builder follows the drawing.

**The fire-blocked state** is item 8's last question: yes for real items (*For DESIGN-021* section 5). `fire` and `close`
read the unavailable list from the catalog store at the press, replacing `menu.eightySixed`. It is a stand-in's
presentation of FR-E4, and Phase 3's fire is the control.

### 9. The POS preset picker

**Recommended: real presets in served mode in Phase 1. It is a new owner question, because Q14 does not cover it.** Q14's
words are "add a real menu item". The 2026-10-13 ruling keeps stand-ins until the server's *command* arrives, and what
changes here is a read, not a command, so it leans the same way, but neither says it. See OQ1.

**The reasons:** a manager who makes a preset in BO-07 and cannot find it at the POS will think BO-07 is broken. Deactivating
a preset would visibly do nothing, against FR-F5. The fixture list ("Staff meal", "Comp") would sit in a served picker on a
real sign-in, which is B-24's named list. The cost is small: `changeDiscount` already takes `presets` as an input fact.

**If yes.** The projection carries `presets`. `orderStore.ts`'s `PRESETS` input comes from the catalog store at the press.
`ratePpm` is converted to the `percent` string `discount.ts` holds by a pure, exact function, tested by the round trip
`rateFromPercent(percentFromPpm(p)) === p`, with no float. `Preset.active` is true for everything served. The stand-in's
rules are unchanged: FR-F8's gates, no audit, and the fixed amount capped by `discountAmount` when applied. Fixture
orders' `STAFF_MEAL` and `COMP` become literal snapshots in the order fixtures, since those are order stand-ins, not a
pick-list, and `PRESETS` joins the fixture-only module.

**If no.** The projection omits `presets`, the picker keeps the fixture list until Phase 2, and DESIGN-021's picker states
wait for it. Phase 2 adds the field.

### 10. The version the POS keeps for Phase 2

**Decided: the store holds `{ version, categories, items, presets }` as one immutable object, replaced whole.** That is the
whole of what Phase 2 needs. Add-line must carry the version of the projection it was built on (ADR-012 rule 12). The sheet
renders from the current object, so the version of the object it rendered from at the press is by construction the one
behind the figures on screen. `apps/pos/src/catalog/` is where it lives.

**No line or order carries it,** and no parameter is added now. An unused field on `NewLine` is dead code that would look
like a promise (Q13). *Red for the shape:* a unit test that a refresh never exposes a new version with old contents, or the
reverse. What the server does with it, and `CATALOG_CHANGED` at the POS, are Phase 2's.

| Alternative | Why it lost |
|---|---|
| The revision the poll last saw | **Dangerous:** newer than the contents on screen, so a stale price would pass the check. This is the pairing ADR-012 rule 11 forbids |
| A version captured when the sheet opens | The sheet is live, so that would describe contents no longer shown |

### 11. The split

**S7a** (server) and **S7b, which should split again into three.** It is the only Phase 1 slice that touches the add path, and
item 5's untangling alone is a reviewable change that must not move behaviour. See *For the lead*. The order is S7a, S7b1,
S7b2, S7b3; S7b3 waits on OQ1 and all three on DESIGN-021's review.

### 12. What DESIGN-021 must draw

*For DESIGN-021*, sections 1 to 8, and D1 and D2.

## For the owner

**OQ1. May the served POS discount picker show real presets in Phase 1, applied into the discount stand-in?** Q14 covers real
menu items and does not mention presets. **Proposed: yes.** Nothing is stored, the stand-in's gates are unchanged, and it
goes when Phase 2's discount command arrives. Otherwise the fixture list stays in a served picker until Phase 2, and
a preset made or deactivated in BO-07 has no visible effect at the POS (item 9). Blocks S7b3 only.

## Stale text found

No contract document needs a change. All of these are small and none blocks anything.

1. **C1 §2.2**, *What the POS may offer*: "an item that is active, available, and in an active category" reads as though an
   86'd item is not offered. DESIGN-019's F2 and the lead's ruling are clearer. C1 is not binding and needs no edit; S7's task
   files should quote this report's section 1 instead.
2. **`apps/pos/src/orderFixtures.ts:37`** names `MENU_ITEMS`: S7b1 rewords it (item 5).
3. **`docs/design/SCREEN-INVENTORY.md` POS-03** says "the twelve menu tiles", while the code has fourteen. Its M-2 needs the new
   states. Both are DESIGN-021's.
4. **`apps/pos/src/session/source.ts`'s comment** describes two things behind the switch; S7b1 updates it.
5. **`MenuFixture.lock`** in `menuFixtures.ts` is set and no longer read (`MenuRegion` takes the lock from `originFacts`). S7b1
   drops it during the split.

## For the lead

Every test names the change that must make it fail. The builder makes that change once, sees it fail for the stated reason,
reverts it, and records it in the Handoff.

### S7a — the POS catalog and revision routes

- **`touches`:** `money`, `boundaries`, `identity`. **Browser harness:** no.
- **`owns`:** `packages/contracts/src/pos-catalog.ts`, `packages/contracts/src/index.ts`, `packages/contracts/src/routes.ts`,
  `packages/api-client/src/specs.ts`, `packages/api-client/src/client.ts` (`ROUTES`), `apps/server/src/domain/catalog.ts` (or a new
  `pos-menu.ts`), `apps/server/src/http/routes/pos-catalog.ts`, the server's route registration,
  `apps/pos/src/session/api.ts` (the mapped type forces two entries; they stay unused until S7b1), and tests.
- **Scope:** the two routes of items 1 and 2. No client behaviour.

| # | Acceptance criterion | Red |
|---|---|---|
| 1 | Both routes are `ACTIVE`, POS, not interactive, and in the route table | Declare one interactive: `route-table.test.ts` case 8 fails |
| 2 | A back-office session is refused on both; no session is `UNAUTHENTICATED` | Declare `BACK_OFFICE`: startup refuses it |
| 3 | Reading either route does not move `last_interactive_at`; a session idled past the limit is answered `SESSION_IDLE` by each (AC-28) | Declare interactive: the stamp moves |
| 4 | The menu omits an archived category and its items (even active, available ones), an archived item, a removed variant and modifier, and a deactivated preset. A strict-schema parse rejects `isActive` or `displayOrder` | Load with `true` in place of the filter: each row fails |
| 5 | An 86'd active item is present with `isAvailable: false`. An item both 86'd and archived is absent | Filter on `is_available` |
| 6 | Order: display order, ties by name with the collator, then id, for categories, items and options; a tie is seeded by the owner connection | Remove the tie-break: `b` precedes `a` when `b`'s id is lower |
| 7 | **AC-31, Phase 1 part:** the version comes from one snapshot. A second connection commits a price change and an advance between the read's statements; the read returns the old version with the old price (C-18's pattern) | Read in `READ COMMITTED`: the pair mismatches |
| 8 | Money and rates are canonical strings; the response validates against `PosMenuResponse` | Send a number: the core's schema refuses it, and so does the test |
| 9 | `revision` equals the version after every command class (one row per ADR-012 rule 10's kinds, by route) | Skip the advance in one command |
| 10 | The revision route does not touch `client_instance` | Remove `clientInstance: false`: `last_seen_at` moves |
| 11 | An empty catalog answers version 0 and empty lists, not an error (B-24) | Treat none as `NOT_FOUND` |
| 12 | The per-route log level (item 2): a poll writes no line at `info` and a 500 still logs. **Confirm the Fastify fact with the librarian first** | Remove the option: a line appears |

**Tests expected to change:** `route-table.test.ts` and its explicit lists as they need; the access tests. A new
`pos-catalog-routes.test.ts`. `schema.test.ts` is unchanged (no migration). If OQ1 is unanswered when S7a is written, build
it with `presets`: the field is one line to remove and costs nothing if unread.

### S7b1 — the served menu: the store, the poll, the sources and the grid

- **`touches`:** `boundaries`, `money` (prices decoded in one place). **Browser harness:** yes.
- **`owns`:** `apps/pos/src/catalog/**`, `session/source.ts`, `session/realSession.ts` and `types.ts` (the one instance hands the
  store its two reads), `PosRoutes.tsx`, `MenuRegion.tsx`, `menuFixtures.ts` and the new fixture-only module, `sheetFixtures.ts`,
  `orderStore.ts` (`priceOf`, `CategoryId`, availability input to `fire` and `close`), `OrderPanel.tsx`, `pos.css`, `apps/pos/test/**`,
  `e2e/tests/pos-catalog.spec.ts`, `e2e/tests/idle.spec.ts`, `e2e/support/**`.
- **Scope:** items 3 to 6; DESIGN-021's states of section 2 and section 1's grid. Tiles open a sheet from S7b2; until then an
  available tile does nothing in served mode, which is fine for one merge in a Phase 1 sequence, and the lead should say so
  to the owner.
- **Depends on:** S7a, DESIGN-021's review.

| # | Acceptance criterion | Red |
|---|---|---|
| 1 | Served: tiles, order, categories and prices come from the store. A money field is decoded once, at the wire | Hard-code a category |
| 2 | **B-24:** the marker and the option-name needles are absent from both builds | Import the fixture module from `MenuRegion` |
| 3 | The poll never runs while signed out, runs on the floor and on POS-04, pauses when hidden, and runs one cycle at a time. Fake timer, stub API | `setInterval`: two cycles overlap under a held response |
| 4 | `activity` cannot be reached by the store: it is given two functions, and the existing source scan stays green | Pass the whole API: type-level, and the scan is extended to hold it |
| 5 | Focus and becoming visible run a cycle at once; a sign-in does too | Remove a listener |
| 6 | One failed check shows nothing; two show *Possibly out of date*; the grid stays usable; a good check clears it | Threshold 1, or disable tiles |
| 7 | First read failed: entered on one failure, left by a later good read without a press and by *Try again*; background retries do not flicker | Set loading on every retry |
| 8 | Empty catalog is not an error, and shows no fixture | Fall back to fixtures |
| 9 | A cycle's result arriving after a lock changes nothing | Remove the epoch |
| 10 | A new version and its contents appear together (item 10) | Set the version before the read |
| 11 | **AC-12's grid, on the served path:** an 86'd tile keeps its slot, greys, carries the tag, and cannot be selected. The fixture-path tests move to the served path | Filter 86'd items out |
| 12 | Archived or removed items leave at the next refresh; the selection follows its id; a vanished category falls to the first | Select by index |
| 13 | **The three-second proof,** item 4 steps 1 to 5 and 7, both engines | Interval 3500 |
| 14 | The body read in the page (item 4) | Answer an archived item |
| 15 | Polling extends nothing in a browser (item 4) | Mark the route interactive |
| 16 | `?state=` in served mode, item 6's table; the `OrderPanel.tsx:357` gate is the constant | Leave the gate |

**Tests expected to change:** `built-session-support.ts` (the needles). `menu-region`, `menu-categories`, `tile-for.ts`, `own-items`,
`sheets`, `fire`, `one-press-fire`, `quick-sale`, `order-store`, `void-apply`, `discount`, `discount-apply` and `discount-change`
import the fixture modules and move their imports. Their assertions should not change meaning; a served-mode render helper
is new. `no-invented-values.test.ts` reads top-level `src` files only, so it needs extending to `src/catalog`.
`e2e/tests/idle.spec.ts` **B6 and B8 will otherwise flake:** a poll and the deadline read now race for the verdict, so
`lastCodeOf(POS_ME)` may be null or `UNAUTHENTICATED`, and a poll may be in flight at `fastForward`, against rule 27. They assert
the code from either route and quiet the poll first. A helper in `e2e/support/` pauses, waits for no outstanding catalog
request, and resumes: **ask the librarian to confirm `clock.resume`** and `pauseAt`'s behaviour. Review the other POS tests that
move a clock or count requests by path; I found none that should change meaning in `identity`, `premises`, `audience` or `scan`.
**`test:e2e:all` is the lead's to run before merge.**

### S7b2 — M-2 for a served item, Add, and the sheet between polls

- **`touches`:** `money`, `boundaries`. **Browser harness:** yes.
- **`owns`:** `Sheets.tsx`, `OrderPanel.tsx`, `orderStore.ts`, `fire.ts` if its plural copy changes, `apps/pos/src/catalog/**`,
  `pos.css`, `apps/pos/test/**`, `e2e/tests/pos-catalog.spec.ts`.
- **Scope:** items 7 and 8, D1.
- **Depends on:** S7b1.

| # | Acceptance criterion | Red |
|---|---|---|
| 1 | Any served item opens M-2 by component state, with no URL change, at *empty*, with no preselection and at most two groups | Preselect the first variant |
| 2 | An item with variants: Add off until exactly one is chosen; an item with none needs none | Allow none |
| 3 | The line snapshots names, deltas and the floored unit (AC-26): base 10.000, variant −20.000 gives unit 0 | Clamp the total, not the unit |
| 4 | **`addLine` under a lock** (own draft and fixture lease) refuses, returning the same book. Driven at the hook, as ARCH-004 asks | Remove the check: a line is added |
| 5 | `addLine` of an 86'd item refuses, reading the store at the press; a comment says stand-in | Read the value captured at render |
| 6 | D1: a choice or quantity past either ceiling turns Add and plus off with the reason, the store refuses, and the line editor's *Update* does the same. Exact bound 99.999.999 accepted, 100.000.000 refused | Check the line only |
| 7 | Every row of *For DESIGN-021* section 4, with a stub store changing the item under an open sheet | Snapshot the item at open |
| 8 | **AC-12's sheet,** in the browser: item 4 step 6, both engines | Close the sheet on 86 |
| 9 | Fire blocked for a real pending line, cleared by restoring; a fixture line with `itemId: 'steak'` beside a served 86'd item named Steak does not block; a line with no `itemId` never blocks | Compare by name |
| 10 | A pending line keeps its price after the item's price changes (B-8) | Read the catalog for the line |

**Tests expected to change:** `sheets`, `own-items`, `order-store`, `one-press-fire`, `fire`. `sheet-item86`'s test stays in fixture mode
with a served twin.

### S7b3 — the POS preset picker (if OQ1 is yes)

- **`touches`:** `money`, `boundaries`. **Browser harness:** one case.
- **`owns`:** `DiscountSheets.tsx`, `discountFixtures.ts`, `discount.ts`, `orderFixtures.ts` (literal snapshots), `orderStore.ts`,
  `apps/pos/test/**`, `e2e/tests/pos-catalog.spec.ts`, `built-session-support.ts`.
- **Depends on:** S7b1, OQ1.

| # | Acceptance criterion | Red |
|---|---|---|
| 1 | Served: only projection presets, in order; zero-valued shown; no fixture preset in the picker, and the fixture list's marker absent from both builds | Keep `PRESETS` |
| 2 | `percentFromPpm` is exact, by round trip across 0, 1, 123456, 1000000 | Divide with a float: 123456 fails |
| 3 | A preset applied keeps its snapshot when it is later edited or deactivated (FR-F4, FR-F5) | Read the preset at render |
| 4 | Loading, failed and no-presets states, with *Other amount* live; FR-F8's table unchanged | Hide Other amount |
| 5 | Browser: a preset created in BO-07 appears at the POS after `runFor(2000)`, and one deactivated leaves | Omit presets from the version's advance (S6-4's red) |

**Tests expected to change:** `discount`, `discount-apply`, `discount-change`.

## Not decided here

- **Phase 2:** the add-line command, its idempotency, `CATALOG_CHANGED` at the POS (AC-31), `ITEM_UNAVAILABLE`'s POS state, and
  the server's FR-M5 refusal and its codes.
- **Phase 3:** whether a fire refuses a pending line whose item was archived (ADR-012 rule 12 names availability only).
- **Tables** in `/api/pos/catalog/...` (ARCHITECTURE §13's row): the floor stays fixture until Phase 2 (Q14), so S7 adds no such read.
