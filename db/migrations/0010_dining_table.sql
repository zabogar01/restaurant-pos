-- A dining table (FR-B2, consult C2): the place an order is opened against. It starts
-- empty and is never deleted: a table that is no longer used is deactivated, and
-- may be reactivated. There is no seat count and no area.
CREATE TABLE dining_table (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label      text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- The database's backstop for the request schema's label rule: 1 to 32 characters
  -- and no leading or trailing whitespace. Code points never exceed the UTF-16 units
  -- the schema counts, so this never refuses a label the schema accepts.
  CONSTRAINT dining_table_label_check
    CHECK (char_length(label) BETWEEN 1 AND 32 AND label !~ '^\s|\s$')
);

-- One active table per label, compared case-insensitively across the whole floor.
-- Inactive tables are history and may share a label with each other and with an
-- active table. This index is the authority: no command pre-checks, because a read
-- followed by an insert is a race and the index is not.
CREATE UNIQUE INDEX dining_table_active_label_key
  ON dining_table (lower(label))
  WHERE is_active;

-- No DELETE, and neither the id nor the creation time can be changed.
GRANT SELECT, INSERT ON dining_table TO pos_app;
GRANT UPDATE (label, is_active) ON dining_table TO pos_app;
