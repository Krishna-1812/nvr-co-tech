import type { NavItem } from '@/lib/nav';
import { NavLink } from '../NavLink';

/**
 * The phone and tablet navigation: a dock along the bottom of the screen.
 *
 * Bottom rather than a hamburger because of what this app is for. Approving on a
 * phone between meetings is the common case, and a queue that is two taps and a
 * menu animation away is a queue that gets looked at less. It is also simply
 * where a thumb is.
 *
 * It replaced a horizontally scrolling strip of tabs under the header, which hid
 * whichever section did not fit — usually Settings, sometimes Admin.
 *
 * There is deliberately no floating action button above it. A dock plus a FAB puts
 * two competing controls in the same corner, and the FAB sat on top of whatever
 * card happened to be at the foot of the page. New voucher lives in the top bar
 * at these widths instead, where it covers nothing.
 */
export function MobileDock({ nav }: { nav: NavItem[] }) {
  /*
   * The dock is the one place NavItem.secondary is honoured, which is what that
   * flag was written for: the rail and the palette have room for everything, and
   * a bar of thumb-sized cells does not. Unfiltered, an admin got five cells and
   * an analytics admin six, at which point the labels under the icons start
   * truncating and every target is narrower than a thumb.
   *
   * Dropped rather than folded into a "more" cell. A menu behind a dock is the
   * hamburger this replaced, and Admin and the two analytics screens are all
   * places you go deliberately, from the rail, rather than while holding a phone
   * between meetings.
   */
  const items = nav.filter((item) => !item.secondary);

  return (
    <nav
      aria-label="Sections"
      className="a-glass fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {/*
        One column per destination rather than a fixed four, so a tool with two
        destinations spreads them across the width instead of huddling them at
        the left. Most sections offer three or four once the secondary ones are
        out; Visitor Intelligence offers six, which is why NavItem carries a
        short label for the cells too narrow to hold the real one.
      */}
      <div
        className="grid px-1 py-1.5"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            shortLabel={item.short}
            icon={<item.icon className="size-4.5" aria-hidden />}
            badge={item.badge}
            exact={item.href === '/admin'}
            variant="dock"
          />
        ))}
      </div>
    </nav>
  );
}
