"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { HowItWorks } from "@/components/how-it-works";
import { hourLabel, ktmNow, storeState, toMinutes, type StoreInfo } from "@/lib/store-state";

import "./store-and-gift.css";

const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first; 0 is Sunday, as in StoreInfo.hours
const DAY = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function hoursLine(info: StoreInfo) {
  const open = info.hours.filter((h) => !h.closed);
  if (!open.length) return null;
  const same = open.every((h) => h.open === open[0].open && h.close === open[0].close);
  if (!same) return "Hours on the Visit page";
  const range = `${hourLabel(open[0].open)} to ${hourLabel(open[0].close)}`;
  return open.length === 7 ? `Every day, ${range}` : range;
}

/**
 * The end of the home page (owner, 29 Oct 2026, design 4 of ten, "Live store"): the store as a living thing and,
 * beside it, sending a gift. The store's photo follows the time of day in Kathmandu (day, evening, or the shutter
 * down at night), with "Open now" or "Closed" from the store's own hours (Admin → Store), the week's hours as a slim
 * bar with a mark at the time now, and self-checkout as four small steps. Lime only on the open dot.
 */
export function StoreAndGift({ info, store = true, gift = true, copy }: { info: StoreInfo; store?: boolean; gift?: boolean; copy: { title: string; line: string; send: string; cards: string } }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock is read once mounted (the server has no Kathmandu time to match)
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const state = now ? storeState(info, now) : null;
  const k = now ? ktmNow(now) : null;
  const open = state?.kind === "open" || state?.kind === "drop";
  const minutesLeft = open && k && "closesAt" in state! ? toMinutes(state.closesAt) - k.minutes : null;
  const status = !state
    ? { text: "Easypick", sub: "Jhamsikhel" }
    : state.kind === "soon"
      ? { text: "Opening soon", sub: "" }
      : open
        ? { text: "Open now", sub: minutesLeft !== null && minutesLeft <= 60 ? `· closes in ${minutesLeft} min` : `· closes ${hourLabel((state as { closesAt: string }).closesAt)}` }
        : { text: "Closed", sub: `· ${state.headline.replace(/^Shutter down\. /, "").replace(/\.$/, "")}` };
  // The photo by the time of day: day until 5 PM, evening after, the shutter down when closed.
  const scene = !state || state.kind === "soon" ? "day" : !open ? "night" : k && k.minutes >= 17 * 60 ? "dusk" : "day";
  const photo = { day: "/visit/store-day-open.avif", dusk: "/visit/store-dusk-open.avif", night: "/visit/store-night-closed.avif" }[scene];
  const hours = hoursLine(info);
  const where = info.area || info.address || "Kathmandu";
  // The open stretch of a day as a share of 24 hours, for the week bar.
  const span = (day: number) => {
    const h = info.hours.find((x) => x.day === day);
    return !h || h.closed ? null : { left: (toMinutes(h.open) / 1440) * 100, width: ((toMinutes(h.close) - toMinutes(h.open)) / 1440) * 100 };
  };

  if (!store && !gift) return null;
  return (
    <section className={`sg ${store && gift ? "" : "sg-one"}`} aria-labelledby="sg-title">
      <div className="sg-head">
        <div>
          <p className="sg-eyebrow">The store · {where}</p>
          <h2 id="sg-title" className="sg-title">
            Come in <em>person.</em>
          </h2>
        </div>
        {k && (
          <p className="sg-clock">
            Kathmandu <b>{hourLabel(`${Math.floor(k.minutes / 60)}:${k.minutes % 60}`)}</b>
          </p>
        )}
      </div>

      <div className="sg-grid">
        {store && (
          <article className="sg-store">
            <Link className="sg-photo" href="/visit" aria-label="Visit the store">
              <Image src={photo} alt={`The Easypick shop front in ${where}`} fill sizes="(min-width: 860px) 760px, 100vw" className="sg-img" />
              <span className={`sg-status ${open ? "open" : ""}`}>
                <span className="sg-dot" aria-hidden />
                {status.text}
                {status.sub && <span className="sg-sub">{status.sub}</span>}
              </span>
              <span className="sg-scene">Now · {scene === "day" ? "daytime" : scene === "dusk" ? "evening" : "night"}</span>
            </Link>

            <div className="sg-info">
              <p className="sg-place">
                Easypick, {where}
                <span>{[hours, "Same price online and in store"].filter(Boolean).join(" · ")}</span>
              </p>
              <div className="sg-links">
                <Link className="sg-btn ghost" href="/visit/tour">
                  <u>Walk it in 3D</u>
                </Link>
                <Link className="sg-btn solid" href="/visit">
                  Visit the store <span aria-hidden>→</span>
                </Link>
              </div>
              <div className="sg-week" aria-label="Opening hours this week">
                {WEEK.map((d) => {
                  const s = span(d);
                  const today = k?.weekday === d;
                  return (
                    <div key={d} className={`sg-day ${today ? "today" : ""}`}>
                      <span className="sg-lab">
                        <span>{DAY[d]}</span>
                      </span>
                      <span className="sg-bar">
                        {s && <i style={{ left: `${s.left}%`, width: `${s.width}%` }} />}
                        {today && k && <b className="sg-now" style={{ left: `${(k.minutes / 1440) * 100}%` }} />}
                      </span>
                    </div>
                  );
                })}
              </div>
              {hours && (
                <p className="sg-weeknote">
                  <span>This week</span>
                  <span>{hours}</span>
                </p>
              )}
            </div>

            <div className="sg-foot">
              <ol className="sg-steps" aria-label="Self-checkout">
                {[
                  ["Pick", <path key="p" d="M8 3.2a1.4 1.4 0 1 1 1.4 1.4L8 5.6v1M8 6.6 2 11h12z" />],
                  ["Scan", <path key="s" d="M2 5V3h2M12 3h2v2M14 11v2h-2M4 13H2v-2M5 5.5v5M7 5.5v5M9.5 5.5v5M11 5.5v5" />],
                  ["Pay", <path key="y" d="M3.5 4h9A1.5 1.5 0 0 1 14 5.5v5.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11V5.5A1.5 1.5 0 0 1 3.5 4zM2 7h12M4.5 10h2.5" />],
                  ["Leave", <path key="l" d="M6 2.5h6.5v11H6M2 8h7M6.5 5.5 9 8l-2.5 2.5" />],
                ].map(([label, icon], i) => (
                  <li key={label as string}>
                    {i > 0 && <span className="sg-sep" aria-hidden />}
                    <svg viewBox="0 0 16 16" aria-hidden>
                      {icon}
                    </svg>
                    {label}
                  </li>
                ))}
              </ol>
              <span className="sg-note">Self-checkout. No queue, no counter.</span>
            </div>
          </article>
        )}

        {gift && (
          <article className="sg-gift" aria-labelledby="sg-gift-title">
            <div className="sg-gift-top">
              <span className="sg-eyebrow">Gifts</span>
              <span className="sg-range">Rs 1,000 – 50,000</span>
            </div>
            <div className="sg-stage">
              <Link className="sg-stack" href="/gift#buy" aria-label={copy.cards}>
                <Image className="c2" src="/gift-cards/front-10000.webp" alt="" width={700} height={365} />
                <Image className="c3" src="/gift-cards/front-5000.webp" alt="Easypick gift card, Rs 5,000" width={700} height={365} />
              </Link>
            </div>
            <h3 id="sg-gift-title" className="sg-gift-title">
              {copy.title}
            </h3>
            <p className="sg-gift-line">{copy.line}</p>
            <ol className="sg-trio">
              <li>
                <span>01</span>You pick
              </li>
              <li>
                <span>02</span>They size
              </li>
              <li>
                <span>03</span>We wrap
              </li>
            </ol>
            <div className="sg-links sg-gift-links">
              <Link className="sg-btn solid" href="/gift">
                {copy.send} <span aria-hidden>→</span>
              </Link>
              <Link className="sg-btn line" href="/gift#buy">
                {copy.cards}
              </Link>
              <HowItWorks guide="gift" />
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
