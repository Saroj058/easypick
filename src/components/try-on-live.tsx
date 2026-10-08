"use client";

import { useEffect, useState } from "react";

// Live try-on for the pieces the owner switches it on for (admin, product page): the shopper sees
// the garment on themselves through their camera. It is Anywear's widget (Decart), a script from
// their site that finds the product photos and puts its own Try-on buttons on them.
//
// Nothing of theirs loads until the shopper asks: the button is a plain link to this same page with
// ?try=1, opened as a full page load, because only that address is allowed to run their script and
// to offer the camera (see next.config.ts). The video goes from the shopper's browser to Anywear,
// never to us.

/** The address mark that switches the widget on, and the rule in next.config.ts that allows it. */
export const TRY_ON_PARAM = "try";
export const TRY_ON_ORIGIN = "https://anywear.decart.ai";

export function TryOnLive({ slug }: { slug: string }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(location.search).get(TRY_ON_PARAM) !== "1") return;
    const later = setTimeout(() => setOn(true), 0);
    if (document.querySelector("script[data-try-on]")) return () => clearTimeout(later);
    const script = document.createElement("script");
    script.src = `${TRY_ON_ORIGIN}/widget/latest/anywear.js?domain=${encodeURIComponent(location.hostname)}`;
    script.async = true;
    script.setAttribute("data-try-on", "");
    document.body.appendChild(script);
    return () => clearTimeout(later);
  }, []);

  return (
    <div data-try-on-live={on ? "on" : "off"} className="mt-4">
      {on ? (
        <p className="text-[14px] text-steel-dark" role="status">
          Live try-on is on: press <span className="font-semibold text-ink">Try on</span> on a photo.
        </p>
      ) : (
        // A full page load on purpose (not a <Link>): the try-on address carries its own permissions.
        <a href={`/product/${slug}?${TRY_ON_PARAM}=1`} rel="nofollow" className="btn btn-outline w-full">
          Try it on live
        </a>
      )}
      <p className="mt-2 text-[13px] text-steel-dark">Uses your camera. The video goes to Anywear to draw the piece on you, not to us.</p>
    </div>
  );
}
