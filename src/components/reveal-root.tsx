"use client";

import { useEffect } from "react";

/**
 * Fades [data-reveal] elements up once as they enter the viewport. Elements are
 * hidden only after this runs, so nothing disappears without JavaScript.
 * The hero never uses data-reveal, so it paints immediately.
 */
export function RevealRoot() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const vh = window.innerHeight;
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          (e.target as HTMLElement).dataset.shown = "";
          io.unobserve(e.target);
        }),
      { rootMargin: "0px 0px -8% 0px" },
    );
    els.forEach((el) => {
      // Already on screen: show without animating.
      if (el.getBoundingClientRect().top < vh) el.dataset.shown = "";
      else io.observe(el);
    });
    document.documentElement.classList.add("reveal-on");
    return () => {
      io.disconnect();
      document.documentElement.classList.remove("reveal-on");
    };
  }, []);
  return null;
}
