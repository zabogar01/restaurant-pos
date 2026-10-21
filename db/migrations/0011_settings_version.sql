-- The installation's settings, versioned (ADR-012 Part 1; consult C1 section 1). A
-- save is a new row; no row is ever changed or removed, so a version an order will
-- one day refer to reads back exactly as it was saved. The table starts empty and no
-- migration seeds it (B-24): the current version is the highest number, and there is
-- none until the first manager saves.
--
-- Same shape as reject_change_to_append_only() (0004), with a message that does not
-- name B-7, which is the audit log's boundary.
CREATE FUNCTION reject_change_to_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is immutable: % is not permitted', TG_TABLE_NAME, TG_OP;
END;
$$;

-- There is no currency and no precision column (ADR-012 rule 5): they are the
-- installation's constants, 'IDR' and 0, in shared code.
CREATE TABLE settings_version (
  -- Assigned by the server as the current number + 1 (rule 2). The key is what
  -- refuses a concurrent duplicate.
  version            integer PRIMARY KEY,
  tax_rate_ppm       bigint NOT NULL,
  service_rate_ppm   bigint NOT NULL,
  outlet_name        text NOT NULL,
  address            text NOT NULL,
  phone              text NOT NULL,
  npwpd              text,
  footer             text NOT NULL,
  -- Written by the server from a constant; no request carries it (rule 6).
  calculation_policy smallint NOT NULL,
  -- B-13: the manager who saved the version. No ON DELETE action.
  created_by         uuid NOT NULL REFERENCES staff_user (id),
  created_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT settings_version_version_check CHECK (version >= 1),
  -- Zero to 100 percent (FR-M5; owner, 2026-10-20).
  CONSTRAINT settings_version_tax_rate_check CHECK (tax_rate_ppm BETWEEN 0 AND 1000000),
  CONSTRAINT settings_version_service_rate_check CHECK (service_rate_ppm BETWEEN 0 AND 1000000),
  CONSTRAINT settings_version_policy_check CHECK (calculation_policy = 1),

  -- Every text reaches paper through an ESC/POS printer, where a control character is
  -- a printer command (ADR-012 rule 8). [[:cntrl:]] matches the C0 and C1 controls
  -- (ESC, DEL, U+009B) under this database's UTF8 encoding; the schema test proves it.
  -- Lengths count code points, which never exceed the UTF-16 units the request schema
  -- counts, so these never refuse what the schema accepts. A value that starts or
  -- ends in whitespace, or is only whitespace, is refused.
  CONSTRAINT settings_version_outlet_name_check
    CHECK (char_length(outlet_name) BETWEEN 1 AND 64
           AND outlet_name !~ '^\s|\s$'
           AND outlet_name !~ '[[:cntrl:]]'),
  -- The address alone may hold line feeds, at most two (three lines).
  CONSTRAINT settings_version_address_check
    CHECK (char_length(address) BETWEEN 1 AND 200
           AND address !~ '^\s|\s$'
           AND translate(address, E'\n', '') !~ '[[:cntrl:]]'
           AND char_length(address) - char_length(replace(address, E'\n', '')) <= 2),
  -- Digits, spaces and + - . ( ) only (owner, 2026-10-21).
  CONSTRAINT settings_version_phone_check
    CHECK (char_length(phone) BETWEEN 1 AND 32
           AND phone !~ '^\s|\s$'
           AND phone ~ '^[0-9 +.()-]+$'),
  CONSTRAINT settings_version_npwpd_check
    CHECK (npwpd IS NULL
           OR (char_length(npwpd) BETWEEN 1 AND 32
               AND npwpd !~ '^\s|\s$'
               AND npwpd !~ '[[:cntrl:]]')),
  CONSTRAINT settings_version_footer_check
    CHECK (char_length(footer) BETWEEN 1 AND 120
           AND footer !~ '^\s|\s$'
           AND footer !~ '[[:cntrl:]]')
);

-- SELECT and INSERT only, the insert column by column so the application cannot
-- choose created_at.
GRANT SELECT ON settings_version TO pos_app;
GRANT INSERT (version, tax_rate_ppm, service_rate_ppm, outlet_name, address, phone,
              npwpd, footer, calculation_policy, created_by)
  ON settings_version TO pos_app;

-- Stops the owner, a migration and a test from rewriting a version.
CREATE TRIGGER settings_version_immutable
  BEFORE UPDATE OR DELETE OR TRUNCATE ON settings_version
  FOR EACH STATEMENT EXECUTE FUNCTION reject_change_to_immutable();
