"use client";

import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Counts down to a drop. Seconds tick only in the large variant, only while the
 * tab is visible, and never under reduced motion (then it updates once a minute).
 * Height is fixed in every state so nothing shifts.
 */
export function Countdown({ to, label, size = "lg" }: { to: string; label: string; size?: "sm" | "lg" }) {
  const target = Date.parse(to);
  const [now, setNow] = useState<number | null>(null);
  const [calm, setCalm] = useState(true);

  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fast = size === "lg" && !reduce;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the clock and motion preference once mounted
    setCalm(!fast);
    const tick = () => document.visibilityState === "visible" && setNow(Date.now());
    setNow(Date.now());
    const id = setInterval(tick, fast ? 1000 : 30_000);
    const onVis = () => tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [size]);

  const live = now !== null && now >= target;
  const { d, h, m, s } = parts(now === null ? 0 : target - now);
  const units = [
    { v: d, l: "days" },
    { v: h, l: "hrs" },
    { v: m, l: "min" },
    ...(calm ? [] : [{ v: s, l: "sec" }]),
  ];

  const numCls = size === "lg" ? "text-[length:var(--text-stat)] leading-[0.85]" : "text-[22px] leading-none sm:text-[28px] md:text-[40px]";
  const boxH = size === "lg" ? "min-h-[clamp(4.5rem,2.6rem+6vw,8.25rem)]" : "min-h-[52px]";

  return (
    <div className={boxH}>
      <p role="status" className="sr-only">
        {live ? `${label} is live now` : ""}
      </p>
      {now === null ? null : live ? (
        <p className={`font-mono font-semibold ${numCls}`}>Live now</p>
      ) : (
        <div role="timer" aria-label={`${label} in ${d} days ${h} hours ${m} minutes`}>
          <ol className={`flex font-mono ${size === "lg" ? "gap-5 md:gap-8" : "gap-3"}`} aria-hidden>
            {units.map((u) => (
              <li key={u.l} className="flex flex-col">
                <span className={`font-semibold tabular-nums ${numCls}`}>{pad(u.v)}</span>
                <span className="mt-2 text-[11px] uppercase tracking-[0.14em] opacity-70">{u.l}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
