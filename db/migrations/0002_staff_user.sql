-- The application connects as pos_app. A provisioning step creates that role
-- before any migration runs: a migration never creates a login and never
-- holds a credential. If the role is missing, this file fails, as intended.
GRANT USAGE ON SCHEMA public TO pos_app;

CREATE TABLE staff_user (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  role               text NOT NULL,
  -- Argon2id encoded hash, used to verify a PIN (B-11, FR-A3).
  pin_hash           text NOT NULL,
  -- Keyed blind index of the PIN under a secret held outside the database
  -- (ARCHITECTURE 7.3). Finds the one row to verify and makes PINs unique
  -- (FR-A4). It is not a verifier and is never exposed or logged.
  pin_lookup         text NOT NULL,
  is_active          boolean NOT NULL DEFAULT true,
  -- Incremented on deactivation and on PIN reset. A session is valid only
  -- while the version it recorded equals this one (ARCHITECTURE 7.2).
  credential_version integer NOT NULL DEFAULT 1,
  created_at         timestamptz NOT NULL DEFAULT now(),

  -- KITCHEN is a staff classification, never an authenticating role (FR-A1).
  CONSTRAINT staff_user_role_check CHECK (role IN ('CASHIER', 'MANAGER')),
  CONSTRAINT staff_user_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT staff_user_pin_hash_check CHECK (pin_hash LIKE '$argon2id$%'),
  CONSTRAINT staff_user_credential_version_check CHECK (credential_version >= 1)
);

CREATE UNIQUE INDEX staff_user_pin_lookup_key ON staff_user (pin_lookup);

-- No DELETE: a staff member is deactivated, never removed.
GRANT SELECT, INSERT, UPDATE ON staff_user TO pos_app;
