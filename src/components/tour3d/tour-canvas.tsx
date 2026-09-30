"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import { EYE, KEYFRAMES, shutterOpen } from "@/lib/tour-plan";
import { buildStore, w, type Fonts, type TagInfo } from "./build-store";

export interface TourCanvasProps {
  /** Position along the keyframes (0 … KEYFRAMES.length − 1), written by the page on scroll. */
  pathRef: React.RefObject<number>;
  /** True: jump straight to each stop (reduced motion, or the viewer paused motion). */
  still: boolean;
  tag: TagInfo;
  /** Called once the first frame is drawn, so the page can fade the poster out. */
  onReady?: () => void;
}

const posCurve = new THREE.CatmullRomCurve3(KEYFRAMES.map((k) => w(k.at[0], EYE, k.at[1])), false, "centripetal");
const lookCurve = new THREE.CatmullRomCurve3(KEYFRAMES.map((k) => w(...k.look)), false, "centripetal");
const LAST = KEYFRAMES.length - 1;

function readFonts(): Fonts {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    display: v("--font-barlow", "'Arial Narrow', sans-serif"),
    mono: v("--font-jetbrains", "monospace"),
    sans: v("--font-inter", "system-ui, sans-serif"),
    nepali: `${v("--font-mukta", "")}, 'Nirmala UI', 'Noto Sans Devanagari', sans-serif`.replace(/^, /, ""),
  };
}

function Store({ pathRef, still, tag, onReady }: TourCanvasProps) {
  const { camera, invalidate } = useThree();
  const store = useMemo(() => buildStore({ fonts: readFonts(), tag }), [tag]);
  /** Where the camera is now (eases towards the scroll position); −1 until the first frame. */
  const current = useRef(-1);
  const ready = useRef(false);

  useEffect(() => () => store.dispose(), [store]);

  // Redraw when the page scrolls; otherwise the canvas sits idle (frameloop "demand").
  useEffect(() => {
    const on = () => invalidate();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, [invalidate]);
  useEffect(() => invalidate(), [still, invalidate]);

  useFrame((_, dt) => {
    const target = Math.min(LAST, Math.max(0, pathRef.current ?? 0));
    // Ease towards where the scroll says you are; jump when motion is off.
    current.current = still || current.current < 0 ? target : THREE.MathUtils.damp(current.current, target, 6, Math.min(dt, 0.1));
    const u = current.current / LAST;
    camera.position.copy(posCurve.getPoint(u));
    camera.lookAt(lookCurve.getPoint(u));
    store.setShutter(shutterOpen(current.current));
    if (Math.abs(current.current - target) > 1e-4) invalidate();
    if (!ready.current) {
      ready.current = true;
      requestAnimationFrame(() => onReady?.());
    }
  });

  return <primitive object={store.group} />;
}

/** The 3D walk-through. Loaded only on /visit/tour, and only where the page decided 3D is a good idea. */
export default function TourCanvas(props: TourCanvasProps) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.5]}
      camera={{ fov: 58, near: 0.05, far: 60, position: [0, EYE, 4] }}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: false, stencil: false }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        // Soft reflections from a room environment generated here (nothing downloaded), and a dusk sky.
        const pmrem = new THREE.PMREMGenerator(gl);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environmentIntensity = 0.45;
        pmrem.dispose();
        scene.background = new THREE.Color("#1a1f2b");
        scene.fog = new THREE.Fog("#1a1f2b", 9, 26);
      }}
      aria-hidden
      tabIndex={-1}
    >
      <hemisphereLight args={["#f4f1ea", "#3a3a3c", 1.1]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[2, 6, 3]} intensity={0.9} />
      {/* Warm 3500K spots down the store, a cool glow at the kiosk, the street lamp outside */}
      <pointLight position={w(2.7, 2.6, 2.5).toArray()} intensity={9} distance={7} decay={1.6} color="#ffe6c7" />
      <pointLight position={w(3.8, 2.6, 6).toArray()} intensity={9} distance={7} decay={1.6} color="#ffe6c7" />
      <pointLight position={w(3.8, 2.4, 9.6).toArray()} intensity={7} distance={6} decay={1.6} color="#ffe2bd" />
      <pointLight position={w(1.9, 1.6, 3.9).toArray()} intensity={2.5} distance={2.5} decay={2} color="#e9ffd0" />
      <pointLight position={w(-1.2, 5.2, -2.2).toArray()} intensity={14} distance={10} decay={1.4} color="#ffb766" />
      <Store {...props} />
    </Canvas>
  );
}
