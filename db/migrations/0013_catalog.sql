-- The menu catalog (FR-C1 to FR-C8, ADR-012 Part 2, consult C1 section 2): categories,
-- items with a tax-inclusive base price, single-select variants with a signed price
-- change and multi-select modifiers with a non-negative price change, each option
-- belonging to one item. The four tables start empty and no migration seeds them (B-24).
-- Nothing is ever deleted (B-8): a category or item is archived and may be restored, an
-- option is removed by setting it inactive and is not restored. An order line will one
-- day refer to these rows.

-- The catalog's one coordination row (ADR-012 rules 9, 10 and 14). Its version is the
-- revision the POS polls, and every catalog write locks this row first, so two writes
-- never interleave. It is not configuration: a counter and a lock point, seeded for the
-- reason the throttle rows are, so that commands only ever update it.
CREATE TABLE catalog_revision (
  -- At most one row: the key can only be true.
  is_singleton boolean PRIMARY KEY DEFAULT true,
  -- 0 is the empty catalog.
  version      integer NOT NULL DEFAULT 0,

  CONSTRAINT catalog_revision_singleton_check CHECK (is_singleton),
  CONSTRAINT catalog_revision_version_check CHECK (version >= 0)
);

INSERT INTO catalog_revision DEFAULT VALUES;

-- The version moves forward by one and by nothing else (ARCHITECTURE section 4.3, a
-- monotonic catalog revision), by construction rather than by every command's care.
-- The message names no row content.
CREATE FUNCTION require_catalog_version_step() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'catalog_revision.version may only advance by one';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER catalog_revision_version_step
  BEFORE UPDATE ON catalog_revision
  FOR EACH ROW EXECUTE FUNCTION require_catalog_version_step();

-- UPDATE on the counter alone. PostgreSQL also requires UPDATE on at least one column
-- before it lets a role lock the row FOR UPDATE or FOR SHARE, so this grant is what
-- lets pos_app take the lock.
GRANT SELECT ON catalog_revision TO pos_app;
GRANT UPDATE (version) ON catalog_revision TO pos_app;

-- The name rule is the same on every table, with its own length: no leading or trailing
-- whitespace and no control character. [[:cntrl:]] matches the C0 and C1 controls (ESC,
-- DEL, U+009B) under this database's UTF8 encoding. Lengths count code points, as the
-- request schemas' do, so these never refuse a name the schemas accept.
CREATE TABLE menu_category (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  display_order integer NOT NULL,
  -- false = archived (FR-B4, FR-C8)
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT menu_category_name_check
    CHECK (char_length(name) BETWEEN 1 AND 32
           AND name !~ '^\s|\s$'
           AND name !~ '[[:cntrl:]]'),
  CONSTRAINT menu_category_display_order_check CHECK (display_order >= 0)
);

CREATE TABLE menu_item (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   uuid NOT NULL REFERENCES menu_category (id),
  name          text NOT NULL,
  -- Tax-inclusive (FR-C1, PRD section 4). At most the largest line total (FR-M5), since
  -- a dearer item could never be sold.
  base_price    bigint NOT NULL,
  display_order integer NOT NULL,
  -- false = 86'd (FR-C5); written by the 86 commands, true until then.
  is_available  boolean NOT NULL DEFAULT true,
  -- false = archived
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT menu_item_name_check
    CHECK (char_length(name) BETWEEN 1 AND 64
           AND name !~ '^\s|\s$'
           AND name !~ '[[:cntrl:]]'),
  CONSTRAINT menu_item_base_price_check CHECK (base_price BETWEEN 0 AND 99999999),
  CONSTRAINT menu_item_display_order_check CHECK (display_order >= 0)
);

-- Single-select, with a signed price change (FR-C2). It belongs to one item for ever:
-- the application has no UPDATE on item_id. Whether the item's price plus the change
-- stays within 0 and the line maximum is checked when a line is priced, not here.
CREATE TABLE menu_item_variant (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid NOT NULL REFERENCES menu_item (id),
  name          text NOT NULL,
  price_delta   bigint NOT NULL,
  display_order integer NOT NULL,
  -- false = removed; a removed variant is not restored
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT menu_item_variant_name_check
    CHECK (char_length(name) BETWEEN 1 AND 32
           AND name !~ '^\s|\s$'
           AND name !~ '[[:cntrl:]]'),
  CONSTRAINT menu_item_variant_delta_check CHECK (price_delta BETWEEN -99999999 AND 99999999),
  CONSTRAINT menu_item_variant_display_order_check CHECK (display_order >= 0)
);

-- Multi-select, with a price change of zero or more (FR-C3). No group, no parent and no
-- stock (FR-C4).
CREATE TABLE menu_item_modifier (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id       uuid NOT NULL REFERENCES menu_item (id),
  name          text NOT NULL,
  price_delta   bigint NOT NULL,
  display_order integer NOT NULL,
  -- false = removed; a removed modifier is not restored
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT menu_item_modifier_name_check
    CHECK (char_length(name) BETWEEN 1 AND 32
           AND name !~ '^\s|\s$'
           AND name !~ '[[:cntrl:]]'),
  CONSTRAINT menu_item_modifier_delta_check CHECK (price_delta BETWEEN 0 AND 99999999),
  CONSTRAINT menu_item_modifier_display_order_check CHECK (display_order >= 0)
);

-- One active row per name, compared case-insensitively. A category name is held among
-- active categories; an item name among all active items, across the whole menu; an
-- option name among that item's active options of the same kind. Archived and removed
-- rows are history and may share names. These indexes are the authority: no command
-- pre-checks, because a read followed by a write is a race and the index is not. There
-- is no unique index on display_order: a reorder rewrites many rows, and ties are
-- broken by name on screen.
CREATE UNIQUE INDEX menu_category_active_name_key
  ON menu_category (lower(name))
  WHERE is_active;

CREATE UNIQUE INDEX menu_item_active_name_key
  ON menu_item (lower(name))
  WHERE is_active;

CREATE UNIQUE INDEX menu_item_variant_active_name_key
  ON menu_item_variant (item_id, lower(name))
  WHERE is_active;

CREATE UNIQUE INDEX menu_item_modifier_active_name_key
  ON menu_item_modifier (item_id, lower(name))
  WHERE is_active;

-- No DELETE on any of them, and no grant on id or created_at. An option's item_id is
-- not updatable, so an option cannot move to another item under an order line.
GRANT SELECT, INSERT ON menu_category, menu_item, menu_item_variant, menu_item_modifier TO pos_app;
GRANT UPDATE (name, display_order, is_active) ON menu_category TO pos_app;
GRANT UPDATE (category_id, name, base_price, display_order, is_available, is_active) ON menu_item TO pos_app;
GRANT UPDATE (name, price_delta, display_order, is_active) ON menu_item_variant TO pos_app;
GRANT UPDATE (name, price_delta, display_order, is_active) ON menu_item_modifier TO pos_app;
