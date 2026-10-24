'use client';

import { useState } from 'react';
import { Gift as GiftIcon } from 'lucide-react';
import { Button } from '@/components/ui/primitives';
import { CenterPanel } from '@/components/ui/Drawer';
import { assetLabel, describeAsset, joinNames } from '@/lib/will/clauses';
import { setGift, setResidue } from '@/lib/will/edit';
import { findPerson, personName, type Share, type WillRecord } from '@/lib/will/model';
import { SharesEditor } from './SharesEditor';
import { FocusCard, StepFindings, StepHead, type StepProps } from './shared';

/** "Nisha (100%)", "Aarav (50%) and Anaya (50%)". */
function said(r: WillRecord, shares: Share[]): string {
  return joinNames(shares.map((s) => `${personName(findPerson(r, s.personId))}${shares.length > 1 ? ` (${s.percent}%)` : ''}`));
}

/**
 * Step four: who gets which thing.
 *
 * One row per thing the person listed, each saying who gets it or that it is
 * "not given by name". Leaving a thing ungifted is fine and common: it falls
 * into "everything else" (the next step), and the checks say how many do.
 */
export function GiftsStep({ record, update, findings, go, focus }: StepProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const asset = record.assets.find((a) => a.id === openId);
  const gift = record.gifts.find((g) => g.assetId === openId);

  return (
    <div>
      <StepHead title="Who gets what">
        Choose who gets each thing you listed. Anything you leave out goes to the people you name for “everything else” on
        the next step.
      </StepHead>

      {record.assets.length === 0 ? (
        <div className="surface-sunken rounded-2xl border px-4 py-6 text-center text-sm">
          <p className="text-muted">You have not listed anything you own. You can go straight to “everything else”, or list things first.</p>
          <div className="mt-3 flex justify-center gap-2">
            <Button size="sm" onClick={() => go('assets')}>
              List what I own
            </Button>
            <Button size="sm" variant="primary" onClick={() => go('residue')}>
              Skip to everything else
            </Button>
          </div>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {record.assets.map((a, i) => {
            const g = record.gifts.find((x) => x.assetId === a.id);
            return (
              <li key={a.id}>
                <FocusCard id={a.id} focused={focus?.assetId === a.id} className="!p-3.5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        <span className="text-subtle mr-1.5 tabular-nums">{i + 1}.</span>
                        {assetLabel(a)}
                      </span>
                      <span className="text-muted mt-0.5 block text-[12.5px]">{describeAsset(a) || 'No details yet'}</span>
                    </span>
                    <span className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className={`min-w-0 text-sm ${g ? 'font-medium' : 'text-muted'}`}>
                        {g ? <>{said(record, g.shares)}</> : 'Not given by name'}
                      </span>
                      <Button size="sm" className="shrink-0" variant={g ? 'secondary' : 'primary'} onClick={() => setOpenId(a.id)}>
                        <GiftIcon className="size-3.5" aria-hidden />
                        {g ? 'Change' : 'Choose who'}
                      </Button>
                    </span>
                  </div>
                </FocusCard>
              </li>
            );
          })}
        </ul>
      )}

      <StepFindings findings={findings} step="gifts" />

      {asset && (
        <CenterPanel
          open
          onClose={() => setOpenId(null)}
          size="md"
          title={`Who gets: ${assetLabel(asset)}`}
          footer={
            <div className="flex justify-end gap-2">
              {gift && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    update((r) => setGift(r, asset.id, []));
                    setOpenId(null);
                  }}
                >
                  Do not give by name
                </Button>
              )}
              <Button variant="primary" onClick={() => setOpenId(null)}>
                Done
              </Button>
            </div>
          }
        >
          <p className="text-muted mb-4 text-sm">
            {describeAsset(asset) || 'No details yet.'} Each share is a per cent of this one thing. A backup takes the share if
            that person is not alive when you die.
          </p>
          <SharesEditor
            record={record}
            shares={gift?.shares ?? []}
            onChange={(shares) => update((r) => setGift(r, asset.id, shares))}
            onNeedPeople={() => {
              setOpenId(null);
              go('family');
            }}
          />
        </CenterPanel>
      )}
    </div>
  );
}

/**
 * Step five: everything else.
 *
 * The single most useful clause in a will: who gets whatever it does not name,
 * including what is bought after signing and any gift that fails. It is a
 * step of its own, with its own explanation, because leaving it out is the
 * commonest way a will quietly stops doing what its maker meant.
 */
export function ResidueStep({ record, update, findings, go }: StepProps) {
  return (
    <div>
      <StepHead title="Everything else">
        This covers anything you have not given by name: what you buy after signing, accounts you forgot, and any gift
        that cannot go ahead. Name who gets it, in shares that add up to 100%.
      </StepHead>

      <SharesEditor record={record} shares={record.residue} onChange={(s) => update((r) => setResidue(r, s))} onNeedPeople={() => go('family')} />

      <StepFindings findings={findings} step="residue" />
    </div>
  );
}
