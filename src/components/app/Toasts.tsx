import { Toaster } from 'sonner';

/**
 * Where every toast in the product lands.
 *
 * ── Why this is not in the root layout ──────────────────────────────────────
 *
 * It was, which put sonner in the first-load bundle of all eight public pages —
 * 37 KB of JavaScript, 10 KB over the wire, to render a notification host for
 * notifications that cannot happen. Every one of the two dozen `toast()` calls
 * in this repository is on the signed-in side; the marketing site and the auth
 * screens have none, and neither has ever shown one.
 *
 * So it moved down to the signed-in frame, on the same reasoning as `PageTiming`
 * beside it in AppShell: here rather than in each tool's layout, so a new tool
 * cannot arrive without it, and here rather than at the root, so it never ships
 * to the public site.
 *
 * The settings live in this file rather than at the two call sites, because a
 * product where the toast appears top-centre in one tool and bottom-right in
 * another is worse than either.
 */
export function Toasts() {
  return <Toaster position="top-center" richColors closeButton />;
}
