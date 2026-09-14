# Screen inventory

Status: **confirmed by the product lead.** All seven conflicts and the implied list
are ruled on below; the rulings are built in [prototype/](prototype/).
Companion: [SITEMAP.md](SITEMAP.md). Source of truth: [PRD.md](../PRD.md),
[BOUNDARIES.md](../BOUNDARIES.md).

Every screen in both clients. For each: purpose, who reaches it and from
where, the states it must express, the requirements it satisfies, and the
decisions already fixed by the PRD that a designer must not re-open.

**"Must not invent" is the load-bearing column.** Everything listed there is
already decided. A prototype that contradicts one of those lines is wrong even
if it looks better.

## Conventions

- **States** are listed for every screen: `empty`, `loading`, `error`,
  `permission-denied`, `overflow`, plus screen-specific states. Where a
  standard state genuinely cannot occur, it says so and why — that is a
  finding, not an omission.
- **Overflow** means: what happens when the content exceeds the viewport at
  the design target (1280×800 POS, 1440 back office).
- **Permission-denied** on the POS is rarely a blank wall. The POS has two
  authenticating roles and almost every POS action is cashier-permitted; the
  denial surface is the manager-approval modal failing, not a locked screen.
- `[RULED IN]` screens were not named by any requirement and have been ruled into
  the MVP by the product lead. `[MY CALL]` marks a choice the requirements leave
  open that the designer made. See §"Implied — rulings".

---

# POS client — 7 screens

Tablet landscape 1280×800. One-handed, at speed, mid-conversation. 90-second
idle expiry. The cashier will not read a confirmation dialog — every
destructive path is either ungated by design (FR-H2) or gated by a PIN that
cannot be dismissed by muscle memory (FR-A6).

---

## POS-01 — Lock / PIN entry

**Purpose.** Identify the staff member for the next stretch of work, on a
device that is shared and unattended between uses.

**Reached by / from.** Cold start; 90-second idle expiry from any POS screen;
explicit release; session invalidation from the back office (FR-B3). It is the
POS's default state, not an exception.

**States.**
- *empty* — the resting state. No actor, no order context leaked on screen.
- *loading* — PIN submitted, verification in flight. Keypad must not accept a
  second submission.
- *error* — wrong PIN, with attempts remaining before cooldown.
- *permission-denied* — a PIN belonging to a deactivated user (FR-B3).
- *overflow* — none; fixed-size keypad.
- *throttled* — LOGIN class cooldown, 5 minutes, installation-wide, survives
  restart (FR-A5). Must state that it is a cooldown, not a broken device.
- *session invalidated* — distinct from ordinary idle expiry. The back office
  deactivated the user or reset the PIN mid-shift (FR-B3, AC-32).
- *tender draft waiting* — a draft survived expiry in this tab and is waiting
  behind re-authentication (FR-G9, AC-20). Must be visible here, or the
  cashier believes the payment was lost.
- *emergency print incident present* — **ruling C-6**: presence is shown before
  authentication, detail requires a PIN. The indicator names the printer, never
  the order.

**Requirements.** FR-A2, FR-A5, FR-A7, FR-B3, FR-G9.

**Must not invent.**
- Six digits, numeric (FR-A1). Not a password, not a username field, not a
  staff picker followed by a PIN.
- No "remember me", no biometric, no stay-signed-in. 90 seconds is the policy
  (FR-A2, AC-28).
- No PIN value is ever echoed, logged, or partially revealed (FR-J4, B-12).
  Masked entry only; no "show PIN" toggle.
- Throttle is per class and installation-wide. A successful cashier login here
  does **not** clear a manager-approval cooldown (FR-A5, AC-19).
- Background polling does not extend the session (FR-A2b, AC-28) — an idle POS
  that is quietly polling the catalog still expires.

---

## POS-02 — Floor (tables and quick sale)

**Purpose.** Pick the thing to work on: an existing open table order, a new
table order, or a quick sale.

**Reached by / from.** Cashier or manager, immediately after PIN entry
(POS-01). Returned to after close, void, or abandoning an order.

**States.**
- *empty* — no tables configured yet (a real state before Phase 1 data
  exists); and separately, tables configured but none occupied.
- *loading* — floor state fetch.
- *error* — floor state unavailable.
- *permission-denied* — not reachable; both authenticating roles may open
  orders (FR-D1, D2).
- *overflow* — more tables than fit at 1280×800. Must scroll, never shrink
  targets below touch size.
- *table occupied* — table holds an OPEN order; it opens that order rather
  than starting a new one (FR-D1).
- *table deactivated* — a table deactivated in the back office is gone from
  the floor, but not if it holds an open order (FR-C8).
- *business day closed* — standing banner (**ruling I-4**); new orders belong to
  the next day, and orders on the closed day can no longer be voided or refunded.

**Requirements.** FR-D1, FR-D2, FR-C8, FR-I1.

**Must not invent.**
- A table holds **at most one** open order (FR-D1). No second tab per table,
  no per-guest checks, no bill splitting (out of scope).
- Quick sale is a **variant of the same order model**, not a separate mode or
  a fake table (PRODUCT purpose, FR-D2). It must not look like a different
  product.
- No table transfer, merge, or split (out of scope, Horizon 1).
- The table list is configuration owned by the back office (FR-B2). No
  create-table affordance here.

---

## POS-03 — Order workspace

**Purpose.** Build and correct an order, fire it in rounds, discount it, void
it. The screen the cashier spends the shift on.

**Reached by / from.** POS-02, by opening a table or starting a quick sale.
Also re-entered after settlement is abandoned.

Two variants of one screen — `table` and `quick_sale` — differing in
affordances only.

**States.**
- *empty* — order open, no lines. The most common first state.
- *loading* — catalog fetch, line commit in flight.
- *error* — command rejected by the server; order left exactly as it was
  (B-20).
- *permission-denied* — the gated actions are free-form discount (FR-F3),
  fired-line void (FR-H4), and fired-order void (FR-H4). Denial is the
  approval modal being cancelled or failing, never a hidden control.
- *overflow* — long order (up to 99 per line, many lines) and long menu
  category. The order list and the menu browser scroll independently; the
  totals panel never scrolls out of view.
- *line states* — PENDING, FIRED, VOIDED must be distinguishable at a glance
  in greyscale (FR-D5, E1, H4). **Ruling I-12:** the distinction is carried by
  the line's trailing slot, not only by its typography. A PENDING line has a
  remove control there; a FIRED line reserves the same slot and leaves it
  empty; a VOIDED line is struck through and inert.
- *round grouping* — lines grouped by fire round; a second fire sends only new
  lines (FR-E2, B-16). The cashier must be able to answer "did this go to the
  kitchen?" without asking anyone.
- *86'd item* — item unavailable within 3 seconds of a back-office toggle
  (FR-C6, AC-12). **Ruling C-3: disabled in place, never removed** — the tile keeps
  its position, greys, and carries an 86 marker.
- *fire blocked* — a PENDING line holds an 86'd item. Fire is refused and the
  offending lines are named; resolution is voiding the line or restoring the
  item (FR-E4, B-17).
- *CATALOG_CHANGED* — a command was built on stale catalog data, rejected,
  client refreshes; no line was added at the stale price (FR-C7, AC-31).
- *discount applied* — at most one, showing its snapshotted name (FR-F1, F4).
- *settlement lock, your own draft* — a tender draft is active in this tab
  (FR-G12, AC-21). **Ruling C-5:** reads as "finish this payment first" — the
  cashier's own doing, recoverable by them.
- *settlement lock, another client's lease* — the same five actions disabled by a
  server-held lease (FR-G13). **Ruling C-5:** reads as "another client is settling
  this order" — not recoverable by this cashier. **Never the same string.**
- *menu browser under either lock* — **absent.** Add-line is one of the five
  blocked actions (AC-21, AC-29) and the menu grid is the surface that performs
  it. Unlike the order lines it holds nothing the cashier is entitled to read
  while locked, so it is removed rather than left inert — an intact menu grid
  under a lock is an invitation to tap it. The lock notice takes the space and
  carries the route out.
- *order lines under either lock* — **void is one of the five blocked actions,
  and FR-H1 defines void as applying to an OPEN order _or to lines on one_.**
  AC-3 calls removing an unfired line "voiding an unfired line", so the
  per-line remove control is a void and is blocked with the rest. Under either
  lock **every trailing slot is empty and no row is interactive**. This is
  ruling I-12 holding, not a fourth line signature: the slot means "removable
  now", and under a lock nothing is removable now. **Inert, not absent** — see
  I-12. The rows stay, because FR-G13 blocks no reads and the lines are what
  the cashier is still entitled to read.
- *pending line held under a lock* — a draft or lease may exist against a table
  order that still holds a PENDING line; FR-G10 refuses the **close**, not the
  draft. This is the case FR-G10 exists to catch, and it is drawn on both
  sides: the locked order workspace and POS-04's *table order with PENDING
  lines* refusal.
- *fire result* — PRINTED, FAILED, or UNKNOWN. FAILED/UNKNOWN escalates to the
  global emergency banner (FR-E3).
- *zero-total* — a 100% discount leaves a zero total that is still closable
  (FR-G11).

**Requirements.** FR-D3, D4, D5, D6, FR-C1–C7, FR-E1–E5, FR-F1–F8, FR-H2, H3,
H4, FR-G10, G12, FR-M4.

**Must not invent.**
- **Fire sends only lines not previously fired** (FR-E2, B-16). No "reprint
  the whole order to kitchen" control. Ever.
- A quick-sale order fires **at close**, not from this screen (FR-E5).
  **Ruling C-2: there is no fire control at all on a quick sale.** Settling fires
  it, and the settle button says so. One control that means "send to kitchen" on a
  table order and nothing on a quick sale teaches the cashier the button is
  unreliable, and that lesson transfers to the table order where it matters.
- Removing a PENDING line requires **no approval and is not audited**
  (FR-H2, AC-3). No confirmation dialog. This is deliberate: the cashier will
  not read one, and there is nothing to protect. **Ruling I-12: it is a
  control on the line itself**, not only a button inside the line-editor
  sheet.
- Voiding a FIRED line requires a manager PIN **and a reason**, and emits
  exactly one cancellation ticket containing only the cancelled work
  (FR-H4, AC-22, B-16). **Ruling I-12: it is never reached from the line's
  trailing slot.** The row body opens the void sheet; the trailing slot stays
  empty on a fired line. A gated action never occupies the position an
  ungated one has already taught. **Under a settlement lock neither control
  exists**, because void — line-level included, per FR-H1 and AC-3 — is one of
  the five actions FR-G12 and FR-G13 block.
- The line-editor sheet is retained for **quantity** (FR-D5, FR-M5), which has
  nowhere else to live. It keeps a Remove control as the exit from that sheet;
  the per-line control is the fast path, not a replacement.
- **The line editor has a table form and a quick form**, as POS-03 itself has
  two variants. They differ only in the return target: the quick form returns
  to the quick workspace. A shared sheet returned to the table workspace, which
  carries a Send to kitchen control — a control a quick sale must never show at
  all (**C-2**, FR-E5). A variant that differs only in affordances is exactly
  what the two POS-03 variants already are.
- Void here applies to an OPEN order or its lines. **Refund never appears on
  this screen** (FR-H1, B-19).
- One discount per order (FR-F1, B-22). A preset applies with no prompt
  (FR-F2); free-form requires a manager PIN (FR-F3). Discounts are
  order-level only — no item-level discount control (out of scope).
- The approval gate covers the **whole transition** (FR-F8): removing or
  replacing a free-form discount is gated even when the replacement is a
  preset.
- No discount applies itself (FR-F7, B-21). No auto-apply, no suggestion, no
  "best discount" affordance.
- Totals follow the fixed order of operations (§4 money rules). Tax is
  **derived and display-only**, never added (B-4, FR-M4). The totals panel
  shows subtotal, discount, service charge, total, and an "includes tax" line
  — in that relationship.
- Prices are snapshots. Editing the menu later never changes this order
  (FR-D4, B-8).
- Quantity is a whole number, max 99 (FR-M5).
- Modifiers are flat — no nested groups (FR-C4).

---

## POS-04 — Settlement

**Purpose.** Collect money and close the order exactly.

**Reached by / from.** POS-03, by the cashier or manager. Its own route:
entering acquires a server-side CheckoutLease (FR-G13); the draft it holds is
client-side and tab-local until close (FR-G9).

**States.**
- *empty* — no tenders drafted; full balance outstanding. **Ruling I-13:** the
  tender amount field is **prefilled with the remaining balance** for every
  method, and is editable in place.
- *tender prefilled* — a method is chosen and the amount is already correct.
  The ordinary payment is method, Add, Close, with nothing keyed.
- *loading* — close command in flight. Idempotent; must not be double-fired.
- *error* — close rejected (stale version, lease lost, precondition failed).
  No partial state; the draft survives for correction (B-20).
- *permission-denied* — a manager takeover displaced this client, and its
  close is rejected (FR-G14, AC-30).
- *overflow* — many split tenders. The draft list scrolls; balance and total
  stay pinned.
- *partially tendered* — balance remaining shown; close disabled (FR-G5,
  B-18).
- *non-cash over balance* — rejected, with the maximum acceptable amount
  offered (FR-G3, AC-6, B-5). **A rejected amount cannot be added at all**: the
  Add control is disabled, not merely warned against, and the drafted lines are
  left exactly as they were (B-20).
- *cash over balance* — accepted; change computed as cash minus remaining
  balance (FR-G4, AC-5).
- *change ceiling exceeded* — validated **before** commit, with the maximum
  acceptable cash shown (FR-M5). **That maximum is the remaining balance plus
  the 9,999,999 change limit, capped by the 99,999,999 single-tender limit** —
  not the bare change limit, which is not an amount of cash the sale can take.
  Add is disabled here too, and the draft is unchanged.
- *the tender walk* — every Add lands on the state that adding **that** amount
  produces, so the three settlement paths are walkable end to end rather than
  merely described: exact cash in full; card in full (the I-13 headline); and
  **AC-7** — 10.00 card keyed against a 15.59 balance, added, leaving 5.59
  which the cash pad then arrives prefilled with, closing the order. **AC-5**
  walks the same way through a 20.00 cash tender and 4.41 change.
- *exact settlement* — close enabled (FR-G5).
- *zero-total* — closes with no Tender records, still produces a receipt
  (FR-G11, AC-24).
- *table order with PENDING lines* — close rejected (FR-G10).
- *actor expired, draft alive* — the 90-second actor context expired; the
  draft survives in this tab and re-authentication is required before close
  (FR-G9, AC-20).
- *lease held / renewing / expiring* — the lease renews in 5-minute
  increments, expires within 5 minutes of the client ceasing to renew, and
  cannot exceed 15 minutes without renewed actor authentication (FR-G14).
- *receipt print failed* — the order is closed regardless (FR-G8, B-15).

**Requirements.** FR-G1–G14, FR-M5, FR-E5, FR-A2.

**Must not invent.**
- **No Tender record exists before close** (FR-G9). The draft is client-side.
  A design that shows tenders "saved so far" as server records is wrong.
- **This screen may say nothing was _recorded_; it may never say nothing was
  _taken_.** FR-G1 has no gateway and no terminal integration, and FR-G14
  explicitly contemplates a card charge already in progress elsewhere. The POS
  cannot know whether money moved, only whether it wrote anything down.
- **Exact settlement only** (FR-G5, B-18). No tolerance, no "close anyway",
  no rounding allowance at the boundary.
- Revenue is the order total, never the amount tendered (FR-G6, B-6). Change
  is not revenue and must not be presented as part of takings.
- Cash may exceed balance; card and custom tenders may not (FR-G3, G4, B-5).
  The two pads are therefore not the same component with a different label.
  **Ruling I-13:** for card and custom the prefilled balance is simultaneously
  the default *and* the ceiling, so B-5 holds by construction. For cash the
  same prefill is a default only. The caption under the field states which,
  because a rule that is only true is not yet legible.
- **Ruling I-13: there is no split mode, tab, or toggle.** Keying an amount
  below the balance *is* the split (FR-G2); the remainder stays on the balance
  and the pad is ready for the next method. A mode the cashier must remember
  to enter is a mode they forget mid-transaction, and B-18 is checked against
  the balance, never against a mode.
- Prefilling does **not** remove the over-balance rejection (FR-G3, AC-6). A
  cashier can still key past the maximum, and the refusal naming the maximum
  is a requirement, not a fallback.
- **No tips. Definitively excluded** (PRD §8). No tip line, no rounding-up
  prompt, no suggested amounts.
- No gateway, no terminal integration — every tender is recorded manually
  (FR-G1).
- Splitting is by tender, not by guest (FR-G2; bill splitting out of scope).
- **Ruling I-5:** an explicit "Cancel payment" releases the lease and returns to the
  order, ungated — releasing a lease you hold moves no money (FR-G13).
- **Ruling I-9:** custom payment-method names come from back-office settings, never
  free text typed here (FR-G1, B-24).
- A quick sale fires **and** prints its receipt at close (FR-E5).
- Manager takeover requires acknowledging that an external charge may already
  be in progress, is audited, and rejects the displaced client's close
  (FR-G14, FR-J3).

---

## POS-05 — Closed orders `[RULED IN — I-1]`

**Purpose.** Find a closed order in order to reprint its receipt or refund it.

**Reached by / from.** Cashier or manager, from POS-02. Not named by any
requirement; required by FR-G7 ("reprintable on demand") and FR-H5 (refund
targets a CLOSED order), neither of which states how the order is found.

**States.** *empty* (no closed orders this business day) · *loading* · *error*
· *permission-denied* (not applicable; both roles may reach it — the refund
gate is at the action, not the screen) · *overflow* (a full trading day of
orders; scoped to the open business day) · *refunded* orders marked distinctly
(FR-H6).

**Requirements.** FR-G7, FR-H5, FR-H6, FR-H7.

**Must not invent.** Search is by **table, time and amount** (ruling I-1).
**Not by receipt number** — the numbering format is PRD Open Question 2, and a
search built on an unsettled key would have to be redone.

---

## POS-06 — Closed order detail `[RULED IN — I-1]`

**Purpose.** Read what was charged, reprint the receipt, and — separately —
refund the order.

**Reached by / from.** POS-05.

**States.**
- *loading* / *error* — order fetch, reprint, refund command.
- *empty* — not applicable; a closed order always has content.
- *permission-denied* — refund requires a manager PIN at the moment of the
  action (FR-H5, A6). Cancelled approval leaves the order untouched (B-20).
- *overflow* — long orders; receipt figures pinned.
- *reprint result* — PRINTED / FAILED / UNKNOWN, at receipt urgency only
  (FR-G7, G8, E6).
- *refund available* — CLOSED, business day open.
- *already refunded* — REFUNDED is terminal; a second refund is rejected
  (FR-H6, AC-14, B-10).
- *business day closed* — void and refund blocked (FR-H7, B-9).

**Requirements.** FR-G7, G8, FR-H1, H5, H6, H7, FR-A6, FR-J2, J3.

**Must not invent.**
- **Refunds are full-order only** (FR-H5, B-23). No line selection, no partial
  amount field.
- **Ruling C-1: a zero-total order is not refundable, and the Refund action is
  absent, not disabled.** It took no money, so there is nothing to return; a
  disabled control invites a manager to hunt for an override that does not exist
  (FR-G11, H5).
- Default allocation reproduces each original tender's **effective
  contribution** — amount tendered minus change given. A 20.00 cash sale with
  4.41 change defaults to a 15.59 cash refund allocation, not 20.00 (FR-H5,
  AC-25).
- Allocations must sum **exactly** to the order total (FR-H5).
- Refund requires a manager PIN **and a reason** and produces one combined
  audit entry naming actor and approver (FR-H5, J2, J3, AC-11).
- A reprint shows **identical figures** to the original (FR-G7, AC-13). No
  recomputation from current settings.
- Refund and void are **never the same control** (FR-H1, B-19). This screen
  has no void action; POS-03 has no refund action.

---

## POS-07 — Print incidents (POS)

**Purpose.** Show unresolved print failures and offer reprint, without ever
blocking the floor.

**Reached by / from.** The global emergency banner or the receipt warning
chip, from any POS screen. Application-wide, not per-actor-session (FR-E3).

**States.**
- *empty* — no incidents. Must be reachable and legible when empty, so the
  cashier can confirm nothing is outstanding.
- *loading* / *error* — incident list; reprint dispatch.
- *permission-denied* — not specified; reprint is not listed as a gated action
  (FR-J3 does not audit it).
- *overflow* — many incidents; emergency class always sorts and renders above
  receipt class.
- *emergency: kitchen work ticket* — FAILED or UNKNOWN (FR-E3).
- *emergency: cancellation ticket* — FAILED or UNKNOWN (FR-H4). Distinct from
  a work ticket (B-16) and never presented as a reissue of the original work.
- *warning: receipt* — FAILED or UNKNOWN, lower urgency (FR-E6).
- *UNKNOWN specifically* — the operator must check the printer before
  reprinting; UNKNOWN is not the same as FAILED (PRD §6).
- *reprint result*.

**Requirements.** FR-E3, FR-E6, FR-H4, FR-G8, FR-B15/B-15, AC-23, AC-33.

**Must not invent.**
- Kitchen and receipt failures are **two urgency classes** and must never be
  presented identically (FR-E6, AC-23). In greyscale that difference is
  carried by persistence, placement, size, and whether clearing requires an
  explicit action.
- Kitchen incidents are **persistent** until acted on, and appear in **both**
  clients (FR-E3, AC-33). Not a toast. Not auto-dismissing.
- Printing never gates anything (B-15, FR-E3). No incident may block order
  entry, fire, close, or navigation.
- A cancellation ticket is a correction, never a fire (B-16). Reprinting one
  must not be describable as "send to kitchen again".

---

# Back-office client — 13 screens (12 specified, 1 ruled in; BO-14 deferred)

Desktop 1440. Seated manager, dense tables, 30-minute idle / 8-hour absolute.
Reporting and audit are read surfaces; everything else operates.

---

## BO-01 — Login

**Purpose.** Establish a conventional desk session for a manager.

**Reached by / from.** Cold start; absolute 8-hour expiry; explicit logout.
Idle expiry uses the re-authentication modal instead, so unsaved form state is
preserved (FR-A2b).

**States.** *empty* (resting) · *loading* · *error* (wrong credentials) ·
*permission-denied* (a cashier PIN — the back office is manager only) ·
*overflow* (none) · *throttled* (LOGIN class, 5 minutes, shared
installation-wide with the POS, FR-A5).

**Requirements.** FR-A2b, FR-A2c, FR-A5, FR-A7, FR-B preamble.

**Must not invent.**
- Manager only (FR-B preamble, PRODUCT). No cashier back-office view.
- A back-office session is never accepted on a POS route and never satisfies a
  POS approval (FR-A2c, AC-27).
- 30-minute idle, 8-hour absolute, explicit logout (FR-A2b, AC-28).
- Idle expiry **preserves unsaved form state behind re-authentication**
  (FR-A2b) — that is a modal over the work, not a bounce to this screen.

---

## BO-02 — Today `[MY CALL — I-2]`

**Purpose.** A landing destination after login: the open business day, any
outstanding print incidents, and the route to end-of-day.

**Reached by / from.** BO-01. Not named by any requirement.

**States.** *empty* · *loading* · *error* · *permission-denied* (n/a) ·
*overflow* · *business day open* / *open orders outstanding* (FR-I1, I2) ·
*emergency incident present* (FR-E3).

**Requirements.** FR-I1, FR-I2, FR-E3, FR-E6.

**Must not invent.** The back office observes orders; it never operates them
(FR-G12). No settle, void, fire or refund control appears here.

---

## BO-03 — Menu: items and categories

**Purpose.** See and manage the whole menu; toggle 86 status fast.

**Reached by / from.** Manager, from navigation.

**States.** *empty* (no items yet — the state a new installation starts in,
because no menu is hard-coded, B-24) · *loading* · *error* · *permission-denied*
(n/a; back office is manager only) · *overflow* (long menu: dense table,
sticky headers, no truncation of price or availability) · *item 86'd* ·
*86 rejected while a CheckoutLease holds a quick-sale order carrying that item,
naming the order* (FR-G13, AC-29) · *item archived* (FR-C8).

**Requirements.** FR-B4, FR-B6, FR-C1, FR-C5, FR-C7, FR-C8, FR-G13.

**Must not invent.**
- The 86 toggle is here, in the back office, and its effect must reach the POS
  within three seconds (FR-B6, C6, AC-12). There is no POS-side 86 control.
- Menu changes advance a catalog version, which can reject in-flight POS
  commands (FR-C7). The manager must be able to understand that their edit has
  a floor-side consequence.
- Archiving or materially changing an item never alters existing order
  snapshots (FR-C8, B-8).
- No menu, price, or category is hard-coded, including in demo seed data
  (B-24). The empty state is real and must be designed.

---

## BO-04 — Item editor

**Purpose.** Define one item: category, tax-inclusive base price, variants,
modifiers.

**Reached by / from.** BO-03.

**States.** *empty* (new item) · *loading* · *error* (validation) ·
*permission-denied* (n/a) · *overflow* (many variants and modifiers on one
item) · *unsaved changes* (must survive idle re-authentication, FR-A2b) ·
*price immutable-currency context* (currency and precision are locked after
the first order, FR-B1, M1).

**Requirements.** FR-B4, FR-C1, FR-C2, FR-C3, FR-C4, FR-C8.

**Must not invent.**
- Prices are **tax-inclusive** (§4). The editor asks for the price the
  customer pays. There is no ex-tax field.
- Variants are **single-select** with a positive or negative delta; modifiers
  are **multi-select** with a delta of zero or more (FR-C2, C3). Two different
  structures — not one "options" concept.
- Resolved unit price floors at zero; a negative variant delta snapshots zero,
  never a negative (FR-C2, AC-26).
- **No nested modifier groups** (FR-C4, PRD §8). No modifier-of-a-modifier
  affordance.
- No link between modifiers and stock (FR-C4). No inventory field.

---

## BO-05 — Tables

**Purpose.** Define the floor: create, edit, deactivate tables.

**Reached by / from.** Manager, from navigation.

**States.** *empty* (no tables — a real starting state, B-24) · *loading* ·
*error* · *permission-denied* (n/a) · *overflow* · *deactivation rejected —
table holds an OPEN order* (FR-C8, AC-32) · *deactivated table retained for
history*.

**Requirements.** FR-B2, FR-C8.

**Must not invent.** A table holding an OPEN order cannot be deactivated
(FR-C8) — the rejection must name the order, because the manager's next step
is to go and settle it at the POS. No table merge, transfer, or split (out of
scope).

---

## BO-06 — Users

**Purpose.** Manage staff: create, assign role, set and reset PIN, deactivate.

**Reached by / from.** Manager, from navigation.

**States.** *empty* · *loading* · *error* · *permission-denied* (n/a) ·
*overflow* · *PIN not unique — rejected* (FR-A4) · *deactivation invalidates
that user's POS session on its next authenticated request* (FR-B3, AC-32) ·
*kitchen staff listed without a PIN* (FR-A1).

**Requirements.** FR-A1, FR-A3, FR-A4, FR-B3, FR-J4.

**Must not invent.**
- Two authenticating roles only: cashier and manager. **Kitchen is a
  non-authenticating classification** with no PIN and no permissions (FR-A1).
  Waiter is deferred — no waiter option.
- PINs are six digits and unique across users, because an audit actor must be
  unambiguous (FR-A1, A4, B-13).
- A PIN is **never displayed, echoed, or recoverable** — set and reset only,
  never "view" (FR-A3, J4, B-11, B-12). No masked-reveal control.
- Deactivating a user or resetting a PIN has an immediate floor consequence
  (FR-B3). The manager must be told that, at the moment of the action.

---

## BO-07 — Discount presets

**Purpose.** Define the named discounts staff may apply without approval.

**Reached by / from.** Manager, from navigation.

**States.** *empty* · *loading* · *error* · *permission-denied* (n/a) ·
*overflow* · *deactivated preset — hidden from the POS picker but still
readable on orders carrying it* (FR-F5, AC-17).

**Requirements.** FR-B5, FR-F2, FR-F4, FR-F5.

**Must not invent.**
- A preset is the **constrained common path**: any authenticating staff member
  applies it with no prompt (FR-F2, principle 3). Presets are not approval-gated
  here or at the POS.
- Discounts are 0–100%; a fixed discount is capped at the subtotal; no order
  reaches a negative total (FR-M5).
- **No scheduling, no auto-apply, no date or time triggers** (FR-F7, B-21).
  This is the promotions boundary; a "valid from / valid to" field crosses it.
- One discount per order (B-22) — no stacking rules, no precedence editor.
- Applying snapshots name, kind, and value onto the order (FR-F4, B-8); later
  edits here never change past orders.

---

## BO-08 — Settings

**Purpose.** Currency, minor-unit precision, tax rate, service-charge rate,
and the business details printed on receipts.

**Reached by / from.** Manager, from navigation.

**States.** *empty* (first-run configuration) · *loading* · *error*
(validation) · *permission-denied* (n/a) · *overflow* (n/a) · *currency and
precision locked — an order already exists* (FR-B1, M1) · *rate change creates
a new settings version affecting only orders opened afterwards* (FR-B1).

**Requirements.** FR-B1, FR-M1, FR-M5.

**Must not invent.**
- Currency and minor-unit precision become **immutable after the first order**
  (FR-B1, M1). The locked state is not an edge case; it is the state this
  screen spends its life in.
- A rate change is versioned and **never retroactive** (FR-B1, B-8, B-9). No
  "apply to open orders" option.
- One tax rate. Tax-inclusive. Service charge untaxed (§4, B-3, B-4). No tax
  groups, no per-item rates, no jurisdiction packs (out of scope).
- Rate precision is one part per million; the permitted **range** is Open
  Question 4 and is not yours to settle.

---

## BO-09 — End of day

**Purpose.** Close the business day and produce the immutable report.

**Reached by / from.** Manager, from navigation (and BO-02 if it exists).

**States.**
- *empty* — not applicable; a business day is always open (FR-I1).
- *loading* — the close command runs its own authoritative transaction
  (FR-I2).
- *error* — command failure.
- *permission-denied* — n/a; manager-only client.
- *overflow* — the refusal list of still-open orders can be long.
- *refused — orders still OPEN*, listed (FR-I2, AC-15). The manager's next
  action is at the POS, not here.
- *ready to close*.
- *closed — report stored, next day opened* (FR-I3).
- *already closed — second close rejected, report still reprintable* (FR-I4).

**Requirements.** FR-I1, FR-I2, FR-I3, FR-I4, FR-H7.

**Must not invent.**
- Close is **refused while any order is OPEN**, and lists them (FR-I2). No
  force-close, no "close anyway", no auto-void of stragglers.
- A closed day is **immutable** (B-9, FR-I4). Its report never changes; voids
  and refunds against it are blocked (FR-H7).
- The resolution path crosses clients: settle or void at the POS, then retry
  (FR-I2). See implied item I-6 — whether that list links anywhere is
  unspecified.
- Post-close corrections are Open Question 3. Do not design an adjustment
  flow.

---

## BO-10 — Reports: business day list

**Purpose.** Find a stored day report.

**Reached by / from.** Manager, from navigation. Read surface.

**States.** *empty* (no day has closed yet) · *loading* · *error* ·
*permission-denied* (n/a) · *overflow* (grows one row per trading day).

**Requirements.** FR-I3, FR-I4, FR-I5.

**Must not invent.** Reports are stored snapshots, not live queries (FR-I3,
B-9). No date-range picker that recomputes across days; no ad-hoc reporting.

---

## BO-11 — Report detail

**Purpose.** Read one immutable end-of-day snapshot; reprint it.

**Reached by / from.** BO-10. Read surface.

**States.** *empty* (a day with no orders still produces a report) · *loading*
· *error* · *permission-denied* (n/a) · *overflow* (the figure set below is
long; dense table, no truncation of money) · *reprint result*.

**Requirements.** FR-I4, FR-I5.

**Must not invent.** The figure set is fixed by FR-I5 and must appear in full:
- Gross sales — every order that reached CLOSED, **including orders later
  refunded**.
- Refunds as a **separate** total; net = gross − refunds.
- Gross, refund-reversal, and net figures for included tax, service charge,
  and discounts.
- Gross effective tender, refund allocation, and net movement **by tender
  type**.
- Order count for every order that reached CLOSED, with refunded-order count
  shown **separately**.
- Whole-order void count and value, valued at the order total immediately
  before the void.
- Fired-line void count, tax-inclusive line snapshot value, **and** the
  before/after reduction in order total — these differ whenever a percentage
  discount or service charge applies, and both must be shown.

A refunded order's original discount stays in gross discounts and appears
again as a refund reversal (FR-I5). Gross / reversal / net is the structural
spine of this screen; a designer must not collapse it into single figures.
No item-level, hourly, or labor breakdown (out of scope).

---

## BO-12 — Audit viewer

**Purpose.** Answer "why is the till short?" the next morning.

**Reached by / from.** Manager, from navigation. Read surface, strictly.

**States.** *empty* (no entries yet, or none match the filter — two different
empties) · *loading* · *error* · *permission-denied* (n/a) · *overflow* (the
log only grows; needs paging and filtering) · *approved action* (one combined
entry naming actor **and** approver) · *failed or cancelled approval* (one
entry naming the actor, approver null) · *entry detail with before/after
amounts and business reason*.

**Requirements.** FR-J1, FR-J2, FR-J3, FR-J4.

**Must not invent.**
- **Append-only. No edit, no delete, no soft-delete, no hide** (FR-J1, B-7).
  A designer must not draw a row action menu here.
- Audited actions are exactly: whole-order void, fired-line void, discount
  apply/replace/remove, refund, manager takeover of a CheckoutLease, and every
  manager-approval outcome (FR-J3). Removing a PENDING line is **not** audited
  (FR-H2) and must not appear.
- A successful approved action is **one combined entry**, not two (FR-J3,
  AC-18).
- Every entry names a specific human actor — no "system" actor, no
  terminal-attributed action (B-13).
- **No PIN value appears here in any form, including partially masked**
  (FR-J4, B-12).
- Unauthenticated PIN failures and throttle cooldowns are **security
  telemetry, not audit entries** (FR-J3) — they do not belong on this screen.

---

## BO-13 — Print incidents (back office)

**Purpose.** Make sure a manager sitting at a desk cannot miss a failed
kitchen ticket.

**Reached by / from.** The global emergency banner or warning chip, from any
back-office screen.

**States.** Same set as POS-07: *empty* · *loading* · *error* ·
*permission-denied* (n/a) · *overflow* · *emergency: kitchen work* ·
*emergency: cancellation ticket* · *warning: receipt* · *UNKNOWN vs FAILED
distinction* · *reprint result*.

**Requirements.** FR-E3, FR-E6, FR-H4, FR-G8, AC-23, AC-33.

**Must not invent.**
- The incident is **application-wide, not session-specific** (FR-E3). Both
  clients show the same incident; resolving it in one resolves it in both.
- The same two urgency classes, with the same never-identical rule (FR-E6,
  AC-23).
- This is a **data-table** rendering of the same domain object the POS renders
  as touch cards. Independent components, one meaning (NFR-5).
- Whether a back-office reprint of a kitchen ticket is gated or audited is
  unspecified — see implied item I-8. Do not decide it.

---

---

# Load-bearing modals and sheets

Not screens. Listed because each carries a requirement that a design tool will
otherwise flatten into a page.

## M-1 — Manager approval prompt `[MODAL]` — POS only

**Purpose.** Authorise **one** specific action, at the moment it is attempted.

**Reached by / from.** Free-form discount (FR-F3), discount removal or
replacement under the whole-transition gate (FR-F8), fired-line void (FR-H4),
fired-order void (FR-H4), refund (FR-H5), lease takeover (FR-G14). It appears
over POS-03, POS-04, and POS-06 — over whatever screen triggered it.

**States.** *empty* (awaiting PIN) · *loading* · *error* (wrong PIN, attempts
remaining) · *permission-denied* (a cashier PIN entered where a manager PIN is
required) · *overflow* (n/a) · *throttled* (MANAGER_APPROVAL class, 5 minutes,
installation-wide, survives restart, FR-A5, AC-19) · *cancelled — the
triggering action does not happen and no partial state is written* (B-20) ·
*no manager available — blocked, nothing written* (PRD §6).

**Requirements.** FR-A6, FR-A2c, FR-A5, FR-F3, FR-F8, FR-H4, FR-H5, FR-G14,
FR-J3, B-14, B-20.

**Must not invent.**
- It is a **modal over the triggering screen**, never a route, never a mode,
  never a session (FR-A6, B-14). There is no "manager is here now" state.
- A manager already holding a back-office session **still enters a PIN here**
  (FR-A2c, AC-27).
- The approval authorises one action and does not persist to the next one
  (B-14) — no "approve all", no remaining-time indicator, no re-use.
- Where the PRD requires a reason (fired-line void FR-H4, refund FR-H5), the
  reason is captured with the approval and is required, not optional.
- Cancelling writes an audit entry naming the actor with approver null
  (FR-J3, AC-18) — the cancel path is evidence, not a no-op.
- Failed manager approvals are **audit** entries; unauthenticated login
  failures are **telemetry** (FR-A5, J3). Different stores.

## M-2 — Item configuration sheet `[SHEET]` — POS-03

**States.** *empty* (no selections) · *loading* · *error* · *overflow* (many
modifiers) · **item 86'd while the sheet is open**: the user's choices are
preserved, the item is marked unavailable, Add is disabled, and the change is
explained (FR-C6, AC-12 — this exact behaviour is specified, not a
suggestion) · *resolved unit price floors at zero* (FR-C2, AC-26).

**Requirements.** FR-C2, FR-C3, FR-C4, FR-C5, FR-C6, FR-D4.

## M-3 — Discount sheets `[SHEET]` — POS-03

Three distinct nodes, not one: preset picker (ungated, FR-F2), free-form entry
(gated, FR-F3), and remove/replace (gated by the whole transition, FR-F8).
Deactivated presets are absent from the picker but readable on orders holding
them (FR-F5). Each successful change writes one audit entry with before and
after values (FR-F8).

## M-4 — Tender pads `[SHEET]` — POS-04

Cash and non-cash are **different components with different rules** (FR-G3,
G4, B-5): cash may exceed the balance and produces change with a validated
ceiling (FR-M5); card and custom may not exceed the remaining balance and are
rejected with the maximum offered (AC-6). A custom tender is a named method
recorded manually (FR-G1) — see implied item I-9 on where that name comes
from.

## M-5 — Refund allocation sheet `[SHEET]` — POS-06

Defaults to each original tender's effective contribution (FR-H5, AC-25),
must sum exactly to the order total, is full-order only (B-23), and requires
manager PIN plus reason (FR-H5).

## M-6 — Back-office re-authentication `[MODAL]`

Idle timeout at 30 minutes preserves unsaved form state behind
re-authentication (FR-A2b). It is an overlay over the work in progress, never
a bounce to BO-01.

---

# Implied — rulings

The product lead has ruled on each. Nothing below is open.

| # | Item | Ruling |
|---|---|---|
| I-1 | POS closed-order lookup and detail | **Kept** as POS-05 / POS-06. Search by **table, time and amount**. Not by receipt number — the numbering format is an open product question and a search built on an unsettled key would have to be redone. |
| I-2 | Back-office landing (BO-02 Today) | Designer's call. **Kept.** FR-I2 makes "which orders are still open?" the manager's most frequent question and FR-E3 requires a kitchen incident to be unmissable here. |
| I-3 | Security telemetry viewer (BO-14) | **Out of scope for the MVP. Dropped.** The store is written to by design this release; nothing reads it. Left in this inventory as deferred so the omission is visible rather than looking like an oversight. |
| I-4 | POS awareness that the business day is closed | Designer's call. A standing banner on POS-02 **and** a refusal at the moment of the attempt on POS-06 — so a cashier learns it before promising a customer a refund, not after. |
| I-5 | Deliberate lease release | **Yes.** An explicit "Cancel payment" on POS-04 releases the lease and returns to the order. Releasing a lease you already hold moves no money and needs no approval. A cashier must never wait five minutes because a customer changed their mind. |
| I-6 | Whether BO-09's open-order list links into the POS | Designer's call. **It does not link.** Two separately bootstrapped clients with separate sessions cannot hand an actor context to each other (NFR-5, FR-A2c), so a link would be a lie. A "Check again" control re-reads authoritative server state instead. |
| I-7 | Fire-round history on POS-03 | Designer's call. **Lines are grouped by fire round**, with the round's time and print status in the group header, so the cashier can answer "did this go to the kitchen?" without asking anyone. |
| I-8 | Back-office reprint of a kitchen ticket | **Still open.** FR-E3 grants the action; FR-J3 does not audit it. Drawn ungated and unaudited, matching the requirements as written, and flagged on BO-13. Not settled by the designer. |
| I-9 | Where a custom payment-method name comes from | **Back-office configuration**, a new area under BO-08 Settings. B-24 forbids inventing configuration as free text on the fastest, most error-prone screen in the product. |
| I-10 | Voiding several orders in sequence at end of day | Designer's call. **No bulk void.** Each void is a deliberate, separately reasoned act (FR-H3/H4); a batch control would make the rare path routine, against principle 3. |
| I-11 | Confirmation dialogs | Designer's call, now a standing rule: **confirmations on the back office, PIN gates on the POS, nothing in between.** The back-office reader is seated and the action irreversible (B-9); the POS reader will not read a dialog, so protection there is a PIN or nothing (FR-H2). |
| I-12 | Where a per-line removal control lives on POS-03 | Raised by the product owner in DESIGN-002. **Applied, with the gated twin deliberately kept out of the same slot.** A PENDING line carries a remove control in its trailing slot: one tap, no prompt, nothing written (FR-H2, AC-3). A FIRED line **reserves the same slot and leaves it empty** — absent, not disabled, the same reasoning as C-1 — and its void is reached by tapping the row body, which opens the reason-and-PIN sheet (FR-H4). A single control that is silent on one row and PIN-gated on the row above it teaches a reflex that is correct most of the time, and B-16 means paper cannot be un-printed. The empty slot also keeps the money column aligned across row types. The group header, not each row, carries the marker, because the panel's first job is being read. The line-editor sheet is kept for quantity (FR-D5, M5), which has no other home. **Under a settlement lock neither control exists** — void is one of the five actions FR-G12 and FR-G13 block, and FR-H1 scopes void to an open order *or to lines on one*, so line removal is a void too. Every slot is empty there, which is this ruling holding rather than a fourth signature. Chosen **inert, not absent**: C-1 removes a control that is permanently impossible, whereas a lock is temporary and each variant has a real route out, so naming it points at something that exists — and FR-G13 blocks no reads, so the rows themselves must stay legible. |
| I-13 | Whether a card tender should require keying an amount | Raised by the product owner in DESIGN-002. **Applied as a prefill, not as a mode.** Every tender arrives with the remaining balance already in the field, editable in place. For card and custom that value is also the maximum, so B-5 holds by construction and the most error-prone screen in the product loses a keying step. An explicit split mode or tab was **declined**: keying less than the balance already *is* the split, a new structural node would have to be added to three documents including a settled external brief, and a mode the cashier must remember to enter is a mode they forget with a customer waiting. B-18 is enforced by the balance, not by a mode. The over-balance rejection (AC-6) stays drawn, because a cashier can still key past the maximum. |

---

# Conflicts — rulings

| # | Conflict | Ruling |
|---|---|---|
| C-1 | Refunding a zero-total order: FR-G11 stores no tenders, FR-H5 demands "one or more allocations" | **Not refundable.** A 100%-discounted comp took no money, so there is nothing to return. FR-H5 keeps its wording; zero-total orders are excluded from the refund path entirely. On POS-06 the Refund action is **absent, not disabled** — a disabled control invites a manager to hunt for an override that does not exist. |
| C-2 | Fire on a quick-sale order | **No fire control at all on a quick sale.** Settling fires it, and the settle button says so. One visible control that means "send to kitchen" on a table order and does nothing on a quick sale teaches the cashier the button is unreliable, and that lesson transfers to the table order where it matters. |
| C-3 | "Removes or disables" an 86'd item | **Disable in place, never remove.** The tile keeps its position, greys, becomes unselectable, and carries a visible 86 marker. Removal reflows the grid under a finger already travelling toward a target. This now matches the dialog rule the PRD already specifies, so the behaviour is uniform everywhere an item can be selected. |
| C-4 | Asymmetric 86 rejection under a checkout lease | **Not a conflict — do not "fix" it.** FR-G10 rejects closing a table order with pending lines, so a table order at settlement has nothing left to fire and an 86 cannot invalidate it. The rejection rule is correctly quick-sale-only. Noted on BO-03 so nobody later "corrects" it. |
| C-5 | FR-G12 tab guard and FR-G13 lease disable the same five actions | **Two causes, two messages. Never the same string.** The tab guard reads as "finish this payment first" — the cashier's own doing, recoverable by them. The lease reads as "another client is settling this order" — someone else's doing, not recoverable by them. |
| C-6 | Print incident on the locked POS | **Presence pre-authentication, detail behind a PIN.** The lock screen carries an unmissable "kitchen printer needs attention" indicator with no order information on it; tapping it prompts for a PIN and then opens POS-07. Un-missable without leaking order data to a room. |
| C-7 | AC-22's "FR-B16" | Not an error. AC-22 cites **"FR-H4, B-16"** — a requirement and a boundary, two references. |

---

# What the drawing exposed that the sitemap did not

Found by building it, not by listing it. Each is already applied in the prototype.

**1. A sheet that covers the order is the wrong shape.** The sitemap defined a
`[SHEET]` as "not obscuring the order context", then the first draft drew it as a
right-hand panel that covered the order panel completely. Configuring an item,
choosing a discount, or writing a void reason are all judgements *about the order*,
and hiding it while making them is wrong. Sheets are now anchored to the left,
leaving the 460 px order panel and its running total legible throughout. They also
start below the 64 px POS bar, so the actor and the 90-second idle countdown stay
visible mid-sheet — a sheet must never be the reason a cashier gets logged out
mid-decision.

**2. Settlement has two columns of meaning, not two columns of layout.** The first
draft put the drafted payment lines beside the keypad, and at 1280 x 800 the pad
pushed them under the close bar. What is owed, what has been drafted against it,
and the change due belong together on the left; the right column is one payment
line being entered. This is the only screen where the PRD's "nothing recorded
until close" (FR-G9) has to be legible at a glance, and it now is.

**3. FR-E4's fire refusal cannot live in the scrolling line list.** The explanation
of *why* the kitchen button is dead was drawn inside the order list, where a long
order scrolls it out of sight — leaving a disabled button with no reason. It is now
pinned between the list and the totals, adjacent to the control it explains.

**4. Two empties on the audit viewer, not one.** "Nothing has been recorded yet"
(a new installation) and "no entries match this filter" (a bad search) are
different facts with different next actions. Drawing them exposed that the
inventory had listed a single *empty* state.

**5. The 86 marker has to survive being drawn.** In greyscale, a "disabled" tile
and a "low emphasis" tile look identical. The 86 state needs an explicit textual
marker on the tile, not just a lighter treatment — a note for whoever assigns the
visual direction downstream.

**6. The two print-urgency classes survive greyscale, but only structurally.**
AC-23 is satisfied here by border weight, size, placement, section order, and
whether clearing requires an explicit action — never by colour. Downstream must
preserve those differences and not collapse them into two colours of the same
component.

---

# Deferred, recorded so it is visible

**BO-14 — Security telemetry viewer.** Cut by ruling I-3. FR-A5 and FR-J3
deliberately keep unauthenticated PIN failures and throttle cooldowns out of the
audit log; that store exists and is written to in the MVP, and nothing reads it
this release. If it is ever built: no PIN value in any form (FR-J4, B-12), and it
must be structurally distinct from BO-12 so the two stores are never confused.
