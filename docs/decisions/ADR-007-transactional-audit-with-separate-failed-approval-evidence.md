# ADR-007: Transactional audit with separate failed-approval evidence

**Status:** Accepted

**Date:** 2026-09-10

**Approved by:** Product owner

## Context

A successful protected action without its audit evidence violates the
append-only audit boundary. Failed and cancelled manager approvals also need
actor-attributed evidence, but no successful business mutation exists whose
transaction they can join. Unauthenticated PIN failures have no identified
actor and therefore cannot satisfy B-13.

## Decision

Insert each successful action's AuditEntry in the same PostgreSQL transaction
as that action. A successful approved action creates one combined entry naming
the initiating actor and approver. The application database role may insert
and read permitted audit projections but cannot update or delete AuditEntry;
migration and administrative roles remain separate.

Record a failed or cancelled manager approval in its own short append-only
transaction with the initiating actor, `approver = null`, and its outcome. If
that evidence cannot commit, the protected request fails and its business
action does not run. Record unauthenticated login failures and throttle events
only in separate security telemetry. Neither store may contain a PIN value.

## Options considered

- Transactional AuditEntry insertion.
- Asynchronous audit events.
- A mutable activity log.
- Omitting failed or cancelled approvals.
- Treating unauthenticated attempts as audit entries with a guessed actor.

## Consequences

- Successful audited actions and their evidence cannot diverge.
- Failed approval evidence remains actor-attributed without inventing an
  approver or a business mutation.
- Unauthenticated security telemetry remains distinct from the audit history,
  preserving B-13.
- Audit schema migration requires a separate privileged database role.
