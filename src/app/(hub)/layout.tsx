import { requireUser } from '@/lib/supabase/server';
import { fiscalYear, istLongDate, istToday } from '@/lib/fiscal';
import { PREVIEW } from '@/lib/preview';
import { Backdrop } from '@/components/app/Backdrop';
import { PreviewBanner } from '@/components/app/PreviewBanner';
import { HubBar } from '@/components/hub/HubBar';

/**
 * The shell for the workspace itself, as opposed to the shell for a tool inside it.
 *
 * Its own route group rather than a page under (app), because (app) is Voucher
 * Desk: that layout carries a rail of voucher destinations, a queue badge and a
 * New voucher button, none of which mean anything until you have chosen a tool.
 * The two shells share the atmosphere and the account menu and nothing else.
 */
export default async function HubLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const fiscal = fiscalYear(istToday());

  return (
    <div className="relative min-h-screen">
      <Backdrop />

      <a
        href="#main"
        className="gradient-brand elev-brand sr-only rounded-lg px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Skip to content
      </a>

      {PREVIEW && <PreviewBanner />}

      <HubBar user={user} fiscal={fiscal} today={istLongDate()} />

      <main id="main" className="mx-auto max-w-[92rem] px-4 pt-6 pb-20 sm:px-6 sm:pt-8">
        {children}
      </main>
    </div>
  );
}
