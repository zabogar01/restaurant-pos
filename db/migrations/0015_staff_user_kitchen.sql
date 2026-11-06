-- Kitchen staff are user records with no role and no PIN (FR-A1, owner 2026-10-06, Q9;
-- consult C3 section 1). Kitchen is "role IS NULL": it is a classification and never an
-- authenticating role, so every reader of `role` that compares it with 'MANAGER' or
-- 'CASHIER' fails closed on a kitchen row without a change, and `findUserByPin`'s
-- `WHERE pin_lookup = $1 AND is_active` can never select one. 0002's role check still
-- refuses the string 'KITCHEN' and still passes a null.
--
-- The credential version rule in full (0002's comment on the column states only two of
-- its causes and is left alone, because an applied migration is never edited). The
-- version is incremented, in the same transaction as the change, whenever a command
-- deactivates the person, changes their role or classification, or stores or removes a
-- PIN or a password. A session is valid only while the version it recorded equals the
-- row's, so each of those ends every session of the person, and a later reactivation
-- does not revive them.
--
-- This migration scans the existing rows: if one violates a new check the migration
-- fails and no row is edited by hand.

ALTER TABLE staff_user
  ALTER COLUMN role       DROP NOT NULL,
  ALTER COLUMN pin_hash   DROP NOT NULL,
  ALTER COLUMN pin_lookup DROP NOT NULL,
  -- A role and a PIN together, or neither (kitchen). Never one without the other.
  ADD CONSTRAINT staff_user_credential_shape_check CHECK (
    (role IS NULL AND pin_hash IS NULL AND pin_lookup IS NULL)
    OR (role IS NOT NULL AND pin_hash IS NOT NULL AND pin_lookup IS NOT NULL)),
  -- The printed-text rule (ADR-012 rule 8, C1): trimmed, bounded, no control character.
  -- Lengths count code points, as the request schema's bound does at most.
  ADD CONSTRAINT staff_user_name_text_check CHECK (
    name = btrim(name) AND char_length(name) <= 64 AND name !~ '[[:cntrl:]]');

-- The application writes exactly the columns below. Nothing renames a person (C3 OQ2) or
-- moves their id or creation time; a column grant makes that a property of the database,
-- as 0007 did for the username. SELECT and INSERT stay table-wide, and DELETE stays absent.
-- Revoking UPDATE on the table also revokes any column-level UPDATE privilege (the
-- PostgreSQL 16 manual, REVOKE), so the grant below is the whole of it.
REVOKE UPDATE ON staff_user FROM pos_app;
GRANT UPDATE (role, pin_hash, pin_lookup, is_active, credential_version)
  ON staff_user TO pos_app;
