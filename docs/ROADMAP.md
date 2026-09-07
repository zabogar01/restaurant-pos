# Roadmap

Delivery sequence for the MVP, then the horizons beyond it. Requirement IDs
refer to [PRD.md](PRD.md).

The ordering principle: **build the things everything else depends on first,
and make every phase end in something demonstrable.** Money primitives and
the audit log come before anything that touches money, because retrofitting
integer arithmetic or an audit trail into working code is far more expensive
than starting with them.

## MVP phases

### Phase 0 — Foundations

Money, identity, audit. Nothing user-facing ships here, but every later phase
depends on it.

- Money primitives: integer minor units, half-up rounding, configured
  precision (FR-M1–M3)
- Settings: currency, tax rate, service charge rate, business details (FR-B1)
- Users, roles, PIN hashing, lockout (FR-A1–A5)
- PIN authentication and the inline manager-approval prompt (FR-A2, A6)
- Append-only audit log (FR-J1, J2)

**Demonstrable:** a manager sets rates, creates staff, and staff authenticate.
Failed PIN attempts lock out and appear in the audit log.

**Depends on nothing. Everything depends on it.**

### Phase 1 — Menu and configuration

Everything a manager sets up before a single order exists.

- Categories, items, variants, modifiers, prices (FR-B4, C1–C4)
- 86 toggle (FR-B6, C5)
- Tables (FR-B2)
- Discount presets (FR-B5)

**Demonstrable:** a real menu is loaded and browsable, items can be 86'd.

### Phase 2 — Order capture and totals

The order model and the arithmetic, without the kitchen or the money.

- Open table and quick-sale orders, one open order per table (FR-D1, D2)
- Add, edit, remove `PENDING` lines with price snapshotting (FR-D3–D5)
- Server-side order persistence across restarts (FR-D6)
- Totals: subtotal, discount, derived tax, service charge (FR-M4, order of
  operations)
- Preset and free-form discounts, with the free-form gate (FR-F1–F7)
- Void a pending line; void an unfired order (FR-H2, H3)

**Demonstrable:** an order is built on screen and its total matches the
worked example exactly. **AC-4, AC-8, AC-9, AC-10** pass here.

### Phase 3 — Kitchen firing

- Fire action: collect `PENDING`, print one ticket, mark `FIRED` (FR-E1)
- Round-based firing — second ticket carries only new lines (FR-E2)
- ESC/POS printing over LAN (NFR-2)
- Print failure handling: state advances, warning raised, reprint offered
  (FR-E3)
- Firing blocked on 86'd pending lines (FR-E4)
- Fired-line and fired-order voids behind the manager gate (FR-H4)

**Demonstrable:** the full waiter loop — order, fire, add a round, fire
again — with correct paper. **AC-1, AC-2, AC-3, AC-12** pass here.

**Risk:** printer integration is the phase most likely to surprise. Prove the
ESC/POS path against real hardware early rather than at the end of the phase.

### Phase 4 — Payment, close, and refund

- Tender types including custom named methods (FR-G1)
- Split payment across several tenders (FR-G2)
- Non-cash tender capped at remaining balance (FR-G3)
- Cash over-tender and change (FR-G4, G6)
- Close on exact settlement (FR-G5)
- Receipt print and reprint, resilient to printer failure (FR-G7, G8)
- Quick-sale close: fire and receipt together (FR-E5)
- Full-order refund behind the manager gate (FR-H5, H6)

**Demonstrable:** money end to end, both order types. **AC-5, AC-6, AC-7,
AC-11, AC-13, AC-14** pass here.

**Settle open question 4 (tip capture) before starting this phase.**
Retrofitting tips into a completed payment model is expensive.

### Phase 5 — Business day and end-of-day

- Business day lifecycle, orders attributed to the open day (FR-I1)
- Close refused while orders are open (FR-I2)
- Immutable report snapshot, next day opened (FR-I3, I4)
- Report contents and printing (FR-I5)
- Voids and refunds blocked against a closed day (FR-H7)

**Demonstrable:** a full simulated trading day closes and reconciles. **AC-15,
AC-16** pass here.

### Phase 6 — Hardening and acceptance

- Every edge case in PRD Section 6 covered by a test
- Audit completeness sweep, including the "no PIN in any log" check (FR-J3,
  J4)
- Snapshot immutability verified against edits made after the fact (AC-17)
- Full acceptance pass, AC-1 through AC-18

**Demonstrable:** the MVP is done.

## Sequencing notes

- Phases 0 and 1 can overlap once money primitives exist.
- Phase 2 must complete before Phase 3: firing operates on lines that Phase 2
  defines.
- Phases 3 and 4 are independently testable and could run in parallel with
  enough hands; both depend on Phase 2 and neither depends on the other.
- Phase 5 depends on Phase 4 — there is nothing to report on until orders
  close.

## After the MVP

Grouped by how soon they are likely to matter, not committed to dates.

### Horizon 1 — the gaps real service will expose first

Bill splitting by guest. Item-level discounts and complimentary items.
Partial and line-item refunds. Tip capture, if question 4 deferred it.
Cash-drawer float and till reconciliation. Table transfer, merge, and split.
Reopening a closed order.

These are the things a busy restaurant will ask for within weeks, because
each one corresponds to a real situation the MVP forces staff to work around.

### Horizon 2 — depth on what already exists

Kitchen display screen. Inventory: stock counts, deduction on sale,
low-stock alerts. Richer reporting: item-level sales, hourly breakdown,
labor. Scheduled and auto-applying discount campaigns. Multiple discounts per
order.

Each deepens a capability the MVP has in shallow form. None of them change
the shape of the system.

### Horizon 3 — breadth

Multi-location with per-branch menus, pricing, and consolidated reporting.
Offline operation with queueing and conflict resolution. Payment
integrations: QR, external terminals, gateways. Jurisdiction-specific tax
packs and mandated receipt formats. Customer records and loyalty.

These change the architecture. Each deserves its own design cycle rather than
being absorbed into an existing phase — in particular, offline sync and
multi-location both alter assumptions that the MVP deliberately builds on
(single database on the LAN, one location, last-write-wins concurrency).
