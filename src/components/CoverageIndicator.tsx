import type { Coverage, PhaseCell } from "@/types/ghatwatch";

const CELL: Record<PhaseCell["state"], { cls: string; label: string }> = {
  full: { cls: "bg-tide-400/80", label: "DO, BOD and pH all numeric" },
  partial: { cls: "bg-tide-400/35", label: "Some of DO/BOD/pH numeric" },
  not_sampled: { cls: "border border-dashed border-gap-400/70 bg-transparent", label: "Row exists, not sampled" },
  not_in_source: { cls: "bg-[repeating-linear-gradient(45deg,rgb(255_107_91/0.55)_0_2px,transparent_2px_4px)]", label: "No table in supplied pack" },
  out_of_scope: { cls: "bg-ink-700/40", label: "Outside current filter" },
};

export function PhaseGrid({ cells, size = "sm" }: { cells: PhaseCell[]; size?: "sm" | "lg" }) {
  const windows: { key: string; label: string; cells: PhaseCell[] }[] = [];
  for (const c of cells) {
    const key = `${c.year}-${c.festival}`;
    let w = windows.find((x) => x.key === key);
    if (!w) {
      w = { key, label: `${String(c.year).slice(2)}${c.festival[0]}`, cells: [] };
      windows.push(w);
    }
    w.cells.push(c);
  }
  const box = size === "lg" ? "size-5 rounded" : "size-2 rounded-[2px]";
  return (
    <div className={`flex flex-wrap ${size === "lg" ? "gap-3" : "gap-1"}`} role="img" aria-label={`Phase coverage: ${cells.filter((c) => c.state === "full" || c.state === "partial").length} of ${cells.filter((c) => c.state !== "out_of_scope").length} in-scope phase slots have numeric DO/BOD/pH`}>
      {windows.map((w) => (
        <div key={w.key} className="flex flex-col items-center gap-1">
          <div className={`flex ${size === "lg" ? "gap-1" : "gap-px"}`}>
            {w.cells.map((c) => (
              <span key={c.phase} className={`${box} ${CELL[c.state].cls}`} title={`${c.year} ${c.festival} ${c.phase}: ${CELL[c.state].label}`} />
            ))}
          </div>
          {size === "lg" && <span className="num text-[10px] text-fog-500">{w.label}</span>}
        </div>
      ))}
    </div>
  );
}

export function PhaseLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fog-500">
      {(Object.keys(CELL) as PhaseCell["state"][]).map((k) => (
        <li key={k} className="inline-flex items-center gap-1.5">
          <span className={`size-2.5 rounded-[3px] ${CELL[k].cls}`} aria-hidden /> {CELL[k].label}
        </li>
      ))}
    </ul>
  );
}

export function CoverageIndicator({ c }: { c: Coverage }) {
  const bar = (num: number, den: number, tone: string) => (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${den ? (100 * num) / den : 0}%` }} />
    </div>
  );
  return (
    <div className="grid min-w-0 gap-1.5 text-[11px] text-fog-500">
      <div>
        <div className="flex justify-between">
          <span>Numeric DO/BOD/pH</span>
          <span className="num text-fog-300">
            {c.numericComparableSlots}/{c.recordedBenchmarkedSlots}
          </span>
        </div>
        {bar(c.numericComparableSlots, c.recordedBenchmarkedSlots, "bg-tide-400/80")}
      </div>
      <div>
        <div className="flex justify-between">
          <span>Festival tables</span>
          <span className={`num ${c.sourceAbsentWindows.length ? "text-crit-300" : "text-fog-300"}`}>
            {c.windowsAvailable}/{c.nominalWindows}
          </span>
        </div>
        {bar(c.windowsAvailable, c.nominalWindows, c.sourceAbsentWindows.length ? "bg-crit-400/70" : "bg-tide-400/50")}
      </div>
      <PhaseGrid cells={c.phaseCoverage} />
    </div>
  );
}
