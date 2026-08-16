-- ---------------------------------------------------------------------------
-- 0016 — voucher numbers are unique per organization, not globally
--
-- A genuine bug in 0012: next_voucher_no()'s counting was scoped by
-- organization_id, but the constraint enforcing the result stayed a plain
-- unique index on voucher_no alone. Two organizations whose chapters happen
-- to share a code — "HO" is the obvious one, since every client tends to
-- name their head office that — independently compute the same next number
-- and collide on this index the moment both have submitted at least one
-- voucher. Composite the index with organization_id: still unique within an
-- organization, no longer unique across organizations that were never
-- sharing a sequence in the first place.
-- ---------------------------------------------------------------------------

drop index if exists vouchers_no_unique;

create unique index vouchers_no_unique
  on vouchers (organization_id, voucher_no)
  where voucher_no is not null and deleted_at is null;
