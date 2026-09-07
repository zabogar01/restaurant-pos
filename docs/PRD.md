# Product Requirements — MVP

Status: approved for planning
Design rationale: [specs/2026-09-07-restaurant-pos-mvp-design.md](superpowers/specs/2026-09-07-restaurant-pos-mvp-design.md)

Requirements are identified `FR-<group><n>` and referenced by the acceptance
criteria at the end. Implementation plans should cite these IDs.

## 1. Scope summary

Single location. Table-service is the core flow; quick sale (no table, paid
immediately) is a variant of the same order model. Four roles sharing
terminals over a local network. One tax rate, tax-inclusive prices, optional
untaxed service charge. Cash, card, and custom-named tenders recorded
manually. Kitchen ticket printing, no kitchen display. No inventory, no
integrations, no offline sync.

## 2. Domain vocabulary

| Term | Meaning |
|---|---|
| Order | One bill. Type is `table` or `quick_sale`. Status is `OPEN`, `CLOSED`, `VOIDED`, or `REFUNDED` |
| Order line | One item on an order. State is `PENDING`, `FIRED`, or `VOIDED` |
| Fire | Send all `PENDING` lines to the kitchen as one printed ticket |
| 86 | Mark a menu item temporarily unavailable (`MenuItem.is_available = false`) |
| Preset | A manager-defined named discount, applied without approval |
| Business day | The period between two end-of-day closes |
| Tender | One payment against an order; an order may have several |

Full entity list and fields: see the design spec, Section 4. All boolean
fields are `is_`-prefixed.

## 3. Functional requirements

### A. Identity and access

- **FR-A1** Each staff member has a role of waiter, kitchen, cashier, or
  manager, and a numeric PIN.
- **FR-A2** Staff authenticate by PIN on a shared terminal. Authentication
  establishes a short-lived actor context that expires on idle timeout or on
  explicit release.
- **FR-A3** PINs are stored using a modern password hash (argon2id or
  bcrypt), never in plaintext, and never written to any log.
- **FR-A4** PINs are unique per user, so an audit actor is unambiguous.
- **FR-A5** Repeated failed PIN entry locks the user out for a cooldown
  period. The lockout is audited.
- **FR-A6** Manager approval is an inline prompt requiring a manager PIN at
  that moment. It authorises one specific action and does not persist.

### B. Configuration and management (manager only)

- **FR-B1** Settings hold currency, minor-unit precision, tax rate, service
  charge rate, and the business details printed on receipts.
- **FR-B2** Manage tables: create, edit, and deactivate.
- **FR-B3** Manage users: create, assign role, set and reset PIN, deactivate.
- **FR-B4** Manage menu: categories, items, variants, modifiers, prices.
- **FR-B5** Manage discount presets: create, edit, deactivate.
- **FR-B6** Toggle an item's 86 status.

### C. Menu

- **FR-C1** Items belong to a category and carry a tax-inclusive base price.
- **FR-C2** An item may offer variants: single-select, each with a price
  delta (for example size).
- **FR-C3** An item may offer modifiers: multi-select, each with a price
  delta of zero or more (for example "extra cheese +1.50").
- **FR-C4** No nested modifier groups. No link between modifiers and stock.
- **FR-C5** An item with `is_available = false` cannot be added to any order.

### D. Order capture

- **FR-D1** A waiter opens a table order against a table that has no other
  `OPEN` order. A table holds at most one open order.
- **FR-D2** A cashier opens a quick-sale order, which has no table.
- **FR-D3** Lines may be added while the order is `OPEN`, including after an
  earlier fire.
- **FR-D4** Adding a line captures the resolved unit price as a snapshot.
  Later menu price edits never change an existing order.
- **FR-D5** A `PENDING` line may be edited or removed freely.
- **FR-D6** Order state is held server-side and survives a terminal or
  application restart.

### E. Kitchen firing

- **FR-E1** Firing collects every `PENDING` line, prints one kitchen ticket
  containing only those lines, and marks them `FIRED`.
- **FR-E2** A second fire prints only lines added since the previous fire.
- **FR-E3** A failed print still marks the lines `FIRED` and saves the ticket
  with `print_status = failed`, raising a visible warning and offering a
  reprint. Printing never blocks the sale.
- **FR-E4** Firing is blocked while any `PENDING` line holds an item that is
  86'd, until that line is voided or the item is restored.
- **FR-E5** For a quick-sale order, firing and receipt printing both occur at
  close.

### F. Discounts

- **FR-F1** Discounts are order-level. An order carries at most one.
- **FR-F2** A preset discount is applied by any staff member with no approval
  prompt.
- **FR-F3** A free-form discount (typed percentage or amount) requires a
  manager PIN.
- **FR-F4** Applying a discount snapshots the name, kind, and value onto the
  order. Editing or deactivating the preset afterwards never alters an
  existing order or a closed day's report.
- **FR-F5** A deactivated preset disappears from the picker but remains
  readable on orders that already carry it.
- **FR-F6** Every discount is audited. A preset records the actor; a
  free-form discount records the actor and the approver.
- **FR-F7** No discount applies itself. A staff member always chooses it.

### G. Payment and close

- **FR-G1** Tender types are cash, card, and any custom named method. All are
  recorded manually; there is no gateway or terminal integration.
- **FR-G2** An order may be paid with several tenders.
- **FR-G3** A non-cash tender must not exceed the remaining balance.
- **FR-G4** A cash tender may exceed the remaining balance. Change equals
  cash tendered minus remaining balance.
- **FR-G5** An order closes when tenders less change given equal the order
  total exactly.
- **FR-G6** Recorded revenue is the order total. Change is not revenue.
- **FR-G7** A receipt prints on close and is reprintable on demand with
  identical figures.
- **FR-G8** A receipt-printer failure never prevents the order closing.

### H. Void and refund

- **FR-H1** Void applies to an `OPEN` order or to lines on one. Refund
  applies only to a `CLOSED` order. The UI must not present them as the same
  action.
- **FR-H2** Removing a `PENDING` line requires no approval and is not
  audited.
- **FR-H3** Voiding an order with no `FIRED` lines requires no approval and
  is audited.
- **FR-H4** Voiding a `FIRED` line, or an order holding one, requires a
  manager PIN and a reason, and is audited.
- **FR-H5** A refund reverses a closed order in full. Partial refunds are out
  of scope. It requires a manager PIN and a reason, and is audited.
- **FR-H6** An order may be refunded once. `REFUNDED` is terminal.
- **FR-H7** Voids and refunds against a closed business day are blocked.

### I. Business day and reporting

- **FR-I1** A business day runs from one end-of-day close to the next. An
  order belongs to the business day open when it was created, not to a
  calendar date.
- **FR-I2** End-of-day close is refused while any order is still `OPEN`, and
  lists those orders.
- **FR-I3** A successful close stores an immutable report snapshot, closes
  the business day, and opens the next.
- **FR-I4** A second close of the same business day is rejected. The stored
  report remains re-printable.
- **FR-I5** The report contains: total sales, tax collected, service charge
  collected, discounts given, refunds, voids, breakdown by tender type, and
  order count.

### J. Audit

- **FR-J1** The audit log is append-only. Entries are never edited or
  deleted.
- **FR-J2** An entry records actor, action, order reference where applicable,
  reason, timestamp, and before/after amounts.
- **FR-J3** Audited actions: whole-order void, fired-line void, discount,
  refund, manager approval, and PIN lockout.
- **FR-J4** No PIN value appears in the audit log in any form.

## 4. Money rules

Prices are **tax-inclusive**: the price shown is the price paid. The tax line
is derived from the total, never added to it. The service charge is **not
taxed**.

- **FR-M1** Currency and minor-unit precision are configured once (2 for USD
  or EUR, 0 for IDR or JPY).
- **FR-M2** All money is stored as integers in minor units. Binary floating
  point is never used for money at any layer.
- **FR-M3** Computed fractions round **half-up** at the point of becoming a
  stored or displayed value.
- **FR-M4** Tax is computed once at order level from the discounted subtotal,
  never summed from per-line figures.

Order of operations, with `r` = tax rate and `s` = service-charge rate:

1. `subtotal` = sum of non-voided line totals (tax-inclusive)
2. `discount` = percentage or fixed amount, rounded half-up
3. `D` = `subtotal − discount`
4. `tax_included` = `D × r / (1 + r)`, rounded half-up — **display only**
5. `service_charge` = `D × s`, rounded half-up — not taxed
6. `total` = `D + service_charge`

### Worked example

Tax 10% inclusive, service charge 5% untaxed, 2-decimal currency.

| Step | Value |
|---|---|
| Burger 10.00, Large variant +2.00, extra cheese +1.50 | 13.50 |
| Soda | 3.00 |
| Subtotal (tax-inclusive) | 16.50 |
| Discount 10% | −1.65 |
| Discounted subtotal `D` | 14.85 |
| Of which GST 10% (`14.85 × 0.10/1.10`) | 1.35 |
| Service charge 5% (`14.85 × 0.05` = 0.7425) | 0.74 |
| **Total** | **15.59** |

Receipt shows subtotal 16.50, discount −1.65, service charge 0.74, total
15.59, and the line "Includes GST 10%: 1.35".

## 5. Non-functional requirements

- **NFR-1** Terminals, printers, and the server all run on one local network.
  No cloud dependency for core operation.
- **NFR-2** Printing targets ESC/POS-compatible thermal printers over the
  LAN. Kitchen and receipt output may share one device in the smallest
  deployment.
- **NFR-3** Concurrent terminal count is single-digit. No horizontal scaling
  or queueing infrastructure is assumed.
- **NFR-4** Concurrent edits to one order resolve last-write-wins for MVP.

## 6. Edge cases the build must handle

- Kitchen or receipt printer offline or out of paper — see FR-E3, FR-G8.
- Tenders below the total — closing blocked, remaining balance shown.
- Non-cash tender above the remaining balance — rejected, maximum shown.
- Manager approval requested with no manager available — action blocked, no
  partial state written.
- Void attempted on an already-fired line — routed to the approval path
  automatically, whoever initiates it.
- Refund attempted on an already-refunded order — rejected.
- Item 86'd while a `PENDING` line holds it — firing blocked (FR-E4).
- Item 86'd while a `FIRED` line holds it — no effect, already cooking.
- Preset edited or deactivated while an open order carries it — order
  unaffected, it holds a snapshot (FR-F4).
- Discount on an order later voided or refunded — counted in the end-of-day
  discount total only for orders that actually closed.
- Terminal restart mid-order — open orders persist (FR-D6).
- End-of-day attempted with open orders — refused with a list (FR-I2).
- Repeated wrong PIN — lockout, audited (FR-A5).

## 7. Acceptance criteria

Each is observable. The MVP is done when all pass.

| # | Criterion | Covers |
|---|---|---|
| AC-1 | A waiter authenticates by PIN, opens a table order, adds an item with a variant and a priced modifier, fires it, and the kitchen ticket prints containing exactly that line | FR-A2, C2, C3, E1 |
| AC-2 | Adding two more lines and firing again prints a second ticket containing **only** the two new lines | FR-D3, E2 |
| AC-3 | Voiding an unfired line succeeds with no prompt; voiding a fired line raises a manager-PIN prompt and is refused when cancelled | FR-H2, H4 |
| AC-4 | The worked example reproduces exactly: subtotal 16.50, discount 1.65, tax-included 1.35, service charge 0.74, total 15.59 | FR-M1–M4 |
| AC-5 | 20.00 cash against a 15.59 total shows 4.41 change, closes the order, and records 15.59 as revenue — not 20.00 | FR-G4, G6 |
| AC-6 | A card tender of 20.00 against a 15.59 balance is rejected, with 15.59 offered as the maximum | FR-G3 |
| AC-7 | A split of 10.00 card plus 5.59 cash closes the order; a split leaving any balance does not | FR-G2, G5 |
| AC-8 | A preset discount applies with no prompt of any kind, and its audit entry names the preset ("Staff Meal 50%") rather than a bare number | FR-F2, F6 |
| AC-9 | A free-form discount is refused when the manager prompt is cancelled and succeeds with a valid manager PIN; its record carries actor and approver, a preset's carries only the actor | FR-F3, F6 |
| AC-10 | Voiding an order with nothing fired succeeds with no prompt and writes exactly one audit entry; voiding an order holding a fired line raises the manager prompt | FR-H3, H4 |
| AC-11 | A fired-line void and a refund each fail without a manager PIN and succeed with one, each producing one audit entry naming actor, approver, reason, and order | FR-H4, H5, J2 |
| AC-12 | Toggling an item to 86 removes it from order entry within the same session with no restart, and blocks firing an order holding it as a pending line | FR-C5, E4 |
| AC-13 | A closed order's receipt reprints on demand with identical figures | FR-G7 |
| AC-14 | A refund moves a closed order to `REFUNDED`; a second refund attempt is rejected | FR-H5, H6 |
| AC-15 | End-of-day close is refused while an order is open, and succeeds once that order is closed or voided | FR-I2 |
| AC-16 | The end-of-day report's sales, tax, service charge, discounts, refunds, voids, tender breakdown, and order count match a manual sum of that business day's orders | FR-I5 |
| AC-17 | Editing a menu price or a preset value after an order was taken changes neither that order's total nor the closed day's report; a deactivated preset stays readable on orders carrying it | FR-D4, F4, F5 |
| AC-18 | The audit log holds one entry per whole-order void, fired-line void, discount, refund, approval, and PIN lockout in a test session, and contains no PIN values in any form | FR-J3, J4 |

## 8. Out of scope for MVP

Multi-location. Queue numbers and pickup displays. Nested modifier groups.
Item-level discounts and comps. Bill splitting by guest. QR and external
terminal payments. Partial refunds. Kitchen display screens. Offline
queueing and sync. Inventory. Item-level, labor, and hourly reporting.
Jurisdiction-specific tax packs. Tip capture. Table transfer, merge, and
split. Cash-drawer float and till reconciliation. Customer records and
loyalty. Auto-applying or scheduled discount campaigns. More than one
discount per order.

Rationale for each: see the design spec, Section 2.

## 9. Open questions

Tracked in the design spec, Section 12. None block the start of
implementation; all should be settled before the feature they touch is
built.

1. Whether a `CLOSED` order can be reopened, or refund-and-rering is the only
   path back.
2. Whether voiding a fired line should print a cancellation slip to the
   kitchen.
3. Whether corrections against a closed business day need a mechanism, or
   out-of-band handling is acceptable.
4. Whether tips must be captured — must be settled **before payment is
   built**, as retrofitting is expensive.
5. Whether the service charge should be based on the net-of-tax amount rather
   than the tax-inclusive subtotal.
6. Whether the free-form discount gate should become a threshold instead.
7. Receipt content and format details.
8. Whether multi-terminal concurrency needs stricter locking than
   last-write-wins.
9. Whether the management screens should ship as UI or as seeded
   configuration for the first release.
