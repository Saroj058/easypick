// What Pick, the Visit page's helper, says at each moment of the film: one short line that tells
// the visitor what they're looking at and what they can do next. Pure, so the words can be tested.

import type { SceneId } from "@/lib/visit/film";

export interface GuideContext {
  scene: SceneId;
  /** Before opening day: no door, no route. */
  soon: boolean;
  /** "Jhamsikhel": the neighbourhood. */
  area: string;
  /** Where the drawn route begins ("Jhamsikhel Chowk", "Your location"), or null with no route. */
  from: string | null;
  /** Minutes on foot along the route, or null. */
  walk: number | null;
  /** The receipt lines of the route. */
  steps: { text: string }[];
  /** The line the film has reached (-1 before the first). */
  step: number;
  /** The directions are on screen. */
  panel: boolean;
  /** No film on this device: just the directions. */
  plain: boolean;
  /** The visitor can be asked where they are. */
  canLocate: boolean;
}

export function guideLine(c: GuideContext): string {
  if (c.plain) return c.soon ? `We open soon, around ${c.area}. The hours we plan to keep are below.` : "Here are the directions. The lime button opens Google Maps from wherever you are.";
  if (c.soon) {
    if (c.scene === "open") return `Namaste, I'm Pick. We're opening soon, around ${c.area}. Join the list and I'll tell you the day.`;
    if (c.panel) return "The exact door goes on the map a few weeks before opening day. The planned hours are in the panel.";
    return `This is ${c.area}. Our door will be somewhere inside the circle.`;
  }
  switch (c.scene) {
    case "open":
      return c.from ? `Namaste, I'm Pick. The lime line is the way to our door${c.walk ? `, about ${c.walk} minutes on foot` : ""}. Come in person, or walk the store from here.` : "Namaste, I'm Pick. The big pin is us. Come in person, or walk the store from here.";
    case "street":
      return c.from ? (c.from === "Your location" ? "We start from where you are." : `We start at ${c.from}.`) : "This is where we are.";
    case "route": {
      const s = c.steps[c.step];
      return s ? `${c.step + 1} of ${c.steps.length}: ${s.text}.` : "Follow the lime line with me.";
    }
    case "door":
      return "This is us. Black shutter, lime dot.";
    case "arrive":
      return c.panel ? `Your directions are ready. The lime button opens Google Maps.${c.canLocate ? " Tap “From my location” and I'll draw the way from where you are." : ""}` : "This is us. Black shutter, lime dot.";
  }
}
