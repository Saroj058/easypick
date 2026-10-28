import { DotIntro } from "./dot-intro";

/**
 * The top of the home page, above the rail (owner, 28 Oct 2026: "that dot is better, put it in the system"):
 * the dot intro, which settles on the first screen. How each part of the store works is shown in its own
 * section instead (how-it-works.tsx).
 */
export function LandingHero() {
  return (
    <section aria-labelledby="landing-title" className="relative isolate h-[calc(100svh-62px-env(safe-area-inset-bottom))] min-h-[520px] overflow-hidden bg-white md:min-h-[600px] lg:h-svh">
      <DotIntro />
    </section>
  );
}
