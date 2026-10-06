-- Browser-profile identity for continuity and telemetry only. Never an
-- authorization boundary (FR-A7).
CREATE TABLE client_instance (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON client_instance TO pos_app;

-- Every timestamp here is PostgreSQL time (ARCHITECTURE 14.4).
CREATE TABLE actor_session (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SHA-256 of the opaque token the cookie carries. The token itself is
  -- never stored, so reading this table yields no usable session.
  token_hash          bytea NOT NULL,
  -- Audience decides route context and timeout policy, never permission
  -- (FR-A2c). Role still decides what the actor may do.
  audience            text NOT NULL,
  staff_user_id       uuid NOT NULL REFERENCES staff_user (id),
  -- The version of the credential that was verified. Deliberately no
  -- default: a session created without it must fail, not validate.
  credential_version  integer NOT NULL,
  client_instance_id  uuid REFERENCES client_instance (id),
  issued_at           timestamptz NOT NULL DEFAULT now(),
  -- Interactive activity only. Polling does not move it (FR-A2b).
  last_interactive_at timestamptz NOT NULL DEFAULT now(),
  absolute_expires_at timestamptz,
  released_at         timestamptz,

  CONSTRAINT actor_session_audience_check
    CHECK (audience IN ('POS', 'BACK_OFFICE')),
  CONSTRAINT actor_session_token_hash_check
    CHECK (octet_length(token_hash) = 32),
  -- FR-A2b: a back-office session always has an absolute lifetime.
  CONSTRAINT actor_session_back_office_expiry_check
    CHECK (audience <> 'BACK_OFFICE' OR absolute_expires_at IS NOT NULL),
  CONSTRAINT actor_session_expiry_after_issue_check
    CHECK (absolute_expires_at IS NULL OR absolute_expires_at > issued_at)
);

CREATE UNIQUE INDEX actor_session_token_hash_key ON actor_session (token_hash);
CREATE INDEX actor_session_active_idx
  ON actor_session (staff_user_id) WHERE released_at IS NULL;

-- No DELETE: a session ends by released_at or by expiry.
GRANT SELECT, INSERT, UPDATE ON actor_session TO pos_app;
