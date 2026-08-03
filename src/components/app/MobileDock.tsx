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
  return (
    <nav
      aria-label="Sections"
      className="a-glass fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {/*
        One column per destination rather than a fixed five, so three items are
        spread across the width instead of huddled at the left. There are never
        more than five: appNav tops out there.
      */}
      <div
        className="grid px-1 py-1.5"
        style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
      >
        {nav.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
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
