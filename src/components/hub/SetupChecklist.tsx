import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The organisation as this card needs to see it. Owner-only figures. */
export type SetupState = {
  /**
   * Chapters in the organisation. 0021 makes create_organization() seed a head
   * office, so a brand-new organisation has exactly one and this step arrives
   * already settled — which is the point of seeding it.
   */
  chapters: number;
  /** Accounts in the organisation, including the owner reading this. */
  people: number;
  requiresApproval: boolean;
};

type Step = {
  title: string;
  note: string;
  href: string;
  /** What the link to the screen that settles this step is called. */
  action: string;
  done: boolean;
};

/**
 * What a brand-new owner is told to do, and the one thing the workspace never
 * said.
 *
 * Finishing onboarding used to land on a screen whose only sentence was
 * "Nothing is waiting on you. The desk is clear." — the same sentence a veteran
 * reads on a quiet Friday. It is true on both days and useful on only one of
 * them: on day one the desk is clear because the organisation has nobody in it
 * and nothing set up, and a clear desk is not the news.
 *
 * Three things, each one a link to the screen that settles it. The card is not
 * a wizard and does not block anything — a voucher can be raised with all three
 * outstanding — so it is written as a list of what is true rather than as a
 * sequence of gates.
 *
 * It returns null once every step is done, which is deliberate: a checklist
 * with all its boxes ticked is a permanent congratulation taking up the best
 * space on the screen, and the workspace is meant to show what needs attention.
 * Nothing marks it as dismissed, because nothing needs to — the state of the
 * organisation is what decides, and it cannot come back once the organisation
 * has people in it.
 */
export function SetupChecklist({ state }: { state: SetupState }) {
  const steps = buildSteps(state);
  const done = steps.filter((s) => s.done).length;

  if (done === steps.length) return null;

  return (
    <section
      style={{ '--tone': 'var(--color-brand-600)' } as CSSProperties}
      className="surface-lit a-ring animate-[rise_0.6s_cubic-bezier(0.22,1,0.36,1)_30ms_backwards] relative overflow-hidden rounded-2xl"
      aria-labelledby="setup-checklist"
    >
      {/* The same lit top edge the live tool cards carry, in the brand colour
          rather than a tool's, because this belongs to the workspace itself. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, var(--color-brand-500), transparent)' }}
      />

      <div className="relative flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b px-5 py-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <span
            aria-hidden
            className="tinted grid size-10 shrink-0 place-items-center rounded-xl border"
          >
            <ListChecks className="size-[1.15rem]" />
          </span>
          <div className="min-w-0">
            <h2 id="setup-checklist" className="m-display text-[1.15rem]">
              Setting up your organisation
            </h2>
            <p className="text-muted mt-1.5 text-[13px] text-pretty">
              A few things to settle once. This card goes for good once they are settled.
            </p>
          </div>
        </div>

        <p className="a-label shrink-0">
          {done} of {steps.length} settled
        </p>
      </div>

      <ol className="relative divide-y">
        {steps.map((step) => (
          <li key={step.href + step.title} className="flex items-start gap-3.5 px-5 py-4">
            {/*
              Amber for outstanding rather than grey, matching the People screen's
              own warning about having nobody to approve — the same fact, one
              screen earlier.
            */}
            <span
              aria-hidden
              style={
                {
                  '--tone': step.done ? 'var(--status-approved)' : 'var(--status-warn)',
                } as CSSProperties
              }
              className={cn(
                'tinted mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border',
                !step.done && 'border-dashed',
              )}
            >
              {step.done ? (
                <Check className="size-3.5" />
              ) : (
                <span className="size-1.5 rounded-full bg-current" />
              )}
            </span>

            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-pretty">
                {/* The mark is the only thing that says which of these is done, and
                    it is a colour and a shape. Said in words for anybody who gets
                    the list read to them. */}
                <span className="sr-only">{step.done ? 'Settled. ' : 'Still to do. '}</span>
                {step.title}
              </p>
              <p className="text-muted mt-1 text-[13px] leading-relaxed text-pretty">{step.note}</p>
              <Link
                href={step.href}
                className="group/l mt-2 inline-flex items-center gap-1 text-xs font-semibold transition hover:text-brand-600 dark:hover:text-brand-300"
              >
                {step.action}
                <ArrowUpRight
                  className="size-3.5 transition-transform duration-300 group-hover/l:translate-x-0.5 group-hover/l:-translate-y-0.5"
                  aria-hidden
                />
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function buildSteps({ chapters, people, requiresApproval }: SetupState): Step[] {
  const hasChapter = chapters > 0;

  /*
   * With approval switched off, one account is a finished setup rather than an
   * unfinished one: nothing is ever waiting on a second person, so asking the
   * owner to go and find one would be inventing work. The step becomes
   * outstanding the moment they turn approval on, which is exactly when a lone
   * owner's own vouchers would otherwise have nobody left to clear them.
   */
  const hasSomebodyElse = !requiresApproval || people >= 2;

  return [
    {
      title: hasChapter ? 'Your chapters are in place' : 'Add a chapter',
      note: hasChapter
        ? `${chapters === 1 ? 'One chapter' : `${chapters} chapters`}, and every voucher is raised against one. Add your branches or units here as the organisation grows.`
        : 'Every voucher is raised against a chapter, so nothing can be raised until there is at least one.',
      href: '/admin/chapters',
      action: hasChapter ? 'Chapters' : 'Add one',
      done: hasChapter,
    },
    {
      /*
       * Always settled, and written as a statement rather than as a task.
       *
       * Nothing in the database records whether an owner has read this setting,
       * so a step that waited for them to "decide" would have no way of ever
       * ticking and would nag for the life of the organisation. Approval being
       * off is also a real choice and the shipped default (0014) — not a gap —
       * and a checklist that marked the default as incomplete would be pushing
       * one answer while pretending to ask the question.
       */
      title: requiresApproval
        ? 'Vouchers need one approval before they are paid'
        : 'Vouchers are paid the moment they are submitted',
      note: requiresApproval
        ? 'Nobody can approve their own, so every voucher passes through a second pair of hands.'
        : 'No sign-off and no queue. For a small team that is often the right answer, and it is yours to change whenever it stops being one.',
      href: '/admin',
      action: 'Change this',
      done: true,
    },
    people >= 2
      ? {
          title: 'Somebody else has an account here',
          note: `${people} accounts in your organisation. Worth checking that at least one of them can approve, because a voucher's approval can never come from whoever raised it.`,
          href: '/admin',
          action: 'People and roles',
          done: true,
        }
      : hasSomebodyElse
        ? {
            title: 'Nobody needs to approve anything',
            note: 'With approval off you can raise and pay on your own. Invite people when there are people to invite.',
            href: '/admin',
            action: 'Invite someone',
            done: true,
          }
        : {
            title: 'Invite someone who can approve',
            note: 'You are the only account here, and nobody can approve their own voucher. As things stand, nothing you raise can be paid.',
            href: '/admin',
            action: 'Invite someone',
            done: false,
          },
  ];
}
