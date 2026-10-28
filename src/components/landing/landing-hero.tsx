import { Showroom, type ShowroomData } from "./showroom";

/** The top of the home page: the showroom, one screen on a computer; on a phone it reads top to bottom. */
export function LandingHero({ data }: { data: ShowroomData }) {
  return (
    <section aria-labelledby="landing-title" className="relative isolate bg-[#fafaf7] min-[761px]:h-svh min-[761px]:max-h-[1000px] min-[761px]:min-h-[760px]">
      <span id="landing-title" className="sr-only">
        The showroom
      </span>
      <Showroom data={data} />
    </section>
  );
}
