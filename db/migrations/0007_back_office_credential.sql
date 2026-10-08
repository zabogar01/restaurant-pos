-- The MVP back office signs in with a username and a password (ADR-009). The
-- credential belongs to one staff user and carries its own throttle state, so a
-- wrong password counts against that account and never in a PIN class (FR-A5b).
CREATE TABLE back_office_credential (
  staff_user_id        uuid PRIMARY KEY REFERENCES staff_user (id),
  -- Stored lower-case. Unique across every row, active or not.
  username             text NOT NULL,
  -- Argon2id encoded hash (B-11, FR-A3).
  password_hash        text NOT NULL,
  consecutive_failures integer NOT NULL DEFAULT 0,
  blocked_until        timestamptz,

  CONSTRAINT back_office_credential_username_check
    CHECK (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$'),
  CONSTRAINT back_office_credential_password_hash_check
    CHECK (password_hash LIKE '$argon2id$%'),
  CONSTRAINT back_office_credential_failures_check
    CHECK (consecutive_failures >= 0)
);

CREATE UNIQUE INDEX back_office_credential_username_key
  ON back_office_credential (username);

-- No DELETE, and the username cannot be changed by the application.
GRANT SELECT, INSERT ON back_office_credential TO pos_app;
GRANT UPDATE (password_hash, consecutive_failures, blocked_until)
  ON back_office_credential TO pos_app;

-- A failed back-office sign-in leaves telemetry that names nobody (B-13): the
-- same three columns, two more permitted values.
ALTER TABLE security_event DROP CONSTRAINT security_event_type_check;
ALTER TABLE security_event ADD CONSTRAINT security_event_type_check
  CHECK (event_type IN ('PIN_FAILURE', 'COOLDOWN_STARTED', 'PASSWORD_FAILURE'));

ALTER TABLE security_event DROP CONSTRAINT security_event_throttle_class_check;
ALTER TABLE security_event ADD CONSTRAINT security_event_throttle_class_check
  CHECK (throttle_class IN ('LOGIN', 'MANAGER_APPROVAL', 'BACK_OFFICE_LOGIN'));
