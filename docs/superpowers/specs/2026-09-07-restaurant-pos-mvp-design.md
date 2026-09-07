# Restaurant POS MVP Design

Date: 2026-09-07
Status: Approved for planning

## Context

Single-location restaurant POS supporting mixed table-service and quick-sale
(counter/takeaway) order types. This document captures the MVP scope agreed
through a structured interview, the explicit exclusions, and the rules the
implementation must satisfy.

## 1. MVP Capabilities

- Single location, table-service core plus a quick-sale variant (no table,
  pay immediately) built on the same order model.
- Menu structure: categories, items, single-select variants (price-affecting,
  e.g. size), multi-select modifiers (e.g. "no onion"). No nested modifier
  groups, no modifier-to-inventory linkage.
- Four roles: waiter, kitchen, cashier, manager (see Section 3).
- Order lifecycle: open -> sent to kitchen (ticket printed) -> served -> paid
  -> closed.
- Order-level discount (percentage or fixed amount), requires manager
  approval.
- Payments: cash, card, and custom-named tender types, all recorded manually
  (no payment gateway or terminal integration). Multiple tenders may be
  split across a single order.
- Voids: pre-fire void (waiter, no approval needed) and post-fire or
  post-payment void (requires manager approval).
- Full-order refund only, manager-approved, reason recorded.
- Receipt reprint, available to cashier or manager.
- Kitchen ticket printer only (no kitchen display screen).
- Manual "86" (unavailable) toggle per menu item.
- End-of-day summary report: total sales, tax collected, service charge
  collected, discounts given, refunds/voids total, breakdown by tender type,
  count of orders.
- Minimal append-only audit log covering voids, discounts, refunds, manager
  approvals, and logins.
- Generic flat-rate VAT/GST-style tax plus an optional flat service-charge
  percentage, applied at the order level. Simple itemized receipt.
- Local-area-network architecture: POS terminals, printer, and database run
  on the local network with no cloud dependency for core operation.

## 2. Explicit Non-Goals (Post-MVP)

- Multi-branch / multi-location support.
- Quick-service queue numbers or pickup-counter display.
- Nested modifier groups or modifier-level inventory linkage.
- Item-level (line-level) discounts or complimentary items.
- Bill splitting by guest (dividing one order into separate checks).
- QR payment or external payment-terminal integration.
- Partial or line-item refunds.
- Kitchen display screen (KDS).
- Offline order queueing and conflict-resolution sync.
- Inventory stock counts, purchasing, or low-stock alerts.
- Item-level, labor, or hourly-breakdown reporting.
- Jurisdiction-specific tax rules: per-item tax rates, tax exemptions, or
  mandated receipt fields for a specific country/region.

## 3. User Roles

| Role | Key permissions |
|---|---|
| Waiter | Open order, add/edit items pre-fire, send order to kitchen, pre-fire void, close and take payment on an order |
| Kitchen | View and print kitchen tickets |
| Cashier | Take payment on any order (single or split tender), reprint receipt, open quick-sale orders |
| Manager | All of the above, plus: approve discounts, approve post-fire voids, approve refunds, toggle item 86 status, view end-of-day report, view audit log |

## 4. Critical Workflows

**Table order**
Waiter opens a table order, adds items (selecting variant and modifiers as
applicable), sends the order to the kitchen (prints a ticket), may add
further items in additional rounds, then a waiter or cashier takes payment
(single or split tender) to close the order and print a receipt.

**Quick sale**
Cashier opens a quick-sale order (no table), adds items, takes payment
immediately, prints a kitchen ticket and a customer receipt, and the order
closes.

**Pre-fire void**
Waiter removes an item from an order before it has been sent to the
kitchen. No approval required; not logged beyond the normal order edit.

**Post-fire void or refund**
Requires manager approval (PIN or login). The action and reason are
recorded in the audit log and reflected in the end-of-day report.

**Discount**
Waiter or cashier applies a percentage or fixed-amount discount to the
order total. Requires manager approval before it takes effect; the approval
is logged.

**86 an item**
Manager toggles an item to unavailable. The item is immediately hidden or
disabled on order-entry screens for new orders.

**End-of-day close**
Manager triggers the end-of-day report. The system totals all orders closed
that day and displays/prints the summary described in Section 1.

## 5. Business Rules

- Tax rate and service-charge percentage are each configured once, at
  setup, and apply to every order.
- Discounts are order-level only and require manager approval before being
  applied.
- Order total is computed as: (subtotal - discount) with service charge and
  tax applied on top, in a fixed, explicit order (see Section 8 -- exact
  sequencing of service charge versus tax is an unresolved decision that
  must be confirmed before implementation, since it changes every receipt
  total).
- A multi-tender payment must sum exactly to the order total before the
  order can be closed.
- Any post-fire void or refund requires manager approval and a recorded
  reason.
- An item toggled to 86 cannot be added to new orders, but remains visible
  (visually marked, e.g. grayed out) on any order that already contains it.
- Audit log entries are append-only: never edited or deleted after
  creation.

## 6. Failure and Edge Cases

- **Kitchen printer offline or out of paper when an order fires**: the
  order still saves as sent; the UI shows a print-failed warning; a manual
  reprint action is available.
- **Tender sum does not equal order total**: closing the order is blocked;
  the UI shows the remaining or overpaid amount.
- **Manager approval requested but no manager is available to authenticate**:
  the action is blocked and the order remains in its prior state.
- **Void attempted on an item that has already been prepared or served**:
  the system routes this through the post-fire approval path regardless of
  who initiates it.
- **Refund attempted on an order that has already been refunded**: blocked.
- **Concurrent edits to the same open order from two terminals**: resolved
  as last-write-wins for MVP, acceptable given a single location and small
  terminal count (flagged in Section 8 if stricter locking is wanted).
- **Application or terminal restart while an order is open**: open orders
  persist server-side and are not lost, since order state is not held only
  in terminal memory.

## 7. Observable Acceptance Criteria

- A waiter can open a table order, add an item with a variant and a
  modifier, send it to the kitchen, and see the ticket printed.
- A cashier can open a quick-sale order, add items, take a split cash-plus-
  card payment, and close it once tenders sum to the total.
- A manager-approval gate blocks an unapproved discount, post-fire void, or
  refund attempt, and the action succeeds once approved.
- A closed order's receipt can be reprinted on demand.
- Toggling an item to 86 removes it from the "add item" list within the
  same session, with no restart required.
- An end-of-day report for a test day shows totals (sales, tax, service
  charge, discounts, refunds, tender breakdown, order count) that match a
  manual sum of that day's closed orders.
- The audit log contains one entry per void, discount, refund, approval,
  and login performed during a test session, each recording actor, action,
  timestamp, and order reference.

## 8. Unresolved Decisions

- **Service charge vs. tax sequencing**: whether service charge is
  calculated on the discounted subtotal before tax, or tax is calculated
  first -- needs explicit confirmation before implementation, since it
  affects every receipt total.
- **Manager approval mechanism**: PIN entry versus full username/password
  login -- affects hardware and UX (numeric keypad vs. credential form).
- **Reopening closed orders**: whether a closed order can ever be reopened
  (e.g., a customer returns before end-of-day) or whether refund is the
  only path back to a corrected state.
- **Receipt content and format**: exact business-info fields, footer text,
  and logo placement -- deferred to the design/build phase.
- **Multi-terminal concurrency**: accepted as last-write-wins for MVP
  unless stricter locking is required before implementation begins.
