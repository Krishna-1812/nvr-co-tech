-- ============================================================================
-- NVR Voucher v2 — seed data
-- The 15 CIO Association chapters, carried over from v1's hard-coded constant
-- (src/lib/constants.js) into real rows so HO can manage them without a deploy.
--
-- Codes are used in voucher numbers: NVR/<CODE>/25-26/0001
-- ============================================================================

insert into chapters (name, code, is_head_office) values
  ('CIO Association HO',         'HO',   true),
  ('CIO Association Ahmedabad',  'AMD',  false),
  ('CIO Association Bangalore',  'BLR',  false),
  ('CIO Association Chennai',    'MAA',  false),
  ('CIO Association Coimbatore', 'CJB',  false),
  ('CIO Association Delhi',      'DEL',  false),
  ('CIO Association Hyderabad',  'HYD',  false),
  ('CIO Association Kerala',     'KL',   false),
  ('CIO Association Kolkata',    'CCU',  false),
  ('CIO Association Mumbai',     'BOM',  false),
  ('CIO Association Nagpur',     'NAG',  false),
  ('CIO Association Pune',       'PNQ',  false),
  ('CIO Association Punjab',     'PB',   false),
  ('CIO Association Rajasthan',  'RJ',   false),
  ('CIO Association Goa',        'GOA',  false)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Promote the first account to owner so the system has an administrator.
-- Run this once, after the first user signs up:
--
--   update profiles set role = 'owner' where email = 'you@example.com';
-- ---------------------------------------------------------------------------
