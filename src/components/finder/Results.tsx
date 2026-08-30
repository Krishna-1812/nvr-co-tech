'use client';

import {
  Building2,
  Check,
  ExternalLink,
  ShieldQuestion,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Entity } from './filters';
import { RevealButton } from './Profile';
import { rowId, type Row } from './store';

/**
 * A page of results, as cards or as a table.
 *
 * Cards read one person at a time; a table reads a whole page at once and is how
 * anybody actually compares twenty-four of them. Both draw from the same row, so
 * neither can show a figure the other does not have.
 */

// ─── Reading a row ───────────────────────────────────────────────────────────

const s = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);

function compact(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

function count(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n.toLocaleString('en-IN') : '';
}

/**
 * Headcount growth, which Apollo returns as a fraction: 0.19 means 19%.
 *
 * Rendered as a percent with its sign, because a bare "0.19" under a header
 * saying "growth" is a number three different surfaces once read three
 * different ways.
 */
function growth(v: unknown): { text: string; up: boolean } | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return null;
  const pct = n * 100;
  return { text: `${pct > 0 ? '+' : ''}${pct.toFixed(pct.toString().length > 5 ? 0 : 1)}%`, up: pct > 0 };
}

function place(row: Row, prefix: '' | 'organization_'): string {
  return [row[`${prefix}city`], row[`${prefix}state`], row[`${prefix}country`]]
    .map(s)
    .filter(Boolean)
    .join(', ');
}

function monogram(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

// ─── Shared bits ─────────────────────────────────────────────────────────────

function Chip({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return (
    <span
      className="tinted inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium"
      style={tone ? ({ '--tone': tone } as React.CSSProperties) : undefined}
    >
      {children}
    </span>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <p className="a-label truncate">{label}</p>
      <p className="numeric truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function Tick({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-md border transition',
        on ? 'gradient-brand border-transparent' : 'hover:border-[var(--border-strong)]',
      )}
    >
      {on && <Check className="size-3.5" aria-hidden />}
    </button>
  );
}

/**
 * Apollo withheld this surname, and the row says so.
 *
 * On screen a shortened name sits next to this badge. In an export it would be
 * just a name under a header called Name, which is why the file carries a
 * derived column for it too: a spreadsheet outlives the session that made it.
 */
function MaskedBadge() {
  return (
    <span
      title="Apollo withholds this surname until the record is enriched. The name is shortened, never guessed at."
      className="tinted inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium"
      style={{ '--tone': 'var(--h-amber)' } as React.CSSProperties}
    >
      <ShieldQuestion className="size-3" aria-hidden />
      surname withheld
    </span>
  );
}

// ─── Person ──────────────────────────────────────────────────────────────────

function PersonCard({
  row,
  on,
  toggle,
  open,
}: {
  row: Row;
  on: boolean;
  toggle: () => void;
  open: () => void;
}) {
  const name = s(row.full_name) || 'Name withheld';
  const seniority = s(row.seniority_from_title);
  const functions = arr(row.functions_from_title);
  const employer = s(row.organization_name);
  const g = growth(row.organization_growth12) ?? growth(row.organization_growth6);

  return (
    <article className="surface-lit a-ring hover-lift flex flex-col gap-3 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <Tick on={on} onClick={toggle} label={`Select ${name}`} />

        <span className="gradient-brand grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold">
          {monogram(name)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate text-[15px] font-semibold tracking-tight">{name}</h3>
            {row.name_masked === true && <MaskedBadge />}
            {row.is_saved_contact === true && (
              <Chip tone="var(--h-emerald)">already yours</Chip>
            )}
          </div>
          {s(row.title) && <p className="text-muted truncate text-sm">{s(row.title)}</p>}
        </div>

        {s(row.linkedin_url) && (
          <a
            href={s(row.linkedin_url)}
            target="_blank"
            rel="noreferrer noopener"
            className="text-subtle shrink-0 transition hover:text-[var(--text-c)]"
            aria-label={`${name} on LinkedIn`}
            title="LinkedIn profile"
          >
            <ExternalLink className="size-4" aria-hidden />
          </a>
        )}
      </div>

      {(seniority || functions.length > 0) && (
        <div className="flex flex-wrap gap-1">
          {/*
            Read off the title, never from Apollo, and labelled that way
            everywhere it appears: the free search returns neither field, and a
            chip claiming Apollo said so would be a quiet fiction.
          */}
          {seniority && <Chip tone="var(--h-violet)">{seniority}</Chip>}
          {functions.map((f) => (
            <Chip key={f} tone="var(--h-cyan)">
              {f}
            </Chip>
          ))}
        </div>
      )}

      {employer && (
        <div className="surface-sunken rounded-xl border p-3">
          <div className="flex items-center gap-2">
            <Building2 className="text-subtle size-3.5 shrink-0" aria-hidden />
            <p className="truncate text-sm font-medium">{employer}</p>
            {row.employer_unconfirmed === true && (
              <span
                title="Apollo returned no domain for this employer, so the match could not be confirmed. Kept and flagged rather than dropped."
                className="text-subtle shrink-0 text-[10px]"
              >
                unconfirmed
              </span>
            )}
          </div>

          {row.employer_lookup_failed === true ? (
            <p className="text-subtle mt-1.5 text-xs">
              This company could not be looked up, so nothing here was checked against it.
            </p>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Figure label="Industry" value={s(row.organization_industry)} />
              <Figure label="People" value={count(row.organization_employees)} />
              <Figure label="HQ" value={place(row, 'organization_')} />
              <Figure label="Revenue" value={compact(row.organization_revenue)} />
              <Figure label="Raised" value={compact(row.organization_funding)} />
              {g && (
                <div className="min-w-0">
                  <p className="a-label truncate">Headcount</p>
                  <p
                    className="numeric flex items-center gap-1 truncate text-sm font-semibold"
                    style={{ color: g.up ? 'var(--h-emerald)' : 'var(--h-rose)' }}
                  >
                    {g.up ? (
                      <TrendingUp className="size-3.5" aria-hidden />
                    ) : (
                      <TrendingDown className="size-3.5" aria-hidden />
                    )}
                    {g.text}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/*
        The card's own footer. When this row has been revealed the details it
        cost a credit to learn are shown HERE rather than only inside the panel:
        an address behind one more click is an address somebody pays for twice
        because they forgot they had it.
      */}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {s(row.email) && (
          <a
            href={`mailto:${s(row.email)}`}
            className="numeric text-muted min-w-0 truncate text-xs hover:underline"
          >
            {s(row.email)}
          </a>
        )}
        {arr(row.phones)[0] && (
          <span className="numeric text-subtle truncate text-xs">{arr(row.phones)[0]}</span>
        )}
        <span className="flex-1" />
        <RevealButton
          onClick={open}
          enriched={row.enriched === true}
          label={row.enriched === true ? 'Full record' : 'Reveal'}
        />
      </div>
    </article>
  );
}

// ─── Company ─────────────────────────────────────────────────────────────────

function CompanyCard({
  row,
  on,
  toggle,
  open,
}: {
  row: Row;
  on: boolean;
  toggle: () => void;
  open: () => void;
}) {
  const name = s(row.name) || 'Unnamed company';
  const g = growth(row.growth12) ?? growth(row.growth6);
  const tech = arr(row.technologies);

  return (
    <article className="surface-lit a-ring hover-lift flex flex-col gap-3 rounded-2xl p-4">
      <div className="flex items-start gap-3">
        <Tick on={on} onClick={toggle} label={`Select ${name}`} />

        <span
          className="grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold text-white"
          style={{ background: 'var(--h-cyan)' }}
        >
          {monogram(name)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate text-[15px] font-semibold tracking-tight">{name}</h3>
            {row.domain_unconfirmed === true && (
              <span
                title="Apollo returned no domain for this row, so it could not be confirmed against the one you asked for. Kept and flagged rather than dropped."
                className="text-subtle text-[10px]"
              >
                domain unconfirmed
              </span>
            )}
          </div>
          {s(row.primary_domain) && (
            <a
              href={`https://${s(row.primary_domain)}`}
              target="_blank"
              rel="noreferrer noopener"
              className="text-muted inline-flex items-center gap-1 truncate text-sm hover:underline"
            >
              {s(row.primary_domain)}
              <ExternalLink className="size-3 shrink-0" aria-hidden />
            </a>
          )}
        </div>
      </div>

      {s(row.industry) && (
        <div className="flex flex-wrap gap-1">
          <Chip tone="var(--h-cyan)">{s(row.industry)}</Chip>
          {arr(row.industries)
            .filter((i) => i !== s(row.industry))
            .slice(0, 2)
            .map((i) => (
              <Chip key={i}>{i}</Chip>
            ))}
        </div>
      )}

      {s(row.short_description) && (
        <p className="text-muted line-clamp-2 text-xs leading-relaxed">
          {s(row.short_description)}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Figure label="People" value={count(row.estimated_num_employees)} />
        <Figure label="Revenue" value={compact(row.annual_revenue)} />
        <Figure label="Raised" value={compact(row.total_funding)} />
        <Figure label="Founded" value={s(row.founded_year)} />
        <Figure label="HQ" value={place(row, '')} />
        {g && (
          <div className="min-w-0">
            <p className="a-label truncate">Headcount</p>
            <p
              className="numeric flex items-center gap-1 truncate text-sm font-semibold"
              style={{ color: g.up ? 'var(--h-emerald)' : 'var(--h-rose)' }}
            >
              {g.up ? (
                <TrendingUp className="size-3.5" aria-hidden />
              ) : (
                <TrendingDown className="size-3.5" aria-hidden />
              )}
              {g.text}
            </p>
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {tech.length > 0 && (
          <p className="text-subtle min-w-0 flex-1 truncate text-[11px]">
            {tech.slice(0, 5).join(' · ')}
            {tech.length > 5 && ` · +${tech.length - 5}`}
          </p>
        )}
        <span className="flex-1" />
        {/*
          A company row already carries everything the paid search returned, so
          this is not a reveal — it is the deeper record plus the free list of
          who works at the top, which is the part a search result cannot show.
        */}
        <RevealButton onClick={open} enriched={false} label="Full profile" />
      </div>
    </article>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────

const PERSON_COLUMNS: readonly (readonly [string, (r: Row) => string])[] = [
  ['Name', (r) => s(r.full_name)],
  ['Title', (r) => s(r.title)],
  ['Seniority (from title)', (r) => s(r.seniority_from_title)],
  ['Company', (r) => s(r.organization_name)],
  ['Industry', (r) => s(r.organization_industry)],
  ['People', (r) => count(r.organization_employees)],
  ['HQ', (r) => place(r, 'organization_')],
];

const COMPANY_COLUMNS: readonly (readonly [string, (r: Row) => string])[] = [
  ['Company', (r) => s(r.name)],
  ['Domain', (r) => s(r.primary_domain)],
  ['Industry', (r) => s(r.industry)],
  ['People', (r) => count(r.estimated_num_employees)],
  ['Revenue', (r) => compact(r.annual_revenue)],
  ['Founded', (r) => s(r.founded_year)],
  ['HQ', (r) => place(r, '')],
];

function ResultTable({
  rows,
  entity,
  selected,
  toggle,
  open,
}: {
  rows: Row[];
  entity: Entity;
  selected: Record<string, true>;
  toggle: (id: string) => void;
  open: (row: Row) => void;
}) {
  const columns = entity === 'companies' ? COMPANY_COLUMNS : PERSON_COLUMNS;

  return (
    <div className="surface-lit a-ring overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[52rem] text-sm">
        <thead>
          <tr className="border-b">
            <th className="w-9 px-3 py-2" />
            {columns.map(([label]) => (
              <th key={label} className="a-label whitespace-nowrap px-3 py-2 text-left">
                {label}
              </th>
            ))}
            <th className="w-px px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = rowId(row);
            return (
              <tr key={id} className="border-b transition-colors hover:bg-[var(--surface-sunken)]">
                <td className="px-3 py-2">
                  <Tick on={Boolean(selected[id])} onClick={() => toggle(id)} label="Select row" />
                </td>
                {columns.map(([label, read]) => (
                  <td
                    key={label}
                    className={cn(
                      'max-w-[16rem] truncate px-3 py-2',
                      /^(People|Revenue|Founded)$/.test(label) && 'numeric',
                    )}
                  >
                    {read(row) || <span className="text-subtle">—</span>}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  <RevealButton
                    onClick={() => open(row)}
                    enriched={row.enriched === true}
                    label={
                      entity === 'companies'
                        ? 'Profile'
                        : row.enriched === true
                          ? 'Record'
                          : 'Reveal'
                    }
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── The switch ──────────────────────────────────────────────────────────────

export function Results({
  rows,
  entity,
  view,
  selected,
  toggle,
  open,
}: {
  rows: Row[];
  /** `shownEntity`: what these rows ARE, never what the panel is set to. */
  entity: Entity;
  view: 'cards' | 'table';
  selected: Record<string, true>;
  toggle: (id: string) => void;
  /** Open the full record for one row. Costs a credit unless already bought. */
  open: (row: Row) => void;
}) {
  if (view === 'table') {
    return (
      <ResultTable rows={rows} entity={entity} selected={selected} toggle={toggle} open={open} />
    );
  }

  return (
    <div className="stagger grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {rows.map((row) => {
        const id = rowId(row);
        const props = {
          row,
          on: Boolean(selected[id]),
          toggle: () => toggle(id),
          open: () => open(row),
        };
        return entity === 'companies' ? (
          <CompanyCard key={id} {...props} />
        ) : (
          <PersonCard key={id} {...props} />
        );
      })}
    </div>
  );
}
