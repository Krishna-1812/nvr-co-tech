'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import {
  CornerDownLeft,
  LayoutGrid,
  LogOut,
  Monitor,
  Moon,
  Search,
  Sparkles,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { sectionFor } from '@/lib/nav';
import { VOUCHER_STATUSES, STATUS_META, type UserRole } from '@/lib/domain/workflow';
import { createClient } from '@/lib/supabase/client';
import { setTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

/**
 * Everything this app can do, one keystroke away.
 *
 * The case for it in a voucher system is not novelty. The two things people do
 * here all day are "go to the thing waiting on me" and "find one voucher out of
 * two thousand", and both currently cost a trip to the rail, a page load and a
 * click into a search box. ⌘K collapses that to typing what you want.
 *
 * Deliberately not a search index. The register is filtered on the server with
 * permissions applied, so a free-text query becomes a navigation to /vouchers?q=
 * rather than a list of rows fetched here — the palette never sees a voucher it
 * would have to decide whether you are allowed to see.
 *
 * It offers the tool you are in, not every tool the platform runs. Somewhere
 * between two solutions and eight, one palette listing all of them stops being a
 * shortcut and becomes a second menu you have to read. "All solutions" is here,
 * one keystroke away, and it goes to the screen built for choosing.
 */

type Action = {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  group: string;
  /** Extra words that should match this action but are not worth displaying. */
  keywords?: string;
  run: () => void;
};

export function CommandPalette({ sectionSlug, role }: { sectionSlug: string; role: UserRole }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // ⌘K on a Mac, Ctrl+K everywhere else. Also "/" when nothing else has focus,
  // which is the other muscle memory people arrive with.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName));

      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        // The same clear-on-close as the dialog's own handler. Inlined rather than
        // calling close(), which would put a new function in this effect's deps and
        // rebind the listener on every render.
        if (open) {
          setOpen(false);
          setQuery('');
          setCursor(0);
        } else {
          setOpen(true);
        }
      } else if (e.key === '/' && !typing && !open) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const actions = useMemo<Action[]>(() => {
    const go = (href: string) => () => router.push(href);
    const section = sectionFor(sectionSlug, { role });

    return [
      ...(section.primary
        ? [
            {
              id: 'primary',
              label: section.primary.label,
              hint:
                section.slug === 'voucher-desk'
                  ? 'Starts a private draft'
                  : 'Clears the screen and starts again',
              icon: section.primary.icon,
              group: 'Do',
              keywords: 'create raise add new start',
              run: go(section.primary.href),
            },
          ]
        : []),
      ...section.items.map((item) => ({
        id: `go-${item.href}`,
        label: item.label,
        hint: item.hint,
        icon: item.icon,
        group: 'Go to',
        run: go(item.href),
      })),
      // The assistant is on every screen behind ⌘J, which is exactly the sort of
      // thing nobody discovers. So it is also here, where people look.
      {
        id: 'go-ask',
        label: 'Ask',
        hint: 'Questions about the tools and the accounting',
        icon: Sparkles,
        group: 'Go to',
        keywords: 'assistant chat help ai question explain',
        run: go('/ask'),
      },
      // Out of this tool and back up to the platform. Last in the group on
      // purpose: it is the one destination here that leaves where you are.
      {
        id: 'go-hub',
        label: 'All solutions',
        hint: 'Every tool the firm runs',
        icon: LayoutGrid,
        group: 'Go to',
        keywords: 'hub workspace home agents platform switch',
        run: go('/hub'),
      },
      // Only where there is a register to filter. Offering voucher statuses
      // inside a reconciliation would be offering somebody else's screen.
      ...(section.slug === 'voucher-desk'
        ? VOUCHER_STATUSES.map((status) => ({
            id: `filter-${status}`,
            label: STATUS_META[status].label,
            hint: STATUS_META[status].description,
            icon: Search,
            group: 'Filter the register',
            keywords: `status ${status.replace('_', ' ')}`,
            run: go(`/vouchers?status=${status}`),
          }))
        : []),
      ...([
        ['light', Sun, 'Light'],
        ['dark', Moon, 'Dark'],
        ['system', Monitor, 'Match my system'],
      ] as const).map(([value, icon, label]) => ({
        id: `theme-${value}`,
        label,
        hint: 'Appearance on this device',
        icon,
        group: 'Appearance',
        keywords: `theme ${value} colour color mode`,
        run: () => setTheme(value),
      })),
      {
        id: 'signout',
        label: 'Sign out',
        hint: 'Ends this session on this device',
        icon: LogOut,
        group: 'Session',
        run: async () => {
          await createClient().auth.signOut();
          router.push('/login');
          router.refresh();
        },
      },
    ];
  }, [role, router, sectionSlug]);

  /** Only Voucher Desk has a register, so only there does a stray query search one. */
  const searchable = sectionSlug === 'voucher-desk';

  /*
   * Matching is a subsequence test, not a substring one: "apr" should find
   * Approvals and "sntbk" should find Sent back. Anything cleverer than this
   * (scoring, typo tolerance) would be a library, and a list of twenty actions
   * does not need one.
   */
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;

    const matches = (a: Action) => {
      const hay = `${a.label} ${a.group} ${a.keywords ?? ''} ${a.hint ?? ''}`.toLowerCase();
      let i = 0;
      for (const ch of q) {
        i = hay.indexOf(ch, i);
        if (i === -1) return false;
        i += 1;
      }
      return true;
    };

    const found = actions.filter(matches);
    if (found.length > 0) return found;

    // A query that matches nothing is still a search of the register — which is
    // the most likely reason somebody typed a voucher number in here. There is
    // no equivalent inside a reconciliation, so nothing is offered there rather
    // than sending somebody into another tool's search results.
    return searchable
      ? [
          {
            id: 'search',
            label: `Search the register for “${query.trim()}”`,
            hint: 'Voucher number, payee, invoice or event',
            icon: Search,
            group: 'Find',
            run: () => router.push(`/vouchers?q=${encodeURIComponent(query.trim())}`),
          } satisfies Action,
        ]
      : [];
  }, [actions, query, router, searchable]);

  /*
   * Any change to the query invalidates where the cursor was pointing, so it goes
   * back to the top.
   *
   * Adjusted during render against the query the cursor was set for, rather than in
   * an effect. An effect would render the stale pairing once — highlighting row four
   * of a list that no longer has four rows — and then correct it on a second pass.
   * This is the pattern React documents for state derived from changing input.
   */
  const [cursorFor, setCursorFor] = useState(query);
  if (cursorFor !== query) {
    setCursorFor(query);
    setCursor(0);
  }

  /** Closing always clears, so the palette never reopens mid-thought. */
  const close = () => {
    setOpen(false);
    setQuery('');
    setCursor(0);
  };

  const runAt = (i: number) => {
    const action = results[i];
    if (!action) return;
    close();
    action.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Nothing matched, so there is nothing to move between. Without this guard
    // the modulo is a division by zero and the cursor becomes NaN.
    if (results.length === 0) return;

    if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
      e.preventDefault();
      setCursor((c) => (c + 1) % results.length);
    } else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
      e.preventDefault();
      setCursor((c) => (c - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runAt(cursor);
    }
  };

  // Keep the highlighted row on screen when it is driven from the keyboard.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  let group = '';

  return (
    <>
      <PaletteTrigger onClick={() => setOpen(true)} />

      <Dialog.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <Dialog.Portal>
          <Dialog.Overlay className="animate-[fade_0.18s_ease-out] fixed inset-0 z-50 bg-black/45 backdrop-blur-[3px]" />
          <Dialog.Content
            aria-label="Command palette"
            onKeyDown={onKeyDown}
            className="a-ring animate-[pop_0.2s_cubic-bezier(0.34,1.56,0.64,1)] elev-4 fixed top-[12vh] left-1/2 z-50 flex max-h-[70vh] w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-2xl border bg-[var(--surface-raised)]"
          >
            <Dialog.Title className="sr-only">Command palette</Dialog.Title>

            {/* The one place in the app that gets the full gradient as a hairline:
                it marks the surface that can do anything. */}
            <span aria-hidden className="gradient-brand h-[3px] shrink-0" />

            <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
              <Search className="text-subtle size-4 shrink-0" aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  searchable ? 'Search actions, or type a voucher number…' : 'Search actions…'
                }
                aria-label="Search actions"
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--text-subtle)]"
              />
              <Kbd>Esc</Kbd>
            </div>

            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2">
              {results.map((action, i) => {
                const heading = action.group !== group ? action.group : null;
                group = action.group;
                const on = i === cursor;

                return (
                  <div key={action.id}>
                    {heading && <p className="a-label px-2.5 pt-3 pb-1.5">{heading}</p>}
                    <button
                      type="button"
                      data-active={on}
                      onClick={() => runAt(i)}
                      onPointerMove={() => setCursor(i)}
                      className={cn(
                        'relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors',
                        on ? 'bg-[var(--surface-sunken)]' : 'hover:bg-[var(--surface-sunken)]',
                      )}
                    >
                      {on && (
                        <span
                          aria-hidden
                          className="gradient-brand absolute top-1/2 left-0 h-6 w-[3px] -translate-y-1/2 rounded-r-full"
                        />
                      )}
                      <span
                        className={cn(
                          'grid size-8 shrink-0 place-items-center rounded-lg transition',
                          on
                            ? 'gradient-brand text-white'
                            : 'surface-sunken text-subtle border',
                        )}
                      >
                        <action.icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{action.label}</span>
                        {action.hint && (
                          <span className="text-subtle block truncate text-xs">{action.hint}</span>
                        )}
                      </span>
                      {on && (
                        <CornerDownLeft className="text-subtle size-3.5 shrink-0" aria-hidden />
                      )}
                    </button>
                  </div>
                );
              })}

              {results.length === 0 && (
                <p className="text-subtle px-3 py-10 text-center text-sm">
                  Nothing here matches “{query.trim()}”.
                </p>
              )}
            </div>

            <div className="text-subtle flex shrink-0 items-center gap-4 border-t bg-[var(--surface-sunken)] px-4 py-2 text-[11px]">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd>
                to move
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>↵</Kbd>
                to run
              </span>
              <span className="numeric ml-auto">
                {results.length} {results.length === 1 ? 'action' : 'actions'}
              </span>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

/**
 * The thing in the top bar that says the palette exists.
 *
 * Shaped like a search field rather than like a button, because that is what
 * people will look for, and because a keyboard shortcut nobody is told about
 * might as well not be implemented.
 */
function PaletteTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-subtle group flex h-9 items-center gap-2.5 rounded-xl border border-[var(--border-c)] bg-[var(--surface-sunken)] px-3 transition hover:border-[var(--border-strong)] hover:text-[var(--text-c)] sm:w-72"
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="hidden truncate text-[13px] sm:block">Search or jump to…</span>
      <span className="ml-auto hidden shrink-0 items-center gap-1 sm:flex">
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="text-subtle grid h-5 min-w-5 place-items-center rounded-md border border-[var(--border-c)] bg-[var(--surface-raised)] px-1.5 font-[family-name:var(--font-mono)] text-[10px] font-medium">
      {children}
    </kbd>
  );
}
