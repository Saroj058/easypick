"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { pathAt, SHOTS } from "@/lib/tour-plan";
import { buildStore, w, type BuiltStore, type Fonts, type KioskBill, type TagInfo } from "./build-store";

export interface TourCanvasProps {
  /** Called every frame with the time since the last one; returns the second of the walk to show. */
  tick: (dt: number) => number;
  /** Small extras that are motion for its own sake: the view leans with the pointer, the lens widens when you scroll fast. Off with reduced motion. */
  lively: boolean;
  tag: TagInfo;
  bill: KioskBill;
  /** Called once the first frame is drawn, so the player can fade its poster out. */
  onReady: () => void;
}

// One smooth curve for where the camera stands and one for what it looks at, per shot.
const CURVES = SHOTS.map((frames) => ({
  pos: new THREE.CatmullRomCurve3(
    frames.map((k) => w(k.at[0], k.y, k.at[1])),
    false,
    "centripetal",
  ),
  look: new THREE.CatmullRomCurve3(
    frames.map((k) => w(...k.look)),
    false,
    "centripetal",
  ),
  zoom: frames.map((k) => k.zoom),
  last: frames.length - 1,
}));
const P = new THREE.Vector3();
const L = new THREE.Vector3();

function readFonts(): Fonts {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    display: v("--font-barlow", "'Arial Narrow', sans-serif"),
    mono: v("--font-jetbrains", "monospace"),
    sans: v("--font-inter", "system-ui, sans-serif"),
  };
}

/** The signs, the tag and the kiosk screen are drawn onto textures once, so their fonts must be loaded first. */
async function fontsReady(f: Fonts) {
  try {
    await Promise.all([document.fonts.load(`700 150px ${f.display}`, "EASYPICK"), document.fonts.load(`600 40px ${f.mono}`, "Rs 0123456789"), document.fonts.load(`400 30px ${f.mono}`, "Rs 0123456789"), document.fonts.load(`600 34px ${f.sans}`, "Scan")]);
  } catch {
    // a font that fails to load falls back; the film still plays
  }
}

/**
 * A small room for reflections, built here (nothing downloaded): a black ceiling with the three
 * light tracks, pale walls and a grey floor. Rails, mirrors and the polished floor reflect it.
 */
function storeEnvironment(gl: THREE.WebGLRenderer) {
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

function Store({ tick, lively, tag, bill, onReady }: TourCanvasProps) {
  const [store, setStore] = useState<BuiltStore | null>(null);
  const ready = useRef(false);
  /** What the last drawn frame showed, so a frame where nothing has changed is not drawn again. */
  const drawn = useRef({ t: -1, width: 0, height: 0, warm: 0 });
  /** Where the pointer is (−1 … 1 each way), and the lean and the lens kick as they ease towards it. */
  const pointer = useRef({ x: 0, y: 0 });
  const ease = useRef({ x: 0, y: 0, kick: 0 });

  // Build the store once the fonts for its signs are in. Rebuilt only if the tag or the bill changes.
  const key = `${tag.name}|${tag.price}|${tag.chest}|${tag.length}|${bill.lines.map((l) => l.name + l.price).join("|")}|${bill.total}`;
  useEffect(() => {
    const job: { cancelled: boolean; built: BuiltStore | null } = { cancelled: false, built: null };
    const fonts = readFonts();
    fontsReady(fonts).then(() => {
      if (job.cancelled) return;
      job.built = buildStore({ fonts, tag, bill });
      setStore(job.built);
    });
    return () => {
      job.cancelled = true;
      job.built?.dispose();
      setStore(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for tag and bill
  }, [key]);

  // A mouse leans the view a little, as if you turned your head. Touch screens don't.
  useEffect(() => {
    if (!lively || !matchMedia("(pointer: fine)").matches) {
      pointer.current = { x: 0, y: 0 };
      return;
    }
    const move = (e: PointerEvent) => {
      pointer.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 };
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, [lively]);

  // A new store has to be drawn even if nothing has moved.
  useEffect(() => {
    drawn.current.warm = 4;
  }, [store]);

  // This runs every frame but draws only when the picture would differ: the walk moved, the
  // window changed, or the view is still leaning. A page left open on one frame costs nothing.
  useFrame(({ camera, size: view, gl, scene }, delta) => {
    if (!store) return;
    // The player gets the real time (a slow device still walks at the film's pace); the easing here takes short steps.
    const t = tick(Math.min(delta, 0.5));
    const dt = Math.min(delta, 0.1);
    const was = drawn.current;
    const e = ease.current;

    const follow = 1 - Math.exp(-dt * 4);
    const dx = pointer.current.x - e.x;
    const dy = pointer.current.y - e.y;
    const leaning = Math.abs(dx) > 0.002 || Math.abs(dy) > 0.002;
    if (leaning) {
      e.x += dx * follow;
      e.y += dy * follow;
    }
    // Film seconds per second: 1 is walking pace. Past a brisk scroll the lens opens up a little.
    const speed = was.t < 0 || !lively ? 0 : Math.abs(t - was.t) / Math.max(dt, 0.001);
    const want = Math.min(1, Math.max(0, (speed - 2.5) / 12)) * 6;
    const kicking = Math.abs(want - e.kick) > 0.02;
    if (kicking) e.kick += (want - e.kick) * (1 - Math.exp(-dt * 5));

    const moved = t !== was.t || view.width !== was.width || view.height !== was.height;
    if (!moved && !leaning && !kicking && was.warm <= 0) return;
    was.t = t;
    was.width = view.width;
    was.height = view.height;
    if (was.warm > 0) was.warm -= 1;

    const { shot, f } = pathAt(t);
    const curve = CURVES[shot];
    const u = curve.last ? f / curve.last : 0;
    camera.position.copy(curve.pos.getPoint(u, P));
    camera.lookAt(curve.look.getPoint(u, L));
    camera.rotateY(-e.x * 0.035);
    camera.rotateX(-e.y * 0.02);

    // The lens: about 52° across on a phone held upright (so the store doesn't feel like a corridor),
    // 60° tall on a wide screen; tighter on the close-ups on phones.
    const i = Math.min(Math.floor(f), curve.last - 1 < 0 ? 0 : curve.last - 1);
    const zoom = curve.zoom[i] + (curve.zoom[Math.min(i + 1, curve.last)] - curve.zoom[i]) * (f - i);
    const aspect = view.width / view.height;
    const upright = aspect < 1;
    const base = upright ? Math.min(82, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(26)) / aspect))) : 60;
    const cam = camera as THREE.PerspectiveCamera;
    // A wide screen is already close enough at the tag and the kiosk; only upright phones tighten.
    const fov = (upright ? base / zoom : base) + e.kick;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }

    store.apply(t);
    gl.render(scene, camera);
    if (!ready.current) {
      ready.current = true;
      requestAnimationFrame(onReady);
    }
  }, 1);

  return store ? <primitive object={store.group} /> : null;
}

/** The 3D store. Loaded only on /visit/tour, and only where the player decided 3D is a good idea. */
export default function TourCanvas(props: TourCanvasProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ fov: 55, near: 0.05, far: 60, position: [0, 1.5, 7] }}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: false, stencil: false }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.08;
        const env = storeEnvironment(gl);
        scene.environment = env;
        scene.environmentIntensity = 0.55;
        scene.background = new THREE.Color("#1a1f2b");
        scene.fog = new THREE.Fog("#1a1f2b", 8, 24);
      }}
      aria-hidden
      tabIndex={-1}
    >
      {/* Soft fill, one light for form, and three that matter: the store's warm centre, the kiosk's screen glow, the street lamp. */}
      <hemisphereLight args={["#f4f1ea", "#3a3a3c", 1.25]} />
      <directionalLight position={[2, 6, 3]} intensity={0.75} />
      <pointLight position={w(3.0, 2.6, 5.4).toArray()} intensity={16} distance={11} decay={1.5} color="#ffe6c7" />
      <pointLight position={w(1.9, 1.6, 3.9).toArray()} intensity={2.2} distance={2.5} decay={2} color="#f2f6ff" />
      <pointLight position={w(-1.2, 5.2, -2.2).toArray()} intensity={14} distance={10} decay={1.4} color="#ffb766" />
      <Store {...props} />
    </Canvas>
  );
}
