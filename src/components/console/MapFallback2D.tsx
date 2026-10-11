"use client";

import type { ConsoleSite } from "@/components/console/PlanningConsole";
import { geo, project } from "@/lib/geo";

/** SVG map for devices without WebGL: same projection, same anchors, no motion. */
export function MapFallback2D({ sites, selectedId, onSelect }: { sites: ConsoleSite[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const pts = geo.lakes.flatMap((l) => l.outer.flat().map(([lon, lat]) => project(lon, lat))).concat(sites.flatMap((s) => s.anchors.map((a) => [a.x, a.z] as [number, number])));
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  const pad = 1.5;
  const minX = Math.min(...xs) - pad;
  const minZ = Math.min(...zs) - pad;
  const w = Math.max(...xs) + pad - minX;
  const h = Math.max(...zs) + pad - minZ;
  const path = (ring: [number, number][]) => ring.map(([lon, lat], i) => { const [x, z] = project(lon, lat); return `${i ? "L" : "M"}${(x - minX).toFixed(3)},${(z - minZ).toFixed(3)}`; }).join("") + "Z";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" role="img" aria-label="Map of Bhopal lakes with ghat markers (2D fallback)">
      <rect width={w} height={h} fill="#1a1f23" />
      {geo.lakes.map((l) => (
        <path key={l.id} d={l.outer.map(path).join("") + l.holes.map(path).join("")} fill="#2c5f6c" stroke="#d4eef3" strokeWidth={0.04} fillRule="evenodd" />
      ))}
      {sites.map((s) =>
        s.anchors.map((a, i) => (
          <g key={`${s.id}-${i}`} transform={`translate(${a.x - minX},${a.z - minZ})`} className="cursor-pointer" onClick={() => onSelect(s.id)}>
            <circle r={selectedId === s.id ? 0.32 : 0.24} fill={a.basis === "name_match_only" ? "none" : s.hex} stroke={s.hex} strokeWidth={0.06} strokeDasharray={a.basis === "name_match_only" ? "0.1 0.08" : undefined} />
            <text y={-0.4} textAnchor="middle" fontSize={0.42} fill="#ece9e2" fontFamily="IBM Plex Sans">
              {s.rank ? `${s.rank} ` : ""}
              {s.short}
            </text>
          </g>
        )),
      )}
    </svg>
  );
}
