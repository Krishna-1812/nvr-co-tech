'use client';

import { useEffect, type CSSProperties } from 'react';
import { Cloud, CloudOff, HardDrive, LoaderCircle } from 'lucide-react';
import { startSync, useCloudStatus, type CloudStatus, type CloudTool } from '@/lib/cloud/sync';
import { cn } from '@/lib/utils';

/**
 * Where this tool's work is being kept, said in one line, with the way to
 * change it.
 *
 * For a visitor it is the honest version of "you are not signed in": the work
 * is safe in this browser and nowhere else (the Sign in button in the top bar
 * is the way to change that). For a signed-in person it follows lib/cloud, and says
 * so when the account could not be reached rather than claiming a save that
 * did not happen.
 *
 * Also the thing that starts the account sync, so a tool cannot show this line
 * without the line being true.
 */

const WORDS: Record<CloudStatus, { text: string; tone: string }> = {
  local: { text: 'Kept in this browser only', tone: 'var(--status-draft)' },
  checking: { text: 'Checking your account…', tone: 'var(--status-draft)' },
  saving: { text: 'Saving to your account…', tone: 'var(--status-pending)' },
  saved: { text: 'Saved to your account', tone: 'var(--status-approved)' },
  offline: { text: 'Saved in this browser. Your account could not be reached; the next change tries again.', tone: 'var(--status-warn)' },
  unavailable: { text: 'Saved in this browser. Saving to your account is not switched on yet.', tone: 'var(--status-warn)' },
};

export function SaveStatus({
  tool,
  signedIn,
  storageKey,
  guestKey,
  reload,
  isEmpty,
  className,
}: {
  tool: CloudTool;
  signedIn: boolean;
  /** This person's key in localStorage, and the visitor's, for lib/cloud. */
  storageKey: string;
  guestKey: string;
  reload: () => void;
  /** Stored text that holds no work yet (lib/cloud `decide`). Must be stable. */
  isEmpty?: (body: string) => boolean;
  className?: string;
}) {
  const status = useCloudStatus(tool);
  const shown: CloudStatus = signedIn ? status : 'local';

  useEffect(() => {
    if (signedIn) startSync({ tool, key: storageKey, guestKey, reload, isEmpty });
  }, [signedIn, tool, storageKey, guestKey, reload, isEmpty]);

  const { text, tone } = WORDS[shown];
  const Icon = shown === 'local' ? HardDrive : shown === 'saving' || shown === 'checking' ? LoaderCircle : shown === 'saved' ? Cloud : CloudOff;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span
        role="status"
        style={{ '--tone': tone } as CSSProperties}
        className="tinted inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium text-pretty"
      >
        <Icon className={cn('size-3.5 shrink-0', (shown === 'saving' || shown === 'checking') && 'animate-spin')} aria-hidden />
        {text}
      </span>
    </div>
  );
}
