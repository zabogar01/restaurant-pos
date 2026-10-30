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

## The rest of this report

*Still being written: the twelve decisions with their alternatives, the owner question, and* For the lead*. This section
is replaced in the next commit.*
