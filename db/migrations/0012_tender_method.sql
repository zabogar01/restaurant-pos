-- A custom tender method (FR-B7, consult C2 section 8): a named way to pay besides
-- cash and card. Cash and card are fixed kinds the application never creates, renames
-- or deactivates, so they are not rows here. The table starts empty and no migration
-- seeds it (B-24). A method is never deleted: one that is no longer offered is
-- deactivated, and may be reactivated. There is no fee, integration, order or icon.
CREATE TABLE tender_method (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- The database's backstop for the request schema's name rule: 1 to 32 characters,
  -- no leading or trailing whitespace and no control character. [[:cntrl:]] matches the
  -- C0 and C1 controls (ESC, DEL, U+009B) under this database's UTF8 encoding. Lengths
  -- count code points, as the schema's do, so this never refuses a name it accepts.
  CONSTRAINT tender_method_name_check
    CHECK (char_length(name) BETWEEN 1 AND 32
           AND name !~ '^\s|\s$'
           AND name !~ '[[:cntrl:]]')
);

-- One active method per name, compared case-insensitively. Inactive methods are
-- history and may share a name with each other and with an active method. This index
-- is the authority: no command pre-checks, because a read followed by an insert is a
-- race and the index is not.
CREATE UNIQUE INDEX tender_method_active_name_key
  ON tender_method (lower(name))
  WHERE is_active;

-- No DELETE, and neither the id nor the creation time can be changed.
GRANT SELECT, INSERT ON tender_method TO pos_app;
GRANT UPDATE (name, is_active) ON tender_method TO pos_app;
