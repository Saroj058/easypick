import type { MosaicPiece } from "./hero-mosaic";
import { StoryFilm } from "./story-film";

export function LandingHero({ pieces }: { pieces: MosaicPiece[] }) {
  return (
    <section aria-labelledby="landing-title" className="relative isolate h-[calc(100svh-62px-env(safe-area-inset-bottom))] min-h-[520px] overflow-hidden bg-white md:min-h-[600px] lg:h-svh">
      <StoryFilm pieces={pieces} />
    </section>
  );
}
