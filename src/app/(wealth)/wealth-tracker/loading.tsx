import { Card } from '@/components/ui/primitives';

export default function WealthTrackerLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <Card className="h-72 rounded-[2rem]" />
      <div className="h-10 w-80 rounded-2xl bg-[var(--surface-sunken)]" />
      <Card className="h-64" />
    </div>
  );
}
