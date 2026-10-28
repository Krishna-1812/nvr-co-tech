import { CTA } from '../bits';
import { Reveal } from '../Reveal';
import { Spotlight } from '../motion';

/**
 * A dark band with the sun climbing out of its dune as it arrives: the closing
 * call to action on the guides, the tools and the pages about the firm.
 */
export function DuneCta({
  eyebrow,
  title,
  body,
  href,
  label,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <Reveal>
      <Spotlight color="var(--m-sun)" strength={0.22} size={520} className="overflow-hidden rounded-[2rem]">
        <div className="relative overflow-hidden rounded-[2rem] bg-[var(--m-ink)] px-6 py-14 text-[var(--m-on-grad)] sm:px-12 sm:py-16">
          <span aria-hidden className="g-cta-sun absolute -right-10 bottom-0 size-72 rounded-full bg-[var(--m-sun)] opacity-90 sm:right-16 sm:size-80" />
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-28 bg-[var(--m-gold)]"
            style={{ borderRadius: '60% 40% 0 0 / 40% 35% 0 0' }}
          />
          <div className="relative max-w-2xl">
            <p className="m-eyebrow" style={{ color: 'var(--m-sun)' }}>
              {eyebrow}
            </p>
            <h2 className="m-display mt-4 t-h2">{title}</h2>
            <p className="mt-5 max-w-xl t-4 opacity-85">{body}</p>
            <div className="mt-9 flex flex-wrap items-center gap-3 pb-16 sm:pb-10">
              <CTA href={href} className="!bg-[var(--m-on-grad)] !text-[var(--m-ink)] [--flood:var(--m-sun)]">
                {label}
              </CTA>
              {children}
            </div>
          </div>
        </div>
      </Spotlight>
    </Reveal>
  );
}
