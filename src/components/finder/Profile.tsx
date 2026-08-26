'use client';

import { useState } from 'react';
import {
  AtSign,
  Briefcase,
  Building2,
  Check,
  Copy,
  ExternalLink,
  MapPin,
  Phone,
  ShieldQuestion,
  Sparkles,
  Users,
} from 'lucide-react';
import { WideModal } from '@/components/ui/Drawer';
import { Skeleton } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import type { ProfileState } from './store';

/**
 * Everything a credit bought, laid out.
 *
 * The panel exists because the reveal is the one thing on this screen anybody
 * pays for, and a paid answer shown as three extra table cells is most of the
 * purchase thrown away. So this renders **every field the enrichment returned**,
 * in code — nothing is summarised, nothing is folded away behind a "show more",
 * and a field Apollo left blank is absent rather than drawn as an empty box.
 *
 * Two shapes, one panel. A person hangs their employer off themselves; a company
 * hangs its leadership off itself. They share the hero, the figure grid and the
 * chip row, so a reader who has learned one has learned the other.
 */

const s = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);
const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

function compact(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return '';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

function counted(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n.toLocaleString('en-IN') : '';
}

function monogram(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** A month and a year. Apollo's dates are ISO days, and the day is noise here. */
function month(value: unknown): string {
  const raw = s(value).trim();
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 7);
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

// ─── Small parts ─────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <p className="a-label mb-2">{children}</p>;
}

function Figure({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="surface-sunken min-w-0 rounded-xl border px-3 py-2">
      <p className="a-label truncate">{label}</p>
      <p className="numeric mt-0.5 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

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

/**
 * A contact detail, and the one control that matters on it.
 *
 * Copying is the only thing anybody does with a revealed address or number, and
 * making somebody select ten characters of monospace by hand is how a paid
 * detail becomes a transcription error.
 */
function Detail({
  icon,
  value,
  note,
  href,
}: {
  icon: React.ReactNode;
  value: string;
  note?: string;
  href?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="surface-sunken flex items-center gap-2.5 rounded-xl border px-3 py-2">
      <span className="text-subtle shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        {href ? (
          <a href={href} className="numeric block truncate text-sm hover:underline">
            {value}
          </a>
        ) : (
          <span className="numeric block truncate text-sm">{value}</span>
        )}
        {note && <span className="text-subtle block truncate text-[11px]">{note}</span>}
      </div>
      <button
        type="button"
        aria-label={`Copy ${value}`}
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          });
        }}
        className="text-subtle shrink-0 rounded-md p-1 transition hover:bg-[var(--surface-raised)] hover:text-[var(--text-c)]"
      >
        {copied ? (
          <Check className="size-3.5" style={{ color: 'var(--h-emerald)' }} aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )}
      </button>
    </div>
  );
}

/**
 * The band across the top.
 *
 * The accent wash is the tool's own hue rather than the brand gradient every
 * consequential modal in this app carries: nothing here can be undone or
 * approved, it is a record being read, and borrowing the decision colour for it
 * would make every reveal look like a commitment.
 */
function Hero({
  tone,
  photo,
  title,
  subtitle,
  meta,
  aside,
  children,
}: {
  tone: string;
  photo: string;
  title: string;
  subtitle: string;
  meta?: React.ReactNode;
  aside?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="relative border-b px-5 py-5 sm:px-7 sm:py-6"
      style={{
        background: `linear-gradient(150deg, color-mix(in oklab, ${tone} 16%, var(--surface-raised)), var(--surface-raised) 62%)`,
      }}
    >
      <div className="flex flex-wrap items-start gap-4">
        {photo ? (
          /* A third-party CDN URL that differs per record, so there is nothing
             to configure an image loader against — and a URL that 404s has to
             fall back to the monogram rather than to a broken-image glyph. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            className="size-16 shrink-0 rounded-2xl border object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <span
            className="grid size-16 shrink-0 place-items-center rounded-2xl text-lg font-bold text-white"
            style={{ background: tone }}
          >
            {monogram(title)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">
            {title}
          </h2>
          {subtitle && <p className="text-muted mt-0.5 text-sm">{subtitle}</p>}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>

        {/* Pushed clear of the floating close button the modal draws at top-right. */}
        {aside && <div className="mt-8 shrink-0 sm:mt-0 sm:pr-10">{aside}</div>}
      </div>
      {children}
    </div>
  );
}

/** What this cost, said plainly, including when the answer is nothing. */
function Cost({ credits }: { credits: number | null }) {
  if (credits === null) return null;
  return (
    <span
      className="tinted inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium"
      style={{ '--tone': credits > 0 ? 'var(--h-amber)' : 'var(--h-emerald)' } as React.CSSProperties}
    >
      <Sparkles className="size-3" aria-hidden />
      {credits > 0
        ? `${credits} credit${credits === 1 ? '' : 's'} spent`
        : 'no credit spent — already on file'}
    </span>
  );
}

// ─── A person ────────────────────────────────────────────────────────────────

function PersonBody({ p }: { p: Record<string, unknown> }) {
  const company = rec(p.company);
  const emails = (Array.isArray(p.emails) ? p.emails : []).map(rec);
  const phones = (Array.isArray(p.phones) ? p.phones : []).map(rec);
  const history = (Array.isArray(p.history) ? p.history : []).map(rec);
  const departments = arr(p.departments);
  const links: [string, string][] = [
    ['LinkedIn', s(p.linkedin)],
    ['Twitter', s(p.twitter)],
    ['Facebook', s(p.facebook)],
  ];

  return (
    <>
      <Hero
        tone="var(--h-indigo)"
        photo={s(p.photo)}
        title={s(p.name) || 'Name withheld'}
        subtitle={s(p.title) || s(p.headline)}
        meta={
          <>
            {s(p.seniority) && <Chip tone="var(--h-violet)">{s(p.seniority)}</Chip>}
            {departments.map((d) => (
              <Chip key={d} tone="var(--h-cyan)">
                {d}
              </Chip>
            ))}
            {s(p.location) && (
              <span className="text-subtle inline-flex items-center gap-1 text-xs">
                <MapPin className="size-3" aria-hidden />
                {s(p.location)}
                {s(p.time_zone) && ` · ${s(p.time_zone)}`}
              </span>
            )}
          </>
        }
      />

      <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="min-w-0 space-y-5">
          <section>
            <Label>How to reach them</Label>
            {emails.length === 0 && phones.length === 0 ? (
              <p className="text-muted text-sm">
                Apollo matched this person but holds no email address or phone number for them.
                That is a fact about their record, not a failed lookup.
              </p>
            ) : (
              <div className="space-y-1.5">
                {emails.map((e) => (
                  <Detail
                    key={s(e.email)}
                    icon={<AtSign className="size-3.5" aria-hidden />}
                    value={s(e.email)}
                    href={`mailto:${s(e.email)}`}
                    note={[s(e.type), s(e.status)].filter(Boolean).join(' · ')}
                  />
                ))}
                {phones.map((n) => (
                  <Detail
                    key={s(n.number)}
                    icon={<Phone className="size-3.5" aria-hidden />}
                    value={s(n.number)}
                    href={`tel:${s(n.number).replace(/\s+/g, '')}`}
                    note={[s(n.type), s(n.status)].filter(Boolean).join(' · ')}
                  />
                ))}
              </div>
            )}

            {links.some(([, url]) => url) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {links
                  .filter(([, url]) => url)
                  .map(([label, url]) => (
                    <a
                      key={label}
                      href={url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="surface-sunken text-muted inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition hover:border-[var(--border-strong)] hover:text-[var(--text-c)]"
                    >
                      {label}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  ))}
              </div>
            )}
          </section>

          {history.length > 0 && (
            <section>
              <Label>Where they have worked</Label>
              <ol className="space-y-0">
                {history.map((h, i) => (
                  <li
                    key={`${s(h.company)}-${s(h.title)}-${i}`}
                    className="relative flex gap-3 pb-3 last:pb-0"
                  >
                    {/* The rail is drawn per item and stopped on the last one,
                        so it ends at the earliest job rather than trailing off
                        into whitespace below it. */}
                    <span className="flex shrink-0 flex-col items-center">
                      <span
                        className="mt-1.5 size-2 rounded-full"
                        style={{
                          background: h.current ? 'var(--h-emerald)' : 'var(--border-strong)',
                        }}
                      />
                      {i < history.length - 1 && (
                        <span className="w-px flex-1 bg-[var(--border-c)]" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s(h.title) || 'Role not named'}</p>
                      <p className="text-muted truncate text-xs">
                        {s(h.company)}
                        {Boolean(h.start || h.end) && (
                          <span className="text-subtle">
                            {' · '}
                            {month(h.start) || '?'} – {h.current ? 'now' : month(h.end) || '?'}
                          </span>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        {/* The employer, free with the person: bulk_match returns the whole
            organisation record, so these figures cost nothing extra. */}
        {company.name ? (
          <aside className="surface-lit a-ring min-w-0 self-start rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <span
                className="grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold text-white"
                style={{ background: 'var(--h-cyan)' }}
              >
                {monogram(s(company.name))}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s(company.name)}</p>
                {s(company.domain) && (
                  <a
                    href={`https://${s(company.domain)}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-muted inline-flex items-center gap-1 truncate text-xs hover:underline"
                  >
                    {s(company.domain)}
                    <ExternalLink className="size-3 shrink-0" aria-hidden />
                  </a>
                )}
              </div>
            </div>

            <CompanyFigures c={company} />

            {s(company.description) && (
              <p className="text-muted mt-3 text-xs leading-relaxed">{s(company.description)}</p>
            )}

            <ChipRow label="Technology" values={arr(company.technologies)} />
            <ChipRow label="Tagged" values={arr(company.keywords)} />
          </aside>
        ) : (
          <aside className="surface-lit a-ring text-muted min-w-0 self-start rounded-2xl p-4 text-sm">
            Apollo returned no employer record with this person, so there is nothing here to show
            about where they work.
          </aside>
        )}
      </div>
    </>
  );
}

function CompanyFigures({ c }: { c: Record<string, unknown> }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      <Figure label="People" value={counted(c.employees)} />
      <Figure label="Revenue" value={s(c.revenue_printed) || compact(c.revenue)} />
      <Figure label="Founded" value={counted(c.founded)} />
      <Figure label="Industry" value={s(c.industry)} />
      <Figure label="HQ" value={s(c.hq)} />
      <Figure label="Phone" value={s(c.phone)} />
    </div>
  );
}

function ChipRow({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="mt-3">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1">
        {values.slice(0, 14).map((v) => (
          <Chip key={v}>{v}</Chip>
        ))}
        {values.length > 14 && <Chip>+{values.length - 14}</Chip>}
      </div>
    </div>
  );
}

// ─── A company ───────────────────────────────────────────────────────────────

function CompanyBody({ c }: { c: Record<string, unknown> }) {
  const leadership = (Array.isArray(c.leadership) ? c.leadership : []).map(rec);
  const industries = arr(c.industries).filter((i) => i !== s(c.industry));
  const links: [string, string][] = [
    ['Website', s(c.website) || (s(c.domain) ? `https://${s(c.domain)}` : '')],
    ['LinkedIn', s(c.linkedin)],
    ['Twitter', s(c.twitter)],
    ['Facebook', s(c.facebook)],
  ];

  return (
    <>
      <Hero
        tone="var(--h-cyan)"
        photo={s(c.logo)}
        title={s(c.name) || 'Unnamed company'}
        subtitle={s(c.domain)}
        meta={
          <>
            {s(c.industry) && <Chip tone="var(--h-cyan)">{s(c.industry)}</Chip>}
            {industries.slice(0, 3).map((i) => (
              <Chip key={i}>{i}</Chip>
            ))}
            {s(c.address) && (
              <span className="text-subtle inline-flex items-center gap-1 text-xs">
                <MapPin className="size-3" aria-hidden />
                {s(c.address)}
              </span>
            )}
          </>
        }
      />

      <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-4">
          <CompanyFigures c={c} />

          {s(c.description) && (
            <p className="text-muted text-sm leading-relaxed">{s(c.description)}</p>
          )}

          {links.some(([, url]) => url) && (
            <div className="flex flex-wrap gap-1.5">
              {links
                .filter(([, url]) => url)
                .map(([label, url]) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="surface-sunken text-muted inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition hover:border-[var(--border-strong)] hover:text-[var(--text-c)]"
                  >
                    {label}
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                ))}
            </div>
          )}

          <ChipRow label="Technology" values={arr(c.technologies)} />
          <ChipRow label="Tagged" values={arr(c.keywords)} />
        </div>

        <aside className="surface-lit a-ring min-w-0 self-start rounded-2xl p-4">
          <Label>Who is at the top</Label>
          {leadership.length === 0 ? (
            <p className="text-muted text-sm">
              Apollo listed nobody at this company. Searching for a title on the People tab is the
              usual next move, and it costs nothing.
            </p>
          ) : (
            <ul className="space-y-2">
              {leadership.map((person, i) => (
                <li key={s(person.id) || i} className="flex items-start gap-2.5">
                  <span className="surface-sunken grid size-7 shrink-0 place-items-center rounded-lg border text-[10px] font-bold">
                    {monogram(s(person.full_name))}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {s(person.full_name) || 'Name withheld'}
                    </p>
                    <p className="text-subtle truncate text-xs">{s(person.title)}</p>
                  </div>
                  {s(person.linkedin_url) && (
                    <a
                      href={s(person.linkedin_url)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-subtle shrink-0 transition hover:text-[var(--text-c)]"
                      title="LinkedIn profile"
                      aria-label={`${s(person.full_name)} on LinkedIn`}
                    >
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-subtle mt-3 text-[11px] leading-relaxed">
            {/* Said out loud because it is the difference between a name and a
                contact, and the price of confusing them is a wasted credit. */}
            Names only. These come from the free people search, so no address or phone number was
            bought with them.
          </p>
        </aside>
      </div>
    </>
  );
}

// ─── The panel ───────────────────────────────────────────────────────────────

function Loading({ subject }: { subject: ProfileState['subject'] }) {
  return (
    <div className="p-5 sm:p-7">
      <div className="flex items-center gap-4">
        <Skeleton className="size-16 rounded-2xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-lg font-semibold tracking-tight">
            {subject.name || subject.domain || 'Looking that up'}
          </p>
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    </div>
  );
}

export function ProfilePanel({
  profile,
  credits,
  onClose,
}: {
  profile: ProfileState;
  /** What the request that filled this panel cost. Null while it is in flight. */
  credits: number | null;
  onClose: () => void;
}) {
  const data = profile.data;
  const matched = Boolean(data?.matched);
  const name = profile.subject.name || profile.subject.domain || 'Record';

  return (
    <WideModal open onClose={onClose} title={`${name} — full record`}>
      {profile.loading ? (
        <Loading subject={profile.subject} />
      ) : profile.error ? (
        /*
         * A failure to ASK. Kept visually and verbally apart from an answer of
         * "nobody", below, because one of them is a statement about Apollo's
         * database and the other is a statement about our request.
         */
        <div className="p-7">
          <div
            className="a-ring rounded-2xl border px-4 py-3.5 text-sm"
            style={{ background: 'color-mix(in oklab, var(--h-rose) 8%, var(--surface-raised))' }}
          >
            {profile.error}
          </div>
        </div>
      ) : matched && profile.kind === 'person' ? (
        <>
          <PersonBody p={data as Record<string, unknown>} />
          <Footer credits={credits} masked={Boolean(profile.subject.name.includes('*'))} />
        </>
      ) : matched ? (
        <>
          <CompanyBody c={data as Record<string, unknown>} />
          <Footer credits={credits} masked={false} />
        </>
      ) : (
        <div className="p-7">
          <div className="surface-lit a-ring rounded-2xl px-4 py-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              {data?.lookup_failed ? (
                <ShieldQuestion className="size-4" style={{ color: 'var(--h-amber)' }} aria-hidden />
              ) : (
                <Building2 className="size-4 text-[var(--text-subtle)]" aria-hidden />
              )}
              {data?.lookup_failed ? 'Nobody could look' : 'Apollo has no record'}
            </p>
            <p className="text-muted mt-1.5 text-sm leading-relaxed">
              {data?.lookup_failed
                ? 'Apollo did not answer, so nothing was found and nothing was ruled out. No credit was spent, and trying again in a moment is free.'
                : `Apollo answered and holds nothing further for ${name}. No credit was spent — a miss is free.`}
            </p>
          </div>
        </div>
      )}
    </WideModal>
  );
}

function Footer({ credits, masked }: { credits: number | null; masked: boolean }) {
  return (
    <div className="surface-sunken flex flex-wrap items-center gap-3 border-t px-5 py-3 sm:px-7">
      <Cost credits={credits} />
      {masked && (
        <span className="text-subtle inline-flex items-center gap-1.5 text-[11px]">
          <ShieldQuestion className="size-3" aria-hidden />
          the withheld surname is now the real one
        </span>
      )}
      <span className="flex-1" />
      <span className="text-subtle inline-flex items-center gap-1.5 text-[11px]">
        <Briefcase className="size-3" aria-hidden />
        kept for 90 days, then retired
      </span>
    </div>
  );
}

/** The control that opens all of this. Rendered on every card and every row. */
export function RevealButton({
  onClick,
  enriched,
  busy,
  label,
  className,
}: {
  onClick: () => void;
  /** This row already carries a bought record, so opening it costs nothing. */
  enriched: boolean;
  busy?: boolean;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={
        enriched
          ? 'Already paid for. Opening this again costs nothing.'
          : 'Buys the full record: contact details, history and the employer. About one credit.'
      }
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium transition disabled:opacity-60',
        enriched
          ? 'text-muted hover:border-[var(--border-strong)]'
          : 'hover:border-[var(--border-strong)]',
        className,
      )}
    >
      {enriched ? (
        <Users className="size-3.5" aria-hidden />
      ) : (
        <Sparkles className="size-3.5" aria-hidden />
      )}
      {busy ? 'Opening…' : label}
    </button>
  );
}
