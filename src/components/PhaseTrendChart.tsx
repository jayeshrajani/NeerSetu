"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface TrendPoint {
  window: string; // "2023 Ganesh"
  phase: "pre" | "during" | "after";
  value: number | null;
  status: string;
  printed: string;
  id: string | null;
}

const YEAR_COLOR: Record<string, string> = { "2023": "#6f6c66", "2024": "#a9a59c", "2025": "#f3f1ea" };
const PH = { pre: "pre", during: "during", after: "+1 wk" } as const;

export function PhaseTrendChart({
  title,
  unit,
  points,
  windows,
  limits,
  limitLabel,
}: {
  title: string;
  unit: string;
  points: TrendPoint[];
  windows: string[];
  limits: number[];
  limitLabel: string;
}) {
  // one x slot per window×phase; each window is its own series so lines never bridge windows
  const rows = windows.flatMap((w) =>
    (["pre", "during", "after"] as const).map((ph) => {
      const p = points.find((x) => x.window === w && x.phase === ph);
      const row: Record<string, string | number | null> = { x: `${w.slice(2, 4)}${w.split(" ")[1]![0]} ${PH[ph]}`, window: w, phase: ph, status: p?.status ?? "no table", printed: p?.printed ?? "" };
      for (const ww of windows) row[ww] = ww === w ? (p?.value ?? null) : null;
      return row;
    }),
  );
  const numeric = points.filter((p) => p.value !== null);
  const gaps = points.filter((p) => p.value === null);
  const max = Math.max(...numeric.map((p) => p.value as number), ...limits, 1);
  const min = Math.min(...numeric.map((p) => p.value as number), ...limits, 0);

  return (
    <figure className="glass rounded-2xl p-4">
      <figcaption className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-display text-base text-fog-100">{title}</span>
        <span className="text-[11px] text-fog-500">
          {limitLabel} · unit {unit || "none"}
          {unit ? " (assumed)" : ""}
        </span>
      </figcaption>
      <div className="h-56" role="img" aria-label={`${title}: ${numeric.length} numeric readings, ${gaps.length} gaps. Values are listed in the evidence table.`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 26, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgb(148 197 220 / 0.08)" vertical={false} />
            <XAxis dataKey="x" tick={{ fill: "#8299a5", fontSize: 10 }} interval={0} angle={-40} textAnchor="end" height={48} tickLine={false} axisLine={{ stroke: "rgb(148 197 220 / 0.15)" }} />
            <YAxis tick={{ fill: "#8299a5", fontSize: 10 }} domain={[Math.floor(min), Math.ceil(max * 1.1)]} tickLine={false} axisLine={false} />
            {limits.map((l) => (
              <ReferenceLine key={l} y={l} stroke="#e76f51" strokeDasharray="5 4" strokeOpacity={0.8} label={{ value: String(l), fill: "#f2a08b", fontSize: 10, position: "right" }} />
            ))}
            <Tooltip
              contentStyle={{ background: "#09111c", border: "1px solid rgb(148 197 220 / 0.2)", borderRadius: 10, fontSize: 12 }}
              labelStyle={{ color: "#e8f3f6" }}
              formatter={(v, name) => [v === null || v === undefined ? "—" : `${v} ${unit}`, String(name)]}
            />
            {windows.map((w) => (
              <Line
                key={w}
                type="linear"
                dataKey={w}
                name={w}
                stroke={YEAR_COLOR[w.slice(0, 4)] ?? "#b6c9d1"}
                strokeDasharray={w.endsWith("Durga") ? "6 3" : undefined}
                strokeWidth={2}
                dot={{ r: 3.5, strokeWidth: 0, fill: YEAR_COLOR[w.slice(0, 4)] ?? "#b6c9d1" }}
                activeDot={{ r: 5 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fog-500">
        {Object.entries(YEAR_COLOR).map(([y, c]) => (
          <span key={y} className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4" style={{ background: c }} /> {y}
          </span>
        ))}
        <span>solid = Ganesh · dashed = Durga · lines never join separate festivals</span>
      </div>
      {gaps.length > 0 && (
        <p className="mt-2 text-[11px] text-gap-300">
          Gaps (not plotted): {gaps.map((g) => `${g.window} ${g.phase} — ${g.status}${g.printed ? ` “${g.printed}”` : ""}`).join("; ")}
        </p>
      )}
    </figure>
  );
}
