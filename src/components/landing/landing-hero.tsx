import type { MosaicPiece } from "./hero-mosaic";
import { HomeQuick, type HomeStats } from "./home-quick";
import { StoryFilm } from "./story-film";

/** The top of the home page: the lime dot intro, then the logo, the store in numbers and the pieces. */
export function LandingHero({ pieces, stats }: { pieces: MosaicPiece[]; stats: HomeStats }) {
  return (
    <section aria-labelledby="landing-title" className="relative isolate h-[calc(100svh-62px-env(safe-area-inset-bottom))] min-h-[560px] overflow-hidden bg-white md:min-h-[640px] lg:h-svh">
      <StoryFilm pieces={pieces}>
        <HomeQuick stats={stats} />
      </StoryFilm>
    </section>
  );
}
