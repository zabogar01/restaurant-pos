# Roadmap

Delivery sequence for the MVP, then the pre-production gate and the horizons
beyond it. Requirement IDs refer to [PRD.md](PRD.md).

The ordering principle: **build the things everything else depends on first,
and make every phase end in something demonstrable.** Money primitives and the
audit log come before anything that touches money, because retrofitting
integer arithmetic or an audit trail into working code is far more expensive
than starting with them.

**What the MVP is.** A single-host vertical slice on the owner's local
machine, exercising the full domain through two roles and **two clients** — a
touch-first POS and a desktop back office, sharing one server and one
database. It is explicitly not a deployable floor system; see the
pre-production gate below for what stands between this and a real restaurant.

The two-client split is built now rather than later. Extracting a back office
from a combined frontend after it has accumulated route, session, and layout
assumptions costs far more than starting with two shells.

## MVP phases

### Phase 0 — Foundations

Money, identity, audit. Nothing user-facing ships here, but every later phase
depends on it.

- Money primitives: integer minor units, half-up rounding, configured
  precision, exact rate arithmetic behind one calculation module (FR-M1–M3)
- Settings: currency, tax rate, service charge rate, business details (FR-B1)
- Cashier and manager roles; kitchen as a non-authenticating classification
  (FR-A1)
- Six-digit unique PINs, Argon2id hashing (FR-A3, A4)
- Installation-wide `LOGIN` and `MANAGER_APPROVAL` throttle buckets, durable
  across restart (FR-A5)
- `ClientInstance` issuance for UI continuity and telemetry (FR-A7)
- HTTPS on localhost, one origin, path-separated `/pos/` and `/back-office/`,
  with a startup guard rejecting non-loopback listeners (NFR-1)
- Two frontend entry points and application shells (NFR-5)
- Two session types with their own cookies and timeout policies: POS 90-second
  idle, back office 30-minute idle and 8-hour absolute (FR-A2, A2b)
- Session-audience enforcement on API routes (FR-A2c)
- Shared API schema, money, validation, auth primitive, and design-token
  packages (NFR-5)
- Two-client test harness running concurrent browser contexts
- PIN authentication and the inline manager-approval prompt (FR-A2, A6)
- Append-only audit log, separated from unauthenticated security telemetry
  (FR-J1, J2)
- Failed and cancelled approval evidence (FR-J3)

**Demonstrable:** a manager sets rates in the back office and staff
authenticate at the POS, each with its own session behaviour. Failed PINs trip
the correct throttle bucket and appear in telemetry, not the audit log. A
session from one client is refused by the other.

**Depends on nothing. Everything depends on it.**

### Phase 1 — Back office and catalog

Everything a manager sets up before a single order exists. All of it lives in
the back-office client.

- Desktop back-office navigation and dense management layouts
- Categories, items, variants, modifiers, prices (FR-B4, C1–C4)
- 86 toggle (FR-B6, C5)
- Tables, with deactivation blocked while an order is open (FR-B2, C8)
- Discount presets (FR-B5)
- Users, with deactivation and PIN reset invalidating POS sessions (FR-B3)
- Catalog-revision propagation into the POS client, two-second poll (FR-C6)
- Catalog-version handling and `CATALOG_CHANGED` rejection (FR-C7)

**Demonstrable:** a real menu is loaded in the back office and browsable at
the POS; an 86 in one client reaches the other within three seconds.
**AC-12, AC-31, AC-32** pass here.

### Phase 2 — Order capture and totals

The order model and the arithmetic, without the kitchen or the money.

- Open table and quick-sale orders, one open order per table (FR-D1, D2)
- Add, edit, remove `PENDING` lines (FR-D3, D5)
- Price snapshotting with a non-negative resolved-unit-price floor
  (FR-C2, D4)
- `SettingsVersion` captured when an order opens (FR-B1)
- Server-side order persistence across restarts (FR-D6)
- Totals: subtotal, discount, derived tax, service charge (FR-M4)
- Monetary and rate bounds (FR-M5)
- Preset and free-form discounts, with the free-form gate (FR-F1–F7)
- Discount replacement and removal under whole-transition gating (FR-F8)
- Zero-total order behavior (FR-G11)
- Void a pending line; void an unfired order (FR-H2, H3)

**Demonstrable:** an order is built on screen and its total matches the
worked example exactly. **AC-4, AC-8, AC-9, AC-10, AC-24, AC-26** pass here.

### Phase 3 — Kitchen printing

- Fire action: collect `PENDING`, print one ticket, mark `FIRED` (FR-E1)
- Round-based firing — second ticket carries only new lines (FR-E2)
- ESC/POS printing, transactional print outbox, print after commit (FR-E3)
- `PRINTED` / `FAILED` / `UNKNOWN` delivery states and recovery (FR-E3)
- Persistent emergency incidents for kitchen work, rendered in **both**
  clients; lower-priority class for receipts, which arrive in Phase 4
  (FR-E3, E6)
- Firing blocked on 86'd pending lines (FR-E4)
- Two-second availability polling, three-second AC-12 budget (FR-C6)
- Fired-line and fired-order voids behind the manager gate (FR-H4)
- Kitchen cancellation tickets for fired-line and fired-order voids (FR-H4)

**Demonstrable:** the full order loop — order, fire, add a round, fire again,
cancel fired work — with correct paper. **AC-1, AC-2, AC-3, AC-22, AC-23,
AC-33** pass here.

**Risk:** printer integration is the phase most likely to surprise. Prove the
ESC/POS path against real hardware early rather than at the end of the phase.

### Phase 4 — Tender, close, and refund

- Tender types including custom named methods (FR-G1)
- Split payment across several tenders (FR-G2)
- Non-cash tender capped at remaining balance (FR-G3)
- Cash over-tender, change, and the change ceiling (FR-G4, G6, M5)
- Atomic tender plan: no `Tender` rows before close (FR-G9)
- Tab-local tender draft surviving actor-session expiry, re-authentication at
  close (FR-G9)
- Single-tab mutation guard during tender collection (FR-G12)
- Server-side `CheckoutLease`: acquisition, TTL, renewal, restart persistence
  with remaining wall-clock time, audited manager takeover, displaced-client
  rejection (FR-G13, G14)
- Back-office 86 rejected against a leased quick-sale order (FR-G13)
- Close on exact settlement (FR-G5)
- Table close rejected with `PENDING` lines (FR-G10)
- Zero-total close with an empty tender set (FR-G11)
- Receipt print and reprint, resilient to printer failure (FR-G7, G8)
- Quick-sale close: fire and receipt together (FR-E5)
- Full-order refund with `RefundTender` allocations by effective original
  contribution (FR-H5, H6)

**Demonstrable:** money end to end, both order types, with the back office
open alongside and unable to invalidate an in-flight payment. **AC-5, AC-6,
AC-7, AC-11, AC-13, AC-14, AC-20, AC-21, AC-25, AC-29, AC-30** pass here.

Tip capture is definitively excluded and no longer gates this phase.

**Why the lease is here.** It was cut with the single-machine reduction and
returned with the two-client split: a manager can now 86 an item in the back
office while the POS holds a quick-sale tender draft and an external card
charge is in flight. Without the lease, close fails under B-17 after the
customer has already been charged.

### Phase 5 — Business day and end-of-day (back office)

- Business day lifecycle, orders attributed to the open day (FR-I1)
- End-of-day close, reports, and the audit viewer built in the back-office
  client (FR-I2–I5, FR-J)
- Close refused while orders are open (FR-I2)
- Immutable report snapshot, next day opened (FR-I3, I4)
- Gross, reversal, and net reporting: sales, tax, service charge, discounts,
  tender movement, order count, refunded count, whole-order and fired-line
  void metrics (FR-I5)
- Voids and refunds blocked against a closed day (FR-H7)

**Demonstrable:** a full simulated trading day closes and reconciles.
**AC-15, AC-16** pass here.

### Phase 6 — Hardening and acceptance

- Every edge case in PRD Section 6 covered by a test
- Audit completeness sweep, including the no-PIN scan across audit and
  telemetry (FR-J3, J4)
- Throttle behavior under restart, and `ClientInstance` reset (AC-19)
- Snapshot immutability verified against later edits (AC-17)
- Session-audience isolation across both clients (AC-27, AC-28)
- Full acceptance pass, AC-1 through AC-33

Test-level traceability: AC-4 is unit and property tests; AC-16 and AC-17 are
PostgreSQL-backed integration tests; AC-18 is integration, permission, and
log-scan tests. Browser tests cover workflows and conflict presentation, not
arithmetic.

**Demonstrable:** the MVP is done.

## Sequencing notes

- Phases 0 and 1 can overlap once money primitives exist.
- Phase 2 must complete before Phase 3: firing operates on lines that Phase 2
  defines.
- Phases 3 and 4 both depend on Phase 2 and neither depends on the other,
  though receipt output in Phase 4 reuses the Phase 3 print infrastructure.
- Phase 5 depends on Phase 4 — there is nothing to report on until orders
  close.

## Pre-production gate

Everything below was **cut from the MVP, not cancelled**. None of it may be
skipped before the application is reachable from another device or used in a
real restaurant. The MVP's own documents state plainly that it is not
production-ready; this gate is what changes that.

- Managed kiosk terminals, purchased and commissioned
- Provisioned, revocable terminal identity replacing `ClientInstance`
- Extending the `CheckoutLease` from one POS workflow to genuine multi-terminal
  contention — the lease itself ships in MVP Phase 4
- LAN HTTPS, certificate authority state, persistence, and per-terminal trust
- Native or installable mobile POS packaging, if the browser client proves
  insufficient on real tablets
- Server appliance
- UPS
- Backup destination and tested restore
- Multi-terminal print-incident propagation
- Cross-terminal 86 propagation
- Real floor concurrency and waiter-role validation

The last item matters most. The MVP validates the domain through one combined
cashier role on one machine. It does not prove that a waiter and a cashier can
work at once, that an external card charge survives another person editing the
order, or that device credentials can be revoked. Those are the questions this
gate exists to answer.

## After the MVP

Grouped by how soon they are likely to matter, not committed to dates.

### Horizon 1 — the gaps real service will expose first

Dedicated waiter role. Bill splitting by guest. Item-level discounts and
complimentary items. Partial and line-item refunds. Cash-drawer float and till
reconciliation. Table transfer, merge, and split. Reopening a closed order.

These correspond to real situations the MVP forces staff to work around.

### Horizon 2 — depth on what already exists

Kitchen display screen. Inventory: stock counts, deduction on sale, low-stock
alerts. Richer reporting: item-level sales, hourly breakdown, labor.
Scheduled and auto-applying discount campaigns. Multiple discounts per order.
Tip capture, if the market ever demands it.

Each deepens a capability the MVP has in shallow form.

### Horizon 3 — breadth

Multi-location with per-branch menus, pricing, and consolidated reporting.
Offline operation with queueing and conflict resolution. Payment
integrations: QR, external terminals, gateways. Jurisdiction-specific tax
packs and mandated receipt formats. Customer records and loyalty.

These change the architecture and each deserves its own design cycle. Offline
sync and multi-location both alter assumptions the MVP deliberately builds on.
