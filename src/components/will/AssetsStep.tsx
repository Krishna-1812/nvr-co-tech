'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Briefcase, Car, Gem, HandCoins, House, Landmark, Package, PiggyBank, Plus, ShieldCheck, TrendingUp, Umbrella, Wallet, type LucideIcon } from 'lucide-react';
import { Button, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { CenterPanel } from '@/components/ui/Drawer';
import { SEVERITY_TONE, Tag } from '@/components/wealth/shared';
import { assetLabel, describeAsset } from '@/lib/will/clauses';
import { removeAsset, setAsset } from '@/lib/will/edit';
import { fromWealth, importFromWealth } from '@/lib/will/fromWealth';
import { ASSET_KIND_LABELS, ASSET_KINDS, blankAsset, type Asset, type AssetKind } from '@/lib/will/model';
import type { WealthRecord } from '@/lib/wealth/model';
import { useWealth } from '@/lib/wealth/store';
import { FocusCard, Notice, StepFindings, StepHead, type StepProps } from './shared';

/**
 * Step three: what you own.
 *
 * The fastest way in is the person's Wealth Tracker record, if they have one:
 * every account, policy, property and fund they already wrote down comes
 * across in one tap, with its nominee, and can be imported again later without
 * doubling up. Otherwise things are typed one at a time. A will gives what a
 * person owns, so loans stay in Wealth Tracker and are only counted here.
 */

const KIND_ICON: Record<AssetKind, LucideIcon> = {
  property: House,
  bank: Landmark,
  deposit: PiggyBank,
  investment: TrendingUp,
  retirement: Umbrella,
  insurance: ShieldCheck,
  vehicle: Car,
  jewellery: Gem,
  business: Briefcase,
  receivable: HandCoins,
  other: Package,
};

export function AssetsStep({ record, update, findings, focus, userId, selfName }: StepProps & { userId: string; selfName: string }) {
  const [editing, setEditing] = useState<Asset | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);

  return (
    <div>
      <StepHead title="What you own">
        List what you own so you can say who gets what. You do not need values. Enough to find each thing is enough: the
        bank and account, the address, the folio.
      </StepHead>

      <WealthImport
        userId={userId}
        selfName={selfName}
        record={record}
        note={importNote}
        onImport={(w) => {
          // `update` runs its function at once, so the note is ready on the next line.
          let note = 'Nothing new to add.';
          update((r) => {
            const out = importFromWealth(r, w);
            const { assets, people } = out.added;
            note = `Added ${assets} ${assets === 1 ? 'thing' : 'things'} and ${people} ${people === 1 ? 'person' : 'people'}.`;
            if (out.liabilitiesLeft > 0) {
              note += ` ${out.liabilitiesLeft} ${out.liabilitiesLeft === 1 ? 'loan stays' : 'loans stay'} in Wealth Tracker; a will gives what you own.`;
            }
            return out.record;
          });
          setImportNote(note);
        }}
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Select
          aria-label="Add something you own"
          className="max-w-64"
          value=""
          onChange={(e) => {
            const kind = e.target.value as AssetKind;
            if (!kind) return;
            setEditing(blankAsset(kind));
            setIsNew(true);
          }}
        >
          <option value="">+ Add something you own…</option>
          {ASSET_KINDS.map((k) => (
            <option key={k} value={k}>
              {ASSET_KIND_LABELS[k]}
            </option>
          ))}
        </Select>
      </div>

      {record.assets.length === 0 ? (
        <p className="text-muted surface-sunken mt-5 rounded-2xl border px-4 py-6 text-center text-sm">
          Nothing listed yet. You can skip this step: the “everything else” clause covers all you own. Listing things lets
          you give particular ones to particular people.
        </p>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {record.assets.map((a, i) => {
            const Icon = KIND_ICON[a.kind];
            const flagged = findings.filter((f) => f.assetId === a.id && f.step === 'assets');
            return (
              <li key={a.id}>
                <FocusCard id={a.id} focused={focus?.assetId === a.id} className="!p-3.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(a);
                      setIsNew(false);
                    }}
                    className="flex w-full items-start gap-3 text-left"
                  >
                    <span className="surface-lit grid size-10 shrink-0 place-items-center rounded-xl border">
                      <Icon className="size-[18px]" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        <span className="text-subtle mr-1.5 tabular-nums">{i + 1}.</span>
                        {assetLabel(a)}
                      </span>
                      <span className="text-muted mt-0.5 block text-[12.5px] leading-snug">
                        {describeAsset(a) || 'No details yet. Open it to say where it is held.'}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {a.source === 'wealth' && <Tag tone="var(--status-draft)">From Wealth Tracker</Tag>}
                        {(a.holding === 'joint' || a.percent < 100) && <Tag tone="var(--status-warn)">{a.percent < 100 ? `Your ${a.percent}%` : 'Joint'}</Tag>}
                        {flagged.some((f) => f.severity !== 'note') && <Tag tone={SEVERITY_TONE.review}>Needs a look</Tag>}
                      </span>
                    </span>
                    <span className="text-muted text-xs">Edit</span>
                  </button>
                </FocusCard>
              </li>
            );
          })}
        </ul>
      )}

      <StepFindings findings={findings} step="assets" />

      {editing && (
        <AssetEditor
          key={editing.id}
          initial={editing}
          isNew={isNew}
          onSave={(a) => {
            update((r) => setAsset(r, a));
            setEditing(null);
          }}
          onDelete={(id) => {
            update((r) => removeAsset(r, id));
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function WealthImport({
  userId,
  selfName,
  record,
  note,
  onImport,
}: {
  userId: string;
  selfName: string;
  record: StepProps['record'];
  note: string | null;
  onImport: (w: WealthRecord) => void;
}) {
  const { state } = useWealth(userId, selfName);
  const waiting = useMemo(() => {
    if (state.status !== 'ready') return 0;
    const have = new Set(record.assets.map((a) => a.id));
    return fromWealth(state.record).assets.filter((a) => !have.has(a.id)).length;
  }, [state, record.assets]);

  if (state.status === 'loading' || state.status === 'unavailable') return null;

  const box = 'surface-lit a-ring flex flex-wrap items-center gap-3 rounded-2xl border p-4';

  if (state.status === 'locked') {
    return (
      <div className={box}>
        <Wallet className="size-5 shrink-0" aria-hidden />
        <p className="text-muted min-w-0 flex-1 text-sm">
          Your Wealth Tracker record is locked, so it cannot be read here. Unlock it in Wealth Tracker, then come back.
        </p>
        <Link href="/wealth-tracker" className="text-sm font-semibold underline underline-offset-2">
          Open Wealth Tracker
        </Link>
      </div>
    );
  }

  const total = state.record.items.length;
  if (total === 0) {
    return (
      <div className={box}>
        <Wallet className="size-5 shrink-0" aria-hidden />
        <p className="text-muted min-w-0 flex-1 text-sm">
          Wealth Tracker keeps a record of everything you own and owe. Start one, and it can fill this list for you.
        </p>
        <Link href="/wealth-tracker" className="text-sm font-semibold underline underline-offset-2">
          Open Wealth Tracker
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className={box}>
        <Wallet className="size-5 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1 text-sm">
          {waiting > 0 ? (
            <>
              <strong>{waiting}</strong> {waiting === 1 ? 'thing' : 'things'} in your Wealth Tracker record {waiting === 1 ? 'is' : 'are'} not in this will yet.
            </>
          ) : (
            'Everything in your Wealth Tracker record is already in this will.'
          )}
        </p>
        <Button variant="primary" size="sm" disabled={waiting === 0} onClick={() => onImport(state.record)}>
          <Plus className="size-3.5" aria-hidden />
          Add from Wealth Tracker
        </Button>
      </div>
      {note && <Notice tone="var(--status-approved)">{note}</Notice>}
    </div>
  );
}

function AssetEditor({
  initial,
  isNew,
  onSave,
  onDelete,
  onClose,
}: {
  initial: Asset;
  isNew: boolean;
  onSave: (a: Asset) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [a, setA] = useState<Asset>(initial);
  const [names, setNames] = useState(initial.nominee.names.join(', '));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (patch: Partial<Asset>) => setA((x) => ({ ...x, ...patch }));
  const shared = a.holding === 'joint';

  const finish = (): Asset => ({
    ...a,
    // A joint holding with 100% would say the whole of it is yours; the field
    // exists to say otherwise, so the default for a joint asset is left to the person.
    coOwners: shared ? a.coOwners : '',
    nominee: {
      status: a.nominee.status,
      names: a.nominee.status === 'yes' ? names.split(',').map((n) => n.trim()).filter(Boolean) : [],
    },
  });

  return (
    <CenterPanel
      open
      onClose={onClose}
      size="md"
      title={isNew ? `Add: ${ASSET_KIND_LABELS[a.kind].toLowerCase()}` : 'Edit this'}
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {!isNew &&
            (confirmDelete ? (
              <>
                <span className="text-muted text-sm">Remove it, and the gift of it?</span>
                <Button variant="danger" size="sm" onClick={() => onDelete(a.id)}>
                  Remove
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                Remove
              </Button>
            ))}
          <div className="ml-auto flex gap-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" form="asset-form" type="submit">
              {isNew ? 'Add to my will' : 'Save'}
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="asset-form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(finish());
        }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <Field label="What is it" htmlFor="a-kind">
          <Select id="a-kind" value={a.kind} onChange={(e) => set({ kind: e.target.value as AssetKind })}>
            {ASSET_KINDS.map((k) => (
              <option key={k} value={k}>
                {ASSET_KIND_LABELS[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Your name for it" htmlFor="a-title" hint="Optional. For example: Flat in Pune, or my salary account.">
          <Input id="a-title" value={a.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>

        <Field label="Bank, insurer, fund house or broker" htmlFor="a-inst">
          <Input id="a-inst" value={a.institution} onChange={(e) => set({ institution: e.target.value })} />
        </Field>
        <Field label="Account, policy or folio number" htmlFor="a-id" hint="The will shows the last four digits unless you choose otherwise.">
          <Input id="a-id" value={a.identifier} onChange={(e) => set({ identifier: e.target.value })} autoComplete="off" inputMode="text" />
        </Field>
        <label className="surface-sunken flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={a.fullIdentifier}
            onChange={(e) => set({ fullIdentifier: e.target.checked })}
            className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
          />
          <span>
            Print the whole number in the will
            <span className="text-muted mt-0.5 block text-[13px]">
              A will is read by many people. The last four digits and the institution are usually enough to find an account.
            </span>
          </span>
        </label>

        <Field label="Address or branch" htmlFor="a-loc" className="sm:col-span-2" hint="For property, the address as it is on the sale deed.">
          <Textarea id="a-loc" rows={2} value={a.location} onChange={(e) => set({ location: e.target.value })} />
        </Field>
        <Field label="Anything else that pins it down" htmlFor="a-det" className="sm:col-span-2" hint="Area, survey number, registration number, model and year.">
          <Input id="a-det" value={a.details} onChange={(e) => set({ details: e.target.value })} />
        </Field>

        <Field label="Who holds it" htmlFor="a-hold">
          <Select id="a-hold" value={a.holding} onChange={(e) => set({ holding: e.target.value as Asset['holding'] })}>
            <option value="sole">Only you</option>
            <option value="joint">You and someone else</option>
          </Select>
        </Field>
        <Field label="Your share of it, %" htmlFor="a-pct" hint="A will can give only your own share.">
          <Input
            id="a-pct"
            type="number"
            inputMode="decimal"
            min={1}
            max={100}
            step="any"
            value={a.percent}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n)) set({ percent: Math.min(100, Math.max(0, n)) });
            }}
          />
        </Field>
        {shared && (
          <Field label="The other holder(s)" htmlFor="a-co" className="sm:col-span-2">
            <Input id="a-co" value={a.coOwners} onChange={(e) => set({ coOwners: e.target.value })} placeholder="Names, as on the account or title" />
          </Field>
        )}

        <Field label="Does it have a nominee?" htmlFor="a-nom">
          <Select id="a-nom" value={a.nominee.status} onChange={(e) => set({ nominee: { ...a.nominee, status: e.target.value as Asset['nominee']['status'] } })}>
            <option value="">Not sure / not applicable</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="unsure">I need to check</option>
          </Select>
        </Field>
        {a.nominee.status === 'yes' && (
          <Field label="Nominee(s)" htmlFor="a-nomn" hint="Separate with commas.">
            <Input id="a-nomn" value={names} onChange={(e) => setNames(e.target.value)} />
          </Field>
        )}
      </form>
    </CenterPanel>
  );
}
