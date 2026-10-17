import { PageCurtain } from '@/components/marketing/play/PageCurtain';

/**
 * The page transition for everything under /tools.
 *
 * The public site's own template sits one level up and remounts only when the
 * first segment of the address changes, so moving from the roster to a tool,
 * or from one tool to the next, never reached it and played no transition at
 * all. This one remounts for each of those, and plays the arriving tool's door
 * (or the bands, for the roster). See PageCurtain.
 */
export default function ToolsTemplate({ children }: { children: React.ReactNode }) {
  return <PageCurtain scope="tools">{children}</PageCurtain>;
}
