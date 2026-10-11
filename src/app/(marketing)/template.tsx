import { PageCurtain } from '@/components/marketing/play/PageCurtain';

/**
 * A template rather than a layout because a template remounts on every
 * navigation, and the page transition needs exactly that: a fresh mount each
 * time a visitor moves from one public page to another. See PageCurtain.
 */
export default function MarketingTemplate({ children }: { children: React.ReactNode }) {
  return <PageCurtain>{children}</PageCurtain>;
}
