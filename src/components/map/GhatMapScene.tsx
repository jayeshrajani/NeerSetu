"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { type Basis, geo, project } from "@/lib/geo";

export interface MapSite {
  id: string;
  short: string;
  rank: number | null;
  index: number | null;
  hex: string;
  urgent: boolean;
  anchors: { x: number; z: number; basis: Basis; label: string }[];
}

export type Stage = "india" | "flying" | "bhopal";

interface View {
  target: THREE.Vector3;
  dist: number;
  polar: number;
  azim: number;
}

const INDIA_VIEW: View = (() => {
  const [x, z] = project(73.2, 21.6);
  return { target: new THREE.Vector3(x, 0, z), dist: 4600, polar: 0.5, azim: 0 };
})();

const BHOPAL_VIEW: View = (() => {
  const [w, s, e, n] = geo.bhopalBounds;
  const [x, z] = project((w + e) / 2, (s + n) / 2);
  return { target: new THREE.Vector3(x - 1.5, 0, z + 2), dist: 46, polar: 0.72, azim: 0 };
})();

const SEVERE = "#E76F51";

function placeFromView(v: View, out: THREE.Vector3) {
  return out.set(
    v.target.x + v.dist * Math.sin(v.polar) * Math.sin(v.azim),
    v.target.y + v.dist * Math.cos(v.polar),
    v.target.z + v.dist * Math.sin(v.polar) * Math.cos(v.azim),
  );
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Drives the India → Bhopal flight, site focus, and hands over to MapControls when idle. */
function CameraRig({ stage, focus, onArrive, animate }: { stage: Stage; focus: THREE.Vector3 | null; onArrive: () => void; animate: boolean }) {
  const { camera, gl } = useThree();
  const controls = useRef<MapControls | null>(null);
  const flight = useRef<{ from: View; to: View; t0: number; dur: number; done?: () => void } | null>(null);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const c = new MapControls(camera, gl.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.minDistance = 2.5;
    c.maxDistance = 90;
    c.maxPolarAngle = 1.25;
    c.screenSpacePanning = false;
    c.enabled = false;
    controls.current = c;
    placeFromView(INDIA_VIEW, camera.position);
    c.target.copy(INDIA_VIEW.target);
    camera.lookAt(c.target);
    return () => c.dispose();
  }, [camera, gl]);

  const currentView = (): View => {
    const c = controls.current!;
    const off = tmp.copy(camera.position).sub(c.target);
    const dist = off.length();
    return { target: c.target.clone(), dist, polar: Math.acos(off.y / dist), azim: Math.atan2(off.x, off.z) };
  };

  useEffect(() => {
    if (!controls.current) return;
    if (stage === "flying") {
      flight.current = { from: currentView(), to: BHOPAL_VIEW, t0: performance.now(), dur: animate ? 3200 : 10, done: onArrive };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  useEffect(() => {
    if (!controls.current || stage !== "bhopal") return;
    const to: View = focus ? { target: focus.clone(), dist: 19, polar: 0.78, azim: currentView().azim } : BHOPAL_VIEW;
    flight.current = { from: currentView(), to, t0: performance.now(), dur: animate ? 1100 : 10 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, stage === "bhopal"]);

  useFrame(({ clock }) => {
    const c = controls.current;
    if (!c) return;
    const f = flight.current;
    if (f) {
      const raw = Math.min((performance.now() - f.t0) / f.dur, 1);
      const t = easeInOut(raw);
      const tt = 1 - Math.pow(1 - raw, 2.2);
      const v: View = {
        target: f.from.target.clone().lerp(f.to.target, tt),
        dist: f.from.dist * Math.pow(f.to.dist / f.from.dist, t),
        polar: f.from.polar + (f.to.polar - f.from.polar) * t,
        azim: f.from.azim + (f.to.azim - f.from.azim) * t,
      };
      c.target.copy(v.target);
      placeFromView(v, camera.position);
      camera.lookAt(c.target);
      c.enabled = false;
      if (raw >= 1) {
        flight.current = null;
        f.done?.();
      }
      return;
    }
    if (stage === "india") {
      const v = { ...INDIA_VIEW, azim: animate ? Math.sin(clock.getElapsedTime() * 0.08) * 0.12 : 0 };
      placeFromView(v, camera.position);
      camera.lookAt(INDIA_VIEW.target);
      return;
    }
    c.enabled = stage === "bhopal";
    c.update();
  });
  return null;
}

function makeLine(arr: Float32Array, color: string, opacity: number, dashed = false): THREE.Line {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  const m = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: 0.12, gapSize: 0.1, transparent: true, opacity })
    : new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  const l = new THREE.Line(g, m);
  if (dashed) l.computeLineDistances();
  return l;
}

function India() {
  const { shapes, lines } = useMemo(() => {
    const shapes: THREE.Shape[] = [];
    const lines: THREE.Line[] = [];
    for (const ring of geo.india) {
      const pts = ring.map(([lon, lat]) => project(lon, lat));
      shapes.push(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))));
      lines.push(makeLine(new Float32Array(pts.flatMap(([x, z]) => [x, 0.4, z])), "#d8d3c8", 0.85));
    }
    for (let k = -30; k <= 30; k += 2) {
      lines.push(makeLine(new Float32Array([k, 0.008, -30, k, 0.008, 30]), "#56616a", 0.35));
      lines.push(makeLine(new Float32Array([-30, 0.008, k, 30, 0.008, k]), "#56616a", 0.35));
    }
    for (let lon = 65; lon <= 100; lon += 5) {
      const p = [5, 38].map((lat) => project(lon, lat));
      lines.push(makeLine(new Float32Array(p.flatMap(([x, z]) => [x, -29, z])), "#5e5b55", 0.35));
    }
    for (let lat = 5; lat <= 38; lat += 5) {
      const p = Array.from({ length: 8 }, (_, i) => project(65 + i * 5, lat));
      lines.push(makeLine(new Float32Array(p.flatMap(([x, z]) => [x, -29, z])), "#5e5b55", 0.35));
    }
    return { shapes, lines };
  }, []);
  const depth = 30;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-depth}>
        <extrudeGeometry args={[shapes, { depth, bevelEnabled: false, curveSegments: 1 }]} />
        <meshBasicMaterial attach="material-0" color="#2f363b" />
        <meshBasicMaterial attach="material-1" color="#20262a" />
      </mesh>
      {lines.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
    </group>
  );
}

const waterVertex = /* glsl */ `
varying vec2 vXY;
#include <common>
#include <logdepthbuf_pars_vertex>
void main() {
  vXY = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}`;
const waterFragment = /* glsl */ `
uniform float uTime;
varying vec2 vXY;
#include <logdepthbuf_pars_fragment>
void main() {
  #include <logdepthbuf_fragment>
  float band = sin(vXY.x * 2.2 + vXY.y * 1.3 + uTime * 0.6) * 0.5 + 0.5;
  float fine = smoothstep(0.92, 1.0, sin((vXY.x - vXY.y) * 9.0 + uTime * 1.4) * 0.5 + 0.5);
  vec3 deep = vec3(0.16, 0.38, 0.46);
  vec3 lite = vec3(0.34, 0.60, 0.67);
  gl_FragColor = vec4(mix(deep, lite, band * 0.35) + fine * 0.05, 1.0);
}`;

function Lakes({ animate }: { animate: boolean }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  const data = useMemo(
    () =>
      geo.lakes.map((l) => {
        const toV = ([lon, lat]: [number, number]) => {
          const [x, z] = project(lon, lat);
          return new THREE.Vector2(x, -z);
        };
        const shapes = l.outer.map((o) => new THREE.Shape(o.map(toV)));
        shapes[0]!.holes = l.holes.map((h) => new THREE.Path(h.map(toV)));
        const outline = l.outer.map((o) =>
          makeLine(new Float32Array(o.flatMap(([lon, lat]) => { const [x, z] = project(lon, lat); return [x, 0.03, z]; })), "#d4eef3", 0.9),
        );
        return { id: l.id, shapes, outline };
      }),
    [],
  );
  useFrame((_, dt) => {
    if (mat.current && animate) mat.current.uniforms.uTime!.value += dt;
  });
  return (
    <group>
      {data.map((l) => (
        <group key={l.id}>
          <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
            <shapeGeometry args={[l.shapes, 1]} />
            <shaderMaterial ref={mat} vertexShader={waterVertex} fragmentShader={waterFragment} uniforms={uniforms} />
          </mesh>
          {l.outline.map((ln, i) => (
            <primitive key={i} object={ln} />
          ))}
        </group>
      ))}
    </group>
  );
}

function BhopalBeacon({ stage }: { stage: Stage }) {
  const ring = useRef<THREE.Mesh>(null);
  const dot = useRef<THREE.Mesh>(null);
  useFrame(({ clock, camera }) => {
    const d = camera.position.length();
    const vis = THREE.MathUtils.clamp((d - 500) / 900, 0, 1);
    const k = (clock.getElapsedTime() * 0.5) % 1;
    if (ring.current) {
      ring.current.scale.setScalar(20 + k * 90);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.8 * vis;
    }
    if (dot.current) (dot.current.material as THREE.MeshBasicMaterial).opacity = vis;
  });
  return (
    <group position={[0, 1, 0]} visible={stage !== "bhopal"}>
      <mesh ref={dot} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[14, 32]} />
        <meshBasicMaterial color="#F4A93B" transparent />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.9, 1, 64]} />
        <meshBasicMaterial color="#F4A93B" transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

import { markerHeight } from "@/components/map/markerHeight";

function Marker({
  site,
  anchor,
  selected,
  hovered,
  dimmed,
  onHover,
  onSelect,
  animate,
}: {
  site: MapSite;
  anchor: MapSite["anchors"][number];
  selected: boolean;
  hovered: boolean;
  dimmed: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  animate: boolean;
}) {
  const pulse = useRef<THREE.Mesh>(null);
  const h = markerHeight(site.index);
  const weak = anchor.basis === "name_match_only";
  const lakeOnly = anchor.basis === "water_body";
  const color = useMemo(() => new THREE.Color(site.hex), [site.hex]);
  useFrame(({ clock }) => {
    if (pulse.current && site.urgent && animate) {
      const k = (clock.getElapsedTime() * 0.7 + anchor.x) % 1;
      pulse.current.scale.setScalar(1 + k * 3);
      (pulse.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.7;
    }
  });
  const ev = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover(site.id);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      onHover(null);
      document.body.style.cursor = "";
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onSelect(site.id);
    },
  };
  const op = dimmed ? 0.25 : 1;
  const r = selected || hovered ? 0.11 : 0.085;
  return (
    <group position={[anchor.x, 0, anchor.z]}>
      <mesh position-y={h / 2} {...ev}>
        <cylinderGeometry args={[r, r, h, 24, 1, weak]} />
        {weak ? (
          <meshBasicMaterial color={color} wireframe transparent opacity={0.5 * op} />
        ) : (
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected || hovered ? 0.6 : 0.25} roughness={0.5} transparent opacity={op} />
        )}
      </mesh>
      <mesh position-y={h / 2} {...ev} visible={false}>
        <cylinderGeometry args={[0.35, 0.35, h + 0.4, 8]} />
      </mesh>
      {lakeOnly && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.05}>
          <ringGeometry args={[0.5, 0.53, 64]} />
          <meshBasicMaterial color="#ECE9E2" transparent opacity={0.35 * op} />
        </mesh>
      )}
      <mesh rotation-x={-Math.PI / 2} position-y={0.06}>
        <ringGeometry args={[0.13, 0.19, 32]} />
        <meshBasicMaterial color={selected ? "#ffffff" : color} transparent opacity={op} />
      </mesh>
      {site.urgent && (
        <mesh ref={pulse} rotation-x={-Math.PI / 2} position-y={0.04}>
          <ringGeometry args={[0.2, 0.23, 48]} />
          <meshBasicMaterial color={SEVERE} transparent depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function Link2({ a, b }: { a: { x: number; z: number }; b: { x: number; z: number } }) {
  const line = useMemo(() => makeLine(new Float32Array([a.x, 0.08, a.z, b.x, 0.08, b.z]), "#ECE9E2", 0.6, true), [a, b]);
  return <primitive object={line} />;
}

export interface LabelAnchor {
  key: string;
  pos: [number, number, number];
  minDist?: number;
}

function LabelProjector({ anchors, refs, stage }: { anchors: LabelAnchor[]; refs: React.RefObject<Map<string, HTMLElement>>; stage: Stage }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const camDist = camera.position.distanceTo(v.set(0, 0, 0));
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    for (const a of anchors) {
      const el = refs.current?.get(a.key);
      if (!el) continue;
      v.set(a.pos[0], a.pos[1], a.pos[2]).project(camera);
      const show = stage === "bhopal" && v.z < 1 && camDist < (a.minDist ?? 140) && el.dataset.hidden !== "1";
      el.style.opacity = show ? "1" : "0";
      if (!show) continue;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const x = (v.x * 0.5 + 0.5) * size.width - w / 2;
      let y = (-v.y * 0.5 + 0.5) * size.height - h;
      // greedy de-overlap: earlier (higher-ranked) labels keep their spot
      if (!a.key.startsWith("lake:")) {
        for (let guard = 0; guard < 6; guard++) {
          const hit = placed.find((p) => x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y);
          if (!hit) break;
          y = hit.y - h - 2;
        }
        placed.push({ x, y, w, h });
      }
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    }
  });
  return null;
}

export default function GhatMapScene({
  sites,
  stage,
  onArrive,
  selectedId,
  hoveredId,
  onHover,
  onSelect,
  labelRefs,
  labelAnchors,
  animate,
}: {
  sites: MapSite[];
  stage: Stage;
  onArrive: () => void;
  selectedId: string | null;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  labelRefs: React.RefObject<Map<string, HTMLElement>>;
  labelAnchors: LabelAnchor[];
  animate: boolean;
}) {
  const focus = useMemo(() => {
    const s = sites.find((x) => x.id === selectedId);
    if (!s) return null;
    const a = s.anchors[0]!;
    return new THREE.Vector3(a.x, 0, a.z);
  }, [sites, selectedId]);

  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, logarithmicDepthBuffer: true, alpha: false }}
      camera={{ fov: 32, near: 0.05, far: 40000 }}
      onPointerMissed={() => onSelect(null)}
      onCreated={({ gl }) => gl.setClearColor("#1a1f23")}
    >
      <fog attach="fog" args={["#1a1f23", 6000, 20000]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[-400, 900, 300]} intensity={1.1} />
      <India />
      <Lakes animate={animate} />
      <BhopalBeacon stage={stage} />
      {sites.map((s) => (
        <group key={s.id}>
          {s.anchors.map((a, i) => (
            <Marker
              key={i}
              site={s}
              anchor={a}
              selected={selectedId === s.id}
              hovered={hoveredId === s.id}
              dimmed={!!selectedId && selectedId !== s.id}
              onHover={onHover}
              onSelect={onSelect}
              animate={animate}
            />
          ))}
          {s.anchors.length === 2 && <Link2 a={s.anchors[0]!} b={s.anchors[1]!} />}
        </group>
      ))}
      <CameraRig stage={stage} focus={focus} onArrive={onArrive} animate={animate} />
      <LabelProjector anchors={labelAnchors} refs={labelRefs} stage={stage} />
    </Canvas>
  );
}
