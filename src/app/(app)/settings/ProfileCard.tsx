import type { CSSProperties } from 'react';
import { ShieldCheck } from 'lucide-react';
import { ROLE_META, type UserRole } from '@/lib/domain/workflow';
import { Figure } from '@/components/app/Figure';
import { Card, CardBody } from '@/components/ui/primitives';
import { NameForm } from './NameForm';

/**
 * Your own identity card.
 *
 * There is no banner. A filled brand band across the top of a card is a pattern
 * borrowed from social profiles, and it was wrong here twice over: its hard lower
 * edge cut a horizontal line straight through the avatar and through the card, and
 * a saturated slab is not what anything else in this app is made of. Everywhere
 * else the brand appears as light — an orb behind a panel, a gradient on the one
 * control that matters, a hairline along an edge — and this card now does the same.
 *
 * So: one continuous surface, lit from the top left by a brand orb, with the app's
 * grid faded out behind it and a brand hairline along the very top edge. The avatar
 * is the only filled brand object, and nothing crosses it.
 */
export function ProfileCard({
  user,
  raised,
  approved,
  memberSince,
}: {
  user: { email: string; full_name: string | null; role: UserRole };
  /** Vouchers you have raised. */
  raised: number;
  /** Vouchers you have approved. Null for someone who cannot approve. */
  approved: number | null;
  /** "Aug 2025", already in Asia/Kolkata. */
  memberSince: string;
}) {
  const initials =
    (user.full_name ?? user.email)
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join('') || '?';

  const facts = [
    { label: 'Raised', value: raised },
    ...(approved === null ? [] : [{ label: 'Approved', value: approved }]),
  ];

  return (
    <Card className="a-ring relative overflow-hidden">
      {/* ── The light ── */}
      <span
        aria-hidden
        className="a-orb -top-32 -left-20 size-80 opacity-50"
        style={{ background: 'radial-gradient(circle, var(--h-indigo), transparent 68%)' }}
      />
      <div
        aria-hidden
        className="a-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(64%_70%_at_8%_0%,#000,transparent)]"
      />
      {/* The brand, stated as an edge rather than as an area. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--color-brand-500),transparent)]"
      />

      {/* ── Who you are ── */}
      <div className="relative flex items-start gap-4 p-5 sm:gap-5 sm:p-6">
        {/*
          The same gradient mark as the account menu's avatar, so one person is drawn
          one way wherever they appear. The inset hairline along its top edge is what
          every raised object in this app has, and it is what makes this read as a
          tile sitting on the card rather than a coloured square printed on it.
        */}
        <span
          aria-hidden
          className="gradient-brand grid size-16 shrink-0 place-items-center rounded-2xl text-lg font-bold text-white shadow-[inset_0_1px_0_oklch(1_0_0_/_0.28),var(--elev-brand)]"
        >
          {initials}
        </span>

        {/* Spans to the card's right edge, which is what gives the role pill's
            `ml-auto` somewhere to go. Shrink-wrapped, it had no free space to
            consume and the pill stayed glued to the name at every width. */}
        <div className="min-w-0 flex-1 pt-0.5">
          {/*
            The role sits at the far edge of the row where there is room for it, and
            falls in beside the name where there is not. Right-aligned it reads as a
            stamp on the card and balances a row that would otherwise leave a third
            of the card empty; wrapped under the name on a phone it would read as
            floating, so below `sm` it simply follows the name.
          */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="m-display min-w-0 truncate text-[clamp(1.35rem,3.4vw,1.6rem)]">
              {user.full_name ?? user.email.split('@')[0]}
            </h2>
            <span
              style={{ '--tone': 'var(--color-brand-600)' } as CSSProperties}
              className="tinted inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.1em] uppercase sm:ml-auto"
              title={ROLE_META[user.role].grants}
            >
              <ShieldCheck className="size-3" aria-hidden />
              {ROLE_META[user.role].label}
            </span>
          </div>

          <p className="text-muted mt-2 truncate text-sm">{user.email}</p>
        </div>
      </div>

      {/*
        What you have actually done here. A bare figure in the corner of a banner was
        the previous version of this; given a label, a cell of its own and something
        to sit beside, the same number reads as a record.

        Labels along the top and figures along the bottom, so the three of them stay
        on one line when "With us since" wraps to two on a phone.
      */}
      {/* Counted rather than assumed: "with us since" is always there, and whether
          Approved is means the strip is three cells for an approver and two for
          everyone else. */}
      <dl
        className={`relative grid divide-x border-t bg-[var(--surface-sunken)] ${
          facts.length + 1 === 3 ? 'grid-cols-3' : 'grid-cols-2'
        }`}
      >
        {facts.map((f, i) => (
          <div key={f.label} className="flex min-w-0 flex-col justify-between gap-2 px-5 py-3.5">
            <dt className="a-label">{f.label}</dt>
            <dd>
              <Figure value={f.value} delay={i * 90} className="text-[1.4rem]" />
            </dd>
          </div>
        ))}

        <div className="flex min-w-0 flex-col justify-between gap-2 px-5 py-3.5">
          <dt className="a-label">With us since</dt>
          {/* Not a Figure: it is a date, and counting up to a month name is not a
              thing. Same weight and footing as the figures beside it. */}
          <dd className="a-figure truncate text-[1.15rem]">{memberSince}</dd>
        </div>
      </dl>

      <CardBody className="relative border-t">
        <NameForm initial={user.full_name ?? ''} />
      </CardBody>
    </Card>
  );
}
