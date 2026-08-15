import Image from 'next/image';
import { Building2, ChevronDown, ShieldQuestion } from 'lucide-react';
import type { ConnectionType, Firmographics, PersonResult, Resolution } from '@/lib/analytics/types';
import { cn } from '@/lib/utils';
import { Meter, NUM, Pill } from './Figures';

/**
 * Showing an identification, and showing the refusal to make one.
 *
 * Both halves matter equally. A visitor that did not resolve is the normal case
 * — somewhere between a fifth and two fifths of traffic ever resolves, and that
 * is the gate working — so "not identified" has to read as a considered answer
 * rather than as a blank cell where something failed to load. Which is why
 * every one of these carries its reasons.
 */

const TYPE_COPY: Record<ConnectionType, { label: string; tone: string; why: string }> = {
  business: { label: 'Business', tone: 'var(--status-approved)', why: 'A company’s own network.' },
  education: { label: 'Education', tone: 'var(--h-cyan)', why: 'A university or a school.' },
  government: { label: 'Government', tone: 'var(--h-violet)', why: 'A government body.' },
  isp: {
    label: 'Home broadband',
    tone: 'var(--status-draft)',
    why: 'A consumer or transit provider. The name on this address is who sells them internet, not who employs them.',
  },
  mobile: {
    label: 'Mobile data',
    tone: 'var(--status-draft)',
    why: 'A phone network. There is no company behind this address to name.',
  },
  hosting: {
    label: 'Cloud or hosting',
    tone: 'var(--status-draft)',
    why: 'A datacentre. Almost always somebody’s crawler rather than somebody’s employee.',
  },
  proxy: {
    label: 'VPN or security proxy',
    tone: 'var(--status-warn)',
    why: 'Every customer of this vendor egresses from its addresses, so the name here is the vendor.',
  },
  unknown: {
    label: 'Not identifiable',
    tone: 'var(--status-draft)',
    why: 'There was a signal, but nothing in it separates a company from an access provider.',
  },
};

/** A logo when the brand index had one, initials when it did not. */
export function CompanyMark({
  name,
  logoUrl,
  size = 36,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
}) {
  const initials = name
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');

  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        unoptimized
        className="shrink-0 rounded-lg border bg-white object-contain p-1"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden
      className="a-ring grid shrink-0 place-items-center rounded-lg border bg-[var(--surface-sunken)] text-[11px] font-bold tracking-tight"
      style={{ width: size, height: size }}
    >
      {initials || <Building2 className="size-4 opacity-60" />}
    </span>
  );
}

export function ConnectionPill({ type }: { type: ConnectionType }) {
  const copy = TYPE_COPY[type];
  return (
    <Pill tone={copy.tone} title={copy.why}>
      {copy.label}
    </Pill>
  );
}

/**
 * One line saying who this was: the person if we can prove it, otherwise the
 * company if the gate allowed one, otherwise plainly nobody.
 */
export function Identity({
  resolution,
  company,
  person,
  compact = false,
}: {
  resolution: Resolution | null;
  company: Firmographics | null;
  person: PersonResult | null;
  compact?: boolean;
}) {
  if (person?.resolved) {
    const { fullName, email, title, company: employer } = person.person;
    return (
      <div className="flex min-w-0 items-center gap-2.5">
        <CompanyMark name={fullName ?? email ?? '?'} logoUrl={company?.logoUrl} size={compact ? 28 : 36} />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold">{fullName ?? email}</span>
          <span className="text-subtle block truncate text-[11.5px]">
            {[title, employer ?? company?.name].filter(Boolean).join(' · ') || email}
          </span>
        </span>
      </div>
    );
  }

  if (resolution?.identified) {
    const name = company?.name ?? resolution.companyName ?? resolution.domain!;
    return (
      <div className="flex min-w-0 items-center gap-2.5">
        <CompanyMark name={name} logoUrl={company?.logoUrl} size={compact ? 28 : 36} />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold">{name}</span>
          <span className="text-subtle block truncate text-[11.5px]">
            {resolution.domain}
            {resolution.city ? ` · ${resolution.city}` : ''}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden
        className="grid shrink-0 place-items-center rounded-lg border border-dashed bg-[var(--surface-sunken)]"
        style={{ width: compact ? 28 : 36, height: compact ? 28 : 36 }}
      >
        <ShieldQuestion className="text-subtle size-4" />
      </span>
      <span className="min-w-0">
        <span className="text-muted block truncate text-[13px]">Not identified</span>
        <span className="text-subtle block truncate text-[11.5px]">
          {resolution ? TYPE_COPY[resolution.connectionType].label : 'No address recorded'}
        </span>
      </span>
    </div>
  );
}

/**
 * How sure, and on what evidence.
 *
 * Shown even when the answer was no, because the number is the more interesting
 * half of a refusal: 0.5 on a guessed domain and 0.5 on a registry record are
 * two very different situations and only the method list tells them apart.
 */
export function Confidence({ resolution }: { resolution: Resolution }) {
  const tone = resolution.identified ? 'var(--status-approved)' : 'var(--status-draft)';

  return (
    <div className="min-w-[7rem]">
      <div className="flex items-baseline justify-between gap-2">
        <span className={cn(NUM, 'text-[12px] font-semibold')}>
          {Math.round(resolution.confidence * 100)}%
        </span>
        <span className="text-subtle text-[10.5px]">
          {resolution.methods.length} signal{resolution.methods.length === 1 ? '' : 's'}
        </span>
      </div>
      <Meter value={resolution.confidence} tone={tone} className="mt-1.5" />
    </div>
  );
}

/**
 * The full reasoning, folded away.
 *
 * This is the thing that makes the feature trustworthy rather than magical.
 * Anybody who is surprised by a row can open it and read, in order, every step
 * that led there — including the one that decided not to name somebody.
 */
export function Reasons({ resolution }: { resolution: Resolution }) {
  return (
    <details className="group">
      <summary className="text-subtle flex cursor-pointer list-none items-center gap-1.5 text-[11.5px] font-medium hover:text-[var(--text-c)]">
        <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
        Why {resolution.identified ? 'this resolved' : 'this did not resolve'}
      </summary>

      <ul className="mt-2.5 space-y-1.5 border-l pl-3">
        {resolution.reasons.map((reason, index) => (
          <li key={index} className="text-muted text-[11.5px] leading-relaxed text-pretty">
            {reason}
          </li>
        ))}
      </ul>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t pt-3 text-[11px]">
        {[
          ['Address', resolution.ip],
          ['Reverse DNS', resolution.hostname],
          ['Network', resolution.asnOrg],
          ['ASN', resolution.asn],
          ['Block size', resolution.blockSize ? resolution.blockSize.toLocaleString('en-IN') : null],
          ['Country', resolution.country],
        ]
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label as string} className="flex gap-2">
              <dt className="text-subtle shrink-0">{label}</dt>
              <dd className={cn(NUM, 'min-w-0 truncate')}>{value}</dd>
            </div>
          ))}
      </dl>
    </details>
  );
}
