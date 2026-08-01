'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types';

/** Supabase client for Client Components (auth forms, realtime, uploads). */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
