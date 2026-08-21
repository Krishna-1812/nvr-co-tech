'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Building2, Check, Copy, ExternalLink, Link2, RefreshCw, Stethoscope } from 'lucide-react';
import type { Person } from '@/lib/analytics/people';
import type { Read } from '@/lib/analytics/ai';
import type { EnrichedPerson } from '@/app/actions/insight';
import { checkEnrichment, summarisePerson } from '@/app/actions/insight';
import { Button } from '@/components/ui/primitives';
import { WideModal } from '@/components/ui/Drawer';
import { duration, number, NUM } from '@/components/analytics/Figures';
import { Chip, Journey } from '@/components/analytics/Journey';
import { Avatar } from '@/components/analytics/People';
import { accentFor, displayName } from '@/lib/analytics/identity';
import { cn } from '@/lib/utils';

/**
 * One person, in full: the richest surface in the section.
 *
 * A centred modal rather than a side drawer, and that is a considered
 * difference. Every other panel here is one column of one person's history, which
 * a drawer suits. This one sets what a third party knows about somebody against
 * what we have watched them do, and it is meant to be read across the middle —
 * so it needs the width, and it needs to be the thing you are looking at rather
 * than something parked beside a table.
 *
 * The honesty rule running through it: an absence is always explained. There are
 * four different reasons the left column can be empty and they need four
 * different things done about them, only one of which is about this person. A
 * single "no data available" would hide a broken API key behind what looks like
 * a quiet customer.
 */

const INTENT_TONE = {
  high: 'var(--h-emerald)',
  medium: 'var(--h-amber)',
  low: 'var(--text-subtle)',
} as const;

export function Profile({
  person,
  enriched,
  days,
  onClose,
}: {
  person: Person | null;
  enriched: EnrichedPerson | undefined;
  days: number;
  onClose: () => void;
}) {
  /**
   * Keyed by address rather than held as one current value.
   *
   * Resetting a "current summary" when the panel changes person would mean
   * writing state synchronously in an effect, which cascades a render. Holding a
   * map instead makes the reset implicit — a different address is simply a
   * different key, absent until its request lands — so the only write happens in
   * the promise callback. Re-opening somebody already read is then instant and
   * costs nothing.
   */
  const [reads, setReads] = useState<Record<string, Read | 'off' | 'failed'>>({});

  const email = person?.email ?? null;
  const entry = email ? reads[email] : undefined;

  useEffect(() => {
    if (!person || reads[person.email] !== undefined) return;

    let live = true;

    // Asked for only once the panel is actually open, and only after enrichment
    // has already been prefetched for the table — so the model is reasoning
    // about somebody whose company is known rather than about a bare address.
    void summarisePerson(
      {
        email: person.email,
        company: person.company,
        visits: person.visits,
        pageViews: person.pageViews,
        seconds: person.seconds,
        features: person.features,
        runs: person.runs,
        preSignupPages: person.preSignupPages,
        firstSeen: person.firstSeen,
        lastSeen: person.lastSeen,
      },
      days,
    ).then((result) => {
      if (!live) return;
      setReads((prior) => ({
        ...prior,
        [person.email]: result.ok
          ? result.read
          : result.reason === 'not-configured'
            ? 'off'
            : 'failed',
      }));
    });

    return () => {
      live = false;
    };
  }, [person, days, reads]);

  if (!person) return null;

  const accent = accentFor(person.email);
  const name = displayName(person.name, person.email);
  const match = enriched?.person ?? null;

  return (
    <WideModal open onClose={onClose} title={name}>
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div
        className="border-b px-6 py-6"
        style={{ background: `linear-gradient(160deg, color-mix(in oklab, ${accent} 8%, transparent), transparent 60%)` }}
      >
        <div className="flex flex-wrap items-start gap-5">
          <Avatar
            email={person.email}
            name={person.name}
            photo={person.photo}
            lastSeen={person.lastSeen}
            size={90}
          />

          <div className="min-w-0 flex-1">
            <h2 className="text-[1.5rem] leading-tight font-semibold tracking-tight text-pretty">
              {name}
            </h2>

            {match?.title && (
              <p className="text-muted mt-1 text-[13px]">
                {match.title}
                {match.company && (
                  <>
                    {' at '}
                    <span className="font-semibold" style={{ color: accent }}>
                      {match.company}
                    </span>
                  </>
                )}
              </p>
            )}

            <p className={cn(NUM, 'text-subtle mt-1.5 text-[12px]')}>{person.email}</p>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {person.company ? (
                <Chip tone="var(--h-violet)">
                  <Building2 className="size-3" aria-hidden />
                  {person.company}
                </Chip>
              ) : (
                <Chip tone="var(--text-subtle)">Personal email address</Chip>
              )}
              {person.source && <Chip tone="var(--h-cyan)">&#8599; {person.source}</Chip>}
              {person.preSignupPages > 0 && (
                <Chip tone="var(--h-lime)">
                  <Link2 className="size-3" aria-hidden />
                  {number(person.preSignupPages)} pages before signing up
                </Chip>
              )}
            </div>

            {/* Labelled, not bare icons. You cannot tell somebody's own LinkedIn
                from their employer's by looking at two identical glyphs, and
                opening the wrong one wastes the reader's time. */}
            {(match?.linkedin || person.company) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {match?.linkedin && (
                  <a
                    href={match.linkedin}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="a-ring text-muted inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition hover:text-[var(--text-c)]"
                  >
                    <ExternalLink className="size-3" aria-hidden />
                    LinkedIn <span className="text-subtle">(this person)</span>
                  </a>
                )}
                {person.company && (
                  <a
                    href={`https://${person.company}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="a-ring text-muted inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition hover:text-[var(--text-c)]"
                  >
                    <ExternalLink className="size-3" aria-hidden />
                    Website <span className="text-subtle">({person.company})</span>
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── The model's read ───────────────────────────────────────────────── */}
      <div
        className="border-b px-6 py-4"
        style={{ background: `color-mix(in oklab, ${accent} 5%, transparent)` }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="a-label">Read</span>
          {typeof entry === 'object' && (
            <span
              style={{ ['--tone' as string]: INTENT_TONE[entry.intent] }}
              className="tinted rounded-full border px-2 py-px text-[10.5px] font-semibold capitalize"
            >
              {entry.intent} intent
            </span>
          )}
        </div>

        {entry === undefined ? (
          <div className="mt-2 space-y-2" aria-label="Writing a summary">
            <span className="block h-3.5 w-2/5 animate-[shimmer_1.4s_ease-in-out_infinite] rounded bg-[var(--surface-sunken)]" />
            <span className="block h-3 w-4/5 animate-[shimmer_1.4s_ease-in-out_infinite] rounded bg-[var(--surface-sunken)]" />
          </div>
        ) : typeof entry === 'object' ? (
          <>
            <p className="mt-1.5 text-[13.5px] font-semibold text-pretty">{entry.headline}</p>
            <p className="text-muted mt-1 text-[12.5px] leading-relaxed text-pretty">{entry.summary}</p>
          </>
        ) : (
          <p className="text-subtle mt-1.5 text-[12px] leading-relaxed text-pretty">
            {entry === 'off'
              ? 'No ANTHROPIC_API_KEY is set on this deployment, so no summary is written. Everything else on this page is unaffected.'
              : 'A summary could not be written just now. The figures on this page are unaffected — reopening the panel will try again.'}
          </p>
        )}
      </div>

      {/* ── Two columns ────────────────────────────────────────────────────── */}
      <div className="grid gap-0 lg:grid-cols-[51fr_49fr] lg:divide-x">
        <section className="px-6 py-5">
          <h3 className="a-label mb-3">What a third party knows</h3>
          <Enrichment enriched={enriched} email={person.email} />
        </section>

        <section className="px-6 py-5">
          <h3 className="a-label mb-3">What we have watched them do</h3>

          <div className="grid grid-cols-3 gap-2">
            <Tile label="Visits" value={number(person.visits)} accent="var(--h-indigo)" />
            <Tile label="Tool opens" value={number(person.runs)} accent="var(--h-emerald)" />
            <Tile label="Page views" value={number(person.pageViews)} accent="var(--h-cyan)" />
            <Tile label="On screen" value={duration(person.seconds)} accent="var(--h-amber)" />
            <Tile
              label="Before signing up"
              value={number(person.preSignupPages)}
              accent="var(--h-lime)"
            />
            <Tile label="Tools" value={number(person.features.length)} accent="var(--h-violet)" />
          </div>

          <dl className="mt-4 divide-y border-y">
            <Row label="First seen" value={day(person.firstSeen)} />
            <Row label="Last active" value={day(person.lastSeen)} />
            <Row
              label="Device"
              value={[person.browser, person.os, person.device].filter(Boolean).join(' · ') || '—'}
            />
            <Row label="First came from" value={person.source ?? 'Direct, or before tracking'} />
          </dl>

          {person.features.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {person.features.map((slug) => (
                <Chip key={slug} tone={accentFor(slug)}>
                  {slug}
                </Chip>
              ))}
            </div>
          )}

          <h4 className="a-label mt-5 mb-3">Everything, in order</h4>
          {/* The one timeline in the product where all four kinds appear
              together: anonymous browsing, signing in, signed-in views and tool
              opens, interleaved. */}
          <Journey
            events={person.journey}
            empty="Nothing recorded for this person in the window being shown."
          />
        </section>
      </div>
    </WideModal>
  );
}

/**
 * The left column, and the four ways it can be empty.
 *
 * Each state names what is actually true, because each needs something different:
 * set a key, wait for a prefetch, accept that a personal address has no employer,
 * or accept that the provider genuinely has no record. Collapsing them would
 * make a broken key indistinguishable from a quiet customer.
 */
function Enrichment({ enriched, email }: { enriched: EnrichedPerson | undefined; email: string }) {
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const runCheck = async () => {
    setChecking(true);
    const result = await checkEnrichment();
    setDiagnosis(result.detail);
    setChecking(false);
  };

  const match = enriched?.person ?? null;

  if (match) {
    return (
      <div className="space-y-4">
        <div>
          <p className="a-label mb-1.5">Contact</p>
          <CopyRow value={match.email ?? email} verified={Boolean(match.email)} />
          {!match.email && (
            <p className="text-subtle mt-1.5 text-[11px]">
              The provider matched this person but returned no address of their own, so the one
              above is what they signed up with.
            </p>
          )}
        </div>

        <dl className="divide-y border-y">
          {match.title && <Row label="Title" value={match.title} />}
          {match.company && <Row label="Company" value={match.company} />}
          <Row label="Match confidence" value={`${Math.round(match.confidence * 100)}%`} />
        </dl>

        {match.linkedin && (
          <a
            href={match.linkedin}
            target="_blank"
            rel="noreferrer noopener"
            className="a-ring text-muted inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] transition hover:text-[var(--text-c)]"
          >
            <ExternalLink className="size-3" aria-hidden />
            Their LinkedIn
          </a>
        )}

        <p className="text-subtle text-[11px] leading-relaxed">
          Supplied by a third party, not observed by us. Confidence is never shown as certainty
          because a provider match is somebody else&rsquo;s inference.
        </p>
      </div>
    );
  }

  const reason =
    enriched?.status === 'not-configured'
      ? 'Enrichment is not configured on this deployment, so no lookup was attempted. Nothing is wrong with this person.'
      : enriched?.status === 'personal-email'
        ? 'This is a personal email address, so no company lookup is attempted. Guessing an employer from a webmail domain is how a dashboard ends up claiming somebody works at Gmail.'
        : enriched?.status === 'company-only'
          ? 'No record of this individual, but their domain resolved to a company.'
          : enriched === undefined
            ? 'Still fetching, or not fetched yet.'
            : 'The provider was reached and genuinely has no record of this person.';

  return (
    <div className="space-y-3">
      <p className="text-muted rounded-xl border border-dashed px-4 py-4 text-[12.5px] leading-relaxed text-pretty">
        {reason}
      </p>

      {enriched?.company && (
        <div className="rounded-xl border p-3">
          <p className="text-[13px] font-semibold">{enriched.company.name ?? enriched.company.domain}</p>
          <p className={cn(NUM, 'text-subtle text-[11px]')}>{enriched.company.domain}</p>
          {enriched.company.description && (
            <p className="text-muted mt-2 text-[12px] leading-relaxed text-pretty">
              {enriched.company.description}
            </p>
          )}
        </div>
      )}

      {enriched?.status !== 'personal-email' && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={runCheck} loading={checking}>
            <Stethoscope className="size-3.5" aria-hidden />
            Check the connection
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="size-3.5" aria-hidden />
            Try again
          </Button>
        </div>
      )}

      {diagnosis && (
        <p className="text-muted rounded-lg border px-3 py-2 text-[11.5px] leading-relaxed">
          {diagnosis}
        </p>
      )}
    </div>
  );
}

function CopyRow({ value, verified }: { value: string; verified: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Older browsers, and any page not served over a secure origin, have no
      // clipboard API. Selecting the text still works, so this is not worth an
      // error — but silently doing nothing would be, hence no tick.
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <span className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5">
      <span className={cn(NUM, 'flex-1 truncate text-[12px]')}>{value}</span>
      {verified && (
        <BadgeCheck className="size-3.5 shrink-0 text-[var(--h-emerald)]" aria-label="Verified" />
      )}
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${value}`}
        className="a-ring text-muted shrink-0 rounded p-0.5 transition hover:text-[var(--text-c)]"
      >
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      </button>
    </span>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl border p-2.5" style={{ ['--tone' as string]: accent }}>
      <p
        className="a-figure text-[1.35rem]"
        style={{
          background: `linear-gradient(135deg, var(--text-c) 15%, color-mix(in oklab, ${accent} 85%, var(--text-c)) 95%)`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        }}
      >
        {value}
      </p>
      <p className="a-label mt-1 text-[9px]">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className="text-subtle shrink-0 text-[11.5px]">{label}</dt>
      <dd className="truncate text-right text-[12px] font-medium" title={value}>
        {value}
      </dd>
    </div>
  );
}

const day = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
