-- Exactly two installation-wide buckets (FR-A5), seeded so the service only
-- ever updates a row and never races to create one. These are not restaurant
-- configuration (B-24): there are two by requirement.
CREATE TABLE pin_throttle_bucket (
  throttle_class       text PRIMARY KEY,
  consecutive_failures integer NOT NULL DEFAULT 0,
  blocked_until        timestamptz,

  CONSTRAINT pin_throttle_bucket_class_check
    CHECK (throttle_class IN ('LOGIN', 'MANAGER_APPROVAL')),
  CONSTRAINT pin_throttle_bucket_failures_check
    CHECK (consecutive_failures >= 0)
);

INSERT INTO pin_throttle_bucket (throttle_class)
  VALUES ('LOGIN'), ('MANAGER_APPROVAL');

-- No INSERT and no DELETE: a bucket cannot be removed to clear a cooldown,
-- and its class cannot be renamed.
GRANT SELECT ON pin_throttle_bucket TO pos_app;
GRANT UPDATE (consecutive_failures, blocked_until)
  ON pin_throttle_bucket TO pos_app;
