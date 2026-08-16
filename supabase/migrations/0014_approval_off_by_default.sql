-- ---------------------------------------------------------------------------
-- 0014 — direct payment is the default, not two-person approval
--
-- 0013 shipped the toggle with approval on by default, so nothing changed for
-- an organization until its owner opted out. The product decision since then
-- is the other way round: every organization — the ones already here and
-- every one create_organization() makes from now on — starts with approval
-- off. An owner who wants the two-person chain still turns it on from
-- Admin → People, same control as before.
-- ---------------------------------------------------------------------------

alter table organizations
  alter column requires_approval set default false;

update organizations set requires_approval = false;
