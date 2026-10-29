import { Showroom, type ShowroomData } from "./showroom";
import { SiteIntro } from "./site-intro";

/** The top of the home page: the opening motion once per visit, then the showroom (one screen on a computer). */
export function LandingHero({ data }: { data: ShowroomData }) {
  return (
    <section aria-labelledby="landing-title" className="relative isolate bg-[#fafaf7] min-[761px]:h-svh min-[761px]:max-h-[1000px] min-[761px]:min-h-[760px]">
      <span id="landing-title" className="sr-only">
        The showroom
      </span>
      <SiteIntro />
      <Showroom data={data} />
    </section>
  );
}
