import { CardListSkeleton, HeroSkeleton } from '@/components/ui/Skeletons';

export default function ApprovalsLoading() {
  return (
    <div className="space-y-6">
      {/* The queue opens on its hero: the sentence, the three tiles, the age bar. */}
      <HeroSkeleton buttons={false} />
      <CardListSkeleton count={3} />
    </div>
  );
}
