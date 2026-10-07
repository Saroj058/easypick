"use client";

import { useEffect, useState } from "react";

import type { Lights } from "@/lib/visit-status";

// The Visit page's stage (docs/VISIT_PAGE_PLAN.md): the hero now, then the 3D store (Phase 2b),
// the Find us map (Phase 3b) and the motion between them (Phase 4). It's the only place that
// will load those on the client. The hero itself is server-rendered HTML passed in as children,
// so the status, the heading and both links work with no JavaScript at all.

export type Stage = "hero" | "inside" | "map";
export type MapState = "idle" | "loading" | "ready" | "flying" | "drawing" | "done" | "interrupted";
export type Fallback = "none" | "reduced" | "lite" | "nowebgl";

/** Test switches, honoured only with ?preview=open or outside production (the page decides). */
export interface StageSwitches {
  motion: "normal" | "fast";
  lite: boolean;
  gl: "on" | "off";
  tiles: "live" | "fixture";
}

type Nav = Navigator & { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number };

/** Save-Data, a 2G/3G connection or 2 GB of memory or less: the light version (same check as the tour). */
function wantsLite(): boolean {
  const nav = navigator as Nav;
  return Boolean(nav.connection?.saveData || /(^|-)2g|3g/.test(nav.connection?.effectiveType ?? "") || (nav.deviceMemory !== undefined && nav.deviceMemory <= 2));
}

function hasWebGL(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext(); // only a probe: give the context back
    return Boolean(gl);
  } catch {
    return false;
  }
}

export function VisitStage({ lights, switches, children }: { lights: Lights; switches: StageSwitches; children: React.ReactNode }) {
  const [stage] = useState<Stage>("hero");
  const [mapState] = useState<MapState>("idle");
  // Until the browser has been asked, assume the full version (the server can't know).
  const [fallback, setFallback] = useState<Fallback>("none");

  useEffect(() => {
    const decide = (): Fallback => {
      if (switches.gl === "off" || !hasWebGL()) return "nowebgl";
      if (switches.lite || wantsLite()) return "lite";
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return "reduced";
      return "none";
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the device can only be read once mounted
    setFallback(decide());
  }, [switches.gl, switches.lite]);

  return (
    <div data-stage={stage} data-map-state={mapState} data-lights={lights} data-fallback={fallback} data-motion={switches.motion} data-tiles={switches.tiles}>
      {children}
    </div>
  );
}
