// The home page's wardrobe: a hollow niche set into a white wall, built on the page (no photograph
// of a room). What makes it read as a real recess:
//  - the back wall is a shade darker than white, so the light strips have something to light;
//  - a strip of light runs along every inner edge (ceiling, both sides, floor) and under each shelf,
//    each one a bright hairline with a wide soft wash coming off it;
//  - the ceiling, side walls and floor of the recess are drawn in perspective, the ceiling in shade
//    and the floor lit;
//  - shelves are slabs that throw a shadow, rails stand off the wall on brackets, and the hangers and
//    plants cast shadows onto the wall behind them;
//  - the room's polished floor picks up the niche's light.
// The top shelf is for accessories. The clothes are off the rails for now (owner, 9 Oct 2026): the
// tappable rack is in hero-rack.tsx for when they go back.

const HANGERS = 9;
/** How deep the recess looks, as a share of its own size. */
const D = "6.5%";
const LIGHT = "rgba(255,255,255,";

/** A light strip: a bright hairline along one edge and the wash of light coming off it. */
function Strip({ edge, reach, className = "" }: { edge: "top" | "bottom" | "left" | "right"; reach: string; className?: string }) {
  const along = edge === "top" || edge === "bottom";
  const to = { top: "180deg", bottom: "0deg", left: "90deg", right: "270deg" }[edge];
  return (
    <div aria-hidden className={`pointer-events-none absolute ${className}`} style={{ [edge]: 0, ...(along ? { left: 0, right: 0, height: reach } : { top: 0, bottom: 0, width: reach }) }}>
      <div className="absolute inset-0" style={{ background: `linear-gradient(${to}, ${LIGHT}1) 0%, ${LIGHT}0.82) 12%, ${LIGHT}0.38) 45%, ${LIGHT}0) 100%)` }} />
      <div className="absolute bg-white shadow-[0_0_10px_3px_rgba(255,255,255,0.95)]" style={{ [edge]: 0, ...(along ? { left: 0, right: 0, height: 2 } : { top: 0, bottom: 0, width: 2 }) }} />
    </div>
  );
}

/** A plant in a white pot: the leaves are a cut-out photograph, the pot is drawn so it matches the niche. */
function Plant({ kind, className = "" }: { kind: "up" | "trail"; className?: string }) {
  const up = kind === "up";
  return (
    <div aria-hidden className={`relative shrink-0 [filter:drop-shadow(10px_10px_8px_rgba(0,0,0,0.22))] ${up ? "aspect-[1/1.42]" : "aspect-[1/0.72]"} ${className}`}>
      <span
        className="absolute rounded-b-[18%] bg-[linear-gradient(90deg,#cfcfcc,#ffffff_30%,#f4f4f2_66%,#bfbfbc)] [clip-path:polygon(0_0,100%_0,87%_100%,13%_100%)]"
        style={up ? { left: "24%", width: "48%", top: "67%", bottom: 0 } : { left: "31%", width: "37%", top: "38%", bottom: 0 }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- a small cut-out photograph of the leaves */}
      <img src={up ? "/rack/plant-up.webp" : "/rack/plant-trail.webp"} alt="" draggable={false} className="absolute left-0 top-0 block h-auto w-full max-w-none" />
    </div>
  );
}

/** One shelf and the rail under it. `top` is where the shelf sits on the back wall. */
function Storey({ top, items }: { top: string; items?: React.ReactNode }) {
  return (
    <div className="absolute inset-x-0" style={{ top }}>
      {/* What stands on the shelf */}
      {items && <div className="absolute inset-x-[3%] bottom-full z-20 flex items-end justify-between">{items}</div>}
      {/* The slab reaches a little past the back wall into the side walls, as a real shelf is let into them */}
      <div aria-hidden className="relative z-10 -mx-[1.2%] h-[10px] rounded-[1px] bg-[linear-gradient(180deg,#ffffff_0%,#ffffff_55%,#e9e9e7_100%)] shadow-[0_1px_0_rgba(0,0,0,0.08),0_-10px_14px_-8px_rgba(0,0,0,0.18)] md:h-[15px]" />
      {/* Its underside, in shade, then the light strip fixed under it */}
      <div aria-hidden className="-mx-[1.2%] h-[3px] bg-[#a9a9a6] md:h-[5px]" />
      <div className="relative h-0">
        <Strip edge="top" reach="clamp(70px,18vw,170px)" />
      </div>
      {/* Brackets drop from the shelf to hold the rail out from the wall */}
      {["left-[4%]", "right-[4%]"].map((side) => (
        <span key={side} aria-hidden className={`absolute ${side} top-[13px] z-[2] h-[15px] w-[3px] rounded-full bg-[linear-gradient(90deg,#5d5d5d,#e2e2e2_45%,#7a7a7a)] md:top-[20px] md:h-[24px] md:w-[5px]`} />
      ))}
      {/* The rail: a photographed steel rod, with its shadow falling on the wall well below it */}
      {/* eslint-disable-next-line @next/next/no-img-element -- one thin strip of a photographed steel rod, stretched along the rail */}
      <img src="/rack/rail.webp" alt="" aria-hidden draggable={false} className="absolute inset-x-[3%] top-[26px] z-[2] h-[5px] w-[94%] object-fill grayscale [filter:grayscale(1)_contrast(1.15)_drop-shadow(0_16px_6px_rgba(0,0,0,0.2))] md:top-[40px] md:h-[9px]" />
      {/* Black hangers, evenly along the rail */}
      <ul aria-hidden className="absolute inset-x-[8%] top-[22px] z-[3] flex justify-between md:top-[34px]">
        {Array.from({ length: HANGERS }, (_, i) => (
          <li key={i} className="w-[9.4%] [filter:drop-shadow(9px_13px_6px_rgba(0,0,0,0.2))]">
            {/* eslint-disable-next-line @next/next/no-img-element -- a small cut-out photograph of a hanger */}
            <img src="/rack/hanger.webp" alt="" width={652} height={340} draggable={false} className="block h-auto w-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HeroNiche() {
  return (
    <div role="img" aria-label="The Easypick wardrobe: a lit white niche in the wall with two rails of hangers, a shelf for accessories and plants" className="absolute inset-0 bg-[linear-gradient(180deg,#f2f2f0_0%,#ececea_84%)]">
      {/* The room's polished floor, picking up the light from the niche */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[16%] bg-[linear-gradient(180deg,#d2d2cf_0%,#e4e4e1_30%,#efefed_100%)]">
        <div className="absolute inset-x-[8%] top-0 h-[70%] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.95),rgba(255,255,255,0)_70%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-black/10" />
      </div>

      {/* The opening in the wall */}
      <div className="absolute inset-x-[5%] bottom-[14%] top-[6%] shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_0_22px_rgba(255,255,255,0.9)]">
        {/* Ceiling (in shade), side walls and floor (lit) of the recess, in perspective */}
        <div aria-hidden className="absolute inset-x-0 top-0 bg-[linear-gradient(180deg,#b4b4b1,#cfcfcc)]" style={{ height: D, clipPath: `polygon(0 0,100% 0,calc(100% - ${D}) 100%,${D} 100%)` }} />
        <div aria-hidden className="absolute inset-y-0 left-0 bg-[linear-gradient(90deg,#c6c6c3,#f1f1ef)]" style={{ width: D, clipPath: `polygon(0 0,100% ${D},100% calc(100% - ${D}),0 100%)` }} />
        <div aria-hidden className="absolute inset-y-0 right-0 bg-[linear-gradient(270deg,#bcbcb9,#ededeb)]" style={{ width: D, clipPath: `polygon(100% 0,0 ${D},0 calc(100% - ${D}),100% 100%)` }} />
        <div aria-hidden className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,#ffffff,#f1f1ef)]" style={{ height: D, clipPath: `polygon(${D} 0,calc(100% - ${D}) 0,100% 100%,0 100%)` }} />

        {/* The back wall and everything on it */}
        <div className="absolute overflow-visible bg-[#d9d9d6]" style={{ inset: D }}>
          {/* Light strips round the inside of the recess */}
          <Strip edge="top" reach="22%" />
          <Strip edge="bottom" reach="20%" />
          <Strip edge="left" reach="9%" />
          <Strip edge="right" reach="9%" />
          {/* The corners where the walls meet stay a touch darker */}
          <div aria-hidden className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]" />

          <Storey
            top="21%"
            items={
              <>
                <Plant kind="trail" className="w-[14%]" />
                {/* Accessories: the cap, which is in the shop */}
                <div className="flex w-[50%] items-end justify-center gap-[7%]">
                  {[0, 1, 2].map((i) => (
                    // eslint-disable-next-line @next/next/no-img-element -- the cap's own photo, cut out
                    <img key={i} src="/rack/six-panel-cap.webp" alt="" draggable={false} className={`h-auto w-[21%] [filter:drop-shadow(6px_4px_4px_rgba(0,0,0,0.3))] ${i === 1 ? "-scale-x-100" : ""}`} />
                  ))}
                </div>
                <Plant kind="up" className="w-[9%]" />
              </>
            }
          />
          <Storey top="57%" />

          {/* A plant standing on the floor of the recess */}
          <div className="absolute bottom-0 right-[4%] z-[4] w-[14%]">
            <Plant kind="up" className="w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
