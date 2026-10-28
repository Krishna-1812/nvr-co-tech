import { PageCurtain } from '@/components/marketing/play/PageCurtain';
import { toCard } from '@/components/marketing/guides/summary';
import { visibleGuides } from '@/lib/guides';

/**
 * The page transition for everything under /guides, as tools/template.tsx is
 * for /tools: it remounts on every move between guides, and a guide arrives
 * through a door in its tool's colour with its title on it.
 */
export default function GuidesTemplate({ children }: { children: React.ReactNode }) {
  const doors = Object.fromEntries(
    visibleGuides().map((g, i) => {
      const c = toCard(g, i);
      return [g.slug, { name: g.title, color: c.color, on: c.onColor }];
    }),
  );
  return (
    <PageCurtain scope="guides" doors={doors}>
      {children}
    </PageCurtain>
  );
}
