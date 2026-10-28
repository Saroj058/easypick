import Image from "next/image";

/**
 * The top of the home page, above the rail: just one picture for now (owner, 28 Oct 2026: "keep the home
 * page black or an image, just image"). The store at night, black and white, edge to edge; the phone gets
 * its own crop. How each part of the store works is shown in its own section instead.
 */
export function LandingHero() {
  return (
    <section aria-labelledby="landing-title" className="relative isolate h-[calc(100svh-62px-env(safe-area-inset-bottom))] min-h-[520px] overflow-hidden bg-[#0a0a0a] md:min-h-[600px] lg:h-svh">
      <h1 id="landing-title" className="sr-only">
        Easypick: men&apos;s streetwear in Kathmandu
      </h1>
      <Image src="/drops/hero-2.webp" alt="" fill priority sizes="100vw" className="hidden object-cover grayscale md:block" />
      <Image src="/drops/hero-2-phone.webp" alt="" fill priority sizes="100vw" className="object-cover grayscale md:hidden" />
    </section>
  );
}
