import { Reveal } from '../Reveal';

const STOPS = [
  { t: 'The short answer', d: 'What you came for, in under sixty words, first.' },
  { t: 'The working', d: 'Each step in order, with the rule behind it.' },
  { t: 'A worked example', d: 'Real figures in rupees, checked on every build.' },
  { t: 'The tool', d: 'The software that does the same work for you.' },
];

/**
 * How every guide is laid out, as four stops on a line that draws itself across
 * when the section arrives, each stop landing as the line reaches it.
 */
export function GuideRail() {
  return (
    <Reveal className="relative">
      <div aria-hidden className="g-rail-line absolute top-7 right-[12%] left-[12%] hidden h-[3px] rounded-full bg-[var(--m-gold)] md:block" />
      <ol className="relative grid gap-8 md:grid-cols-4 md:gap-6">
        {STOPS.map((s, i) => (
          <li key={s.t} className="g-rail-stop text-center" style={{ '--d': `${300 + i * 380}ms` } as React.CSSProperties}>
            <span className="mx-auto grid size-14 place-items-center rounded-full border-[3px] border-[var(--m-gold)] bg-[var(--m-bg)] m-display t-5 text-[var(--m-gold)]">
              {i + 1}
            </span>
            <p className="m-display mt-5 t-5">{s.t}</p>
            <p className="m-dim-2 mx-auto mt-2 max-w-[16rem] t-3">{s.d}</p>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}
