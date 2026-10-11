"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";

const OPTIONS = {
  year: [
    ["all", "All years"],
    ["2023", "2023"],
    ["2024", "2024"],
    ["2025", "2025"],
  ],
  festival: [
    ["all", "Both festivals"],
    ["Ganesh", "Ganesh"],
    ["Durga", "Durga"],
  ],
  phase: [
    ["all", "All phases"],
    ["pre", "Pre-immersion"],
    ["during", "During"],
    ["after", "One week after"],
  ],
} as const;

const PARAMS = ["all", "pH", "Dissolved oxygen", "BOD", "COD", "Total solids", "Dissolved solids", "Suspended solids", "Turbidity", "Conductivity", "Chromium", "Lead", "Zinc", "Copper"];

export function FiltersBar({ basePath = "/" }: { basePath?: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  const update = (key: string, value: string) => {
    const q = new URLSearchParams(sp.toString());
    if (value === "all") q.delete(key);
    else q.set(key, value);
    const s = q.toString();
    start(() => router.push(`${basePath}${s ? `?${s}` : ""}`, { scroll: false }));
  };

  const val = (k: string) => sp.get(k) ?? "all";
  const active = ["year", "festival", "phase", "parameter"].some((k) => sp.get(k));

  return (
    <form method="get" action={basePath} className="flex flex-wrap items-end gap-3" aria-busy={pending} onSubmit={(e) => e.preventDefault()}>
      <span className="mb-2 hidden items-center gap-2 text-xs uppercase tracking-[0.18em] text-fog-500 md:inline-flex">
        <SlidersHorizontal className="size-3.5" aria-hidden /> Scope
      </span>
      {(Object.keys(OPTIONS) as (keyof typeof OPTIONS)[]).map((k) => (
        <label key={k} className="flex flex-col gap-1 text-[11px] text-fog-500">
          <span className="capitalize">{k}</span>
          <select
            name={k}
            value={val(k)}
            onChange={(e) => update(k, e.target.value)}
            className="min-w-[8.5rem] rounded-lg border keyline bg-ink-850 px-3 py-2 text-sm text-fog-100 hover:border-tide-400/40"
          >
            {OPTIONS[k].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label className="flex flex-col gap-1 text-[11px] text-fog-500">
        <span>Parameter view (not scored)</span>
        <select
          name="parameter"
          value={val("parameter")}
          onChange={(e) => update("parameter", e.target.value)}
          className="min-w-[11rem] rounded-lg border keyline bg-ink-850 px-3 py-2 text-sm text-fog-100 hover:border-tide-400/40"
        >
          {PARAMS.map((p) => (
            <option key={p} value={p}>
              {p === "all" ? "Ranking only" : p}
            </option>
          ))}
        </select>
      </label>
      <noscript>
        <button type="submit" className="rounded-lg border keyline px-3 py-2 text-sm">
          Apply
        </button>
      </noscript>
      {active && (
        <button
          type="button"
          onClick={() => start(() => router.push(basePath, { scroll: false }))}
          className="mb-0.5 inline-flex items-center gap-1.5 rounded-lg border keyline px-3 py-2 text-sm text-fog-300 hover:text-tide-200"
        >
          <RotateCcw className="size-3.5" aria-hidden /> Reset
        </button>
      )}
      {pending && <span className="mb-2 text-xs text-tide-300" role="status">Recomputing…</span>}
    </form>
  );
}
