import { VoucherDetailSkeleton } from '@/components/ui/Skeletons';

/**
 * The detail page runs three queries before it can render anything, so opening
 * a voucher from the list was the one navigation in the app that visibly hung.
 */
export default function VoucherDetailLoading() {
  return <VoucherDetailSkeleton />;
}
