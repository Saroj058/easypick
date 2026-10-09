"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// The wardrobe's clothes as real 3D garments (public/rack/3d/<slug>.glb + .webp, made from the
// hanging photographs and prepared by scripts/rack-3d.mjs). They hang side-on along the two rails
// drawn by hero-niche.tsx; the picked one turns on its hook to face out while the others slide
// along to make room.
//
// The camera has no perspective and one unit is one pixel, so the scene lines up with the rails
// behind it. Nothing is drawn unless something is moving.

/** Which model a piece uses, and a tint over its texture (the black tee is the pocket tee's shape, darkened). */
export const MODELS: Record<string, { model: string; tint?: string }> = {
  "oversized-heavy-tee": { model: "boxy-pocket-tee", tint: "#2b2b2b" },
  "boxy-pocket-tee": { model: "boxy-pocket-tee" },
  "everyday-hoodie": { model: "everyday-hoodie" },
  "brushed-crewneck": { model: "brushed-crewneck" },
  "coach-jacket": { model: "coach-jacket" },
  "fleece-quarter-zip": { model: "fleece-quarter-zip" },
  "relaxed-straight-jean": { model: "relaxed-straight-jean" },
  "tapered-jogger": { model: "tapered-jogger" },
  "wide-cargo-pant": { model: "wide-cargo-pant" },
};

export interface Hung {
  /** "upper:3" */
  key: string;
  slug: string;
  /** Trousers hang longer than tops. */
  long: boolean;
}

interface Loaded {
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture;
  /** Width over height, once the model is stood up with its top at the hook. */
  aspect: number;
}

const cache = new Map<string, Promise<Loaded>>();
function load(model: string): Promise<Loaded> {
  let p = cache.get(model);
  if (!p) {
    p = Promise.all([new GLTFLoader().loadAsync(`/rack/3d/${model}.glb`), new THREE.TextureLoader().loadAsync(`/rack/3d/${model}.webp`)]).then(([gltf, texture]) => {
      let geometry: THREE.BufferGeometry | null = null;
      gltf.scene.traverse((o) => {
        if (!geometry && (o as THREE.Mesh).isMesh) geometry = (o as THREE.Mesh).geometry;
      });
      if (!geometry) throw new Error(`No mesh in ${model}`);
      const g = geometry as THREE.BufferGeometry;
      g.computeBoundingBox();
      const box = g.boundingBox!;
      const size = box.getSize(new THREE.Vector3());
      // Hang it from the middle of its top edge, one unit tall.
      g.translate(-(box.min.x + box.max.x) / 2, -box.max.y, -(box.min.z + box.max.z) / 2);
      g.scale(1 / size.y, 1 / size.y, 1 / size.y);
      g.computeVertexNormals();
      texture.flipY = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      return { geometry: g, texture, aspect: size.x / size.y };
    });
    cache.set(model, p);
  }
  return p;
}

const SIDE_ON = (-74 * Math.PI) / 180;

function Rails({ rails, activeKey, loaded, onPick, onOpen }: { rails: Hung[][]; activeKey: string; loaded: Map<string, Loaded>; onPick: (key: string) => void; onOpen: (key: string) => void }) {
  const { size, invalidate, gl } = useThree();
  const groups = useRef(new Map<string, THREE.Group>());
  const turns = useRef(new Map<string, THREE.Group>());

  // The canvas covers the top 78% of the wardrobe's back wall; the rails sit where hero-niche.tsx draws them.
  const wall = size.height / 0.78;
  const under = size.width >= 520 ? 38 : 22; // from a shelf's top edge to just under its rail
  const railY = [-0.01, 0.385].map((t) => size.height / 2 - (t * wall + under));
  const room = 0.395 * wall - under - 14; // from the rail down to the next shelf
  const slot = size.width * 0.064;
  const open = size.width * 0.235;

  const layout = useMemo(() => {
    const at = new Map<string, { x: number; y: number; h: number; on: boolean }>();
    rails.forEach((rail, r) => {
      const active = rail.findIndex((p) => p.key === activeKey);
      const total = rail.length * slot + (active >= 0 ? open - slot : 0);
      let x = -total / 2;
      rail.forEach((p, i) => {
        const w = i === active ? open : slot;
        at.set(p.key, { x: x + w / 2, y: railY[r], h: room * (p.long ? 0.94 : 0.8), on: i === active });
        x += w;
      });
    });
    return at;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- railY is derived from size
  }, [rails, activeKey, slot, open, room, size.height, size.width]);

  useEffect(() => invalidate(), [layout, loaded, invalidate]);

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-dt * 7);
    let moving = false;
    for (const [key, to] of layout) {
      const g = groups.current.get(key);
      const t = turns.current.get(key);
      if (!g || !t) continue;
      const turn = to.on ? 0 : SIDE_ON;
      const lift = to.on ? 1.06 : 1;
      if (Math.abs(g.position.x - to.x) > 0.2 || Math.abs(t.rotation.y - turn) > 0.004 || Math.abs(t.scale.x - to.h * lift) > 0.2) moving = true;
      g.position.x += (to.x - g.position.x) * k;
      g.position.y = to.y;
      t.rotation.y += (turn - t.rotation.y) * k;
      const s = t.scale.x + (to.h * lift - t.scale.x) * k;
      t.scale.setScalar(s);
    }
    if (moving) invalidate();
  });

  return (
    <>
      <ambientLight intensity={2.3} />
      <directionalLight position={[300, 500, 900]} intensity={2.1} />
      {rails.flat().map((p) => {
        const spec = MODELS[p.slug];
        const m = spec && loaded.get(spec.model);
        const to = layout.get(p.key);
        if (!m || !to) return null;
        return (
          <group
            key={p.key}
            ref={(g) => {
              if (g) {
                // Starts in place, so nothing flies in on the first frame.
                if (!groups.current.has(p.key)) g.position.set(to.x, to.y, 0);
                groups.current.set(p.key, g);
              } else groups.current.delete(p.key);
            }}
          >
            {/* The hook over the rail */}
            <mesh position={[0, 5, 0]} rotation={[0, 0, -0.5]}>
              <torusGeometry args={[5, 0.9, 6, 20, Math.PI * 1.35]} />
              <meshBasicMaterial color="#8e8e8e" />
            </mesh>
            <group
              ref={(t) => {
                if (t) {
                  if (!turns.current.has(p.key)) {
                    t.rotation.y = to.on ? 0 : SIDE_ON;
                    t.scale.setScalar(to.h);
                  }
                  turns.current.set(p.key, t);
                } else turns.current.delete(p.key);
              }}
            >
              <mesh geometry={m.geometry}>
                <meshStandardMaterial map={m.texture} color={spec.tint ?? "#ffffff"} roughness={0.95} side={THREE.DoubleSide} />
              </mesh>
            </group>
            {/* What the pointer hits: the whole slot, not the sliver of a side-on garment */}
            <mesh
              position={[0, -to.h / 2, 60]}
              onPointerOver={(e) => {
                e.stopPropagation();
                gl.domElement.style.cursor = "pointer";
                onPick(p.key);
              }}
              onPointerOut={() => {
                gl.domElement.style.cursor = "";
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (p.key === activeKey) onOpen(p.key);
                else onPick(p.key);
              }}
            >
              <planeGeometry args={[to.on ? open * 0.9 : slot, to.h]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

export default function HeroNiche3D({ rails, activeKey, onPick, onOpen, onReady }: { rails: Hung[][]; activeKey: string; onPick: (key: string) => void; onOpen: (key: string) => void; /** Every model is in: the flat pictures can step aside. */ onReady: () => void }) {
  const [loaded, setLoaded] = useState<Map<string, Loaded> | null>(null);
  // As one string, so a new array of the same pieces doesn't start the loading again.
  const modelList = [...new Set(rails.flat().map((p) => MODELS[p.slug]?.model).filter(Boolean))].sort().join(",");

  useEffect(() => {
    let live = true;
    Promise.all(modelList.split(",").filter(Boolean).map((m) => load(m).then((l) => [m, l] as const)))
      .then((all) => {
        if (!live) return;
        setLoaded(new Map(all));
        onReady();
      })
      .catch(() => {
        // The flat pictures stay.
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onReady is the parent's setter
  }, [modelList]);

  if (!loaded) return null;
  return (
    <Canvas orthographic frameloop="demand" dpr={[1, 2]} gl={{ antialias: true, alpha: true }} camera={{ position: [0, 0, 1000], near: 1, far: 3000, zoom: 1 }} aria-hidden className="!absolute inset-0">
      <Rails rails={rails} activeKey={activeKey} loaded={loaded} onPick={onPick} onOpen={onOpen} />
    </Canvas>
  );
}
