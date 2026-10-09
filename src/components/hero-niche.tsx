// The home page's wardrobe: a hollow niche set into a white wall, built on the page (no photograph
// of a room). Its depth comes from four faces drawn in perspective around a back wall, cool white
// light under every edge, shelves that are slabs with a shaded underside, and steel rails held out
// from the wall with empty hangers on them. The top shelf is for accessories; plants sit on the
// shelf and on the niche's floor. The clothes are off the rails for now (owner, 9 Oct 2026): the
// tappable rack is in hero-rack.tsx for when they go back.

const HANGERS = 8;
/** How deep the niche looks, as a share of its own width and height. */
const D = "5.5%";

/**
 * A plant in a white pot. The leaves are a cut-out photograph; the pot is drawn here, so it is
 * the same white as the niche. "trail" has vines that hang down past whatever it stands on.
 */
function Plant({ kind, className = "" }: { kind: "up" | "trail"; className?: string }) {
  const up = kind === "up";
  return (
    // The box ends at the pot's foot, so the plant stands on a shelf; trailing vines overflow below it.
    <div aria-hidden className={`relative shrink-0 [filter:drop-shadow(6px_8px_6px_rgba(0,0,0,0.18))] ${up ? "aspect-[1/1.42]" : "aspect-[1/0.72]"} ${className}`}>
      <span
        className="absolute rounded-b-[18%] bg-[linear-gradient(90deg,#dcdcd9,#ffffff_32%,#f3f3f1_68%,#cfcfcc)] [clip-path:polygon(0_0,100%_0,87%_100%,13%_100%)]"
        style={up ? { left: "24%", width: "48%", top: "67%", bottom: 0 } : { left: "31%", width: "37%", top: "38%", bottom: 0 }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- a small cut-out photograph of the leaves */}
      <img src={up ? "/rack/plant-up.webp" : "/rack/plant-trail.webp"} alt="" draggable={false} className="absolute left-0 top-0 block h-auto w-full max-w-none" />
    </div>
  );
}

/** A strip of cool white light, as from an LED channel, washing away from an edge. */
function Glow({ className, down = true }: { className: string; down?: boolean }) {
  return <div aria-hidden className={`absolute blur-[6px] ${down ? "bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(255,255,255,0))]" : "bg-[linear-gradient(0deg,rgba(255,255,255,1),rgba(255,255,255,0))]"} ${className}`} />;
}

/** One shelf with its rail: the slab, its shaded underside, the light under it, the brackets, the rod and the hangers. */
function Storey({ top, items }: { top: string; items?: React.ReactNode }) {
  return (
    <div className="absolute inset-x-0" style={{ top }}>
      {/* What stands on the shelf */}
      {items && <div className="absolute inset-x-[4%] bottom-full z-20 flex items-end justify-between">{items}</div>}
      {/* The slab: lit front edge, then the shaded underside */}
      <div aria-hidden className="relative z-10 h-[9px] bg-[linear-gradient(180deg,#ffffff,#f1f1ef)] shadow-[0_12px_16px_-6px_rgba(0,0,0,0.22)] md:h-[13px]" />
      <div aria-hidden className="h-[4px] bg-[linear-gradient(180deg,#b9b9b6,#d9d9d6)] md:h-[6px]" />
      <Glow className="inset-x-0 top-[12px] h-[90px] md:top-[18px] md:h-[150px]" />
      {/* Brackets and rod */}
      <span aria-hidden className="absolute left-[3%] top-[13px] h-[14px] w-[3px] rounded-full bg-[linear-gradient(90deg,#6f6f6f,#c9c9c9,#6f6f6f)] md:top-[19px] md:h-[22px] md:w-[4px]" />
      <span aria-hidden className="absolute right-[3%] top-[13px] h-[14px] w-[3px] rounded-full bg-[linear-gradient(90deg,#6f6f6f,#c9c9c9,#6f6f6f)] md:top-[19px] md:h-[22px] md:w-[4px]" />
      {/* eslint-disable-next-line @next/next/no-img-element -- one thin strip of a photographed steel rod, stretched along the rail */}
      <img src="/rack/rail.webp" alt="" aria-hidden draggable={false} className="absolute inset-x-[2%] top-[25px] z-[2] h-[5px] w-[96%] object-fill grayscale drop-shadow-[0_14px_5px_rgba(0,0,0,0.16)] md:top-[38px] md:h-[8px]" />
      {/* The hangers, waiting */}
      <ul aria-hidden className="absolute inset-x-[7%] top-[22px] z-[3] flex justify-between md:top-[33px]">
        {Array.from({ length: HANGERS }, (_, i) => (
          <li key={i} className="w-[11%] [filter:drop-shadow(7px_12px_7px_rgba(0,0,0,0.2))]">
            {/* eslint-disable-next-line @next/next/no-img-element -- a small cut-out photograph of a hanger */}
            <img src="/rack/hanger.webp" alt="" width={652} height={340} draggable={false} className="block h-auto w-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HeroNiche({ plants }: { plants: boolean }) {
  return (
    <div role="img" aria-label="The Easypick wardrobe: a white niche in the wall with two rails of hangers, a shelf for accessories and plants" className="absolute inset-0 bg-[linear-gradient(180deg,#f6f6f4_0%,#f1f1ef_78%,#e6e6e3_78%,#f3f3f1_100%)]">
      {/* The room's floor, under the wall */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[22%] bg-[linear-gradient(180deg,#dededb,#f0f0ee)]" />

      {/* The opening in the wall */}
      <div className="absolute inset-x-[5%] bottom-[14%] top-[6%] shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_18px_30px_-18px_rgba(0,0,0,0.25)]">
        {/* Back wall */}
        <div aria-hidden className="absolute bg-[linear-gradient(180deg,#ececea_0%,#f4f4f2_40%,#eeeeec_100%)]" style={{ inset: D }} />
        {/* Ceiling, side walls and floor of the niche, in perspective */}
        <div aria-hidden className="absolute inset-x-0 top-0 bg-[linear-gradient(180deg,#c9c9c6,#dfdfdc)]" style={{ height: D, clipPath: `polygon(0 0,100% 0,calc(100% - ${D}) 100%,${D} 100%)` }} />
        <div aria-hidden className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,#d6d6d3,#e9e9e6)]" style={{ width: D, clipPath: `polygon(0 0,100% ${D},100% calc(100% - ${D}),0 100%)` }} />
        <div aria-hidden className="absolute inset-y-0 right-0 bg-[linear-gradient(270deg,#cfcfcc,#e4e4e1)]" style={{ width: D, clipPath: `polygon(100% 0,0 ${D},0 calc(100% - ${D}),100% 100%)` }} />
        <div aria-hidden className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,#f2f2f0,#ffffff)]" style={{ height: D, clipPath: `polygon(${D} 0,calc(100% - ${D}) 0,100% 100%,0 100%)` }} />
        {/* Shade gathering in the corners of the hollow */}
        <div aria-hidden className="absolute shadow-[inset_0_22px_30px_-16px_rgba(0,0,0,0.28),inset_22px_0_30px_-20px_rgba(0,0,0,0.2),inset_-22px_0_30px_-20px_rgba(0,0,0,0.2)]" style={{ inset: D }} />

        {/* Inside the hollow */}
        <div className="absolute" style={{ inset: D }}>
          {/* Light channels along the ceiling and the floor of the niche */}
          <Glow className="inset-x-0 top-0 h-[60px] md:h-[100px]" />
          <Glow down={false} className="inset-x-0 bottom-0 h-[50px] md:h-[90px]" />

          <Storey
            top="20%"
            items={
              <>
                {plants ? <Plant kind="trail" className="w-[15%]" /> : <span />}
                {/* Accessories: the cap, which is in the shop */}
                <div className="flex w-[52%] items-end justify-center gap-[6%]">
                  {[0, 1, 2].map((i) => (
                    // eslint-disable-next-line @next/next/no-img-element -- the cap's own photo, cut out
                    <img key={i} src="/rack/six-panel-cap.webp" alt="" draggable={false} className={`h-auto w-[22%] [filter:drop-shadow(4px_5px_4px_rgba(0,0,0,0.22))] ${i === 1 ? "-scale-x-100" : ""}`} />
                  ))}
                </div>
                {plants ? <Plant kind="up" className="w-[10%]" /> : <span />}
              </>
            }
          />
          <Storey top="56%" />

          {/* A plant on the niche's floor */}
          {plants && (
            <div className="absolute bottom-0 right-[3%] z-[4] w-[15%]">
              <Plant kind="up" className="w-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
