# ADR-003: Versioned commands and bounded checkout leasing

**Status:** Accepted

**Date:** 2026-09-10

**Approved by:** Product owner

## Context

Blind last-write-wins can overwrite food or money. The two-client MVP also has
a specific cross-client race: a manager can 86 an item in the back office while
the POS holds a quick-sale tender draft and an external card charge may be in
progress. If close then fails availability validation, the system has no
gateway through which to reverse the external charge.

## Decision

Use command-oriented mutations with aggregate and catalog versions, explicit
row locks, transaction-time preconditions, and idempotency records. Harmless
edits to `PENDING`-line details may use the last successfully committed command
after validation. Fire, discount change, settlement, void, refund, receipt
allocation, and business-day close reject stale conflicts.

Beginning settlement acquires one server-side CheckoutLease for the Order. It
stores no Tenders and does not change `Order.status`. While active it blocks
add-line, discount change, fire, void, and competing settlement; reads remain
available. An 86 command affecting an item on a leased quick-sale order is also
rejected and identifies that order.

The lease uses an opaque holder token, a five-minute renewable expiry measured
by database time, and a 15-minute hard stop from the most recent actor
authentication. It survives application restart with its remaining wall-clock
duration rather than a reset interval. The holder can release it. A manager can
take it over after acknowledging a possibly in-flight external charge;
takeover is audited, increments the generation, and rejects a later close from
the displaced token.

The seven duplicate-sensitive commands requiring idempotency keys are open
order, fire, settle and close, whole-order void, fired-line void, refund, and
end-of-day close.

## Options considered

- Whole-resource last-write-wins.
- Optimistic versions and preconditions without checkout leasing.
- A tab-only mutation guard.
- An unbounded order ownership lock.
- Versioned commands plus a bounded CheckoutLease.

## Consequences

- Sensitive conflicts fail visibly instead of silently replacing newer state.
- An in-flight manual payment is protected from the approved cross-client 86
  race without persisting partial Tenders.
- Abandoned settlement cannot strand an Order indefinitely.
- Checkout leasing adds Phase 4 protocol and failure tests but no new Order
  state and no authority for the holder token to move money by itself.
