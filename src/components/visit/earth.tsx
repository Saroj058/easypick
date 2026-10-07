"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { earthView, KATHMANDU } from "@/lib/visit/film";

// The Visit page's opening: the Earth from orbit, as it is at this moment. The day side is NASA's
// Blue Marble, the night side its city lights, and the line between them is where the sun really
// is right now (lib/kathmandu-sky.ts), so Nepal is in daylight when it's day in Kathmandu and lit
// by its towns when it's night. The camera's place is a pure function of the film's second
// (lib/visit/film.ts): it hangs to one side of the planet on the first screen, then falls towards
// Kathmandu until the clouds take over. Loaded only by visit-film.tsx, after the first paint.

/** A place on the unit globe, laid out the way the equirectangular textures wrap a three.js sphere. */
function place(lat: number, lng: number, radius = 1): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
}

const SURFACE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPositionW = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

// Day where the sun is up, city lights where it isn't, a soft band of dusk between, and a thin
// blue rim where the air thickens towards the edge.
const SURFACE_FRAGMENT = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform vec3 sunDir;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  void main() {
    vec3 n = normalize(vNormalW);
    float sun = dot(n, sunDir);
    float lit = smoothstep(-0.14, 0.2, sun);
    vec3 day = texture2D(dayMap, vUv).rgb;
    vec3 night = texture2D(nightMap, vUv).rgb;
    vec3 daylight = day * (0.22 + 1.05 * max(sun, 0.0));
    // the lights of towns, warm, on a ground that is only just visible
    vec3 dark = day * vec3(0.016, 0.022, 0.04) + pow(night, vec3(1.25)) * vec3(1.9, 1.5, 1.05);
    vec3 colour = mix(dark, daylight, lit);
    // the low sun reddens the band it's leaving
    float dusk = smoothstep(-0.14, 0.03, sun) * (1.0 - smoothstep(0.03, 0.3, sun));
    colour += day * vec3(0.55, 0.22, 0.08) * dusk * 0.55;
    vec3 view = normalize(cameraPosition - vPositionW);
    float rim = pow(1.0 - max(dot(n, view), 0.0), 3.2);
    colour += vec3(0.28, 0.52, 1.0) * rim * (0.12 + 0.88 * lit) * 0.75;
    gl_FragColor = vec4(colour, 1.0);
    #include <colorspace_fragment>
  }
`;

const CLOUD_FRAGMENT = /* glsl */ `
  uniform sampler2D cloudMap;
  uniform vec3 sunDir;
  uniform float fade;
  varying vec2 vUv;
  varying vec3 vNormalW;
  void main() {
    float cover = texture2D(cloudMap, vUv).r;
    float sun = dot(normalize(vNormalW), sunDir);
    float lit = smoothstep(-0.2, 0.25, sun);
    vec3 colour = mix(vec3(0.05, 0.07, 0.12), vec3(1.0), lit) + vec3(0.5, 0.2, 0.05) * smoothstep(-0.2, 0.0, sun) * (1.0 - smoothstep(0.0, 0.3, sun)) * 0.5;
    gl_FragColor = vec4(colour, smoothstep(0.25, 0.9, cover) * 0.9 * fade);
    #include <colorspace_fragment>
  }
`;

// The glow of the air seen edge-on, drawn on a slightly larger shell from the inside.
const AIR_VERTEX = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPositionW = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const AIR_FRAGMENT = /* glsl */ `
  uniform vec3 sunDir;
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  void main() {
    vec3 n = normalize(vNormalW);
    vec3 view = normalize(cameraPosition - vPositionW);
    float edge = pow(clamp(0.78 + dot(n, view), 0.0, 1.0), 4.5);
    float lit = smoothstep(-0.35, 0.35, dot(-n, sunDir));
    gl_FragColor = vec4(vec3(0.3, 0.56, 1.0) * edge * (0.18 + 0.82 * lit) * 1.5, edge);
  }
`;

export interface EarthProps {
  /** The film's second, read every frame (so scrolling never re-renders React). */
  time: () => number;
  /** Where on the Earth the sun is overhead now. */
  sun: { lat: number; lng: number };
  /** Draws while true; nothing is drawn once the map has taken over or the tab is hidden. */
  active: boolean;
  /** 3 = sharp screens and strong GPUs (4k day texture, antialiasing); 2 = phones. */
  tier: 2 | 3;
  /** No slow turning of the clouds or twinkle: one still frame per change. */
  still: boolean;
  /** 0 … 1 as the pictures arrive, then `onReady` once the first frame is on screen. */
  onProgress: (loaded: number) => void;
  onReady: () => void;
  onLost: () => void;
}

const K = place(KATHMANDU.lat, KATHMANDU.lng);
const TARGET = new THREE.Vector3();
const ORIGIN = new THREE.Vector3();

function Globe({ time, sun, tier, still, onProgress, onReady }: EarthProps) {
  const { invalidate, size } = useThree();
  const clouds = useRef<THREE.Mesh>(null);
  const pin = useRef<THREE.Sprite>(null);
  const ring = useRef<THREE.Sprite>(null);
  const cloudMat = useRef<THREE.ShaderMaterial>(null);
  /** How many of the three pictures have arrived. */
  const arrived = useRef(0);
  const state = useRef({ ready: false, spin: 0, pulse: 0 });

  // The three pictures: empty textures at first, filled in as each image arrives (counted, so the
  // page can show how far along it is).
  const maps = useMemo(() => {
    const make = (colour: boolean) => {
      const texture = new THREE.Texture();
      if (colour) texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = tier === 3 ? 8 : 2;
      return texture;
    };
    return { day: make(true), night: make(true), clouds: make(false) };
  }, [tier]);
  useEffect(() => {
    let cancelled = false;
    arrived.current = 0;
    const loader = new THREE.ImageLoader();
    const fill = (texture: THREE.Texture, url: string) =>
      loader.load(url, (image) => {
        if (cancelled) return;
        texture.image = image;
        texture.needsUpdate = true;
        arrived.current += 1;
        onProgress(arrived.current / 3);
      });
    fill(maps.day, `/visit/earth/day-${tier === 3 ? "4k" : "2k"}.webp`);
    fill(maps.night, "/visit/earth/night-2k.webp");
    fill(maps.clouds, "/visit/earth/clouds-2k.webp");
    return () => {
      cancelled = true;
      maps.day.dispose();
      maps.night.dispose();
      maps.clouds.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the callback only reports progress
  }, [maps, tier]);

  const sunDir = useMemo(() => place(sun.lat, sun.lng).normalize(), [sun.lat, sun.lng]);
  const surface = useMemo(() => ({ dayMap: { value: maps.day }, nightMap: { value: maps.night }, sunDir: { value: sunDir.clone() } }), [maps, sunDir]);
  const cloud = useMemo(() => ({ cloudMap: { value: maps.clouds }, sunDir: { value: sunDir.clone() }, fade: { value: 1 } }), [maps, sunDir]);
  const air = useMemo(() => ({ sunDir: { value: sunDir.clone() } }), [sunDir]);
  // A lime dot for Kathmandu and a ring that breathes out from it: the same mark the map carries on.
  const dot = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const g = canvas.getContext("2d")!;
    g.fillStyle = "#C6FF3D";
    g.beginPath();
    g.arc(32, 32, 20, 0, Math.PI * 2);
    g.fill();
    const hollow = document.createElement("canvas");
    hollow.width = hollow.height = 64;
    const h = hollow.getContext("2d")!;
    h.strokeStyle = "#C6FF3D";
    h.lineWidth = 3;
    h.beginPath();
    h.arc(32, 32, 28, 0, Math.PI * 2);
    h.stroke();
    return { dot: new THREE.CanvasTexture(canvas), ring: new THREE.CanvasTexture(hollow) };
  }, []);
  const stars = useMemo(() => {
    const points = new Float32Array(1400 * 3);
    for (let i = 0; i < 1400; i++) {
      // a fixed scatter (no Math.random: the sky is the same every visit)
      const u = ((i * 0.6180339887) % 1) * 2 - 1;
      const a = i * 2.399963229728653;
      const r = Math.sqrt(1 - u * u);
      points.set([Math.cos(a) * r * 60, u * 60, Math.sin(a) * r * 60], i * 3);
    }
    return points;
  }, []);

  useEffect(() => invalidate(), [invalidate, sunDir, size.width, size.height]);

  useFrame(({ camera }, delta) => {
    const s = state.current;
    const t = time();
    if (!still) {
      s.spin += delta * 0.006; // the weather drifts, very slowly
      s.pulse = (s.pulse + delta / 2.2) % 1;
    }
    const view = earthView(t);
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.copy(place(view.over.lat, view.over.lng, view.distance));
    // First it looks at the whole planet; as it falls, at Kathmandu.
    TARGET.copy(ORIGIN).lerp(K, Math.min(1, view.centred * 1.1));
    cam.lookAt(TARGET);
    // On the first screen the Earth sits to one side (above, on an upright phone), leaving room for the words.
    const aside = 1 - view.centred;
    const upright = size.width < size.height;
    cam.setViewOffset(size.width, size.height, upright ? 0 : -size.width * 0.17 * aside, upright ? size.height * 0.17 * aside : -size.height * 0.03 * aside, size.width, size.height);
    cam.near = Math.max(0.0005, (view.distance - 1) * 0.2);
    cam.updateProjectionMatrix();

    if (clouds.current) clouds.current.rotation.y = s.spin;
    // Near the ground the cloud deck thins out of the way (the white-out is drawn over the page instead).
    if (cloudMat.current) cloudMat.current.uniforms.fade.value = Math.min(1, Math.max(0, (view.distance - 1.03) / 0.12));
    const near = Math.min(1, Math.max(0, (2.6 - view.distance) / 1.2));
    if (pin.current) {
      pin.current.material.opacity = 0.35 + 0.65 * near;
      pin.current.scale.setScalar(0.012 + 0.008 * near);
    }
    if (ring.current) {
      ring.current.material.opacity = (1 - s.pulse) * 0.8;
      ring.current.scale.setScalar(0.014 + s.pulse * (0.05 + 0.03 * near));
    }
    if (!s.ready && arrived.current >= 3) {
      s.ready = true;
      requestAnimationFrame(onReady);
    }
  });

  return (
    <>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[stars, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#cfd8ff" size={tier === 3 ? 1.4 : 1.1} sizeAttenuation={false} transparent opacity={0.55} depthWrite={false} />
      </points>
      <mesh>
        <sphereGeometry args={[1, tier === 3 ? 128 : 96, tier === 3 ? 96 : 64]} />
        <shaderMaterial uniforms={surface} vertexShader={SURFACE_VERTEX} fragmentShader={SURFACE_FRAGMENT} />
      </mesh>
      <mesh ref={clouds}>
        <sphereGeometry args={[1.006, 96, 64]} />
        <shaderMaterial ref={cloudMat} uniforms={cloud} vertexShader={SURFACE_VERTEX} fragmentShader={CLOUD_FRAGMENT} transparent depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.07, 64, 48]} />
        <shaderMaterial uniforms={air} vertexShader={AIR_VERTEX} fragmentShader={AIR_FRAGMENT} side={THREE.BackSide} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <sprite ref={pin} position={K.clone().multiplyScalar(1.008)} renderOrder={5}>
        <spriteMaterial map={dot.dot} sizeAttenuation={false} transparent depthTest={false} toneMapped={false} />
      </sprite>
      <sprite ref={ring} position={K.clone().multiplyScalar(1.008)} renderOrder={5}>
        <spriteMaterial map={dot.ring} sizeAttenuation={false} transparent depthTest={false} toneMapped={false} />
      </sprite>
    </>
  );
}

export default function Earth(props: EarthProps) {
  const { active, tier, onLost } = props;
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
      frameloop={active ? "always" : "never"}
      dpr={tier === 3 ? [1, 1.75] : [1, 1.25]}
      camera={{ fov: 36, near: 0.01, far: 200, position: [0, 0, 3.3] }}
      gl={{ antialias: tier === 3, powerPreference: "high-performance", alpha: false, stencil: false }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.NoToneMapping;
        scene.background = new THREE.Color("#020308");
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          if (here.current) onLost();
        });
      }}
      aria-hidden
      tabIndex={-1}
    >
      <Globe {...props} />
    </Canvas>
  );
}
