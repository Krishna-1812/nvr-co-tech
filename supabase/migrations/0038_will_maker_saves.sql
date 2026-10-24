-- ============================================================================
-- 0038 — Will Maker may keep an ENCRYPTED copy in the account
-- ============================================================================
--
-- Will Maker (docs/will-maker) keeps a person's draft in their browser. This
-- lets a signed-in person who has set a passcode also keep a copy in their
-- account, so it survives a cleared browser and follows them to another device.
--
-- What makes that acceptable is that the server never holds a will it can read.
-- The browser encrypts the draft with the person's passcode (AES-GCM, key from
-- PBKDF2; the passcode never leaves it) and only that ciphertext is saved. A
-- will and the list of what someone owns is the most sensitive thing this site
-- could be asked to hold, so this is enforced in three places and not one:
--
--   1. the browser only sends a locked draft (lib/cloud/sync, `accept`);
--   2. the server action refuses any will body that is not a sealed blob
--      (actions/saves.ts, lib/cloud/guard.ts);
--   3. this constraint refuses it in the database, so no code path, present or
--      future, can store a readable will.
--
-- Everything else about tool_saves is as 0032 made it: one row per person per
-- tool, owner-only under RLS, no admin override. Nobody here can read the row;
-- an admin could not read it even if they could see it.
--
-- Re-runnable: constraints are dropped and re-added.
-- ============================================================================

alter table tool_saves drop constraint if exists tool_saves_tool_check;
alter table tool_saves
  add constraint tool_saves_tool_check
  check (tool in ('wealth-tracker', 'true-property-cost', 'will-maker'));

-- A Will Maker row must be a sealed blob. `case` so that the JSON cast is only
-- ever tried on a Will Maker row: the other tools' rows are never parsed here.
alter table tool_saves drop constraint if exists tool_saves_will_is_sealed;
alter table tool_saves
  add constraint tool_saves_will_is_sealed
  check (
    case
      when tool = 'will-maker' then (body::jsonb ->> 'sealed') = 'aes-gcm-pbkdf2-sha256'
      else true
    end
  );

comment on constraint tool_saves_will_is_sealed on tool_saves is
  'A will is only ever stored as the ciphertext the browser made with the '
  'person''s passcode. The database refuses a readable one.';
