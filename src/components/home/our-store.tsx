import Link from "next/link";

import { hourLabel, type StoreInfo } from "@/lib/store-state";

// "Our store": a drawn shopfront, what's inside, a small map card and the ways to get there.

function hoursLine(info: StoreInfo) {
  const open = info.hours.filter((h) => !h.closed);
  if (open.length === 0) return null;
  const same = open.every((h) => h.open === open[0].open && h.close === open[0].close);
  if (!same) return "Hours on the Visit page";
  const range = `${hourLabel(open[0].open)} to ${hourLabel(open[0].close)}`;
  return open.length === 7 ? `Every day ${range}` : range;
}

function badge(info: StoreInfo) {
  if (info.opened) return "Open every day";
  if (info.openingDate) {
    const d = new Date(`${info.openingDate}T12:00:00+05:45`);
    return `Opens ${d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "Asia/Kathmandu" })}`;
  }
  return "Opening soon";
}

const INSIDE = [
  { label: "Try-on rooms", d: "M4 4h16v16H4zM12 4v16M9 11v2" },
  { label: "Self-checkout", d: "M6 3h12v18H6zM9 7h6M9 11h6M10 15h4v3h-4z" },
  { label: "Online pickup", d: "M5 8h14l-1 12H6zM9 8a3 3 0 0 1 6 0" },
  { label: "Helper on the floor", d: "M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM5 20c0-4 3-7 7-7s7 3 7 7" },
];

function Shopfront() {
  return (
    <div aria-hidden className="relative bg-[repeating-linear-gradient(0deg,#5a3a2e_0_22px,#4d3127_22px_24px)] px-[6%] pt-[6%]">
      <div className="flex h-[clamp(48px,6vw,78px)] items-center justify-center gap-1.5 bg-ink shadow-[0_10px_20px_-10px_rgba(0,0,0,0.6)]">
        <span className="font-display text-[clamp(26px,3.4vw,46px)] tracking-[3px] text-paper">EASYPICK</span>
        <span className="mt-[18px] h-3 w-3 rounded-full bg-volt shadow-[0_0_12px_#c6ff3d]" />
      </div>
      <div className="h-3 bg-graphite" />
      <div className="grid aspect-[16/9] grid-cols-[1fr_1.25fr_1fr] bg-[#121214]">
        <div className="flex border-r-8 border-graphite">
          <div className="flex flex-1 flex-col items-center justify-end bg-[radial-gradient(ellipse_at_50%_20%,#fff8ea,#e9e2d3_70%)] pb-[14%]">
            <div className="h-[3px] w-[70%] bg-steel" />
            <div className="flex h-[40%] items-start gap-[8%]">
              <span className="h-[90%] w-[clamp(16px,2.4vw,36px)] bg-[#1f1f1f]" />
              <span className="h-full w-[clamp(16px,2.4vw,36px)] bg-[#9a9a9c]" />
              <span className="h-[86%] w-[clamp(16px,2.4vw,36px)] bg-[#5b5e3f]" />
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden bg-[linear-gradient(180deg,#fff3d6,#f2dfb5)]">
          <div className="absolute inset-x-0 top-0 h-[58%] bg-[repeating-linear-gradient(180deg,#45454a_0_10px,#2c2c30_10px_13px)] shadow-[0_6px_12px_rgba(0,0,0,0.35)]" />
          <div className="absolute bottom-[8%] left-1/2 h-[34%] w-[46%] -translate-x-1/2 border-2 border-[#c7c7cc]" />
        </div>
        <div className="flex border-l-8 border-graphite">
          <div className="flex flex-1 flex-col items-center justify-end bg-[radial-gradient(ellipse_at_50%_20%,#fff8ea,#e9e2d3_70%)] pb-[14%]">
            <div className="h-[3px] w-[70%] bg-steel" />
            <div className="flex h-[40%] items-start gap-[8%]">
              <span className="h-[96%] w-[clamp(16px,2.4vw,36px)] bg-[#1f2a44]" />
              <span className="h-[86%] w-[clamp(16px,2.4vw,36px)] bg-[#e8e1d3] outline outline-1 outline-[#c7c7cc]" />
              <span className="h-full w-[clamp(16px,2.4vw,36px)] bg-[#2b2b2e]" />
            </div>
          </div>
        </div>
      </div>
      <div className="h-[22px] bg-steel-dark" />
      <div className="-mx-[6.5%] h-[30px] bg-[linear-gradient(180deg,#8e8e93,#aeaeb2)]" />
    </div>
  );
}

export function OurStore({ info }: { info: StoreInfo }) {
  const hours = hoursLine(info);
  const where = info.address ? `${info.address}${info.area && !info.address.includes(info.area) ? `, ${info.area}` : ""}` : info.area;
  const directions = info.mapUrl;

  return (
    <section aria-labelledby="store-title" className="bg-photo pb-12 pt-16 md:pb-16 md:pt-24">
      <div className="container-ep grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-7" data-reveal>
          <Shopfront />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-5" data-reveal>
          <span className="inline-flex h-8 items-center gap-2 self-start bg-ink px-3 font-mono text-[12px] uppercase tracking-[0.12em] text-paper">
            <span className="h-2 w-2 rounded-full bg-volt" aria-hidden />
            {badge(info)}
          </span>
          <div>
            <h2 id="store-title" className="display display-h1">
              Our store
            </h2>
            <p className="mt-3 text-lg">
              {where}
              {hours ? ` · ${hours}` : ""}
            </p>
            {info.landmark && <p className="text-[15px] text-steel-dark">{info.landmark}</p>}
          </div>
          <ul className="grid grid-cols-2 gap-x-5 gap-y-3.5">
            {INSIDE.map((x) => (
              <li key={x.label} className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center border border-ink" aria-hidden>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d={x.d} />
                  </svg>
                </span>
                <span className="text-[15px] font-semibold">{x.label}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2.5">
            <Link href="/visit/tour" className="btn btn-ink grow">
              Walk it in 3D
            </Link>
            {directions ? (
              <a href={directions} target="_blank" rel="noopener" className="btn btn-outline">
                Directions
              </a>
            ) : (
              <Link href="/visit" className="btn btn-outline">
                Visit details
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
