-- A manager approval refused by the MANAGER_APPROVAL cooldown is an audit
-- entry naming the cashier (owner, 2026-10-06): no PIN was verified, so it is
-- not APPROVAL_FAILED. Widening a CHECK is DDL: it edits no row, so the
-- append-only trigger does not fire, and audit_entry_unapproved_outcome_check
-- already requires approver_id to be null for the new value. No column is
-- added, so pos_app's column grants are unchanged. REFUSED is still to come,
-- with its refusal code and its own constraints (FR-J3).
ALTER TABLE audit_entry
  DROP CONSTRAINT audit_entry_outcome_check,
  ADD CONSTRAINT audit_entry_outcome_check
    CHECK (outcome IN ('SUCCESS', 'APPROVAL_FAILED', 'APPROVAL_CANCELLED',
                       'APPROVAL_THROTTLED'));

-- The previous default was the transaction's start time. A combined entry is written at the end of
-- a transaction that may have waited for a lock, and the application cannot
-- supply this column, so the default is the only place the time is decided.
ALTER TABLE audit_entry ALTER COLUMN occurred_at SET DEFAULT clock_timestamp();
