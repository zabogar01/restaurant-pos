# ADR-006: Transactional immutable receipt numbering

**Status:** Accepted

**Date:** 2026-09-10

**Approved by:** Product owner

## Context

Concurrent closes must not allocate the same human-visible receipt number. A
failed close must leave no Receipt or partial settlement, and a reprint must
preserve the exact number and figures originally issued. A PostgreSQL sequence
can consume numbers on rollback, while rendering a receipt from current Order
or configuration state can rewrite history.

## Decision

Receipt is a stored immutable entity with an internal UUID and a separate
human-visible number. Inside the atomic close transaction, lock one
installation ReceiptSeries row, allocate its next number, store all Tenders,
store the immutable Receipt, close the Order, and create the receipt PrintJob.
Rollback consumes no number. Reprint uses the same Receipt and creates only a
new PrintAttempt.

The MVP architecture supports one installation-wide monotonically increasing
series. Display format, reset policy, mandatory fields, refund-document
numbering, retention, fiscal markings, and jurisdiction rules remain open
product decisions.

## Options considered

- A PostgreSQL sequence.
- A business-day-local counter.
- A random human-visible identifier.
- A locked transactional ReceiptSeries plus an internal UUID.

## Consequences

- Committed Receipts have unique, stable numbers and identical reprints.
- Failed transactions do not consume a receipt number.
- The receipt schema can be designed around immutability, but Phase 4 cannot
  finalize fiscal output until the owner closes the receipt-content and
  jurisdiction question.
- A jurisdictional requirement may require a superseding ADR for numbering;
  this acceptance does not prejudge it.
