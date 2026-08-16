/**
 * The safety net underneath every route handler, server component and server
 * action that does not already catch its own failures — which, before this,
 * was almost all of them. Only four route handlers (api/track, api/atrack,
 * api/identify, api/assist) ever called logServerError themselves; everything
 * else failed straight into a bare 500 with nothing written down anywhere.
 *
 * Next calls onRequestError for any error that reaches it uncaught, so this is
 * the one place that actually sees all of them. It does not duplicate the
 * four routes above: an error they already caught and swallowed never
 * propagates this far in the first place.
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath?: string; routeType?: string },
) {
  // Next also imports this file for the Edge runtime, where the server-only
  // Supabase client (and Node APIs it relies on) is not available.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { logServerError } = await import('@/lib/errors/server');
  await logServerError({
    route: context.routePath ?? request.path,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? (error.stack ?? null) : null,
    extra: { method: request.method, routeType: context.routeType },
  });
}
