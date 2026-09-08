# Restaurant POS MVP Design

Date: 2026-09-07
Status: **Superseded in part.** This document records the interview and the
reasoning behind the original scope. Where it disagrees with
[PRD.md](../../PRD.md), [PRODUCT.md](../../PRODUCT.md),
[ROADMAP.md](../../ROADMAP.md), or [BOUNDARIES.md](../../BOUNDARIES.md),
those documents win.

Changed after architecture review and the owner's scope cut of 2026-09-08:

- The entity `Payment` is now `Tender`; `Table` is `DiningTable`.
- The MVP has two authenticating roles, cashier and manager. Waiter is
  deferred. Kitchen is a non-authenticating classification with no screen,
  no PIN, and no reprint permission.
- Fired-line voids print a kitchen cancellation ticket.
- Refunds record `RefundTender` allocations by effective contribution.
- Per-user lockout became installation-wide throttle buckets; unauthenticated
  PIN failures are security telemetry, not audit entries.
- Tip capture is definitively excluded.
- The MVP runs on one local machine over HTTPS on localhost. Terminals, LAN
  TLS, appliance, UPS, and backups moved to the pre-production gate in
  ROADMAP.md.
- The product is **two clients**, not one: a touch-first POS at `/pos/` and a
  desktop back office at `/back-office/`, with separate sessions and timeout
  policies, against one server and one database. All management,
  configuration, reporting, audit viewing, and the end-of-day close live in
  the back office.
- A server-side `CheckoutLease` protects an in-flight payment from concurrent
  back-office changes. It was cut with the single-machine reduction and
  returned with the two-client split.
- Open questions 1 (reopening a closed order) and 5 (service-charge base) are
  resolved: no reopening, and the base is the tax-inclusive discounted
  subtotal.

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

A second round applied product-lead feedback:

- Boolean fields are now consistently `is_`-prefixed.
- Cancelling an order that was keyed in but never fired needs no manager
  approval; the first draft only implied this rather than stating it.
- Discounts no longer require manager approval. Manager-defined presets are
  applied freely and audited by name; only free-form amounts remain gated.

Newly added scope is marked **[added in review]** so it can be challenged.

## 1. MVP Capabilities

- Single location. Table-service is the core flow; quick-sale (no table, pay
  immediately) is a variant on the same order model, not a separate mode.
- Menu structure: categories, items, single-select variants (price-affecting,
  e.g. size), multi-select modifiers (each carrying a price delta of zero or
  more, e.g. "extra cheese +1.50"). No nested modifier groups, no
  modifier-to-inventory linkage.
- Two authenticating roles: cashier and manager. Kitchen is a
  non-authenticating classification; waiter is deferred (Section 3).
- Staff identify themselves by PIN on the shared local client (Section 3).
- Order lifecycle and per-line fire/void tracking (Section 5).
- Order-level discounts, percentage or fixed amount. Manager-defined presets
  ("Staff Meal 50%", "Independence Day 15%") are applied by any staff member
  with no approval. Free-form amounts require a manager PIN. Every discount
  is audited either way.
- Payments: cash, card, and custom-named tender types, all recorded manually
  with no gateway or terminal integration. Multiple tenders may be split
  across one order. Cash over-tender is supported, with change calculated.
- Voids: unfired lines voided freely by any authenticating staff; fired lines and whole
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
  - Discount presets: create/edit/deactivate named presets.
  - User management: create staff, assign role, set and reset PIN.
  - Settings: currency and precision, tax rate, service-charge percentage,
    table list, business details printed on receipts.
- Single-host architecture for the MVP: client, application, and database run
  on one local machine over HTTPS on localhost, with no cloud dependency.
  Printers may be reachable over the local network. Multi-terminal LAN
  deployment moved to the pre-production gate.

## 2. Explicit Non-Goals (Post-MVP)

- Multi-branch / multi-location support.
- Quick-service queue numbers or pickup-counter display.
- Nested modifier groups or modifier-level inventory linkage.
- Item-level (line-level) discounts or complimentary items.
- Auto-applying or scheduled discount campaigns. A preset is always chosen
  deliberately by a staff member; no discount fires itself from a date or
  time window. Scheduling brings campaign precedence, overlap rules, and
  midnight/timezone edges that a one-second tap does not justify.
- More than one discount on a single order.
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

The local client is shared. A staff member authenticates by entering a numeric PIN;
this establishes a short-lived actor context that expires on an idle timeout
or when the user explicitly ends it. Every audited action records the
PIN-identified user.

Manager approval is always an inline step: the approval prompt requires a
manager PIN entered at that moment, regardless of who currently holds the
terminal. Approval authorises one specific action and does not persist.

| Role | Key permissions |
|---|---|
| Cashier | Open table and quick-sale orders, add/edit lines while unfired, fire to the kitchen, void unfired lines, void an order with nothing fired, apply a preset discount, take payment (single or split tender), reprint receipts |
| Kitchen | Non-authenticating classification. No PIN, no screen, no commands. Works from printed work and cancellation tickets |
| Waiter | **Deferred beyond the MVP.** Its permissions are performed by the cashier |
| Manager | All of the above, plus: approve free-form discounts, approve fired-line and order voids, approve refunds, toggle 86 status, run and view the end-of-day close, view the audit log, manage menu, discount presets, users, and settings |

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
| `User` | Staff member and audit actor | role, pin_hash, is_active, locked_until |
| `Table` | Physical table available for table-service orders | label, area, is_active |
| `Category` | Menu grouping | name, sort order, is_active |
| `MenuItem` | Sellable item | category, name, base price (tax-inclusive), is_available (86 flag), is_active |
| `Variant` | Single-select option changing price | menu_item, name, price delta, is_active |
| `Modifier` | Multi-select option, price delta >= 0 | menu_item (or shared group), name, price delta, is_active |
| `Order` | One bill | type (table / quick_sale), table (nullable), status, business_day, opened_by, opened_at, closed_at |
| `OrderLine` | One item on an order | order, menu_item, variant, modifiers, quantity, unit price snapshot, line state |
| `DiscountPreset` | Reusable named discount a manager defines | name, kind (percent / fixed), value, is_active |
| `Discount` | Order-level reduction, at most one per order | order, preset (nullable), name snapshot, kind, value snapshot, applied_by, approved_by (nullable), reason |
| `Tender` | One recorded contribution to settlement | order, tender_type, name snapshot, amount, change_given, taken_by, taken_at |
| `RefundTender` | One allocation of a refund back to a method | refund, tender_type, amount |
| `TenderType` | Cash, card, or custom named method | name, is_cash, is_active |
| `KitchenTicket` | One fire round | order, sequence, lines, printed_at, print_status |
| `BusinessDay` | Reporting period between EOD closes | opened_at, closed_at, closed_by, report snapshot |
| `AuditEntry` | Append-only record | actor, action, order (nullable), reason, timestamp, before/after amounts |
| `Settings` | Singleton configuration | currency, minor-unit precision, tax rate, service charge rate, business details |

**Boolean naming.** Every boolean field is prefixed `is_`, without exception,
including the 86 flag (`MenuItem.is_available`).

**Snapshotting.** `OrderLine` stores the resolved unit price at the time the
line was added, and `Discount` stores the preset's name, kind, and value at
the time it was applied. Editing a menu price or a preset later must never
change the total of an order already taken, and must never change a
historical report. `Discount.preset` is a reference for reporting only; the
snapshot is what the arithmetic and the receipt use.

**Discount approval.** `approved_by` is populated only for free-form
discounts, which require a manager PIN. A preset discount leaves it null and
records only `applied_by`. Presence of `preset` and absence of `approved_by`
together identify the ungated path.

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
  by any authenticating staff member.
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

**What gates a void.** Approval tracks whether the kitchen has been given
work, not who is asking:

| Target | Approval | Audited |
|---|---|---|
| A `PENDING` line | None | No |
| An order with no `FIRED` lines | None | Yes |
| A `FIRED` line | Manager PIN + reason | Yes |
| An order holding any `FIRED` line | Manager PIN + reason | Yes |

Cancelling an order that was keyed in but never sent to the kitchen is
ordinary mistake correction: nothing was cooked and no money was taken, so
there is nothing for an approval to protect. It is still recorded, because a
staff member who cancels a large share of their own orders is a pattern worth
being able to see later.

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

**Table order.** Cashier authenticates by PIN, opens an order against a free
table, adds lines (selecting variant and modifiers), and fires the order. A
kitchen ticket prints with those lines. Later rounds add lines and fire again,
printing only the new lines. A cashier then takes payment (single or
split tender), the order closes, and a receipt prints.

**Quick sale.** Cashier opens a quick-sale order with no table, adds lines,
takes payment immediately, and the order closes. Firing to the kitchen and
receipt printing both occur at close.

**Void an unfired line.** Staff member removes a `PENDING` line. No approval,
no audit entry beyond the ordinary order edit.

**Cancel an unfired order.** Staff member voids an `OPEN` order on which
nothing has been fired and no payment recorded — the ordinary "keyed it in
wrong" case. No approval prompt. The order becomes `VOIDED` and one audit
entry is written naming the actor.

**Void a fired line, or an order holding one.** Requires a manager PIN at the
prompt and a reason. Recorded in the audit log and reflected in the
end-of-day report. Only possible while the order is `OPEN`.

**Refund.** Applies to a `CLOSED` order. Requires a manager PIN and a reason.
Reverses the order in full; the order becomes `REFUNDED`.

**Apply a preset discount.** Staff member picks a named preset from the
active list and it takes effect immediately, with no prompt. The preset's
name, kind, and value are snapshotted onto the order and written to the audit
log, so the log records "Staff Meal 50%" rather than a bare number.

**Apply a free-form discount.** Staff member types a percentage or fixed
amount. A manager PIN is required before it takes effect. The amount, the
actor, and the approver are all logged.

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
- Discounts are order-level only, and an order carries at most one.
- A preset discount requires no approval; a free-form discount requires a
  manager PIN. Both are audited.
- A preset's name, kind, and value are snapshotted onto the order when
  applied. Editing or deactivating the preset afterwards never alters an
  existing order or a closed day's report.
- A deactivated preset disappears from the picker but remains readable on
  orders that already carry it.
- No discount applies itself. A staff member always chooses it.
- Non-cash tenders may not exceed the remaining balance; cash tenders may,
  with the excess returned as change.
- An order may close only when tenders less change equal the total exactly.
- Voiding a `FIRED` line, or any order containing one, requires manager
  approval and a reason. Voiding a `PENDING` line does not, and neither does
  voiding an order on which nothing has been fired.
- A whole-order void is always audited, with or without an approval step.
  Removing a single `PENDING` line is not.
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
- **Preset deactivated or edited while an open order carries it.** The order
  is unaffected: it holds a snapshot, not a live reference. The picker stops
  offering the preset for new orders.
- **Free-form discount attempted with no manager available.** Blocked, and no
  partial discount is written. A preset remains available as the ungated
  alternative.
- **Discount applied to an order that is later voided or refunded.** The
  discount record travels with the order and appears in the end-of-day
  discount total only for orders that actually closed.
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

1. A cashier authenticates by PIN, opens a table order, adds an item with a
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
8. A preset discount applies with no prompt of any kind, and its audit entry
   names the preset ("Staff Meal 50%") rather than a bare number.
9. A free-form discount is refused when the manager-PIN prompt is cancelled,
   and succeeds with a valid manager PIN. Its record carries both the actor
   and the approver; a preset's carries only the actor.
10. Voiding an order on which nothing has been fired succeeds with no prompt
    and writes exactly one audit entry. Voiding an order holding a fired line
    raises the manager prompt and is refused when it is cancelled.
11. A fired-line void and a refund each fail without a manager PIN and
    succeed with one, each producing exactly one audit entry naming the
    actor, the approver, the reason, and the order.
12. Toggling an item to 86 removes it from order entry within the same
    session with no restart, and blocks firing an order holding it as a
    pending line.
13. A closed order's receipt reprints on demand with identical figures.
14. A refund on a closed order moves it to `REFUNDED`, and a second refund
    attempt on the same order is rejected.
15. An end-of-day close is refused while an order is open, and succeeds once
    that order is closed or voided.
16. The end-of-day report's sales, tax, service charge, discounts, refunds,
    voids, tender breakdown, and order count match a manual sum of that
    business day's orders.
17. Editing a menu item's price, or a discount preset's value, after an order
    was taken changes neither that order's total nor the closed day's report.
    Deactivating a preset still leaves it readable on orders that carry it.
18. The audit log contains one entry per whole-order void, fired-line void,
    discount, refund, approval, and PIN lockout in a test session, and
    contains no PIN values in any form.

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
- **Free-form discount gate.** Free-form amounts require a manager PIN while
  presets do not. An alternative is a threshold — ungated below some
  percentage or amount, gated above it — which would remove most manager
  prompts without leaving 100%-off open to anyone. Worth revisiting once
  there is real usage data on how often free-form entry is actually needed.
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
