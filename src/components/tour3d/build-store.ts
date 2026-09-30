import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { STORE } from "@/lib/tour-plan";

// The Easypick store, built from code: no models, no photos, nothing fetched. Fixtures that
// share a material are merged into one mesh, so the whole store is a few dozen draw calls.
// Coordinates are store metres (see lib/tour-plan.ts); w() turns them into world space.

export const w = (x: number, y: number, z: number) => new THREE.Vector3(x - STORE.width / 2, y, -z);

export interface TagInfo {
  name: string;
  price: string;
  chest: string | null;
  length: string | null;
}

export interface Fonts {
  display: string;
  mono: string;
  sans: string;
  nepali: string;
}

// ---------- Colours (art direction: ink, concrete, steel, birch, one volt) ----------
const C = {
  ink: "#0a0a0a",
  steel: "#141416",
  wall: "#ecebe7",
  ceiling: "#101012",
  floor: "#8d8c89",
  birch: "#d9c7a3",
  volt: "#c6ff3d",
  street: "#1b1b1e",
  brick: "#4a3027",
  sky: "#1a1f2b",
  chrome: "#c9c9cc",
  curtain: "#232326",
};
const GARMENTS = ["#1f1f1f", "#e8e1d3", "#9a9a9c", "#5b5e3f", "#1f2a44", "#4a3528", "#8a4b2f", "#2b2b2e", "#d8d4cc"];

// ---------- Canvas textures (signs, tag, kiosk screen) ----------

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A lime zone sign: big number, word, and the Nepali line underneath. */
function zoneSign(f: Fonts, num: string, word: string, ne: string) {
  return canvasTexture(1024, 400, (g) => {
    g.fillStyle = C.volt;
    g.fillRect(0, 0, 1024, 400);
    g.fillStyle = C.ink;
    g.font = `700 230px ${f.display}`;
    g.textBaseline = "alphabetic";
    g.fillText(num, 48, 250);
    g.font = `700 150px ${f.display}`;
    g.fillText(word.toUpperCase(), 340, 215);
    g.font = `600 64px ${f.nepali}`;
    g.fillText(ne, 344, 318);
  });
}

function fasciaSign(f: Fonts) {
  return canvasTexture(1024, 200, (g) => {
    g.fillStyle = C.ink;
    g.fillRect(0, 0, 1024, 200);
    g.fillStyle = "#ffffff";
    g.font = `700 150px ${f.display}`;
    g.textBaseline = "middle";
    const text = "EASYPICK";
    const tw = g.measureText(text).width;
    g.fillText(text, (1024 - tw) / 2 - 20, 108);
    g.fillStyle = C.volt;
    g.beginPath();
    g.arc((1024 + tw) / 2 + 12, 150, 16, 0, Math.PI * 2);
    g.fill();
  });
}

function hangTag(f: Fonts, tag: TagInfo) {
  return canvasTexture(360, 640, (g) => {
    g.fillStyle = "#fbfbf8";
    g.fillRect(0, 0, 360, 640);
    g.fillStyle = C.ink;
    g.beginPath();
    g.arc(180, 44, 14, 0, Math.PI * 2);
    g.fillStyle = "#cfcfcf";
    g.fill();
    g.fillStyle = C.ink;
    // The name shrinks to fit the tag.
    const name = tag.name.toUpperCase();
    let size = 34;
    do g.font = `700 ${size--}px ${f.sans}`;
    while (g.measureText(name).width > 304 && size > 18);
    g.fillText(name, 28, 128);
    g.font = `700 78px ${f.mono}`;
    g.fillText(tag.price, 26, 222);
    g.font = `500 22px ${f.mono}`;
    g.fillStyle = "#6c6c70";
    g.fillText("FIXED · VAT INCL.", 28, 262);
    g.strokeStyle = "#9a9a9c";
    g.setLineDash([8, 8]);
    g.beginPath();
    g.moveTo(28, 300);
    g.lineTo(332, 300);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = C.ink;
    g.font = `600 28px ${f.mono}`;
    g.fillText("SIZE M", 28, 350);
    g.font = `500 28px ${f.mono}`;
    if (tag.chest) g.fillText(`CHEST   ${tag.chest}`, 28, 404);
    if (tag.length) g.fillText(`LENGTH  ${tag.length}`, 28, 450);
    g.fillStyle = C.volt;
    g.fillRect(28, 560, 304, 40);
    g.fillStyle = C.ink;
    g.font = `600 22px ${f.mono}`;
    g.fillText("PICK IT. PAY IT. WEAR IT.", 38, 588);
  });
}

function kioskScreen(f: Fonts, tag: TagInfo) {
  return canvasTexture(600, 1000, (g) => {
    g.fillStyle = "#f7f7f4";
    g.fillRect(0, 0, 600, 1000);
    g.fillStyle = C.volt;
    g.fillRect(0, 0, 600, 90);
    g.fillStyle = C.ink;
    g.font = `700 56px ${f.display}`;
    g.fillText("YOUR PIECES", 36, 66);
    g.font = `500 30px ${f.mono}`;
    const rows: [string, string][] = [
      [`${tag.name.slice(0, 16)} · M`, tag.price.replace("Rs ", "")],
      ["Six-Panel Cap", "999"],
    ];
    rows.forEach(([a, b], i) => {
      g.fillText(a, 36, 160 + i * 52);
      g.fillText(b, 600 - 36 - g.measureText(b).width, 160 + i * 52);
    });
    g.strokeStyle = "#9a9a9c";
    g.setLineDash([8, 8]);
    g.beginPath();
    g.moveTo(36, 270);
    g.lineTo(564, 270);
    g.stroke();
    g.setLineDash([]);
    g.font = `700 34px ${f.mono}`;
    g.fillText("TOTAL", 36, 320);
    // A QR-like pattern (decorative)
    const n = 25;
    const size = 360;
    const x0 = 120;
    const y0 = 380;
    const cell = size / n;
    let seed = 11;
    g.fillStyle = C.ink;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        seed = (seed * 9301 + 49297) % 233280;
        const finder = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
        if (!finder && seed / 233280 > 0.5) g.fillRect(x0 + x * cell, y0 + y * cell, cell, cell);
      }
    for (const [fx, fy] of [
      [0, 0],
      [n - 7, 0],
      [0, n - 7],
    ]) {
      g.fillStyle = C.ink;
      g.fillRect(x0 + fx * cell, y0 + fy * cell, cell * 7, cell * 7);
      g.fillStyle = "#f7f7f4";
      g.fillRect(x0 + (fx + 1) * cell, y0 + (fy + 1) * cell, cell * 5, cell * 5);
      g.fillStyle = C.ink;
      g.fillRect(x0 + (fx + 2) * cell, y0 + (fy + 2) * cell, cell * 3, cell * 3);
    }
    g.fillStyle = C.ink;
    g.font = `600 34px ${f.sans}`;
    const s = "Scan with eSewa";
    g.fillText(s, (600 - g.measureText(s).width) / 2, 820);
    g.font = `500 24px ${f.mono}`;
    g.fillStyle = "#6c6c70";
    const s2 = "NO QUEUE · BILL BY SMS";
    g.fillText(s2, (600 - g.measureText(s2).width) / 2, 870);
  });
}

function momoSign(f: Fonts) {
  return canvasTexture(1024, 256, (g) => {
    g.fillStyle = "#e9b82c";
    g.fillRect(0, 0, 1024, 256);
    g.fillStyle = "#b3261e";
    g.font = `700 104px ${f.display}`;
    g.fillText("MOMO · CHOWMEIN · LAPHING", 40, 150);
    g.fillStyle = "#1f2a44";
    g.fillRect(0, 206, 1024, 50);
    g.fillStyle = "#e9e5d8";
    g.font = `600 30px ${f.sans}`;
    g.fillText("फास्ट फुड  ·  JHAMSIKHEL", 40, 242);
  });
}

function windowsTexture() {
  return canvasTexture(1024, 360, (g) => {
    g.fillStyle = "#15171d";
    g.fillRect(0, 0, 1024, 360);
    let seed = 5;
    for (let b = 0; b < 8; b++) {
      const x0 = b * 128;
      g.fillStyle = b % 2 ? "#1b1d24" : "#181a20";
      g.fillRect(x0, 40 + (b % 3) * 26, 124, 320);
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 3; c++) {
          seed = (seed * 9301 + 49297) % 233280;
          const lit = seed / 233280;
          g.fillStyle = lit > 0.62 ? (lit > 0.9 ? "#c9e7ff" : "#ffcf8a") : "#23262e";
          g.fillRect(x0 + 16 + c * 36, 90 + (b % 3) * 26 + r * 52, 22, 30);
        }
    }
    g.fillStyle = "#0e0f12";
    g.fillRect(0, 330, 1024, 30);
  });
}

function shutterTexture() {
  const t = canvasTexture(64, 64, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, "#3c3c40");
    grad.addColorStop(0.45, "#26262a");
    grad.addColorStop(0.55, "#1a1a1d");
    grad.addColorStop(1, "#333337");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 30);
  return t;
}

function floorTexture() {
  const t = canvasTexture(256, 256, (g) => {
    g.fillStyle = "#8f8e8b";
    g.fillRect(0, 0, 256, 256);
    // soft speckle, like polished concrete tile
    let seed = 3;
    for (let i = 0; i < 1400; i++) {
      seed = (seed * 9301 + 49297) % 233280;
      const x = (seed / 233280) * 256;
      seed = (seed * 9301 + 49297) % 233280;
      const y = (seed / 233280) * 256;
      g.fillStyle = i % 2 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
      g.fillRect(x, y, 2, 2);
    }
    g.strokeStyle = "rgba(0,0,0,0.18)";
    g.lineWidth = 2;
    g.strokeRect(0, 0, 256, 256);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(STORE.width / 0.6, STORE.depth / 0.6);
  return t;
}

// ---------- Garment outlines (metres, top centre at 0,0) ----------

function garmentShape(kind: "tee" | "hoodie" | "jacket") {
  const s = new THREE.Shape();
  const pts: [number, number][] =
    kind === "tee"
      ? [[-0.08, 0], [-0.22, -0.05], [-0.3, -0.2], [-0.21, -0.25], [-0.17, -0.18], [-0.17, -0.66], [0.17, -0.66], [0.17, -0.18], [0.21, -0.25], [0.3, -0.2], [0.22, -0.05], [0.08, 0]]
      : kind === "hoodie"
        ? [[-0.09, 0.02], [-0.23, -0.06], [-0.31, -0.6], [-0.24, -0.63], [-0.18, -0.24], [-0.18, -0.7], [0.18, -0.7], [0.18, -0.24], [0.24, -0.63], [0.31, -0.6], [0.23, -0.06], [0.09, 0.02]]
        : [[-0.08, 0], [-0.24, -0.06], [-0.31, -0.64], [-0.24, -0.66], [-0.19, -0.26], [-0.19, -0.76], [0.19, -0.76], [0.19, -0.26], [0.24, -0.66], [0.31, -0.64], [0.24, -0.06], [0.08, 0]];
  s.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) s.lineTo(x, y);
  if (kind === "hoodie") s.quadraticCurveTo(0, 0.16, -0.09, 0.02);
  else s.quadraticCurveTo(0, -0.07, pts[0][0], pts[0][1]);
  return new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: false, curveSegments: 6 });
}

// ---------- The builder ----------

/** Collects boxes per material and merges them into one mesh each. */
class Kit {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(mat: THREE.Material, geo: THREE.BufferGeometry, pos: THREE.Vector3, rotY = 0, rotX = 0, rotZ = 0) {
    const g = geo.clone();
    geo.dispose();
    const m = new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, rotZ)), new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat)!.push(g.index ? g.toNonIndexed() : g);
  }
  /** A box by its store-space centre (x, y, z) and size (width x, height y, depth z). */
  box(mat: THREE.Material, [x, y, z]: [number, number, number], [sx, sy, sz]: [number, number, number], rotY = 0) {
    this.add(mat, new THREE.BoxGeometry(sx, sy, sz), w(x, y, z), rotY);
  }
  build(group: THREE.Group) {
    for (const [mat, geos] of this.parts) {
      const merged = mergeGeometries(geos);
      if (!merged) continue;
      merged.computeVertexNormals();
      group.add(new THREE.Mesh(merged, mat));
      geos.forEach((g) => g.dispose());
    }
  }
}

export interface BuiltStore {
  group: THREE.Group;
  /** The rolling shutter: move it with setShutter(0…1). */
  setShutter: (open: number) => void;
  dispose: () => void;
}

export function buildStore(opts: { fonts: Fonts; tag: TagInfo }): BuiltStore {
  const { fonts, tag } = opts;
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);

  const std = (color: string, rough = 0.8, metal = 0) => keep(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
  const glow = (color: string) => keep(new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  const M = {
    ink: std(C.ink, 0.6),
    steel: std(C.steel, 0.45, 0.6),
    chrome: std(C.chrome, 0.2, 1),
    wall: std(C.wall, 0.95),
    ceiling: std(C.ceiling, 1),
    birch: std(C.birch, 0.7),
    brick: std(C.brick, 0.95),
    street: std(C.street, 0.9),
    curtain: std(C.curtain, 1),
    volt: glow(C.volt),
    light: glow("#fff6e6"),
    acrylic: keep(new THREE.MeshStandardMaterial({ color: "#dfe7ea", roughness: 0.05, metalness: 0, transparent: true, opacity: 0.18 })),
    glass: keep(new THREE.MeshStandardMaterial({ color: "#aab4b8", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.12, depthWrite: false })),
    mirror: std("#dfe3e6", 0.05, 1),
    bag: std("#f4f3ef", 0.9),
  };
  const kit = new Kit();
  const W = STORE.width;
  const D = STORE.depth;
  const H = STORE.height;

  // ---- Shell ----
  const floorMat = keep(new THREE.MeshStandardMaterial({ map: keep(floorTexture()), roughness: 0.45, metalness: 0.05 }));
  const floor = new THREE.Mesh(keep(new THREE.PlaneGeometry(W, D)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.copy(w(W / 2, 0, D / 2));
  group.add(floor);
  kit.box(M.ceiling, [W / 2, H + 0.05, D / 2], [W, 0.1, D]);
  kit.box(M.wall, [-0.05, H / 2, D / 2], [0.1, H, D]); // left
  kit.box(M.wall, [W + 0.05, H / 2, D / 2], [0.1, H, D]); // right
  kit.box(M.wall, [W / 2, H / 2, D + 0.05], [W, H, 0.1]); // back
  // stockroom wall and door (back left)
  kit.box(M.wall, [1.1, H / 2, 9.4], [2.2, H, 0.1]);
  kit.box(M.ink, [1.8, 1.05, 9.34], [0.8, 2.1, 0.02]);
  // full-height mirror closing the central view
  kit.box(M.mirror, [2.7, 1.2, D - 0.02], [0.8, 2.2, 0.02]);
  kit.box(M.ink, [2.7, 1.2, D - 0.01], [0.9, 2.3, 0.01]);

  // ---- Street and facade ----
  const street = new THREE.Mesh(keep(new THREE.PlaneGeometry(30, 14)), M.street);
  street.rotation.x = -Math.PI / 2;
  street.position.copy(w(W / 2, -0.01, -7));
  group.add(street);
  kit.box(std("#2a2a2d", 0.9), [W / 2, 0.08, -0.9], [30, 0.16, 1.8]); // pavement
  kit.box(M.brick, [-3, 4, 0.05], [6, 8, 0.3]);
  kit.box(M.brick, [W + 3, 4, 0.05], [6, 8, 0.3]);
  kit.box(M.brick, [W / 2, 5.9, 0.05], [W, 4.2, 0.3]);
  kit.box(M.ink, [W / 2, 3.5, -0.3], [W + 0.2, 0.6, 0.1]); // fascia
  kit.box(M.steel, [W / 2, 3.1, -0.2], [W, 0.2, 0.3]); // shutter box
  // rebar and water tank on the building next door
  for (let i = 0; i < 5; i++) kit.box(M.steel, [W + 1 + i * 0.9, 8.4, 0.1], [0.03, 0.9, 0.03]);
  kit.box(M.ink, [W + 2.2, 8.5, 0.6], [1.0, 1.0, 1.0]);
  // across the street: buildings with a few lit windows (what you see when you walk out)
  const across = new THREE.Mesh(keep(new THREE.PlaneGeometry(26, 9)), keep(new THREE.MeshBasicMaterial({ map: keep(windowsTexture()), toneMapped: false })));
  across.position.copy(w(W / 2, 4.5, -11));
  across.rotation.y = Math.PI;
  group.add(across);
  // street lamp on the pole, and a scooter parked outside
  kit.box(M.steel, [-0.9, 5.4, -1.6], [1.0, 0.05, 0.05]);
  kit.box(M.light, [-0.45, 5.34, -1.6], [0.3, 0.05, 0.12]);
  kit.box(M.ink, [5.9, 0.4, -1.4], [0.35, 0.5, 1.3]);
  kit.add(M.ink, new THREE.TorusGeometry(0.22, 0.06, 8, 20), w(5.9, 0.24, -2.0), Math.PI / 2);
  kit.add(M.ink, new THREE.TorusGeometry(0.22, 0.06, 8, 20), w(5.9, 0.24, -0.8), Math.PI / 2);
  kit.box(std("#8a4b2f", 0.5, 0.3), [5.9, 0.75, -1.2], [0.4, 0.3, 0.9]);
  // power pole
  kit.box(std("#6b6b6b", 0.9), [-1.4, 4, -1.6], [0.22, 8, 0.22]);
  // momo shop next door
  const momo = new THREE.Mesh(keep(new THREE.PlaneGeometry(3.4, 0.85)), keep(new THREE.MeshBasicMaterial({ map: keep(momoSign(fonts)) })));
  momo.position.copy(w(W + 2.6, 3.2, -0.22));
  group.add(momo);
  kit.box(std("#3d2b23", 0.9), [W + 2.6, 1.3, -0.1], [3, 2.6, 0.12]); // their shutter, down

  // tangled cables from the pole across the street
  const cableMat = keep(new THREE.MeshBasicMaterial({ color: "#050505" }));
  for (let i = 0; i < 7; i++) {
    const a = w(-1.4, 7.2 - i * 0.12, -1.6);
    const b = w(W + 6, 7.4 - (i % 3) * 0.25, 0.2 - i * 0.15);
    const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -0.9 - (i % 4) * 0.25, 0));
    const tube = keep(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 24, 0.012, 4));
    group.add(new THREE.Mesh(tube, cableMat));
  }
  // coil of spare cable on the pole
  const coil = new THREE.Mesh(keep(new THREE.TorusGeometry(0.28, 0.02, 6, 24)), cableMat);
  coil.position.copy(w(-1.25, 5.6, -1.6));
  group.add(coil);

  // the fascia sign
  const fascia = new THREE.Mesh(keep(new THREE.PlaneGeometry(2.6, 0.5)), keep(new THREE.MeshBasicMaterial({ map: keep(fasciaSign(fonts)), toneMapped: false })));
  fascia.position.copy(w(W / 2, 3.5, -0.36));
  group.add(fascia);

  // glass shopfront with the double door open
  kit.box(M.glass, [0.9, 1.5, 0.25], [1.8, 3, 0.02]);
  kit.box(M.glass, [4.5, 1.5, 0.25], [1.8, 3, 0.02]);
  kit.box(M.steel, [1.8, 1.5, 0.25], [0.05, 3, 0.06]);
  kit.box(M.steel, [3.6, 1.5, 0.25], [0.05, 3, 0.06]);
  // window plinths with a folded stack on each
  kit.box(M.ink, [0.85, 0.15, 0.8], [1.3, 0.3, 0.8]);
  kit.box(M.ink, [4.55, 0.15, 0.8], [1.3, 0.3, 0.8]);

  // the shutter, which rolls up
  const shutterMat = keep(new THREE.MeshStandardMaterial({ map: keep(shutterTexture()), roughness: 0.5, metalness: 0.7 }));
  const shutter = new THREE.Mesh(keep(new THREE.BoxGeometry(W - 0.2, 3, 0.05)), shutterMat);
  const shutterDown = w(W / 2, 1.5, -0.1);
  shutter.position.copy(shutterDown);
  group.add(shutter);
  // Rolls up into its box at 3 m: what's left hanging shrinks from the bottom.
  const setShutter = (open: number) => {
    shutter.scale.y = Math.max(0.02, 1 - open);
    shutter.position.y = 3 - 1.5 * shutter.scale.y;
  };

  // ---- RFID gate ----
  for (const x of [1.8, 3.6]) {
    kit.box(M.acrylic, [x, 0.75, 1.0], [0.08, 1.5, 0.35]);
    kit.box(M.volt, [x, 1.5, 1.0], [0.09, 0.015, 0.36]);
  }
  // volt tape line on the floor: door → kiosk
  kit.box(M.volt, [2.7, 0.004, 2.0], [0.05, 0.008, 2.0]);
  const diag = new THREE.BoxGeometry(0.05, 0.008, 1.3);
  kit.add(M.volt, diag, w(2.25, 0.004, 3.45), Math.atan2(0.9, 0.9));

  // ---- Greeter's stand with the picture guide ----
  kit.box(M.ink, [4.1, 0.55, 1.9], [0.5, 1.1, 0.4]);
  kit.box(M.birch, [4.1, 1.12, 1.9], [0.56, 0.04, 0.46]);

  // ---- Right wall bays: tees, hoodies, jackets ----
  const bays: { z0: number; z1: number; kind: "tee" | "hoodie" | "jacket"; drop: number }[] = [
    { z0: 1.8, z1: 4.2, kind: "tee", drop: 0.66 },
    { z0: 4.2, z1: 6.6, kind: "hoodie", drop: 0.7 },
    { z0: 6.6, z1: 8.4, kind: "jacket", drop: 0.76 },
  ];
  const sideHung: { pos: THREE.Vector3; size: [number, number]; colour: string }[] = [];
  const faceOut: { kind: "tee" | "hoodie" | "jacket"; pos: THREE.Vector3; colour: string; rotY: number }[] = [];
  let ci = 0;
  for (const b of bays) {
    // uprights and back panel
    kit.box(M.birch, [W - 0.02, 1.3, (b.z0 + b.z1) / 2], [0.03, 2.4, b.z1 - b.z0 - 0.06]);
    kit.box(M.steel, [W - 0.2, 1.3, b.z0 + 0.03], [0.04, 2.4, 0.04]);
    // two hang rails (upper and lower) and a face-out arm at the front of each bay
    for (const y of [2.0, 1.2]) kit.add(M.chrome, new THREE.CylinderGeometry(0.012, 0.012, b.z1 - b.z0 - 0.7, 8), w(W - 0.25, y, (b.z0 + b.z1) / 2 + 0.3), 0, Math.PI / 2);
    kit.box(M.chrome, [W - 0.35, 1.7, b.z0 + 0.35], [0.3, 0.02, 0.02]);
    for (const [y, count] of [
      [2.0, 11],
      [1.2, 11],
    ] as const) {
      for (let i = 0; i < count; i++) {
        const z = b.z0 + 0.75 + i * ((b.z1 - b.z0 - 0.95) / count);
        const h = y === 2.0 ? Math.min(b.drop, 0.7) : b.drop;
        sideHung.push({ pos: w(W - 0.25, y - h / 2 - 0.03, z), size: [0.46, h], colour: GARMENTS[(ci++ * 5) % GARMENTS.length] });
      }
    }
    faceOut.push({ kind: b.kind, pos: w(W - 0.52, 1.7, b.z0 + 0.35), colour: GARMENTS[(ci += 3) % GARMENTS.length], rotY: -Math.PI / 2 });
  }
  // the tee on the first face-out arm is the one with the readable tag
  faceOut[0].colour = "#e8e1d3";

  // ---- Left wall: bottoms and a cap pegboard ----
  kit.box(M.birch, [0.02, 1.3, 5.7], [0.03, 2.4, 1.74]);
  kit.add(M.chrome, new THREE.CylinderGeometry(0.012, 0.012, 1.6, 8), w(0.25, 1.75, 5.7), 0, Math.PI / 2);
  for (let i = 0; i < 12; i++) sideHung.push({ pos: w(0.25, 1.23, 4.98 + i * 0.13), size: [0.34, 1.0], colour: ["#1f2a44", "#2b2b2e", "#5b5e3f", "#9a9a9c"][i % 4] });
  kit.box(M.birch, [0.02, 1.3, 7.5], [0.03, 2.4, 1.74]);
  const capMat = std("#1f1f1f", 0.9);
  const capMat2 = std("#e8e1d3", 0.9);
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 6; c++) kit.add((r + c) % 3 ? capMat : capMat2, new THREE.SphereGeometry(0.1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), w(0.12, 0.8 + r * 0.33, 6.85 + c * 0.26), 0, 0, -Math.PI / 2);

  // ---- Feature tables with folded stacks ----
  kit.box(M.ink, [2.7, 0.45, 5.7], [0.9, 0.9, 1.8]);
  kit.box(M.ink, [2.7, 0.38, 6.9], [0.8, 0.75, 0.6]);
  for (let i = 0; i < 6; i++) {
    const colour = GARMENTS[(i * 2) % GARMENTS.length];
    const stack = std(colour, 1);
    for (let k = 0; k < 4; k++) kit.box(stack, [2.48 + (i % 2) * 0.44, 0.93 + k * 0.045, 5.05 + Math.floor(i / 2) * 0.62], [0.34, 0.04, 0.42]);
  }
  // mannequin plinth (a simple torso form, no face)
  kit.box(M.ink, [2.7, 0.1, 7.6], [1.0, 0.2, 0.6]);
  kit.add(std("#d9d6cf", 0.6), new THREE.CylinderGeometry(0.16, 0.13, 0.6, 16), w(2.45, 1.35, 7.6));
  kit.add(std("#1f1f1f", 0.9), new THREE.CylinderGeometry(0.2, 0.17, 0.55, 16), w(2.45, 1.3, 7.6));
  kit.add(M.steel, new THREE.CylinderGeometry(0.015, 0.015, 1.0, 8), w(2.45, 0.6, 7.6));
  kit.add(std("#8a4b2f", 0.9), new THREE.CylinderGeometry(0.2, 0.17, 0.62, 16), w(2.95, 1.3, 7.6));
  kit.add(M.steel, new THREE.CylinderGeometry(0.015, 0.015, 1.0, 8), w(2.95, 0.6, 7.6));

  // ---- Helper's token station ----
  kit.box(M.ink, [2.7, 0.55, 9.1], [0.6, 1.1, 0.4]);
  for (let i = 0; i < 6; i++) kit.add(M.volt, new THREE.CylinderGeometry(0.045, 0.045, 0.012, 16), w(2.48 + (i % 3) * 0.22, 1.12, 9.0 + Math.floor(i / 3) * 0.18));

  // ---- Fitting rooms (two, back right) ----
  kit.box(M.wall, [4.3, 1.25, 10.35], [0.06, 2.5, 1.3]); // divider
  kit.box(M.wall, [3.2, 1.25, 10.35], [0.06, 2.5, 1.3]);
  kit.add(M.chrome, new THREE.CylinderGeometry(0.01, 0.01, 2.2, 8), w(4.3, 2.3, 9.72), 0, 0, Math.PI / 2); // curtain rail
  const curtainGeo = new THREE.PlaneGeometry(1.0, 2.15, 24, 1);
  const pos = curtainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 28) * 0.03);
  curtainGeo.computeVertexNormals();
  const curtainMat = keep(new THREE.MeshStandardMaterial({ color: C.curtain, roughness: 1, side: THREE.DoubleSide }));
  const c1 = new THREE.Mesh(keep(curtainGeo), curtainMat);
  c1.position.copy(w(4.85, 1.2, 9.72));
  group.add(c1);
  // room 1: curtain drawn aside, a stool and a hook inside
  const c2 = new THREE.Mesh(curtainGeo, curtainMat);
  c2.scale.x = 0.28;
  c2.position.copy(w(3.35, 1.2, 9.72));
  group.add(c2);
  kit.box(M.birch, [3.9, 0.22, 10.7], [0.35, 0.44, 0.35]);
  kit.box(M.mirror, [3.75, 1.2, 10.97], [0.6, 1.8, 0.02]);
  // number lightboxes: volt = free, grey = taken
  kit.box(M.volt, [3.75, 2.62, 9.7], [0.28, 0.2, 0.04]);
  kit.box(std("#5a5a5e", 0.8), [4.85, 2.62, 9.7], [0.28, 0.2, 0.04]);

  // ---- Self-checkout kiosk (faces +x): a tall totem, screen at eye level, tray below ----
  kit.box(M.ink, [1.2, 0.85, 3.9], [0.5, 1.7, 0.62]);
  kit.box(M.steel, [1.5, 0.78, 3.9], [0.14, 0.05, 0.52]); // tray
  kit.box(M.volt, [1.575, 0.8, 3.9], [0.01, 0.025, 0.52]); // tray rim
  const screen = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.42, 0.7)), keep(new THREE.MeshBasicMaterial({ map: keep(kioskScreen(fonts, tag)), toneMapped: false })));
  screen.position.copy(w(1.465, 1.28, 3.9));
  screen.rotation.set(0, Math.PI / 2, 0);
  group.add(screen);
  // the kiosk's glow on the floor
  const halo = new THREE.Mesh(keep(new THREE.CircleGeometry(0.8, 32)), keep(new THREE.MeshBasicMaterial({ color: C.volt, transparent: true, opacity: 0.12, depthWrite: false })));
  halo.rotation.x = -Math.PI / 2;
  halo.position.copy(w(1.8, 0.006, 3.9));
  group.add(halo);

  // ---- Pickup counter and cubbies ----
  kit.box(M.ink, [1.2, 0.48, 2.4], [0.6, 0.96, 1.6]);
  kit.box(M.birch, [1.2, 0.98, 2.4], [0.66, 0.04, 1.66]);
  kit.box(M.birch, [0.18, 1.1, 2.4], [0.35, 2.1, 1.6]);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) kit.box(M.bag, [0.24, 0.45 + r * 0.6, 1.9 + c * 0.5], [0.24, 0.34, 0.3]);
  kit.box(M.bag, [1.2, 1.18, 2.2], [0.3, 0.36, 0.16]); // the bag waiting on the counter
  kit.box(M.volt, [1.36, 1.1, 2.2], [0.005, 0.06, 0.1]); // its order sticker

  // ---- Ceiling: black track runs with spots ----
  for (const x of [1.0, 2.7, 4.4]) {
    kit.box(M.ink, [x, H - 0.03, 6], [0.04, 0.03, 9]);
    for (let z = 1.8; z < 10.5; z += 1.2) {
      kit.add(M.ink, new THREE.CylinderGeometry(0.04, 0.05, 0.14, 12), w(x, H - 0.12, z));
      kit.add(M.light, new THREE.CircleGeometry(0.035, 12), w(x, H - 0.195, z), 0, Math.PI / 2);
    }
  }
  // the volt LED strip along the right wall's top edge (it leads you in)
  kit.box(M.volt, [W - 0.04, H - 0.05, 5.5], [0.02, 0.02, 9]);

  // ---- Hanging zone signs ----
  const signGeo = keep(new THREE.PlaneGeometry(0.9, 0.35));
  const addSign = (tex: THREE.Texture, [x, y, z]: [number, number, number], rotY: number) => {
    const m = new THREE.Mesh(signGeo, keep(new THREE.MeshBasicMaterial({ map: keep(tex), toneMapped: false, side: THREE.DoubleSide })));
    m.position.copy(w(x, y, z));
    m.rotation.y = rotY;
    group.add(m);
    kit.box(M.ink, [x, y + 0.35, z], [0.006, 0.36, 0.006]);
  };
  addSign(zoneSign(fonts, "01", "Pick", "छान्नुहोस्"), [4.55, 2.45, 3.0], -Math.PI / 2);
  addSign(zoneSign(fonts, "02", "Try", "लगाएर हेर्नुहोस्"), [4.3, 2.45, 9.2], 0);
  addSign(zoneSign(fonts, "03", "Pay", "तिर्नुहोस्"), [1.3, 2.35, 3.9], Math.PI / 2);
  addSign(zoneSign(fonts, "04", "Pickup", "लिनुहोस्"), [1.3, 2.35, 2.2], Math.PI / 2);
  // "Aaunus" welcome board on the greeter's stand (faces the door)
  const welcome = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.5, 0.2)), keep(new THREE.MeshBasicMaterial({ map: keep(zoneSign(fonts, "00", "Aaunus", "आउनुस्")), toneMapped: false })));
  welcome.position.copy(w(3.83, 1.3, 1.8));
  welcome.rotation.set(-0.25, -0.9, 0, "YXZ"); // turned towards you as you come through the gate
  group.add(welcome);

  // ---- Garments ----
  const garmentMat = keep(new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 }));
  const hung = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(1, 1, 0.022)), garmentMat, sideHung.length);
  const dummy = new THREE.Object3D();
  sideHung.forEach((g, i) => {
    dummy.position.copy(g.pos);
    dummy.rotation.set(0, 0, ((i % 3) - 1) * 0.012); // hung side-on, sleeve towards the aisle
    dummy.scale.set(g.size[0], g.size[1], 1);
    dummy.updateMatrix();
    hung.setMatrixAt(i, dummy.matrix);
    hung.setColorAt(i, new THREE.Color(g.colour));
  });
  group.add(hung);
  for (const f of faceOut) {
    const m = new THREE.Mesh(keep(garmentShape(f.kind)), keep(new THREE.MeshStandardMaterial({ color: f.colour, roughness: 0.95 })));
    m.position.copy(f.pos);
    m.rotation.y = f.rotY;
    group.add(m);
  }

  // ---- The readable hang tag, on the first face-out tee ----
  const tagMesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.2, 0.356)), keep(new THREE.MeshBasicMaterial({ map: keep(hangTag(fonts, tag)), toneMapped: false })));
  tagMesh.position.copy(w(W - 0.62, 1.33, 1.8 + 0.45));
  tagMesh.rotation.set(0, -Math.PI / 2 - 0.45, 0.04, "YXZ"); // turned towards you
  group.add(tagMesh);
  kit.box(M.ink, [W - 0.6, 1.53, 1.8 + 0.43], [0.003, 0.1, 0.003]); // its string

  kit.build(group);
  group.traverse((o) => {
    if (o instanceof THREE.Mesh && o.geometry) disposables.push(o.geometry);
    o.matrixAutoUpdate = o === shutter;
    o.updateMatrix();
  });

  return {
    group,
    setShutter: (open) => {
      setShutter(open);
      shutter.updateMatrix();
    },
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
}
