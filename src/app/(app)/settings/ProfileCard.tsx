import { ShieldCheck } from 'lucide-react';
import { ROLE_META, type UserRole } from '@/lib/domain/workflow';
import { Figure } from '@/components/app/Figure';
import { Card, CardBody } from '@/components/ui/primitives';
import { NameForm } from './NameForm';

/**
 * Your own identity card.
 *
 * This is the only place in the signed-in app that shows you your own name at
 * size, so it is worth building properly. Four bands, top to bottom: a lit brand
 * header, the name breaking through its lower edge, a strip of facts about your
 * own use of the place, and the one field you are allowed to change.
 *
 * The header is layered rather than filled. A flat 112px of saturated gradient was
 * the largest object on the page and said nothing: it read as a placeholder banner
 * from a template. What makes it a surface instead is the light — a broad highlight
 * off the top left corner, a deepening at the bottom right, the app's own grid
 * masked so it never reaches an edge, grain over all of it, and a lit hairline
 * along the bottom so the boundary the avatar breaks through is an edge rather than
 * a cut. It is also shorter, and it now carries something: your role.
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
    <Card className="overflow-hidden">
      {/* ── The header ── */}
      <div className="relative h-24 w-full overflow-hidden">
        <span aria-hidden className="gradient-brand absolute inset-0" />

        {/*
          Lit from off the top left, deepening towards the bottom. Two layers, and
          both are load-bearing: the highlight is what stops a flat fill reading as
          a swatch, and the scrim is what the avatar needs. The avatar carries the
          same brand gradient as the band, so without a darker footing to break
          through it disappeared into it in the dark theme.
        */}
        <span
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(125%_150%_at_4%_-45%,oklch(1_0_0_/_0.34),transparent_58%)]"
        />
        <span
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_top,oklch(0.21_0.06_285_/_0.42),transparent_58%)]"
        />

        {/* The app's grid, at a wider gauge and a lighter hand than the page
            backdrop's, and masked so it fades out instead of ending in a line. */}
        <span
          aria-hidden
          className="absolute inset-0 opacity-[0.10] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(85%_120%_at_16%_-15%,#000,transparent)]"
        />
        <span aria-hidden className="a-grain absolute inset-0 opacity-[0.16]" />
        <span aria-hidden className="a-shine absolute inset-0" />

        {/*
          Your role, on the band rather than beside your name. It is the one fact
          about you that this card cannot let you change, so it belongs on the part
          of the card you cannot type into. It also stops the header being empty.
        */}
        <span
          className="absolute top-3.5 right-4 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] text-white uppercase backdrop-blur-[2px]"
          title={ROLE_META[user.role].grants}
        >
          <ShieldCheck className="size-3" aria-hidden />
          {ROLE_META[user.role].label}
        </span>

        <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-white/25" />
      </div>

      {/* ── Who you are ── */}
      <div className="flex items-end gap-4 px-5 pb-4">
        {/*
          The same gradient mark as the account menu's avatar, so one person is
          drawn one way wherever they appear. The 4px frame in the card's own colour
          is what lets it sit across the header's edge and still read as one object
          rather than as a hole punched through it.
        */}
        <span
          aria-hidden
          className="gradient-brand -mt-9 grid size-18 shrink-0 place-items-center rounded-2xl border-4 border-[var(--surface-raised)] text-xl font-bold text-white shadow-[inset_0_1px_0_oklch(1_0_0_/_0.28),var(--elev-brand)]"
        >
          {initials}
        </span>

        <div className="min-w-0 pb-0.5">
          <p className="m-display truncate text-xl">
            {user.full_name ?? user.email.split('@')[0]}
          </p>
          <p className="text-muted mt-1 truncate text-sm">{user.email}</p>
        </div>
      </div>

      {/*
        What you have actually done here. A bare "19" in the corner of the header
        was the previous version of this, and it read as a stray number; given a
        label, a track of its own and something to sit beside, the same figure
        reads as a record.
      */}
      <dl
        className={`divide-x border-t bg-[var(--surface-sunken)] ${
          facts.length === 2 ? 'grid grid-cols-3' : 'grid grid-cols-2'
        }`}
      >
        {/*
          Labels at the top of each cell, figures along the bottom. On a phone
          "With us since" takes two lines and the other two take one, and with the
          figures simply following their labels the three of them sat at different
          heights across one row.
        */}
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

      <CardBody className="border-t">
        <NameForm initial={user.full_name ?? ''} />
      </CardBody>
    </Card>
  );
}
