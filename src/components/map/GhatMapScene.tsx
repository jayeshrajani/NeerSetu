"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import CameraControls from "camera-controls";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { interpolateZoom } from "d3-interpolate";
import { type Basis, geo, project } from "@/lib/geo";
import { markerHeight } from "@/components/map/markerHeight";

CameraControls.install({ THREE });

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

/** Screen pixels covered by floating UI; the camera's view offset keeps the subject centred in what is left. */
export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface LabelAnchor {
  key: string;
  pos: [number, number, number];
  stages?: Stage[];
  maxDist?: number;
  avoid?: boolean;
}

const BG = "#0b0f12";
const FOV = 32;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const INDIA_POLAR = 0.42;
const BHOPAL_POLAR = 0.74;
const FOCUS_POLAR = 0.86;
const FOCUS_DIST = 15;

interface Ext {
  cx: number;
  cz: number;
  w: number;
  d: number;
  h: number;
}
interface View {
  x: number;
  z: number;
  dist: number;
  polar: number;
  azim: number;
}

function extOf(pts: [number, number][], h: number): Ext {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of pts) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    z0 = Math.min(z0, z);
    z1 = Math.max(z1, z);
  }
  return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h };
}

const INDIA_EXT = extOf(geo.india.flat().map(([lon, lat]) => project(lon, lat)), 0);
const BHOPAL_EXT = (() => {
  const [w, s, e, n] = geo.bhopalBounds;
  return extOf([project(w, s), project(e, n)], 3);
})();
const BOUNDARY = new THREE.Box3(
  new THREE.Vector3(BHOPAL_EXT.cx - BHOPAL_EXT.w / 2 - 10, -1, BHOPAL_EXT.cz - BHOPAL_EXT.d / 2 - 10),
  new THREE.Vector3(BHOPAL_EXT.cx + BHOPAL_EXT.w / 2 + 10, 1, BHOPAL_EXT.cz + BHOPAL_EXT.d / 2 + 10),
);

/** Camera distance that fits `ext` into the part of the canvas not covered by `ins`. */
function fitDistance(ext: Ext, size: { width: number; height: number }, ins: Insets, polar: number, pad: number) {
  const uw = Math.max(160, size.width - ins.left - ins.right);
  const uh = Math.max(160, size.height - ins.top - ins.bottom);
  const depth = ext.d * Math.cos(polar) + ext.h * Math.sin(polar);
  return (size.height / (2 * TAN)) * Math.max(depth / uh, ext.w / uw) * pad;
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
// C2-continuous: zero velocity and acceleration at both ends, so the hand-off at arrival is seamless.
const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

interface Flight {
  path: ReturnType<typeof interpolateZoom>;
  polar0: number;
  azim0: number;
  to: View;
  t0: number;
  dur: number;
}

function CameraRig({
  stage,
  focus,
  insets,
  animate,
  recenter,
  onArrive,
  onProgress,
}: {
  stage: Stage;
  focus: { x: number; z: number } | null;
  insets: Insets;
  animate: boolean;
  recenter: number;
  onArrive: () => void;
  onProgress?: (p: number) => void;
}) {
  const { camera, gl, size } = useThree();
  const cam = camera as THREE.PerspectiveCamera;
  const ccRef = useRef<CameraControls | null>(null);
  const flight = useRef<Flight | null>(null);
  const ready = useRef(false);
  const lastStage = useRef<Stage>(stage);
  const offset = useRef({ x: 0, y: 0 });
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const live = useRef({ animate, onArrive, onProgress, insets });
  useEffect(() => {
    live.current = { animate, onArrive, onProgress, insets };
  });

  // Created in the effect (not useMemo) so a StrictMode unmount/remount gets fresh listeners.
  useEffect(() => {
    const A = CameraControls.ACTION;
    const cc = new CameraControls(cam, gl.domElement);
    cc.smoothTime = 0.45;
    cc.draggingSmoothTime = 0.1;
    cc.dollyToCursor = true;
    cc.dollySpeed = 0.6;
    cc.azimuthRotateSpeed = 0.5;
    cc.polarRotateSpeed = 0.5;
    cc.minPolarAngle = 0;
    cc.maxPolarAngle = 1.22;
    cc.mouseButtons.left = A.SCREEN_PAN;
    cc.mouseButtons.right = A.ROTATE;
    cc.mouseButtons.middle = A.DOLLY;
    cc.mouseButtons.wheel = A.DOLLY;
    cc.touches.one = A.TOUCH_SCREEN_PAN;
    cc.touches.two = A.TOUCH_DOLLY_ROTATE;
    cc.enabled = false;
    ccRef.current = cc;
    ready.current = false;
    return () => {
      cc.dispose();
      ccRef.current = null;
    };
  }, [cam, gl]);

  const indiaView: View = useMemo(
    () => ({
      x: INDIA_EXT.cx,
      z: INDIA_EXT.cz,
      dist: size.height > 0 ? THREE.MathUtils.clamp(fitDistance(INDIA_EXT, size, insets, INDIA_POLAR, 1.04), 1500, 12000) : 5200,
      polar: INDIA_POLAR,
      azim: 0,
    }),
    [size, insets],
  );
  const overview: View = useMemo(
    () => ({
      x: BHOPAL_EXT.cx,
      z: BHOPAL_EXT.cz,
      dist: size.height > 0 ? THREE.MathUtils.clamp(fitDistance(BHOPAL_EXT, size, insets, BHOPAL_POLAR, 1.12), 18, 90) : 46,
      polar: BHOPAL_POLAR,
      azim: 0,
    }),
    [size, insets],
  );
  const views = useRef({ indiaView, overview, focus });
  useEffect(() => {
    views.current = { indiaView, overview, focus };
  });

  const go = (cc: CameraControls, v: View, smooth: boolean) => {
    void cc.moveTo(v.x, 0, v.z, smooth);
    void cc.dollyTo(v.dist, smooth);
    void cc.rotateTo(v.azim, v.polar, smooth);
  };
  const setLocal = (cc: CameraControls, local: boolean) => {
    cc.minDistance = local ? 2.5 : 1;
    cc.maxDistance = local ? 95 : Infinity;
    cc.setBoundary(local ? BOUNDARY : undefined);
    cc.enabled = local;
  };
  const focusView = (cc: CameraControls, f: { x: number; z: number }): View => ({ x: f.x, z: f.z, dist: FOCUS_DIST, polar: FOCUS_POLAR, azim: cc.azimuthAngle });
  const startFlight = (cc: CameraControls) => {
    const ov = views.current.overview;
    setLocal(cc, false);
    const t = cc.getTarget(tmp);
    const path = (interpolateZoom as typeof interpolateZoom & { rho: (r: number) => typeof interpolateZoom }).rho(1.2)([t.x, t.z, cc.distance * 2 * TAN], [ov.x, ov.z, ov.dist * 2 * TAN]);
    flight.current = {
      path,
      polar0: cc.polarAngle,
      azim0: cc.azimuthAngle,
      to: ov,
      t0: performance.now(),
      dur: live.current.animate ? THREE.MathUtils.clamp(path.duration * 1.05, 2800, 4400) : 0,
    };
  };

  const focusKey = focus ? `${focus.x},${focus.z}` : "";
  const overviewKey = focus ? "" : `${overview.x},${overview.z},${overview.dist.toFixed(2)}`;
  const indiaKey = stage === "india" ? indiaView.dist.toFixed(0) : "";
  useEffect(() => {
    const prev = lastStage.current;
    lastStage.current = stage;
    const cc = ccRef.current;
    if (!cc || !ready.current) return;
    if (stage === "flying" && prev !== "flying") return startFlight(cc);
    if (stage === "india") return go(cc, views.current.indiaView, live.current.animate);
    if (stage !== "bhopal") return;
    const { overview: ov, focus: f } = views.current;
    // A skip (from the intro, or mid-flight) cuts; everything else glides.
    const cut = prev === "india" || flight.current !== null;
    flight.current = null;
    setLocal(cc, true);
    if (!f) cc.normalizeRotations();
    go(cc, f ? focusView(cc, f) : ov, live.current.animate && !cut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, focusKey, overviewKey, indiaKey, recenter]);

  useFrame((state, dt) => {
    const cc = ccRef.current;
    const { width, height } = state.size;
    if (!cc || height < 2) return;
    const { animate: anim, insets: ins } = live.current;
    const tx = (ins.right - ins.left) / 2;
    const ty = (ins.bottom - ins.top) / 2;

    if (!ready.current) {
      ready.current = true;
      const { indiaView: iv, overview: ov, focus: f } = views.current;
      if (stage === "bhopal") {
        setLocal(cc, true);
        go(cc, f ? focusView(cc, f) : ov, false);
      } else {
        setLocal(cc, false);
        go(cc, iv, false);
        if (stage === "flying") startFlight(cc);
      }
      offset.current = { x: tx, y: ty };
    }

    const fl = flight.current;
    if (fl) {
      const raw = fl.dur > 0 ? clamp01((performance.now() - fl.t0) / fl.dur) : 1;
      const e = smoother(raw);
      const [x, z, w] = fl.path(e);
      const tilt = smoother(clamp01((raw - 0.35) / 0.65));
      void cc.moveTo(x!, 0, z!, false);
      void cc.dollyTo(w! / (2 * TAN), false);
      void cc.rotateTo(fl.azim0 + (fl.to.azim - fl.azim0) * e, fl.polar0 + (fl.to.polar - fl.polar0) * tilt, false);
      live.current.onProgress?.(raw);
      if (raw >= 1) {
        flight.current = null;
        live.current.onArrive();
      }
    } else if (stage === "india" && anim) {
      void cc.rotateTo(Math.sin(state.clock.elapsedTime * 0.07) * 0.1, INDIA_POLAR, false);
    }

    const k = anim ? 1 - Math.exp(-dt * 3.5) : 1;
    offset.current.x += (tx - offset.current.x) * k;
    offset.current.y += (ty - offset.current.y) * k;

    cc.update(dt);

    const d = cc.distance;
    const cam = state.camera as THREE.PerspectiveCamera;
    cam.near = Math.max(0.01, d * 0.01);
    cam.far = d * 30 + 400;
    cam.setViewOffset(width, height, offset.current.x, offset.current.y, width, height);
    const fog = state.scene.fog as THREE.Fog | null;
    if (fog) {
      fog.near = d * 1.6;
      fog.far = d * 7 + 50;
    }
  });
  return null;
}

function fatLine(pts: number[], color: string, width: number, opacity = 1, dashed = false) {
  const g = new LineGeometry();
  g.setPositions(pts);
  const m = new LineMaterial({
    color,
    linewidth: width,
    transparent: true,
    opacity,
    depthWrite: false,
    dashed,
    dashSize: 0.16,
    gapSize: 0.12,
  });
  const l = new Line2(g, m);
  if (dashed) l.computeLineDistances();
  return l;
}

const linearOut = /* glsl */ `
  col = pow(col, vec3(2.2));
`;

function India() {
  const { shapes, lines, graticule } = useMemo(() => {
    const shapes: THREE.Shape[] = [];
    const lines: Line2[] = [];
    for (const ring of geo.india) {
      const pts = ring.map(([lon, lat]) => project(lon, lat));
      shapes.push(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z))));
      const flat = pts.flatMap(([x, z]) => [x, 0.4, z]);
      lines.push(fatLine(flat, "#f4a93b", 7, 0.07));
      lines.push(fatLine(flat, "#d9d3c6", 1.2, 0.85));
    }
    const seg: number[] = [];
    for (let lon = 65; lon <= 100; lon += 5) {
      for (let lat = 5; lat < 40; lat += 5) {
        const [a, b] = [project(lon, lat), project(lon, lat + 5)];
        seg.push(a[0], -29, a[1], b[0], -29, b[1]);
      }
    }
    for (let lat = 5; lat <= 40; lat += 5) {
      for (let lon = 65; lon < 100; lon += 5) {
        const [a, b] = [project(lon, lat), project(lon + 5, lat)];
        seg.push(a[0], -29, a[1], b[0], -29, b[1]);
      }
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
    const graticule = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: "#4d5960", transparent: true, opacity: 0.35, depthWrite: false }));
    return { shapes, lines, graticule };
  }, []);
  const depth = 30;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-depth}>
        <extrudeGeometry args={[shapes, { depth, bevelEnabled: false, curveSegments: 1 }]} />
        <meshBasicMaterial attach="material-0" color="#1f272d" />
        <meshBasicMaterial attach="material-1" color="#131a1e" />
      </mesh>
      <primitive object={graticule} />
      {lines.map((l, i) => (
        <primitive key={i} object={l} />
      ))}
    </group>
  );
}

const gridVertex = /* glsl */ `
varying vec2 vP;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vP = w.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const gridFragment = /* glsl */ `
uniform float uOpacity;
uniform vec2 uCenter;
varying vec2 vP;
float gridLine(vec2 p, float scale, float w) {
  vec2 q = p / scale;
  vec2 g = abs(fract(q - 0.5) - 0.5) / fwidth(q);
  return 1.0 - min(min(g.x, g.y) / w, 1.0);
}
void main() {
  float minor = gridLine(vP, 1.0, 1.0);
  float major = gridLine(vP, 5.0, 1.3);
  float fade = 1.0 - smoothstep(10.0, 46.0, length(vP - uCenter));
  float a = max(minor * 0.07, major * 0.2) * fade * uOpacity;
  vec3 col = vec3(0.66, 0.74, 0.78);
  ${linearOut}
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;

/** Kilometre grid around Bhopal; fades in only once the camera is close enough for it to read as scale. */
function LocalGrid() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uOpacity: { value: 0 }, uCenter: { value: new THREE.Vector2(BHOPAL_EXT.cx, BHOPAL_EXT.cz) } }), []);
  useFrame(({ camera }) => {
    if (mat.current) mat.current.uniforms.uOpacity!.value = 1 - THREE.MathUtils.smoothstep(camera.position.length(), 140, 420);
  });
  return (
    <mesh rotation-x={-Math.PI / 2} position={[BHOPAL_EXT.cx, 0.01, BHOPAL_EXT.cz]} renderOrder={-1}>
      <planeGeometry args={[110, 110]} />
      <shaderMaterial
        ref={mat}
        vertexShader={gridVertex}
        fragmentShader={gridFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-1}
        polygonOffsetUnits={-4}
      />
    </mesh>
  );
}

const waterVertex = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const waterFragment = /* glsl */ `
uniform float uTime;
varying vec2 vP;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
void main() {
  vec2 p = vP * 1.7;
  float n = noise(p + vec2(uTime * 0.12, uTime * 0.07)) * 0.6 + noise(p * 2.4 - vec2(uTime * 0.09, -uTime * 0.11)) * 0.4;
  float glint = smoothstep(0.74, 0.92, n);
  vec3 col = mix(vec3(0.10, 0.29, 0.35), vec3(0.24, 0.50, 0.57), n * 0.6) + glint * 0.07;
  ${linearOut}
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

function Lakes({ animate }: { animate: boolean }) {
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
          fatLine(
            o.flatMap(([lon, lat]) => {
              const [x, z] = project(lon, lat);
              return [x, 0.03, z];
            }),
            "#cdeef4",
            1.4,
            0.9,
          ),
        );
        return { id: l.id, shapes, outline };
      }),
    [],
  );
  const mat = useRef<THREE.ShaderMaterial>(null);
  useFrame((_, dt) => {
    if (animate && mat.current) mat.current.uniforms.uTime!.value += dt;
  });
  return (
    <group>
      {data.map((l) => (
        <group key={l.id}>
          <mesh rotation-x={-Math.PI / 2} position-y={0.02}>
            <shapeGeometry args={[l.shapes, 1]} />
            <shaderMaterial ref={mat} vertexShader={waterVertex} fragmentShader={waterFragment} uniforms={uniforms} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-8} />
          </mesh>
          {l.outline.map((ln, i) => (
            <primitive key={i} object={ln} />
          ))}
        </group>
      ))}
    </group>
  );
}

const MARIGOLD_GLOW = new THREE.Color("#f4a93b").multiplyScalar(2.2);

function BhopalBeacon({ stage }: { stage: Stage }) {
  const root = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const dot = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock, camera }) => {
    const vis = THREE.MathUtils.smoothstep(camera.position.length(), 450, 1400);
    if (root.current) root.current.visible = stage !== "bhopal" && vis > 0.01;
    const k = (clock.getElapsedTime() * 0.45) % 1;
    if (ring.current) {
      ring.current.scale.setScalar(18 + k * 110);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * (1 - k) * 0.9 * vis;
    }
    if (dot.current) dot.current.opacity = vis;
  });
  return (
    <group ref={root} position={[0, 1, 0]}>
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[13, 40]} />
        <meshBasicMaterial ref={dot} color={MARIGOLD_GLOW} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.9, 1, 72]} />
        <meshBasicMaterial color={MARIGOLD_GLOW} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

const SEVERE_GLOW = new THREE.Color("#e76f51").multiplyScalar(2);

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
  const g = useRef<THREE.Group>(null);
  const body = useRef<THREE.MeshStandardMaterial | THREE.MeshBasicMaterial>(null);
  const tip = useRef<THREE.MeshBasicMaterial>(null);
  const base = useRef<THREE.MeshBasicMaterial>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const h = markerHeight(site.index);
  const weak = anchor.basis === "name_match_only";
  const lakeOnly = anchor.basis === "water_body";
  const color = useMemo(() => new THREE.Color(site.hex), [site.hex]);
  const glow = useMemo(() => new THREE.Color(site.hex).multiplyScalar(2.3), [site.hex]);
  const on = selected || hovered;
  const r = 0.085;
  const tipH = Math.min(0.14, h * 0.2);

  useFrame(({ clock }, dt) => {
    const k = animate ? 1 - Math.exp(-dt * 12) : 1;
    const op = dimmed ? 0.22 : 1;
    if (g.current) {
      const s = g.current.scale.x + ((on ? 1.4 : 1) - g.current.scale.x) * k;
      g.current.scale.set(s, 1, s);
    }
    if (body.current) {
      body.current.opacity += ((weak ? 0.55 : 1) * op - body.current.opacity) * k;
      if ("emissiveIntensity" in body.current) body.current.emissiveIntensity += ((on ? 0.85 : 0.3) - body.current.emissiveIntensity) * k;
    }
    if (tip.current) tip.current.opacity += (op - tip.current.opacity) * k;
    if (base.current) base.current.opacity += (op - base.current.opacity) * k;
    if (pulse.current) {
      const m = pulse.current.material as THREE.MeshBasicMaterial;
      if (site.urgent && animate) {
        const p = (clock.getElapsedTime() * 0.6 + anchor.x * 0.13) % 1;
        pulse.current.scale.setScalar(1 + p * 3.2);
        m.opacity = (1 - p) * (1 - p) * 0.8 * op;
      } else {
        pulse.current.scale.setScalar(1.6);
        m.opacity = 0.35 * op;
      }
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

  return (
    <group position={[anchor.x, 0, anchor.z]}>
      <group ref={g}>
        <mesh position-y={(h - tipH) / 2} {...ev}>
          <cylinderGeometry args={[r, r, h - tipH, 24, 1, weak]} />
          {weak ? (
            <meshBasicMaterial ref={body} color={color} wireframe transparent opacity={0.55} />
          ) : (
            <meshStandardMaterial ref={body} color={color} emissive={color} emissiveIntensity={0.3} roughness={0.55} transparent opacity={1} />
          )}
        </mesh>
        {!weak && (
          <mesh position-y={h - tipH / 2}>
            <cylinderGeometry args={[r, r, tipH, 24]} />
            <meshBasicMaterial ref={tip} color={glow} transparent toneMapped={false} />
          </mesh>
        )}
        <mesh rotation-x={-Math.PI / 2} position-y={0.06}>
          <ringGeometry args={[0.13, 0.19, 40]} />
          <meshBasicMaterial ref={base} color={selected ? "#ffffff" : color} transparent depthWrite={false} />
        </mesh>
      </group>
      <mesh position-y={h / 2} {...ev} visible={false}>
        <cylinderGeometry args={[0.38, 0.38, h + 0.5, 8]} />
      </mesh>
      {lakeOnly && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.05}>
          <ringGeometry args={[0.5, 0.525, 72]} />
          <meshBasicMaterial color="#ECE9E2" transparent opacity={dimmed ? 0.1 : 0.35} depthWrite={false} />
        </mesh>
      )}
      {site.urgent && (
        <mesh ref={pulse} rotation-x={-Math.PI / 2} position-y={0.045}>
          <ringGeometry args={[0.2, 0.225, 56]} />
          <meshBasicMaterial color={SEVERE_GLOW} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

function Link2({ a, b }: { a: { x: number; z: number }; b: { x: number; z: number } }) {
  const line = useMemo(() => fatLine([a.x, 0.08, a.z, b.x, 0.08, b.z], "#ECE9E2", 1.5, 0.7, true), [a, b]);
  return <primitive object={line} />;
}

interface LabelState {
  el: HTMLElement;
  w: number;
  h: number;
  on: boolean;
  off: number;
  tf: string;
}

/** Projects DOM labels onto 3D anchors. Sizes are cached (no per-frame layout reads) and de-overlap shifts are eased, not snapped. */
function LabelProjector({ anchors, refs, stage }: { anchors: LabelAnchor[]; refs: React.RefObject<Map<string, HTMLElement>>; stage: Stage }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  const states = useRef(new Map<string, LabelState>());
  useFrame(({ camera, size }, dt) => {
    const k = 1 - Math.exp(-dt * 14);
    const camDist = camera.position.length();
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    for (const a of anchors) {
      const el = refs.current?.get(a.key);
      if (!el) continue;
      let s = states.current.get(a.key);
      if (!s || s.el !== el) {
        s = { el, w: 0, h: 0, on: false, off: 0, tf: "" };
        states.current.set(a.key, s);
      }
      v.set(a.pos[0], a.pos[1], a.pos[2]).project(camera);
      const show =
        (a.stages ?? ["bhopal"]).includes(stage) &&
        v.z < 1 &&
        Math.abs(v.x) < 1.15 &&
        Math.abs(v.y) < 1.15 &&
        camDist < (a.maxDist ?? 150) &&
        el.dataset.hidden !== "1";
      if (show !== s.on) {
        s.on = show;
        el.style.opacity = show ? "1" : "0";
        if (show) {
          s.w = el.offsetWidth;
          s.h = el.offsetHeight;
          s.off = 0;
        }
      }
      if (!show) continue;
      const x = (v.x * 0.5 + 0.5) * size.width - s.w / 2;
      const y0 = (-v.y * 0.5 + 0.5) * size.height - s.h;
      let y = y0;
      if (a.avoid !== false) {
        for (let guard = 0; guard < 6; guard++) {
          const hit = placed.find((p) => x < p.x + p.w && x + s.w > p.x && y < p.y + p.h && y + s.h > p.y);
          if (!hit) break;
          y = hit.y - s.h - 2;
        }
        placed.push({ x, y, w: s.w, h: s.h });
      }
      s.off += (y - y0 - s.off) * k;
      const tf = `translate3d(${x.toFixed(1)}px,${(y0 + s.off).toFixed(1)}px,0)`;
      if (tf !== s.tf) {
        s.tf = tf;
        el.style.transform = tf;
      }
    }
  });
  return null;
}

export default function GhatMapScene({
  sites,
  stage,
  onArrive,
  onProgress,
  selectedId,
  hoveredId,
  onHover,
  onSelect,
  labelRefs,
  labelAnchors,
  insets,
  animate,
  recenter = 0,
}: {
  sites: MapSite[];
  stage: Stage;
  onArrive: () => void;
  onProgress?: (p: number) => void;
  selectedId: string | null;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  labelRefs: React.RefObject<Map<string, HTMLElement>>;
  labelAnchors: LabelAnchor[];
  insets: Insets;
  animate: boolean;
  recenter?: number;
}) {
  const focus = useMemo(() => {
    const a = sites.find((x) => x.id === selectedId)?.anchors[0];
    return a ? { x: a.x, z: a.z } : null;
  }, [sites, selectedId]);

  return (
    <Canvas
      dpr={[1, 1.75]}
      flat
      gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
      camera={{ fov: FOV, near: 1, far: 60000, position: [0, 5000, 2000] }}
      onPointerMissed={() => onSelect(null)}
    >
      <color attach="background" args={[BG]} />
      <fog attach="fog" args={[BG, 8000, 40000]} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[-400, 900, 300]} intensity={1.2} />
      <India />
      <LocalGrid />
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
      <CameraRig stage={stage} focus={focus} insets={insets} animate={animate} recenter={recenter} onArrive={onArrive} onProgress={onProgress} />
      <LabelProjector anchors={labelAnchors} refs={labelRefs} stage={stage} />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur intensity={0.7} luminanceThreshold={0.95} luminanceSmoothing={0.12} radius={0.65} />
        <Vignette offset={0.3} darkness={0.6} />
      </EffectComposer>
    </Canvas>
  );
}
