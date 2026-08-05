-- ---------------------------------------------------------------------------
-- 0007 — voucher numbers move from NVR/ to FI/
--
-- The platform is now Finance Intelligence, so the prefix the database hands out
-- changes with it: FI/<CHAPTER-CODE>/<FY>/<0001>.
--
-- Numbers already issued are NOT rewritten, and that is deliberate. A voucher
-- number is the identifier an approved voucher was signed and filed under. Ours
-- are printed on PDFs, quoted in the audit trail, and in at least one case sit in
-- a real accounting record. Renaming an identifier after the fact is the kind of
-- thing an auditor is entitled to object to, and voucher_audit has no UPDATE
-- policy precisely so that history cannot be edited. So old vouchers keep their
-- NVR/ numbers for ever, and new ones are issued as FI/.
--
-- The sequence does not restart, though. The old function counted vouchers whose
-- number began with the full prefix, so simply changing the prefix would have
-- started a fresh run at 0001 inside a chapter and financial year that already
-- had numbers issued. An auditor expects one unbroken series per chapter per
-- year, not two overlapping ones. This version therefore counts on the middle of
-- the number — chapter code and financial year — and ignores which prefix was in
-- force when the earlier voucher was raised.
--
-- So a chapter that reached NVR/CIO/25-26/0004 continues at FI/CIO/25-26/0005.
-- ---------------------------------------------------------------------------

create or replace function next_voucher_no(p_chapter_id uuid, p_date date)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_fy   text;
  v_seq  int;
  v_tail text;
begin
  select code into v_code from chapters where id = p_chapter_id;
  if v_code is null then
    raise exception 'Unknown chapter';
  end if;

  v_fy := financial_year(coalesce(p_date, current_date));

  -- Everything after the prefix. Matching on this rather than on the whole
  -- number is what keeps one run of numbers across the rename.
  v_tail := '/' || v_code || '/' || v_fy || '/';

  -- Lock the chapter row so two concurrent submits can't take the same number.
  perform 1 from chapters where id = p_chapter_id for update;

  select coalesce(max(split_part(voucher_no, '/', 4)::int), 0) + 1
    into v_seq
  from vouchers
  where voucher_no like '%' || v_tail || '%';

  return 'FI' || v_tail || lpad(v_seq::text, 4, '0');
end $$;

comment on function next_voucher_no(uuid, date) is
  'Issues FI/<CHAPTER>/<FY>/<0001>. Counts existing numbers by chapter and '
  'financial year regardless of prefix, so the series carried on unbroken '
  'through the rename from NVR/ in 0007.';
