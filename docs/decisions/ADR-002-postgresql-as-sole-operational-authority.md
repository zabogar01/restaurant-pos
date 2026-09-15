# ADR-002: PostgreSQL as sole operational authority

**Status:** Accepted

**Date:** 2026-09-10

**Approved by:** Product owner

## Context

Order capture, firing, checkout leasing, exact settlement, receipt allocation,
refund, printing, audit, and business-day close require durable transactions,
row locking, uniqueness, and recovery across application or browser restart.
Paper cannot prove physical delivery, and browser state cannot safely own
financial facts.

## Decision

PostgreSQL is the sole authority for operational and financial state. Clients,
browser caches, tab-local drafts, reports rendered for display, and paper are
projections or artifacts. Every state-changing command commits all of its
business facts, immutable snapshots, audit evidence where required, durable
print jobs, and idempotency result in one PostgreSQL transaction.

Use PostgreSQL-backed sessions, throttle buckets, CheckoutLeases, print jobs,
and immutable history. Use database constraints and application-role
privileges to protect invariants that can be expressed below the domain layer.

## Options considered

- PostgreSQL as sole authority.
- SQLite as the operational store.
- Browser- or client-owned state synchronized later.

## Consequences

- Explicit locks, partial unique indexes, constraints, and database roles can
  enforce the MVP's sensitive invariants.
- Integration tests must run against real PostgreSQL rather than an in-memory
  substitute.
- A PostgreSQL outage blocks writes visibly; clients may not claim success or
  queue offline mutations.
- True offline POS operation would change where authority lives and therefore
  requires a new architecture cycle.
