# Restaurant POS MVP Design

Date: 2026-09-07
Status: Approved for planning (revised after design review)

## Context

Single-location restaurant POS supporting mixed table-service and quick-sale
(counter/takeaway) order types. This document captures the MVP scope agreed
through a structured interview, the explicit exclusions, and the rules the
implementation must satisfy.

### Revision note

This revision resolves defects found in review of the first draft:

- The payment rule made cash impossible (it required tenders to sum exactly
  to the total, leaving no room for over-tender and change).
- The `served` order state had no actor authorised to enter it.
- "Post-payment void" and "full-order refund" named the same action twice.
- No domain model, money/rounding rules, staff identity model, table model,
  or business-day definition existed.
- Menu, user, and settings management were assumed but never specified, so
  the system as written could not be configured at all.

Newly added scope is marked **[added in review]** so it can be challenged.

## 1. MVP Capabilities

- Single location. Table-service is the core flow; quick-sale (no table, pay
  immediately) is a variant on the same order model, not a separate mode.
- Menu structure: categories, items, single-select variants (price-affecting,
  e.g. size), multi-select modifiers (each carrying a price delta of zero or
  more, e.g. "extra cheese +1.50"). No nested modifier groups, no
  modifier-to-inventory linkage.
- Four roles: waiter, kitchen, cashier, manager (Section 3).
- Staff identify themselves by PIN on shared terminals (Section 3).
- Order lifecycle and per-line fire/void tracking (Section 5).
- Order-level discount (percentage or fixed amount), manager-approved.
- Payments: cash, card, and custom-named tender types, all recorded manually
  with no gateway or terminal integration. Multiple tenders may be split
  across one order. Cash over-tender is supported, with change calculated.
- Voids: unfired lines voided freely by a waiter; fired lines and whole
  orders containing fired lines require manager approval and a reason.
- Refunds: full-order only, on already-closed orders, manager-approved with a
  reason. Distinct from voids (Section 5).
- Receipt reprint, available to cashier or manager.
- Kitchen ticket printing on each fire. Each ticket contains only the lines
  fired in that round. No kitchen display screen.
- Manual "86" (unavailable) toggle per menu item.
- End-of-day close and summary report: total sales, tax collected, service
  charge collected, discounts given, refunds and voids, breakdown by tender
  type, order count.
- Minimal append-only audit log covering voids, discounts, refunds, manager
  approvals, and PIN authentications.
- Tax-inclusive pricing with a single flat VAT/GST-style rate, plus an
  optional flat service-charge percentage that is not itself taxed
  (Section 6). Simple itemized receipt.
- **[added in review]** Minimal manager-facing management screens, without
  which the system cannot be set up or demonstrated:
  - Menu management: create/edit/archive categories, items, variants,
    modifiers; set prices; toggle 86 status.
  - User management: create staff, assign role, set and reset PIN.
  - Settings: currency and precision, tax rate, service-charge percentage,
    table list, business details printed on receipts.
- Local-area-network architecture: terminals, printers, and database run on
  the local network with no cloud dependency for core operation.

## 2. Explicit Non-Goals (Post-MVP)

- Multi-branch / multi-location support.
- Quick-service queue numbers or pickup-counter display.
- Nested modifier groups or modifier-level inventory linkage.
- Item-level (line-level) discounts or complimentary items.
- Bill splitting by guest (dividing one order into separate checks).
- QR payment or external payment-terminal integration.
- Partial or line-item refunds.
- Kitchen display screen (KDS), bump bar, or order-ready signalling.
- Offline order queueing and conflict-resolution sync.
- Inventory stock counts, purchasing, or low-stock alerts.
- Item-level, labor, or hourly-breakdown reporting.
- Jurisdiction-specific tax rules: per-item rates, exemptions, tax holidays,
  or mandated receipt fields for a named country.
- Tip capture. Gratuity is assumed to be covered by the service charge; no
  separate tip field is recorded at payment (flagged in Section 12).
- Table transfer, merge, or split.
- Cash-drawer float and till reconciliation (expected vs. counted cash).
- Customer records, loyalty, or order history by customer.

## 3. User Roles, Identity, and Permissions

Terminals are shared. A staff member authenticates by entering a numeric PIN;
this establishes a short-lived actor context that expires on an idle timeout
or when the user explicitly ends it. Every audited action records the
PIN-identified user.

Manager approval is always an inline step: the approval prompt requires a
manager PIN entered at that moment, regardless of who currently holds the
terminal. Approval authorises one specific action and does not persist.

| Role | Key permissions |
|---|---|
| Waiter | Open a table order, add/edit lines while unfired, fire the order to the kitchen, void unfired lines, take payment |
| Kitchen | View and reprint kitchen tickets. No order state transitions in MVP |
| Cashier | Take payment on any order (single or split tender), open quick-sale orders, reprint receipts |
| Manager | All of the above, plus: approve discounts, approve fired-line and order voids, approve refunds, toggle 86 status, run and view the end-of-day close, view the audit log, manage menu, users, and settings |

### PIN handling

- PINs are credentials. They are stored hashed with a modern password hash
  (argon2id or bcrypt), never in plaintext, and never written to the audit
  log or application logs.
- Repeated failed PIN entry locks that user out for a cooldown period; the
  lockout is recorded in the audit log.
- PIN length and uniqueness policy are set in Settings; PINs must be unique
  per user so that the audit log actor is unambiguous.

## 4. Domain Model

Entities and the fields that carry behaviour. Field lists are indicative, not
exhaustive schema.

| Entity | Purpose | Notable fields |
|---|---|---|
| `User` | Staff member and audit actor | role, pin_hash, active, locked_until |
| `Table` | Physical table available for table-service orders | label, area, active |
| `Category` | Menu grouping | name, sort order, active |
| `MenuItem` | Sellable item | category, name, base price (tax-inclusive), available (86 flag), active |
| `Variant` | Single-select option changing price | menu_item, name, price delta |
| `Modifier` | Multi-select option, price delta >= 0 | menu_item (or shared group), name, price delta |
| `Order` | One bill | type (table / quick_sale), table (nullable), status, business_day, opened_by, opened_at, closed_at |
| `OrderLine` | One item on an order | order, menu_item, variant, modifiers, quantity, unit price snapshot, line state |
| `Discount` | Order-level reduction | order, kind (percent / fixed), value, approved_by, reason |
| `Payment` | One tender against an order | order, tender_type, amount, change_given, taken_by, taken_at |
| `TenderType` | Cash, card, or custom named method | name, is_cash, active |
| `KitchenTicket` | One fire round | order, sequence, lines, printed_at, print_status |
| `BusinessDay` | Reporting period between EOD closes | opened_at, closed_at, closed_by, report snapshot |
| `AuditEntry` | Append-only record | actor, action, order (nullable), reason, timestamp, before/after amounts |
| `Settings` | Singleton configuration | currency, minor-unit precision, tax rate, service charge rate, business details |

**Price snapshotting.** `OrderLine` stores the resolved unit price at the time
the line was added. Editing a menu price later must never change the total of
an order already taken, and must never change a historical report.

## 5. Order and Line State Machine

The first draft's `served` state is removed: no role in the MVP is authorised
to enter it, and nothing depends on it. Firing is tracked per line, not per
order, because a table order is fired in rounds and voids differ before and
after a line reaches the kitchen.

**`Order.status`**

```
OPEN ──(all lines paid in full)──> CLOSED ──(manager refund)──> REFUNDED
  │
  └──(manager void, unpaid)──────> VOIDED
```

- `OPEN` — accepting lines and payments. Not yet fully paid.
- `CLOSED` — fully paid, receipt printed. Terminal, except for refund.
- `VOIDED` — cancelled before being paid. Terminal.
- `REFUNDED` — was closed, then reversed in full. Terminal.

**`OrderLine.state`**

- `PENDING` — added, not yet sent to the kitchen. Editable and freely voidable
  by a waiter.
- `FIRED` — printed on a kitchen ticket. Voidable only with manager approval.
- `VOIDED` — removed. Excluded from all totals; retained for audit.

**Fire action.** Firing collects every `PENDING` line on the order, prints one
`KitchenTicket` containing only those lines, and marks them `FIRED`. A second
fire prints only the lines added since the first. This prevents the kitchen
cooking earlier rounds twice.

**Void versus refund.** These are distinct actions with distinct
preconditions, and the UI must not present them interchangeably:

- **Void** applies to an `OPEN` (unpaid) order or to individual lines on one.
- **Refund** applies only to a `CLOSED` order and reverses it in full.

## 6. Money, Tax, and Rounding

Menu prices are **tax-inclusive**: the price shown is the price paid. The tax
line on a receipt is derived from the total, not added to it.

The service charge is **not taxed**. It is added after tax has been accounted
for, so the receipt's tax figure reflects only tax embedded in the goods.

### Storage and rounding

- Currency and its minor-unit precision are configured once in Settings
  (for example 2 for USD or EUR, 0 for IDR or JPY).
- All monetary values are stored as integers in minor units. No binary
  floating point is used for money at any layer.
- Any computed fraction is rounded **half-up** to the minor unit at the point
  it becomes a stored or displayed value.
- Tax is computed **once at order level** from the discounted subtotal, never
  summed from per-line tax figures. Per-line rounding would not reconcile to
  the order total.

### Order of operations

Let `r` = tax rate, `s` = service-charge rate.

1. `subtotal` = sum of non-voided line totals (tax-inclusive).
2. `discount` = percentage or fixed amount, rounded half-up.
3. `D` = `subtotal - discount` — the discounted, tax-inclusive base.
4. `tax_included` = `D × r / (1 + r)`, rounded half-up. **Display only** — it
   is a component of `D`, not an addition to it.
5. `service_charge` = `D × s`, rounded half-up. Not taxed.
6. `total` = `D + service_charge`.

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

Receipt presentation: subtotal 16.50, discount −1.65, service charge 0.74,
total 15.59, and a note line "Includes GST 10%: 1.35".

### Payment and change

- Non-cash tenders (card, custom) must not exceed the remaining balance. The
  system must never record a card charge larger than what is owed.
- A cash tender may exceed the remaining balance. `change_given` =
  `cash_tendered - remaining_balance`.
- An order closes when the sum of tenders, less change given, equals the
  order total exactly.
- Recorded revenue is the order total. Change is not revenue and is excluded
  from the sales figures in the end-of-day report.

## 7. Critical Workflows

**Table order.** Waiter authenticates by PIN, opens an order against a free
table, adds lines (selecting variant and modifiers), and fires the order. A
kitchen ticket prints with those lines. Later rounds add lines and fire again,
printing only the new lines. A waiter or cashier then takes payment (single or
split tender), the order closes, and a receipt prints.

**Quick sale.** Cashier opens a quick-sale order with no table, adds lines,
takes payment immediately, and the order closes. Firing to the kitchen and
receipt printing both occur at close.

**Void an unfired line.** Waiter removes a `PENDING` line. No approval, no
audit entry beyond the ordinary order edit.

**Void a fired line or a whole order.** Requires a manager PIN at the prompt
and a reason. Recorded in the audit log and reflected in the end-of-day
report. Only possible while the order is `OPEN`.

**Refund.** Applies to a `CLOSED` order. Requires a manager PIN and a reason.
Reverses the order in full; the order becomes `REFUNDED`.

**Discount.** Waiter or cashier applies a percentage or fixed discount to the
order. A manager PIN is required before it takes effect. The approval, the
approver, and the amount are logged.

**86 an item.** Manager toggles an item unavailable. It disappears from
order-entry immediately for new lines. Existing `PENDING` lines holding that
item are flagged and block firing until voided or the item is restored
(Section 9).

**End-of-day close.** Manager runs the close. The system refuses while any
order is still `OPEN`. On success it totals the business day, stores an
immutable report snapshot, closes the `BusinessDay`, and opens the next one.

## 8. Business Rules

- Tax rate, service-charge rate, currency, and precision are configured once
  in Settings and apply to every order.
- Prices are tax-inclusive; the receipt tax line is derived, never added.
- The service charge is calculated on the discounted tax-inclusive subtotal
  and is not itself taxed.
- Discounts are order-level only and require manager approval before taking
  effect. At most one discount per order in MVP.
- Non-cash tenders may not exceed the remaining balance; cash tenders may,
  with the excess returned as change.
- An order may close only when tenders less change equal the total exactly.
- Voiding a `FIRED` line, or any order containing one, requires manager
  approval and a reason. Voiding a `PENDING` line does not.
- Refunds apply only to `CLOSED` orders, are always for the full amount, and
  require manager approval and a reason.
- An order may be refunded once. A `REFUNDED` order is terminal.
- An 86'd item cannot be added to any order. Lines already `FIRED` are
  unaffected; `PENDING` lines block firing until resolved.
- A table holds at most one `OPEN` order at a time. Quick-sale orders have no
  table.
- Order line prices are snapshotted at the time of adding, so later menu
  price edits never alter existing orders or historical reports.
- Audit entries are append-only: never edited, never deleted.
- A business day runs from one end-of-day close to the next. Orders belong to
  the business day that was open when they were created, not to a calendar
  date.
- An end-of-day close is idempotent per business day: once closed, the report
  is immutable and re-printable, and a second close of the same day is
  rejected.

## 9. Failure and Edge Cases

- **Kitchen printer offline or out of paper on fire.** The lines are still
  marked `FIRED` and the `KitchenTicket` is saved with `print_status =
  failed`. The UI raises a visible warning and offers a manual reprint. The
  order is never silently blocked by a printer fault.
- **Receipt printer fails at close.** The order still closes. Payment is
  never lost to a printing fault; the receipt is reprintable from the closed
  order.
- **Tenders do not reach the total.** Closing is blocked and the UI shows the
  remaining balance.
- **Non-cash tender exceeds the remaining balance.** Rejected at entry with
  the maximum acceptable amount shown.
- **Manager approval requested with no manager available.** The action is
  blocked and the order remains in its prior state. Nothing is half-applied.
- **Void attempted on a line already fired.** Routed to the manager-approval
  path automatically, regardless of who initiated it.
- **Refund attempted on an already-refunded order.** Rejected.
- **Refund or void attempted on an order from a closed business day.** Blocked
  in MVP, because the day's report snapshot is immutable. The manager is told
  to handle it out of band (flagged in Section 12).
- **Item 86'd while a `PENDING` line holds it.** The line is flagged and
  firing is blocked until the line is voided or the item is restored. The
  kitchen is never sent an item it cannot make.
- **Item 86'd while a `FIRED` line holds it.** No effect; it is already being
  prepared.
- **Concurrent edits to one open order from two terminals.** Last-write-wins
  is accepted for MVP given a single location and a small terminal count.
- **Terminal or application restart mid-order.** Open orders persist
  server-side and survive the restart; no order state lives only in terminal
  memory.
- **End-of-day close attempted with orders still open.** Rejected, listing the
  open orders so staff can close or void them.
- **PIN entered incorrectly repeatedly.** The user is locked out for a
  cooldown period and the lockout is audited.

## 10. Observable Acceptance Criteria

1. A waiter authenticates by PIN, opens a table order, adds an item with a
   variant and a priced modifier, fires it, and the kitchen ticket prints
   containing exactly that line.
2. Adding two more lines and firing again prints a second ticket containing
   **only** the two new lines.
3. Voiding an unfired line succeeds with no approval prompt. Voiding a fired
   line raises a manager-PIN prompt and is refused when the prompt is
   cancelled.
4. The worked example in Section 6 reproduces exactly: subtotal 16.50,
   discount 1.65, tax-included 1.35, service charge 0.74, total 15.59.
5. A cashier tenders 20.00 cash against a 15.59 total; the system shows
   4.41 change, closes the order, and records 15.59 as revenue, not 20.00.
6. A card tender of 20.00 against a 15.59 balance is rejected, with 15.59
   offered as the maximum.
7. A split payment of 10.00 card plus 5.59 cash closes the order; a split
   leaving any balance does not.
8. A discount, a fired-line void, and a refund each fail without a manager
   PIN and succeed with one, and each produces exactly one audit entry
   naming the actor, the approver, the reason, and the order.
9. Toggling an item to 86 removes it from order entry within the same
   session with no restart, and blocks firing an order holding it as a
   pending line.
10. A closed order's receipt reprints on demand with identical figures.
11. A refund on a closed order moves it to `REFUNDED`, and a second refund
    attempt on the same order is rejected.
12. An end-of-day close is refused while an order is open, and succeeds once
    that order is closed or voided.
13. The end-of-day report's sales, tax, service charge, discounts, refunds,
    voids, tender breakdown, and order count match a manual sum of that
    business day's orders.
14. Editing a menu item's price after an order was taken changes neither that
    order's total nor the closed day's report.
15. The audit log contains one entry per void of a fired line, discount,
    refund, approval, and PIN lockout in a test session, and contains no
    PIN values in any form.

## 11. Operating Assumptions

- One or more terminals on a local network, all talking to a single
  server-side application and database on that same network.
- Kitchen and receipt printing target ESC/POS-compatible thermal printers
  reachable over the LAN. In the smallest deployment the kitchen ticket and
  the customer receipt may print to the same device.
- Printing is treated as an unreliable side effect throughout: no order or
  payment state transition is conditional on a print succeeding.
- Concurrent terminal count is small (single digits); no horizontal scaling
  or queueing infrastructure is assumed.

## 12. Unresolved Decisions

- **Reopening a closed order.** Whether a `CLOSED` order can be reopened when
  a customer returns before end-of-day, or whether refund-and-rering is the
  only path back. Currently refund is the only path.
- **Cancellation tickets.** Whether voiding a fired line should print a
  cancellation slip to the kitchen, since the kitchen already holds the
  original paper ticket and cannot otherwise learn of the void.
- **Corrections after end-of-day close.** Refunds and voids against a closed
  business day are blocked. Whether an adjustment mechanism is needed, or
  whether out-of-band handling is acceptable at this scale.
- **Tip capture.** Excluded from MVP on the assumption that the service
  charge covers gratuity. If cash or card tips must be recorded per order,
  this needs to re-enter scope before payment is built.
- **Service-charge base.** The service charge is calculated on the
  tax-inclusive discounted subtotal. Calculating it on the net-of-tax amount
  is the alternative; it changes every total slightly.
- **Receipt content and format.** Exact business-info fields, footer text,
  and logo placement, plus whether any legally mandated field applies in the
  target jurisdiction.
- **Multi-terminal concurrency.** Accepted as last-write-wins for MVP unless
  stricter locking is required before implementation begins.
- **Scope of the added management screens.** Menu, user, and settings
  management were added in review because the system could not otherwise be
  configured. If they should instead be seeded by fixture or configuration
  file for the first release, that removes meaningful UI scope.
