'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { CircleAlert, Download, FileText, Plus } from 'lucide-react';
import { Button, Skeleton } from '@/components/ui/primitives';
import { head, type HeadId, type Side } from '@/lib/wealth/heads';
import { blankItem, todayIso, type Item } from '@/lib/wealth/model';
import { summarise } from '@/lib/wealth/calc';
import { checks, type Area } from '@/lib/wealth/checks';
import { backupFileName, useWealth, wealthActions } from '@/lib/wealth/store';
import { cn } from '@/lib/utils';
import { Hero } from './Hero';
import { HeadPicker } from './HeadPicker';
import { ItemEditor } from './ItemEditor';
import { ChecksPanel, ItemsPanel, NomineesPanel, Overview, type Tab } from './Panels';
import { Household, RestoreModal, saveFile } from './Household';
import { LockScreen } from './LockScreen';
import { Welcome } from './Welcome';
import { SignedInContext } from './shared';

/**
 * Wealth Tracker: the whole tool, on one screen.
 *
 * Reads the signed-in person's record from this browser (lib/wealth/store) and
 * shows one of four things: a moment of loading, the lock screen, the welcome
 * for an empty record, or the record itself. The record is a hero with the net
 * worth, and six tabs: an overview, what is owned, what is owed, nominees, the
 * checks, and the household with the record's own data controls.
 *
 * Every entry is added and changed in one editor (ItemEditor), opened from a
 * list row, from a check's "Open" (at the part the check is about), or by the
 * guided first run, which walks through the heads ticked on the welcome screen
 * one after another.
 */

type Editing = { item: Item; isNew: boolean; focus?: Area };

/**
 * The guided first run: the heads ticked on the welcome screen, which one is
 * open, the entry saved at each step (so Back reopens it to change), and any
 * draft left on a step by going Back (so Next does not lose it).
 */
type Queue = { heads: HeadId[]; step: number; saved: Record<number, string>; drafts: Record<number, Item> };

export function WealthWorkbench({
  userId,
  selfName,
  signedIn = false,
}: {
  userId: string;
  selfName: string;
  /** Signed in, so the record is also kept in the account (lib/cloud). */
  signedIn?: boolean;
}) {
  return (
    <SignedInContext.Provider value={signedIn}>
      <Workbench userId={userId} selfName={selfName} />
    </SignedInContext.Provider>
  );
}

function Workbench({ userId, selfName }: { userId: string; selfName: string }) {
  const { state, prefs } = useWealth(userId, selfName);
  const actions = useMemo(() => wealthActions(userId), [userId]);
  const today = useMemo(() => todayIso(), []);
  const [tab, setTab] = useState<Tab>('overview');
  const [picker, setPicker] = useState<Side | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [began, setBegan] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const record = state.record;
  const holder = prefs.holder && record.profile.members.some((m) => m.id === prefs.holder) ? prefs.holder : '';
  const items = holder ? record.items.filter((i) => i.holder === holder) : record.items;
  const summary = useMemo(() => summarise(record, holder || undefined), [record, holder]);
  const findings = useMemo(() => {
    const all = checks(record, today);
    if (!holder) return all;
    const mine = new Set(items.map((i) => i.id));
    return all.filter((f) => !f.itemId || mine.has(f.itemId));
  }, [record, today, holder, items]);

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'unavailable') {
    return (
      <Notice>
        This browser is not letting the page store anything, so there is nowhere to keep the record. Private or
        incognito windows often do this; open Wealth Tracker in an ordinary window.
      </Notice>
    );
  }
  if (state.status === 'locked') {
    return <LockScreen onUnlock={(code) => actions.unlock(code)} onStartOver={() => actions.startOver(selfName)} />;
  }

  const openItem = (id: string, focus?: Area) => {
    const item = record.items.find((i) => i.id === id);
    if (item) setEditing({ item, isNew: false, focus });
  };

  const startNew = (headId: HeadId) => setEditing({ item: blankItem(headId, holder || undefined), isNew: true });

  /** Opens a step of the guided run: its draft, else what was saved there, else a blank. */
  const openStep = (q: Queue, step: number) => {
    if (step >= q.heads.length) {
      setQueue(null);
      setEditing(null);
      setTab('overview');
      return;
    }
    const saved = q.saved[step] ? record.items.find((i) => i.id === q.saved[step]) : undefined;
    const item = q.drafts[step] ?? saved ?? blankItem(q.heads[step]);
    setQueue({ ...q, step });
    setEditing({ item, isNew: !saved });
  };

  /** Next, after a save (the entry's id is kept for Back) or a skip (nothing kept). */
  const nextInQueue = (savedId?: string) => {
    if (!queue) return setEditing(null);
    const drafts = { ...queue.drafts };
    delete drafts[queue.step];
    const saved = { ...queue.saved };
    if (savedId) saved[queue.step] = savedId;
    openStep({ ...queue, saved, drafts }, queue.step + 1);
  };

  const backInQueue = (draft: Item) => {
    if (!queue || queue.step === 0) return;
    openStep({ ...queue, drafts: { ...queue.drafts, [queue.step]: draft } }, queue.step - 1);
  };

  const doExport = async (kind: 'pdf-full' | 'pdf-masked' | 'excel') => {
    setExportError(null);
    try {
      const { exportFile } = await import('@/lib/wealth/exports');
      const { blob, name } = await exportFile(kind, record, today);
      saveFile(blob, name);
    } catch {
      setExportError('The file could not be made. Try again; if it keeps failing, download a backup instead.');
    }
  };

  const showWelcome = record.items.length === 0 && !began && !queue;

  return (
    <div className="space-y-6">
      {state.saveError && (
        <Notice tone="var(--status-rejected)">
          {state.saveError}{' '}
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={async () => saveFile(new Blob([await actions.backup()], { type: 'application/json' }), backupFileName())}
          >
            Download a backup
          </button>
        </Notice>
      )}

      {showWelcome ? (
        <Welcome
          selfName={record.profile.members[0]?.name || selfName}
          onRestore={() => setRestoreOpen(true)}
          onStart={(name, heads) => {
            actions.setProfile({
              ...record.profile,
              members: record.profile.members.map((m) => (m.id === 'self' ? { ...m, name: name.trim() } : m)),
            });
            setBegan(true);
            if (heads.length > 0) {
              setQueue({ heads, step: 0, saved: {}, drafts: {} });
              setEditing({ item: blankItem(heads[0]), isNew: true });
            }
          }}
        />
      ) : (
        <>
          <Hero
            summary={summary}
            profile={record.profile}
            holder={holder}
            onHolder={(id) => actions.setPrefs({ holder: id })}
            hide={prefs.hide}
            onHide={() => actions.setPrefs({ hide: !prefs.hide })}
            locked={state.hasLock}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => setPicker('asset')}>
              <Plus className="size-4" aria-hidden />
              Something you own
            </Button>
            <Button onClick={() => setPicker('liability')}>
              <Plus className="size-4" aria-hidden />
              Something you owe
            </Button>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => doExport('pdf-full')}>
                <FileText className="size-3.5" aria-hidden />
                PDF
              </Button>
              <Button variant="ghost" size="sm" onClick={() => doExport('excel')}>
                <Download className="size-3.5" aria-hidden />
                Excel
              </Button>
            </div>
          </div>
          {exportError && <Notice tone="var(--status-rejected)">{exportError}</Notice>}

          <Tabs
            tab={tab}
            onTab={setTab}
            counts={{
              own: items.filter((i) => head(i.head).side === 'asset').length,
              owe: items.filter((i) => head(i.head).side === 'liability').length,
              checks: findings.filter((f) => f.severity !== 'note').length,
              nominees: summary.nominees.applicable - summary.nominees.yes,
            }}
          />

          <div key={tab} className="animate-[rise_0.35s_cubic-bezier(0.22,1,0.36,1)_backwards]">
            {tab === 'overview' && (
              <Overview
                items={items}
                summary={summary}
                findings={findings}
                hide={prefs.hide}
                today={today}
                onOpen={openItem}
                onTab={setTab}
                onAdd={(side) => setPicker(side)}
              />
            )}
            {(tab === 'own' || tab === 'owe') && (
              <ItemsPanel
                side={tab === 'own' ? 'asset' : 'liability'}
                record={record}
                items={items}
                findings={findings}
                hide={prefs.hide}
                onOpen={openItem}
                onAdd={(side, h) => (h ? startNew(h) : setPicker(side))}
              />
            )}
            {tab === 'nominees' && <NomineesPanel record={record} items={items} onOpen={openItem} onTab={setTab} />}
            {tab === 'checks' && <ChecksPanel findings={findings} onOpen={openItem} onTab={setTab} />}
            {tab === 'household' && (
              <Household record={record} actions={actions} hasLock={state.hasLock} onExport={doExport} selfName={selfName} />
            )}
          </div>
        </>
      )}

      <HeadPicker
        open={picker !== null}
        side={picker ?? 'asset'}
        onClose={() => setPicker(null)}
        onPick={(id) => {
          setPicker(null);
          startNew(id);
        }}
      />

      {editing && (
        <ItemEditor
          open
          initial={editing.item}
          isNew={editing.isNew}
          record={record}
          focus={editing.focus}
          guide={
            queue
              ? { step: queue.step + 1, total: queue.heads.length, onSkip: () => nextInQueue(), onBack: backInQueue }
              : undefined
          }
          onSave={(item) => {
            actions.saveItem(item);
            if (queue) nextInQueue(item.id);
            else {
              setEditing(null);
              const side = head(item.head).side;
              if (editing.isNew && (tab === 'overview' || tab === (side === 'asset' ? 'owe' : 'own'))) setTab(side === 'asset' ? 'own' : 'owe');
            }
          }}
          onSaveAnother={(item) => {
            actions.saveItem(item);
            setEditing({ item: blankItem(item.head, item.holder), isNew: true });
          }}
          onDelete={(id) => {
            actions.deleteItem(id);
            if (queue) {
              // Deleting a step's saved entry during the guided run leaves the
              // step open, blank, rather than ending the run.
              const saved = { ...queue.saved };
              delete saved[queue.step];
              setQueue({ ...queue, saved });
              setEditing({ item: blankItem(queue.heads[queue.step]), isNew: true });
            } else setEditing(null);
          }}
          onClose={() => {
            setEditing(null);
            setQueue(null);
          }}
        />
      )}

      <RestoreModal
        open={restoreOpen}
        current={record.items.length}
        onClose={() => setRestoreOpen(false)}
        onRestore={(r) => {
          actions.replace(r);
          setBegan(true);
        }}
      />
    </div>
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'own', label: 'What you own' },
  { id: 'owe', label: 'What you owe' },
  { id: 'nominees', label: 'Nominees' },
  { id: 'checks', label: 'Checks' },
  { id: 'household', label: 'Household & data' },
];

function Tabs({
  tab,
  onTab,
  counts,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  counts: Partial<Record<Tab, number>>;
}) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div role="tablist" aria-label="Wealth record" className="surface-sunken inline-flex min-w-max gap-1 rounded-2xl border p-1">
        {TABS.map((t) => {
          const on = tab === t.id;
          const n = counts[t.id];
          const alert = (t.id === 'checks' || t.id === 'nominees') && n && n > 0;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onTab(t.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap transition',
                on ? 'bg-[var(--surface-raised)] text-[var(--text-c)] shadow-[var(--elev-1)]' : 'text-muted hover:text-[var(--text-c)]',
              )}
            >
              {t.label}
              {n !== undefined && n > 0 && (
                <span
                  style={alert ? ({ '--tone': 'var(--status-warn)' } as CSSProperties) : undefined}
                  className={cn(
                    'min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold tabular-nums',
                    alert ? 'tinted border' : 'bg-[var(--surface-sunken)]',
                  )}
                >
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-6" aria-busy>
      <Skeleton className="h-72 rounded-[2rem]" />
      <Skeleton className="h-10 w-80 rounded-2xl" />
      <Skeleton className="h-64 rounded-3xl" />
    </div>
  );
}

function Notice({ children, tone = 'var(--status-warn)' }: { children: React.ReactNode; tone?: string }) {
  return (
    <div style={{ '--tone': tone } as CSSProperties} role="status" className="tinted flex gap-2.5 rounded-2xl border px-4 py-3 text-sm">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="text-[var(--text-c)]">{children}</div>
    </div>
  );
}
