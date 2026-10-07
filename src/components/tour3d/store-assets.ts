import * as THREE from "three";

import type { Fonts, Logos } from "./build-store";

// What the 3D store needs before it can be built or lit: the page's fonts (its signs are drawn
// onto textures), the logo images, and a small room for reflections. Shared by the tour
// (tour-canvas.tsx) and the Visit page's night store (visit/store-night.tsx).

export function readFonts(): Fonts {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    display: v("--font-barlow", "'Arial Narrow', sans-serif"),
    mono: v("--font-jetbrains", "monospace"),
    sans: v("--font-inter", "system-ui, sans-serif"),
  };
}

/** The signs, the tag and the kiosk screen are drawn onto textures once, so their fonts must be loaded first. */
export async function fontsReady(f: Fonts) {
  try {
    await Promise.all([document.fonts.load(`700 150px ${f.display}`, "EASYPICK"), document.fonts.load(`600 40px ${f.mono}`, "Rs 0123456789"), document.fonts.load(`400 30px ${f.mono}`, "Rs 0123456789"), document.fonts.load(`600 34px ${f.sans}`, "Scan")]);
  } catch {
    // a font that fails to load falls back; the film still plays
  }
}

/** The logo images for the signs and the bag; a logo that fails to load is left out. */
export function loadLogos(): Promise<Logos> {
  const one = (src: string) =>
    new Promise<HTMLImageElement | null>((done) => {
      const img = new Image();
      img.onload = () => done(img);
      img.onerror = () => done(null);
      img.src = src;
    });
  return Promise.all([one("/brand/logo-white.png"), one("/brand/logo.png")]).then(([white, ink]) => ({ white, ink }));
}

/**
 * A small room for reflections, built here (nothing downloaded): a black ceiling with the three
 * light tracks, pale walls and a grey floor. Rails, mirrors and the polished floor reflect it.
 */
export function storeEnvironment(gl: THREE.WebGLRenderer) {
  const room = new THREE.Scene();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 11), [
    new THREE.MeshBasicMaterial({ color: "#b9b8b3", side: THREE.BackSide }),
    new THREE.MeshBasicMaterial({ color: "#b9b8b3", side: THREE.BackSide }),
    new THREE.MeshBasicMaterial({ color: "#0c0c0e", side: THREE.BackSide }), // ceiling
    new THREE.MeshBasicMaterial({ color: "#6a6966", side: THREE.BackSide }), // floor
    new THREE.MeshBasicMaterial({ color: "#a4a39e", side: THREE.BackSide }),
    new THREE.MeshBasicMaterial({ color: "#a4a39e", side: THREE.BackSide }),
  ]);
  room.add(shell);
  const strip = new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff1dc").multiplyScalar(9) });
  const stripGeo = new THREE.BoxGeometry(0.16, 0.02, 8.5);
  for (const x of [-1.7, 0, 1.7]) {
    const s = new THREE.Mesh(stripGeo, strip);
    s.position.set(x, 1.46, 0);
    room.add(s);
  }
  const pmrem = new THREE.PMREMGenerator(gl);
  const texture = pmrem.fromScene(room, 0.03).texture;
  pmrem.dispose();
  stripGeo.dispose();
  strip.dispose();
  shell.geometry.dispose();
  (shell.material as THREE.Material[]).forEach((m) => m.dispose());
  return texture;
}
