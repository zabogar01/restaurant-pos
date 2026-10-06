-- B-7 for every role, the owner and a superuser included. Privileges stop
-- the application; this stops a migration, a test and a mistake.
CREATE FUNCTION reject_change_to_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not permitted (B-7)',
    TG_TABLE_NAME, TG_OP;
END;
$$;

-- Append-only (B-7). No updated_at, no deleted_at, no soft delete.
CREATE TABLE audit_entry (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- B-13: every entry names a person. An event with no identified actor is
  -- a security_event, never an audit entry with a null or stand-in actor.
  -- No ON DELETE action: a staff member named here cannot be deleted.
  actor_id      uuid NOT NULL REFERENCES staff_user (id),
  -- May equal actor_id (ARCHITECTURE 7.1).
  approver_id   uuid REFERENCES staff_user (id),
  action        text NOT NULL,
  outcome       text NOT NULL,
  subject_type  text,
  subject_id    text,
  reason        text,
  before_amount bigint,
  after_amount  bigint,
  occurred_at   timestamptz NOT NULL DEFAULT now(),

  -- Expected to widen: REFUSED arrives with its refusal_code and its own
  -- constraints, in the phase that first writes it (FR-J3).
  CONSTRAINT audit_entry_outcome_check
    CHECK (outcome IN ('SUCCESS', 'APPROVAL_FAILED', 'APPROVAL_CANCELLED')),
  -- ADR-007: a failed or cancelled approval names no approver.
  CONSTRAINT audit_entry_unapproved_outcome_check
    CHECK (outcome = 'SUCCESS' OR approver_id IS NULL),
  CONSTRAINT audit_entry_action_check CHECK (btrim(action) <> ''),
  CONSTRAINT audit_entry_subject_check
    CHECK ((subject_type IS NULL) = (subject_id IS NULL))
);

CREATE INDEX audit_entry_occurred_at_idx ON audit_entry (occurred_at DESC);

CREATE TRIGGER audit_entry_append_only
  BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_entry
  FOR EACH STATEMENT EXECUTE FUNCTION reject_change_to_append_only();

-- Insert only, and never id or occurred_at: the application cannot choose
-- an entry's identity or its time. No SELECT until a task builds a reader.
GRANT INSERT (actor_id, approver_id, action, outcome, subject_type,
              subject_id, reason, before_amount, after_amount)
  ON audit_entry TO pos_app;

-- Operational evidence for events with no identified actor (B-13). It has no
-- column that could name a person and none wide enough to hold a PIN (B-12).
-- Neither may ever be added.
CREATE TABLE security_event (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type         text NOT NULL,
  throttle_class     text NOT NULL,
  client_instance_id uuid REFERENCES client_instance (id),
  occurred_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT security_event_type_check
    CHECK (event_type IN ('PIN_FAILURE', 'COOLDOWN_STARTED')),
  CONSTRAINT security_event_throttle_class_check
    CHECK (throttle_class IN ('LOGIN', 'MANAGER_APPROVAL'))
);

GRANT INSERT (event_type, throttle_class, client_instance_id)
  ON security_event TO pos_app;
