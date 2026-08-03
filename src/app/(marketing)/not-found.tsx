import { Aurora, CTA, Container } from '@/components/marketing/bits';

/**
 * A 404 inside the public site.
 *
 * Without this, notFound() (which /agents/[slug] calls for an unknown slug)
 * walks up to the root not-found, which sits outside this route group and so
 * renders in the application's light theme. Landing on a white page from a dark
 * site reads as a broken deployment rather than a missing page.
 */
export default function MarketingNotFound() {
  return (
    <section className="relative overflow-hidden py-32 sm:py-44">
      <Aurora color="var(--m-indigo)" opacity={0.26} className="-top-32 left-1/3 size-[34rem]" />
      <div
        aria-hidden
        className="m-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(55%_60%_at_50%_30%,#000,transparent)]"
      />

      <Container className="relative text-center">
        <p className="m-eyebrow">Error 404</p>
        <h1 className="m-display mt-5 text-[clamp(2.2rem,5.5vw,3.6rem)]">
          Nothing filed <span className="m-serif m-grad-text">here.</span>
        </h1>
        <p className="m-dim mx-auto mt-6 max-w-md text-[15px] leading-relaxed">
          This page does not exist. It may have been renamed, or the link that brought you here may
          be an old one.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <CTA href="/">Back to the home page</CTA>
          <CTA href="/agents" variant="ghost">
            See what we build
          </CTA>
        </div>
      </Container>
    </section>
  );
}
