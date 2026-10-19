"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

/** While Pick loads: the same height, the Easypick e turning. */
function PickLoader({ where }: { where: "gift" | "shop" }) {
  return (
    <section aria-label={where === "shop" ? "Pick, your shopping helper" : "Pick, your gift helper"} aria-busy className="relative !mb-8 -mt-6 md:!mb-10 md:-mt-10">
      <div className="grid min-h-[150px] place-items-center [perspective:600px] md:min-h-[190px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- the small brand mark */}
        <img src="/brand/mark.png" width={146} height={148} alt="" className="tour-spin h-10 w-auto opacity-80 motion-reduce:animate-none" />
        <span className="sr-only">Pick is on the way</span>
      </div>
    </section>
  );
}

const PickChat = dynamic(() => import("./pick-chat").then((m) => m.PickChat), { ssr: false, loading: () => null });

/**
 * Pick, loaded only when needed (owner, 19 Oct 2026: "Pick makes the site slow"): the robot is a
 * whole 3D scene, so the page draws first and Pick arrives when it scrolls near (or a few seconds
 * after the page is idle), with the e turning in its place meanwhile.
 */
export function PickLazy({ where = "gift" }: { where?: "gift" | "shop" }) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setNear(true), { rootMargin: "300px 0px" });
    io.observe(el);
    const t = window.setTimeout(() => setNear(true), 4000);
    return () => {
      io.disconnect();
      window.clearTimeout(t);
    };
  }, []);
  return <div ref={box}>{near ? <PickReady where={where} /> : <PickLoader where={where} />}</div>;
}

/** The loader stays until the chat's code has arrived. */
function PickReady({ where }: { where: "gift" | "shop" }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    void import("./pick-chat").then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);
  return ready ? <PickChat where={where} /> : <PickLoader where={where} />;
}
