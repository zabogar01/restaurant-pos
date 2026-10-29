-- Discount presets (FR-B5, FR-F4, FR-F5, ADR-012 rule 10, consult C1 section 4.1): a name and
-- either a percentage or a fixed amount. The table starts empty and no migration seeds it
-- (B-24). Nothing is ever deleted (B-8): a preset is deactivated and may be reactivated, and
-- a deactivated preset stays readable for the orders it was applied to. The columns are the
-- whole record: no date, time, schedule, trigger, stacking or order column (B-21, B-22).

CREATE TABLE discount_preset (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  kind        text NOT NULL,
  -- PERCENTAGE only: parts per million, 0 to 1000000 (0 to 100 percent)
  rate_ppm    bigint,
  -- FIXED only: minor units, 0 to 99999999
  amount      bigint,
  -- false = deactivated (FR-F5)
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- The name rule of the catalog tables, at the length of every name that prints on a
  -- receipt line. Lengths count code points, as the request schemas' do.
  CONSTRAINT discount_preset_name_check
    CHECK (char_length(name) BETWEEN 1 AND 32
           AND name !~ '^\s|\s$'
           AND name !~ '[[:cntrl:]]'),
  CONSTRAINT discount_preset_kind_check CHECK (kind IN ('PERCENTAGE', 'FIXED')),
  -- Exactly the value column of the kind is set, inside its range. Zero is accepted.
  -- IS NOT NULL is explicit: BETWEEN on a NULL is NULL, and a CHECK passes on NULL, so
  -- without it a row with neither column set would be accepted.
  CONSTRAINT discount_preset_value_check CHECK (
    (kind = 'PERCENTAGE' AND rate_ppm IS NOT NULL AND rate_ppm BETWEEN 0 AND 1000000 AND amount IS NULL) OR
    (kind = 'FIXED' AND amount IS NOT NULL AND amount BETWEEN 0 AND 99999999 AND rate_ppm IS NULL))
);

-- One active preset per name, compared case-insensitively. Deactivated presets are
-- history and may share names. The index is the authority: no command pre-checks.
CREATE UNIQUE INDEX discount_preset_active_name_key
  ON discount_preset (lower(name))
  WHERE is_active;

-- No DELETE, and no grant on id or created_at.
GRANT SELECT, INSERT ON discount_preset TO pos_app;GRANT UPDATE (name, kind, rate_ppm, amount, is_active) ON discount_preset TO pos_app;
