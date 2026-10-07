"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { buildStore, w, type BuiltStore, type KioskBill, type NightKind, type TagInfo } from "@/components/tour3d/build-store";
import { fontsReady, loadLogos, readFonts, storeEnvironment } from "@/components/tour3d/store-assets";
import { heightForZoom, inOut } from "@/lib/map/sequence";
import { STORE } from "@/lib/tour-plan";

// The Visit page hero: the store from across the street at night, the same model the tour walks
// through. Its lights follow the store's state; the camera drifts slowly from side to side; the
// two buttons each give a small preview (the door slides, the camera looks up at the roof).
// Loaded only by visit-stage.tsx, after the poster is on screen.

/** What the visitor is pointing at: the hero answers with a small move. */
export type HeroPreview = "inside" | "find" | null;

export interface StoreNightProps {
  lights: NightKind;
  preview: HeroPreview;
  /** 2 = phones and weaker GPUs (no antialiasing, 1× pixels); 3 = everything else. */
  tier: 2 | 3;
  /** No drifting or easing: the store stands still and changes at once. */
  still: boolean;
  /** False while the hero is off screen or the tab is hidden: nothing is drawn. */
  active: boolean;
  tag: TagInfo;
  bill: KioskBill;
  /** Called once the first frame is drawn, so the poster can fade out. */
  onReady: () => void;
  /** The graphics context was lost (the poster comes back until it is restored). */
  onLost: () => void;
  onRestored: () => void;
  /** Where the point above the roof is on screen, in CSS pixels from the canvas's top left, each frame. */
  onAnchor?: (x: number, y: number) => void;
  /** How long the rise to straight overhead takes, in ms, once Find us is tapped; null until then. */
  rise?: number | null;
  /** The map zoom the rise ends at (the map opens at the same view). */
  riseZoom?: number;
  onRisen?: () => void;
  /** Set to true to be handed the current frame as a picture (once), before the canvas is taken away. */
  capture?: boolean;
  onCapture?: (dataUrl: string) => void;
}

// How bright the room is from outside, per state. The shutter is always up; closed is "lights off".
const ROOM: Record<NightKind, { inside: number; front: number; exposure: number }> = {
  open: { inside: 85, front: 46, exposure: 1.35 },
  drop: { inside: 85, front: 46, exposure: 1.35 },
  closed: { inside: 2.2, front: 0.8, exposure: 1.1 },
  soon: { inside: 5, front: 1.6, exposure: 1.1 },
};

const CENTRE = STORE.width / 2;
/** What the camera looks at: the middle of the shopfront. */
const LOOK = w(CENTRE, 1.95, 0.4);
/** The point above the roof where the pin sits. */
const ROOF = w(CENTRE, 4.6, 0.2);
const P = new THREE.Vector3();
const L = new THREE.Vector3();
const TOP = new THREE.Vector3();
const Q0 = new THREE.Quaternion();
/** Looking straight down with the top of the screen pointing into the store (away from the street). */
const DOWN = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));

function Scene({ lights, preview, still, tag, bill, onReady, onAnchor, capture, onCapture, rise = null, riseZoom = 19, onRisen }: StoreNightProps) {
  const { invalidate } = useThree();
  const get = useThree((s) => s.get);
  const [store, setStore] = useState<BuiltStore | null>(null);
  const inside = useRef<THREE.PointLight>(null);
  const front = useRef<THREE.PointLight>(null);
  /** Eased values: the drift's clock, the door, the dolly, the upward tilt, the room's light. */
  const now = useRef({ t: 0, door: 0, dolly: 0, tilt: 0, glow: 1, first: true, rise: 0, risen: false });

  const key = `${tag.name}|${tag.price}|${bill.total}`;
  useEffect(() => {
    const job: { cancelled: boolean; built: BuiltStore | null } = { cancelled: false, built: null };
    const fonts = readFonts();
    Promise.all([fontsReady(fonts), loadLogos()]).then(([, logos]) => {
      if (job.cancelled) return;
      job.built = buildStore({ fonts, tag, bill, logos, door: "sliding" });
      job.built.apply(5); // the shutter fully up
      setStore(job.built);
    });
    return () => {
      job.cancelled = true;
      job.built?.dispose();
      setStore(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for tag and bill
  }, [key]);

  useEffect(() => {
    store?.setNight(lights);
    invalidate();
  }, [store, lights, invalidate]);
  // The last frame, as a picture: drawn and read in the same tick, so the buffer is still there.
  useEffect(() => {
    if (!capture || !store || !onCapture) return;
    const { gl, scene, camera } = get();
    gl.render(scene, camera);
    onCapture(gl.domElement.toDataURL("image/jpeg", 0.86));
  }, [capture, store, onCapture, get]);
  // A hover or a resize while the store stands still needs one new frame.
  useEffect(() => invalidate(), [preview, still, rise, invalidate]);

  useFrame(({ camera, size, gl, scene }, delta) => {
    if (!store) return;
    const dt = Math.min(delta, 0.1);
    const v = now.current;
    const ease = (from: number, to: number, rate: number) => (still ? to : from + (to - from) * (1 - Math.exp(-dt * rate)));

    if (!still) v.t += dt;
    v.door = ease(v.door, preview === "inside" ? 0.12 : 0, 7);
    v.dolly = ease(v.dolly, preview === "inside" ? 0.4 : 0, 5);
    v.tilt = ease(v.tilt, preview === "find" ? 4 : 0, 8);
    v.glow = ease(v.glow, preview === "inside" ? 1.2 : 1, 6);
    store.setDoor(v.door);

    const room = ROOM[lights];
    if (inside.current) inside.current.intensity = room.inside * v.glow;
    if (front.current) front.current.intensity = room.front * v.glow;
    gl.toneMappingExposure = room.exposure;

    // Far enough back to fit the shopfront across the view, whatever the screen's shape.
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    // Half the shopfront plus its neighbours' edges; an upright phone gets just the shopfront.
    const fitWide = (aspect < 1 ? 3.15 : 4.6) / (halfH * aspect);
    const fitTall = 3.4 / halfH; // the sign and the pavement
    const back = Math.max(fitWide, fitTall) - v.dolly;
    // A slow drift from side to side, about 9° either way, once every 48 seconds.
    const swing = Math.sin((v.t / 48) * Math.PI * 2) * 0.16;
    P.copy(w(CENTRE + Math.sin(swing) * back, 1.75, -Math.cos(swing) * back));
    camera.position.copy(P);
    L.copy(LOOK);
    if (aspect < 1) L.y -= 1.0; // an upright phone: the store sits higher, clear of the words
    L.y += Math.tan(THREE.MathUtils.degToRad(v.tilt)) * back;
    camera.lookAt(L);

    // Find us: the camera lifts until it looks straight down on the roof, as high as the map's
    // opening view, north up (the street at the bottom of the screen), so the map can take over
    // from the same picture.
    if (rise !== null) {
      v.rise = Math.min(1, rise <= 0 ? 1 : v.rise + (dt * 1000) / rise);
      const e = inOut(v.rise);
      Q0.copy(camera.quaternion);
      TOP.set(ROOF.x, heightForZoom(riseZoom, cam.fov, size.height), ROOF.z);
      camera.position.lerpVectors(P, TOP, e);
      camera.quaternion.slerpQuaternions(Q0, DOWN, e);
      cam.far = 80 + e * 1200;
      cam.updateProjectionMatrix();
      const fog = scene.fog as THREE.Fog | null;
      if (fog) {
        fog.near = 14 + e * 600;
        fog.far = 34 + e * 1600;
      }
      if (v.rise < 1) invalidate();
      else if (!v.risen) {
        v.risen = true;
        requestAnimationFrame(() => onRisen?.());
      }
    }

    if (onAnchor) {
      P.copy(ROOF).project(camera);
      onAnchor(((P.x + 1) / 2) * size.width, ((1 - P.y) / 2) * size.height);
    }
    if (v.first) {
      v.first = false;
      requestAnimationFrame(onReady);
    }
  });

  return (
    <>
      {/* Four lights: the night sky, the moon, the room, and the room's light on the pavement. */}
      <hemisphereLight args={["#3d4f78", "#12141a", 1.1]} />
      <directionalLight position={[-5, 9, 7]} intensity={0.9} color="#9fb2d6" />
      <pointLight ref={inside} position={w(CENTRE, 2.6, 4.6).toArray()} distance={13} decay={1.4} color="#ffe6c7" />
      <pointLight ref={front} position={w(CENTRE, 2.5, 0.9).toArray()} distance={9} decay={1.6} color="#ffe9cf" />
      {store && <primitive object={store.group} />}
    </>
  );
}

export default function StoreNight(props: StoreNightProps) {
  const { tier, still, active, onLost, onRestored } = props;
  // Taking the canvas away loses its context on purpose; only a loss while it's on the page counts.
  const here = useRef(true);
  useEffect(() => {
    here.current = true;
    return () => {
      here.current = false;
    };
  }, []);
  return (
    <Canvas
      // Drawn all the time only while the store drifts and is on screen; otherwise one frame on demand, or none.
      frameloop={!active ? "never" : still ? "demand" : "always"}
      dpr={tier === 3 ? [1, 1.5] : 1}
      camera={{ fov: 34, near: 0.1, far: 80, position: [0, 1.75, 12] }}
      gl={{ antialias: tier === 3, powerPreference: "default", alpha: false, stencil: false, preserveDrawingBuffer: false }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        scene.environment = storeEnvironment(gl);
        scene.environmentIntensity = 0.4;
        scene.background = new THREE.Color("#07090d");
        scene.fog = new THREE.Fog("#07090d", 14, 34);
        const canvas = gl.domElement;
        canvas.addEventListener("webglcontextlost", (e) => {
          e.preventDefault(); // lets the browser give the context back
          if (here.current) onLost();
        });
        canvas.addEventListener("webglcontextrestored", () => here.current && onRestored());
      }}
      aria-hidden
      tabIndex={-1}
    >
      <Scene {...props} />
    </Canvas>
  );
}
