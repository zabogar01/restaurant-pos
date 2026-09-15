# ADR-005: Transactional print outbox with uncertain delivery

**Status:** Accepted

**Date:** 2026-09-10

**Approved by:** Product owner

## Context

Printing cannot gate an Order, Tender, refund, or business-day transition.
Basic ESC/POS printers also cannot provide end-to-end exactly-once delivery. A
timeout or process crash can occur after the printer accepted bytes but before
the application recorded success; an automatic retry could duplicate food.

## Decision

Store each immutable KitchenTicket, KitchenCancellationTicket, Receipt, or
printable report and its PrintJob in the same PostgreSQL transaction as the
business action. Dispatch only after commit. Create a separate PrintAttempt
for every physical send and record `PRINTED`, `FAILED`, or `UNKNOWN`.

`UNKNOWN` means delivery may have begun or completed. After the one automatic
attempt, neither `FAILED` nor `UNKNOWN` is retried automatically. An explicit
operator reprint creates another PrintAttempt for the same immutable document;
it never creates another fire, cancellation, receipt, or report.

Both clients show application-wide incidents. Kitchen work and cancellation
failure is an emergency; receipt failure is lower priority. An unauthenticated
POS lock screen may show that a kitchen incident exists but not its Order
details.

## Options considered

- Synchronous printer I/O inside the business transaction.
- Direct browser printing.
- Automatic retry until success.
- An external message broker.
- A PostgreSQL transactional outbox with explicit uncertain delivery.

## Consequences

- Business transitions survive printer faults and never wait on paper.
- The application records what it attempted but does not claim paper was
  physically produced when the protocol cannot prove it.
- Staff need a persistent, urgency-specific incident and manual recovery
  workflow.
- A process restart converts an in-dispatch attempt to `UNKNOWN` rather than
  silently retrying it.
