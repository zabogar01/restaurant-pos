-- FR-A4 (owner, 2026-10-07): PINs are unique among active users, so an audit
-- actor is unambiguous; a deactivated user's PIN may be given to another user.
-- 0002 made pin_lookup unique across every row, deactivated ones included. The
-- unique index becomes partial, over active rows only. An index carries no
-- grant, so no privilege changes.
DROP INDEX staff_user_pin_lookup_key;

CREATE UNIQUE INDEX staff_user_active_pin_lookup_key
  ON staff_user (pin_lookup)
  WHERE is_active;
