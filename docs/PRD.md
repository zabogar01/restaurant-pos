# Product Requirements — MVP

Status: approved for planning
Design rationale: [specs/2026-09-07-restaurant-pos-mvp-design.md](superpowers/specs/2026-09-07-restaurant-pos-mvp-design.md)

Requirements are identified `FR-<group><n>` and referenced by the acceptance
criteria at the end. Implementation plans should cite these IDs.

## 1. Scope summary

The MVP is a **single-host vertical slice**, not a deployable floor system. It
runs entirely on the owner's local development machine: POS client, back
office, application server, and PostgreSQL. It supports one active interactive
POS workflow at a time, with the back office permitted to run alongside it.

**Two clients, one server.** The POS client is touch-first and tablet-shaped;
the back-office client is web and desktop-shaped. They are separate frontend
applications with separate sessions, served from one origin at `/pos/` and
`/back-office/` against one API, one modular-monolith server, one database,
and one transaction boundary. The split is in the clients, never in the data.

Table-service is the core flow; quick sale (no table, paid immediately) is a
variant of the same order model. Two authenticating roles, cashier and
manager, share the local client. One tax rate, tax-inclusive prices, optional
untaxed service charge. Cash, card, and custom-named tenders recorded
manually. Kitchen ticket and cancellation-ticket printing, no kitchen display.
No inventory, no integrations, no offline sync, no tips.

**What this MVP does not prove.** It validates the domain — order lifecycle,
money, approvals, audit, reporting. It does not validate multi-person floor
operation, a dedicated waiter role, concurrent terminals, external card
collection while another person edits an order, cross-terminal propagation,
device commissioning, or hardware resilience. Those belong to the
pre-production gate in [ROADMAP.md](ROADMAP.md).

## 2. Domain vocabulary

| Term | Meaning |
|---|---|
| Order | One bill. Type is `table` or `quick_sale`. Status is `OPEN`, `CLOSED`, `VOIDED`, or `REFUNDED` |
| Order line | One item on an order. State is `PENDING`, `FIRED`, or `VOIDED` |
| Fire | Send all `PENDING` lines to the kitchen as one printed ticket |
| Cancellation ticket | A correction document telling the kitchen that fired work is cancelled. Never a fire |
| 86 | Mark a menu item temporarily unavailable (`MenuItem.is_available = false`) |
| Preset | A manager-defined named discount, applied without approval |
| Tender | One recorded contribution to settlement. `Tender` is the entity name; "payment" may be used for the customer-facing workflow |
| Business day | The period between two end-of-day closes |
| ClientInstance | An opaque server-issued browser identifier used for UI continuity and telemetry. Not an authorization boundary |
| POS client | Touch-first tablet-shaped app at `/pos/`. Order entry through settlement |
| Back-office client | Web desktop-shaped app at `/back-office/`. Configuration, history, reporting, end-of-day |
| Session audience | `POS` or `BACK_OFFICE`, recorded on the server-side session. Decides which routes and timeout policy apply, never what a role may do |
| CheckoutLease | Server-side marker that settlement is in progress on an order, so back-office changes cannot invalidate an in-flight payment |
| Catalog version | Monotonic marker of menu and preset state, used to reject commands built on stale prices or options |

All boolean fields are `is_`-prefixed. Enum states such as `Order.status` stay
enums and do not acquire redundant booleans.

## 3. Functional requirements

### A. Identity and access

- **FR-A1** The MVP has two authenticating roles: cashier and manager. Each
  authenticating user has a unique six-digit numeric PIN. Kitchen remains a
  non-authenticating staff classification with no PIN and no application
  permissions. The waiter role is deferred beyond the MVP.
- **FR-A2** On the POS client, cashiers and managers authenticate by PIN. A
  correct PIN identifies the staff member and establishes a server-side actor
  context that expires after 90 seconds of inactivity or on explicit release.
- **FR-A2b** On the back-office client, managers authenticate into a
  conventional session with a 30-minute idle timeout, an eight-hour absolute
  lifetime, and explicit logout. Unsaved form state is preserved behind
  re-authentication. Background polling does not count as user activity.
- **FR-A2c** Every server-side session records an audience of `POS` or
  `BACK_OFFICE`, and each client presents its own cookie. POS routes accept
  POS sessions; back-office routes accept back-office sessions; shared read
  routes may accept either. A back-office session is never accepted as a POS
  actor context and never satisfies an inline POS approval. Audience decides
  client context and timeout policy only — role still decides what an actor
  may do, and a client-supplied header alone is never sufficient.
- **FR-A3** PINs are stored using Argon2id, never in plaintext, and never
  written to any log.
- **FR-A4** PINs are unique per user, so an audit actor is unambiguous.
- **FR-A5** PIN verification has two installation-wide throttle classes:
  `LOGIN` and `MANAGER_APPROVAL`. After five consecutive failures in either
  class, the server rejects further verification in that class for five
  minutes. Only a successful verification **in the same class** resets its
  counter — a successful cashier login must not reset failed manager-approval
  guesses. Throttle state is server-side and survives browser, application,
  and database restart. Unauthenticated login failures are security
  telemetry; failed and cancelled manager approvals remain actor-attributed
  audit entries. No PIN value is recorded in either store.
- **FR-A6** Manager approval is an inline prompt requiring a manager PIN at
  that moment. It authorises one specific action and does not persist.
- **FR-A7** On first contact the server issues the browser profile an opaque
  `ClientInstance` identifier in an HTTP-only cookie, with a server-side
  record. It identifies UI continuity and security telemetry only. It is not
  an authorization boundary, and clearing or replacing it does not bypass
  installation-wide PIN throttling.

### B. Configuration and management (back office, manager only)

All of section B lives in the back-office client. None of it ships to the POS.

- **FR-B1** Settings hold currency, minor-unit precision, tax rate, service
  charge rate, and the business details printed on receipts. Currency and
  minor-unit precision become immutable after the first order. Changes to tax
  or service-charge rates create a new settings version and affect only
  orders opened afterwards.
- **FR-B2** Manage tables: create, edit, and deactivate.
- **FR-B3** Manage users: create, assign role, set and reset PIN, deactivate.
  Deactivating a user or resetting their PIN from the back office invalidates
  that user's POS session on its next authenticated request.
- **FR-B4** Manage menu: categories, items, variants, modifiers, prices.
- **FR-B5** Manage discount presets: create, edit, deactivate.
- **FR-B7** Manage tender types: create, rename, and deactivate custom named
  methods alongside cash and card. B-24 makes this configuration, so a
  cashier never types a tender name as free text on the fastest screen in the
  product.
- **FR-B6** Toggle an item's 86 status.

### C. Menu

- **FR-C1** Items belong to a category and carry a tax-inclusive base price.
- **FR-C2** An item may offer single-select variants. A variant may have a
  positive or negative price delta. The resolved unit price is the greater of
  zero and the base price plus variant delta plus selected modifier deltas.
- **FR-C3** An item may offer modifiers: multi-select, each with a price
  delta of zero or more.
- **FR-C4** No nested modifier groups. No link between modifiers and stock.
- **FR-C5** An item with `is_available = false` cannot be added to any order.
- **FR-C6** An availability change made in the back office is reflected on the
  separately running POS client within three seconds without restart, via a
  two-second catalog-revision poll. The server independently revalidates
  availability when adding a line and when firing. An open selection dialog
  preserves the user's choices, marks the item unavailable, disables Add, and
  explains the change.
- **FR-C7** Menu, variant, modifier, price, and preset changes advance a
  catalog version. A POS command built on stale catalog data is rejected with
  `CATALOG_CHANGED` and the client refreshes, so a line is never added at a
  price other than the one displayed. Settings changes need no equivalent,
  because an order retains the settings version captured when it opened.
- **FR-C8** A `DiningTable` holding an `OPEN` order cannot be deactivated.
  Archiving or materially changing an item or preset never alters existing
  order snapshots.

### D. Order capture

- **FR-D1** A cashier opens a table order against a table that has no other
  `OPEN` order. A table holds at most one open order.
- **FR-D2** A cashier opens a quick-sale order, which has no table.
- **FR-D3** Lines may be added while the order is `OPEN`, including after an
  earlier fire.
- **FR-D4** Adding a line snapshots its customer-visible item, variant, and
  modifier names, component prices, and non-negative resolved unit price.
  Later menu edits never change an existing order.
- **FR-D5** A `PENDING` line may be edited or removed freely.
- **FR-D6** Order state is held server-side and survives a client or
  application restart.

### E. Kitchen printing

- **FR-E1** Firing collects every `PENDING` line, prints one kitchen ticket
  containing only those lines, and marks them `FIRED`.
- **FR-E2** A second fire prints only lines added since the previous fire.
- **FR-E3** A fire transaction marks its lines `FIRED` and saves the
  immutable kitchen ticket and print job before printer delivery begins.
  Delivery may become `PRINTED`, `FAILED`, or `UNKNOWN`. `FAILED` and
  `UNKNOWN` kitchen work are shown as persistent emergency incidents on
  **both** the POS and back-office clients, with an explicit reprint action,
  so a manager working in the back office cannot miss a failed kitchen ticket.
  The incident is application-wide, not actor-session-specific. Printing never
  blocks or rolls back the sale.
- **FR-E3b** The *presence* of an unresolved kitchen incident is visible on an
  unauthenticated POS lock screen; its *detail* requires a PIN. An incident
  cannot be missed simply because nobody is signed in, and order information
  is never shown to a room.
- **FR-E4** Firing is blocked while any `PENDING` line holds an item that is
  86'd, until that line is voided or the item is restored.
- **FR-E5** For a quick-sale order, firing and receipt printing both occur at
  close. A quick-sale order presents **no fire control at all** — settling
  fires it. One visible control meaning "send to kitchen" on a table order and
  nothing on a quick sale teaches the cashier the control is unreliable, and
  that lesson carries to the table order where it matters.
- **FR-E6** `FAILED` or `UNKNOWN` receipt output is shown as a lower-priority
  warning and is never presented with the same urgency as failed kitchen work
  or cancellation output.

### F. Discounts

- **FR-F1** Discounts are order-level. An order carries at most one.
- **FR-F2** A preset discount is applied by any authenticating staff member
  with no approval prompt.
- **FR-F3** A free-form discount requires a manager PIN.
- **FR-F4** Applying a discount snapshots the name, kind, and value onto the
  order.
- **FR-F5** A deactivated preset disappears from the picker but remains
  readable on orders that already carry it.
- **FR-F6** Every discount is audited. A preset records the actor; a
  free-form discount records the actor and the approver.
- **FR-F7** No discount applies itself. A staff member always chooses it.
- **FR-F8** An applied discount may be removed or replaced. The approval gate
  covers the **whole transition**: removing or replacing a free-form discount
  requires manager approval even if its replacement is a preset; removing or
  replacing a preset is ungated unless the replacement is free-form. Each
  successful change writes one audit entry containing before and after
  values.

### G. Tender and close

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
- **FR-G9** Tender entry remains a client-side draft until close. No `Tender`
  record is stored unless the complete plan settles the order exactly. The
  draft survives actor-session idle expiry within the same browser tab, and
  an actor must re-authenticate before close.
- **FR-G10** Closing a table order is rejected while any line remains
  `PENDING`.
- **FR-G11** A zero-total order closes with no `Tender` records, produces a
  receipt, counts as an order that reached `CLOSED`, and records zero
  revenue.
- **FR-G12** The MVP supports one active interactive POS workflow. The
  back-office client may operate concurrently. Back-office configuration
  commands never mutate order or tender state and must respect server-side
  snapshot, version, availability, and checkout-lease preconditions. While a
  tender draft is active, its POS tab disables add-line, discount change,
  fire, void, and competing settlement. That tab guard is UX only and is not a
  substitute for FR-G13. The two block the same five actions for different
  reasons and must never show the same message: the tab guard is the
  cashier's own doing and they can clear it, while a lease is another
  client's doing and they cannot.
- **FR-G13** Beginning settlement acquires a server-side `CheckoutLease` on
  the order. While active it blocks add-line, discount change, fire, void, and
  competing settlement, including from the back office. Reads are never
  blocked. The lease stores no tenders and does not change `Order.status`.
  A back-office 86 command affecting an item on a leased quick-sale order is
  rejected while the lease holds, naming the leased order.
- **FR-G14** A `CheckoutLease` is renewable for five minutes at a time and
  expires within five minutes after its client stops renewing. It survives
  application restart, resuming with its remaining wall-clock time rather than
  a fresh interval, computed from database time. It cannot remain active for
  more than 15 minutes without renewed actor authentication. A manager may
  take it over at any time after acknowledging that an external charge may
  already be in progress; takeover is audited and the displaced client's close
  is rejected. The holder may also release its own lease explicitly — a
  cashier must not wait five minutes because a customer changed their mind.
  Releasing a lease you hold moves no money and needs no approval.

### H. Void and refund

- **FR-H1** Void applies to an `OPEN` order or to lines on one. Refund
  applies only to a `CLOSED` order. The UI must not present them as the same
  action.
- **FR-H2** Removing a `PENDING` line requires no approval and is not
  audited.
- **FR-H3** Voiding an order with no `FIRED` lines requires no approval and
  is audited.
- **FR-H4** Voiding a `FIRED` line, or an order holding one, requires a
  manager PIN and reason and is audited. The same transaction creates one
  immutable kitchen cancellation ticket containing only the previously fired
  work being cancelled. Cancellation printing occurs after commit and never
  gates or rolls back the void. `FAILED` or `UNKNOWN` cancellation delivery
  creates an emergency print incident.
- **FR-H5** A full refund reverses a closed order and records one or more
  `RefundTender` allocations selected by the manager. The default allocation
  reproduces each original `Tender`'s **effective contribution**, defined as
  amount tendered minus change given. Allocations must sum exactly to the
  order total. Partial refunds are out of scope. Requires a manager PIN and a
  reason, and is audited.
- **FR-H5b** A zero-total order is **not refundable**. It took no money, so
  there is nothing to return, and a zero-value allocation would be a fake
  money record. The refund action is absent rather than disabled on such an
  order — a disabled control invites a manager to hunt for an override that
  does not exist.
- **FR-H6** An order may be refunded once. `REFUNDED` is terminal.
- **FR-H7** Voids and refunds against a closed business day are blocked.

### I. Business day and reporting (back office)

End-of-day close, the stored reports, and the audit viewer live in the
back-office client.

- **FR-I1** A business day runs from one end-of-day close to the next. An
  order belongs to the business day open when it was created.
- **FR-I2** End-of-day close is refused while any order is still `OPEN`, and
  lists those orders. The close command queries authoritative server state
  inside its own transaction, so back-office ownership does not weaken this:
  the manager switches to the POS to settle or void those orders, then
  retries.
- **FR-I3** A successful close stores an immutable report snapshot, closes
  the business day, and opens the next.
- **FR-I4** A second close of the same business day is rejected. The stored
  report remains re-printable.
- **FR-I5** The immutable report contains:
  - Gross sales: the sum of `Order.total` for every order that reached
    `CLOSED`, including orders later refunded.
  - Refunds as a separate total, and net sales equal to gross minus refunds.
  - Gross, refund-reversal, and net figures for included tax, service charge,
    and discounts.
  - Gross effective tender, refund allocation, and net movement by tender
    type.
  - Order count equal to every order that reached `CLOSED`, with
    refunded-order count shown separately.
  - Whole-order void count and value, where value is the order total
    immediately before void.
  - Fired-line void count, tax-inclusive line snapshot value, and the
    before/after reduction in order total. These differ whenever an
    order-level percentage discount or service charge applies.

  A refunded order's original discount remains in gross discounts and is
  shown again as a refund reversal, so net discounts reconcile without
  rewriting history.

### J. Audit

- **FR-J1** The audit log is append-only. Entries are never edited or
  deleted.
- **FR-J2** An entry records the initiating actor, optional approver, action
  and outcome, subject and order reference where applicable, required
  business reason where applicable, timestamp, and before/after amounts.
- **FR-J3** Audited actions are whole-order void, fired-line void, discount
  apply/replace/remove, refund, manager takeover of a `CheckoutLease`,
  back-office reprint of a kitchen ticket (naming the actor, the order, and
  the round reprinted), and every manager-approval outcome. A
  successful approved action creates **one combined entry** naming actor and
  approver. A failed or cancelled approval creates one entry naming the
  initiating actor with approver null. Unauthenticated PIN failures and
  throttle cooldowns are security telemetry, not audit entries, because they
  have no identified actor.
- **FR-J4** No PIN value appears in the audit log or in security telemetry,
  in any form.

## 4. Money rules

Prices are **tax-inclusive**: the price shown is the price paid. The tax line
is derived from the total, never added to it. The service charge is **not
taxed**.

This is the **"nett"** convention, confirmed by the owner. Indonesian "++"
billing — tax-exclusive prices with the service charge itself taxed under PB1,
a regional restaurant tax rather than PPN — was considered and deliberately
not chosen. Both conventions are current in Indonesia; this installation uses
nett, and every figure below follows from that.

**This installation: IDR, minor-unit precision 0.** Whole rupiah, no decimal
separator. The worked example below is written in generic minor units so the
arithmetic reads the same at any precision.

- **FR-M1** Currency and minor-unit precision are configured once (2 for USD
  or EUR, 0 for IDR or JPY) and become immutable after the first order.
- **FR-M2** All money is stored as integers in minor units. Binary floating
  point is never used for money at any layer. Money and exact rate arithmetic
  use an integer-exact type behind a single calculation module; canonical
  base-10 integer strings cross the API boundary.
- **FR-M3** Computed fractions round **half-up** at the point of becoming a
  stored or displayed value.
- **FR-M4** Tax is computed once at order level from the discounted subtotal,
  never summed from per-line figures.
- **FR-M5** Bounds: rate precision one part per million; maximum quantity 99
  per line, whole numbers only; maximum line total, order total, and single
  tender 99,999,999 minor units; maximum change 9,999,999 minor units. The
  settlement UI validates the change ceiling before committing and shows the
  maximum acceptable cash amount. Discounts are 0–100%; a fixed discount is
  capped at the subtotal; no order may reach a negative total.

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

- **NFR-1** The POS client, back-office client, application server, and
  PostgreSQL all run on the owner's local development machine. Both clients
  are served from **one HTTPS origin on localhost**, path-separated as
  `/pos/` and `/back-office/`, with APIs at `/api/pos/…` and
  `/api/back-office/…`. A startup guard rejects any non-loopback listener.
  Printers may remain reachable over the local network. No cloud dependency
  is used.
- **NFR-2** Printing targets ESC/POS-compatible thermal printers. Kitchen and
  receipt output may share one device.
- **NFR-3** The MVP supports one local host and one active interactive POS
  workflow, with one back-office client permitted concurrently. Multiple POS
  terminals and simultaneous floor operators are deferred. The server still
  enforces aggregate versions, idempotency, row locks, and command
  preconditions against duplicate, stale, or re-entrant commands.
- **NFR-4** Concurrent commands are serialized by the server. Harmless edits
  to `PENDING`-line details may use last-successfully-committed write. Fire,
  discount change, settlement, void, refund, receipt allocation, and
  business-day close use version and precondition checks and reject stale
  conflicts.
- **NFR-5** The two clients are independently bootstrapped frontend bundles
  with separate route manifests, session cookies, and layouts, built from one
  repository and served from one deployment. They share API schemas, the
  money module, validation, authentication primitives, and design tokens.
  Touch components and data-table components stay independent. A single
  responsive application that shows or hides navigation by role or viewport
  does not satisfy this requirement.

## 6. Edge cases the build must handle

- Kitchen or receipt printer offline or out of paper — FR-E3, FR-E6, FR-G8.
- Tenders below the total — closing blocked, remaining balance shown.
- Non-cash tender above the remaining balance — rejected, maximum shown.
- Cash over-tender above the change ceiling — rejected before commit, with
  the maximum acceptable cash shown.
- Manager approval requested with no manager available — blocked, no partial
  state written.
- Void attempted on an already-fired line — routed to the approval path
  automatically.
- Refund attempted on an already-refunded order — rejected.
- Item 86'd while a `PENDING` line holds it — firing blocked (FR-E4).
- Item 86'd while a `FIRED` line holds it — no effect.
- Preset edited or deactivated while an open order carries it — order
  unaffected, it holds a snapshot.
- Discount on an order later voided or refunded — see FR-I5 gross/reversal.
- Actor-session expiry while a tender draft exists — draft survives in the
  same tab, re-authentication required before close.
- Back office 86's an item on a leased quick-sale order — rejected while the
  lease holds, naming the leased order (FR-G13).
- Back office deactivates a user or resets a PIN mid-shift — that user's POS
  session is invalidated on its next authenticated request (FR-B3).
- POS command built on stale catalog data — rejected with `CATALOG_CHANGED`,
  client refreshes; no line is added at a stale price (FR-C7).
- Back office attempts to deactivate a table holding an open order — rejected
  (FR-C8).
- Checkout client stops renewing, or the application restarts while a lease is
  held — lease resumes with remaining wall-clock time, never a fresh interval
  (FR-G14).
- Manager takes over a lease while an external card charge may be in flight —
  takeover is audited, displaced client's close is rejected (FR-G14).
- Back-office session used against a POS route, or vice versa — rejected on
  audience, regardless of role (FR-A2c).
- Client or application restart mid-order — open orders persist (FR-D6).
- Application restart with pending or dispatching print jobs — dispatching
  jobs become `UNKNOWN` on recovery.
- End-of-day attempted with open orders — refused with a list (FR-I2).
- Five consecutive failed PIN verifications in a class — that class is
  rejected for five minutes. Unauthenticated failures are security telemetry
  with no staff actor and no PIN value.
- `UNKNOWN` cancellation-ticket delivery — emergency incident, operator
  checks the printer before reprinting.
- Zero-total close — no `Tender` rows, receipt still produced.
- Cash refund — defaults to effective contribution, not cash handed over.

## 7. Acceptance criteria

Each is observable. The MVP is done when all pass. Test level is noted where
the browser is the wrong place to prove it.

| # | Criterion | Covers |
|---|---|---|
| AC-1 | A cashier authenticates by PIN, opens a table order, adds an item with a variant and a priced modifier, fires it, and the kitchen ticket prints containing exactly that line | FR-A2, C2, C3, E1 |
| AC-2 | Adding two more lines and firing again prints a second ticket containing **only** the two new lines | FR-D3, E2 |
| AC-3 | Voiding an unfired line succeeds with no prompt; voiding a fired line raises a manager-PIN prompt and is refused when cancelled | FR-H2, H4 |
| AC-4 | The worked example reproduces exactly: subtotal 16.50, discount 1.65, tax-included 1.35, service charge 0.74, total 15.59 *(unit and property tests)* | FR-M1–M5 |
| AC-5 | 20.00 cash against a 15.59 total shows 4.41 change, closes the order, and records 15.59 as revenue — not 20.00 | FR-G4, G6 |
| AC-6 | A card tender of 20.00 against a 15.59 balance is rejected, with 15.59 offered as the maximum | FR-G3 |
| AC-7 | A split of 10.00 card plus 5.59 cash closes the order; a split leaving any balance does not | FR-G2, G5 |
| AC-8 | A preset discount applies with no prompt, and its audit entry names the preset rather than a bare number | FR-F2, F6 |
| AC-9 | A free-form discount is refused when the manager prompt is cancelled and succeeds with a valid PIN; its record carries actor and approver, a preset's carries only the actor | FR-F3, F6 |
| AC-10 | Voiding an order with nothing fired succeeds with no prompt and writes exactly one audit entry; voiding an order holding a fired line raises the manager prompt | FR-H3, H4 |
| AC-11 | A fired-line void and a refund each fail without a manager PIN and succeed with one, each producing one combined audit entry naming actor, approver, reason, and order | FR-H4, H5, J2 |
| AC-12 | A manager toggles an item to 86 **in the back office**; the separately running POS client **disables it in place** for new order entry within three seconds without restart — greyed, marked, and unselectable, never removed, so the grid does not reflow under a finger already moving. An already-open selection dialog preserves the user's choices, marks the item unavailable, disables Add, and explains the change. Adding and firing independently reject unavailable items *(two concurrent browser contexts)* | FR-C5, C6, E4 |
| AC-13 | A closed order's receipt reprints on demand with identical figures | FR-G7 |
| AC-14 | A refund moves a closed order to `REFUNDED`; a second refund attempt is rejected | FR-H5, H6 |
| AC-15 | End-of-day close is refused while an order is open, and succeeds once that order is closed or voided | FR-I2 |
| AC-16 | Report gross, reversal, and net figures — sales, tax, service charge, discounts, tender movement, order and void counts — match manual calculation *(integration tests)* | FR-I5 |
| AC-17 | Editing a menu price or a preset value after an order was taken changes neither that order's total nor the closed day's report; a deactivated preset stays readable on orders carrying it *(integration tests)* | FR-D4, F4, F5 |
| AC-18 | The audit log contains one combined entry per successful approved action naming actor and approver; one entry per failed or cancelled approval naming actor with approver null; and entries for whole-order void, fired-line void, discount apply/replace/remove, and refund. Unauthenticated PIN failures and throttle cooldowns appear only in security telemetry. Neither store contains a PIN value in any form *(integration, permission, and log-scan tests)* | FR-J3, J4 |
| AC-19 | Five failed PIN verifications in a class cause a five-minute cooldown for that class only, surviving restart; a successful cashier login does not reset the manager-approval counter; clearing `ClientInstance` does not reset either | FR-A5, A7 |
| AC-20 | A tender draft survives 90-second actor-session expiry in the same tab and requires re-authentication at close | FR-G9 |
| AC-21 | While a tender draft is active, its tab disables add-line, discount change, fire, void, and competing settlement | FR-G12 |
| AC-22 | A fired-line void creates exactly one cancellation ticket containing only the cancelled work, visually distinct from a work ticket | FR-H4, B-16 |
| AC-23 | A kitchen print failure appears as an emergency incident while a receipt failure appears at lower urgency; they are never presented identically | FR-E3, E6 |
| AC-24 | A zero-total order closes with no `Tender` row, produces a receipt, and records zero revenue | FR-G11 |
| AC-25 | A 20.00 cash / 4.41 change sale defaults to a 15.59 cash `RefundTender` allocation, not 20.00 | FR-H5 |
| AC-26 | A negative variant delta snapshots a resolved unit price of zero rather than a negative value | FR-C2, D4 |
| AC-27 | A POS session is rejected on a back-office route and a back-office session is rejected on a POS route, regardless of role. A manager holding an active back-office session must still enter a PIN for an inline POS approval | FR-A2c, A6 |
| AC-28 | A POS actor context expires after 90 seconds idle; a back-office session survives 30 minutes idle and expires at 8 hours absolute. Background polling does not extend either | FR-A2, A2b |
| AC-29 | While a `CheckoutLease` is active, a back-office 86 affecting that leased quick-sale order is rejected and names the order; add-line, discount change, fire, and void are blocked; reads still succeed | FR-G13 |
| AC-30 | A lease survives application restart with its remaining wall-clock time rather than a fresh interval, and expires within five minutes of the client ceasing to renew. Manager takeover is audited and the displaced client's close is rejected | FR-G14, J3 |
| AC-31 | A POS command built on a stale catalog version is rejected with `CATALOG_CHANGED` and no line is added at the stale price | FR-C7 |
| AC-32 | Deactivating a user in the back office invalidates that user's POS session on its next authenticated request. Deactivating a table holding an open order is rejected | FR-B3, C8 |
| AC-33 | A failed kitchen ticket raises the emergency incident in **both** clients; a failed receipt appears at lower urgency in both | FR-E3, E6 |

## 8. Out of scope for MVP

Waiter as a distinct role. Multiple POS terminals and simultaneous floor
operators. Provisioned terminal identity, commissioning, and revocation. Native
or installable mobile applications — both clients are browser-based in the MVP.
LAN access, TLS beyond localhost, and certificate distribution. Server appliance, UPS, backup destination, and
production recovery testing. Multi-location. Queue numbers and pickup
displays. Nested modifier groups. Item-level discounts and comps. Bill
splitting by guest. QR and external terminal payments. Partial refunds.
Kitchen display screens. Offline queueing and sync. Inventory. Item-level,
labor, and hourly reporting. Jurisdiction-specific tax packs. **Tip capture —
definitively excluded.** Table transfer, merge, and split. Cash-drawer float
and till reconciliation. Customer records and loyalty. Auto-applying or
scheduled discount campaigns. More than one discount per order.

## 9. Open questions

1. **Receipt content and fiscal requirements.** Blocks the final receipt
   schema, numbering format, mandatory fields, refund documents, retention,
   and reprint markings. The immutable `Receipt` entity can still be designed.
   The tax and currency parts of this question are now closed — see below.
2. **Post-close corrections.** Blocks final Phase 5 behavior. Corrections
   that alter a closed day require a new adjustment record and next-day
   reporting; mutating the closed report would violate B-9.
3. **Maximum tax and service-charge rates.** Rate precision is settled at one
   part per million; the permitted range is not.

### Closed since the first draft

- **Tax model.** Nett, not "++". See section 4.
- **Currency and precision.** IDR at precision 0.
- **Restaurant time zone.** WIB (Asia/Jakarta, UTC+7), with no daylight
  saving. Every stored and displayed time is in WIB, shown as 24-hour
  `HH:MM`. A business day runs 00:00–23:59 WIB.
- **Implementation stack.** TypeScript, Node, Fastify, React, Vite, and
  PostgreSQL. Recorded here only so this document does not contradict the
  Phase 0 plan; the stack itself belongs to the architecture, not to the
  product requirements.
