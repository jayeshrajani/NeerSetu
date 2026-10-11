"use client";

import { Fragment, useMemo, useState } from "react";
import { ArrowUpDown, ExternalLink } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";

export interface EvidenceRow {
  id: string;
  year: number;
  festival: string;
  phase: string;
  phaseLabel: string;
  parameter: string;
  parameterAsPrinted: string;
  valueAsPrinted: string;
  numericValue: number | null;
  display: string;
  status: string;
  statusLabel: string;
  benchmarkStatus: string;
  benchmarkLabel: string;
  benchmarkText: string | null;
  csvLine: number;
  siteAsPrinted: string;
  reportTitle: string;
  pageLabel: string;
  pageVerified: boolean;
  manualCheck: string | null;
  localUrl: string;
  officialUrl: string;
  citation: string;
}

const BENCH_CLS: Record<string, string> = {
  outside_screening_benchmark: "text-crit-300",
  within_screening_benchmark: "text-tide-300",
  indeterminate: "text-gap-300",
  no_class_b_benchmark: "text-fog-500",
};

type SortKey = "default" | "parameter" | "value";

export function EvidenceTable({ rows }: { rows: EvidenceRow[] }) {
  const [year, setYear] = useState("all");
  const [fest, setFest] = useState("all");
  const [param, setParam] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<SortKey>("default");
  const [open, setOpen] = useState<string | null>(null);

  const params = useMemo(() => [...new Set(rows.map((r) => r.parameter))], [rows]);
  const years = useMemo(() => [...new Set(rows.map((r) => r.year))].sort(), [rows]);
  const statuses = useMemo(() => [...new Set(rows.map((r) => r.statusLabel))], [rows]);

  const shown = useMemo(() => {
    const out = rows.filter(
      (r) =>
        (year === "all" || String(r.year) === year) &&
        (fest === "all" || r.festival === fest) &&
        (param === "all" || r.parameter === param) &&
        (status === "all" || r.statusLabel === status),
    );
    if (sort === "parameter") out.sort((a, b) => a.parameter.localeCompare(b.parameter) || a.year - b.year);
    if (sort === "value") out.sort((a, b) => (b.numericValue ?? -Infinity) - (a.numericValue ?? -Infinity));
    return out;
  }, [rows, year, fest, param, status, sort]);

  const sel = "rounded-md border keyline bg-ink-850 px-2 py-1.5 text-xs text-fog-100";
  return (
    <div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-[11px] text-fog-500">
          Year
          <select className={sel} value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="all">All</option>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[11px] text-fog-500">
          Festival
          <select className={sel} value={fest} onChange={(e) => setFest(e.target.value)}>
            <option value="all">All</option>
            <option>Ganesh</option>
            <option>Durga</option>
          </select>
        </label>
        <label className="grid gap-1 text-[11px] text-fog-500">
          Parameter
          <select className={sel} value={param} onChange={(e) => setParam(e.target.value)}>
            <option value="all">All 13</option>
            {params.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[11px] text-fog-500">
          Status
          <select className={sel} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[11px] text-fog-500">
          Sort
          <select className={sel} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="default">Source order</option>
            <option value="parameter">Parameter</option>
            <option value="value">Value (high → low)</option>
          </select>
        </label>
        <span className="ml-auto text-[11px] text-fog-500" role="status">
          {shown.length} of {rows.length} rows
        </span>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border keyline">
        <table className="w-full min-w-[760px] text-left text-xs">
          <caption className="sr-only">All source rows for this ghat with status, Class B screening result and source page</caption>
          <thead className="bg-ink-850 text-fog-500">
            <tr>
              <th scope="col" className="px-3 py-2 font-normal">
                Window
              </th>
              <th scope="col" className="px-3 py-2 font-normal">
                <span className="inline-flex items-center gap-1">
                  Parameter <ArrowUpDown className="size-3" aria-hidden />
                </span>
              </th>
              <th scope="col" className="px-3 py-2 font-normal">
                Printed → reading
              </th>
              <th scope="col" className="px-3 py-2 font-normal">
                Class B screening
              </th>
              <th scope="col" className="px-3 py-2 font-normal">
                Source
              </th>
              <th scope="col" className="px-3 py-2 font-normal">
                <span className="sr-only">Citation</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <Fragment key={r.id}>
                <tr className="border-t keyline align-top hover:bg-ink-850/60">
                  <td className="whitespace-nowrap px-3 py-2 text-fog-300">
                    {r.year} {r.festival}
                    <br />
                    <span className="text-fog-500">{r.phaseLabel}</span>
                  </td>
                  <td className="px-3 py-2">
                    {r.parameter}
                    {r.parameterAsPrinted !== r.parameter && <span className="block text-[10px] text-fog-500">printed “{r.parameterAsPrinted}”</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className="num text-fog-500">{r.valueAsPrinted === "" ? "(blank)" : `“${r.valueAsPrinted}”`}</span> →{" "}
                    <span className={`num ${r.status === "numeric" ? "text-fog-100" : "text-gap-300"}`}>{r.display}</span>
                  </td>
                  <td className={`px-3 py-2 ${BENCH_CLS[r.benchmarkStatus]}`}>
                    {r.benchmarkLabel}
                    {r.benchmarkText && <span className="block text-[10px] text-fog-500">{r.benchmarkText}</span>}
                  </td>
                  <td className="px-3 py-2 text-fog-300">
                    <a href={r.localUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 hover:text-tide-200">
                      {r.pageVerified ? r.pageLabel : "page ?"} <ExternalLink className="size-3" aria-hidden />
                    </a>
                    <span className="num block text-[10px] text-fog-500">CSV L{r.csvLine}</span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      aria-expanded={open === r.id}
                      aria-controls={`cite-${r.id}`}
                      onClick={() => setOpen(open === r.id ? null : r.id)}
                      className="rounded border keyline px-2 py-1 text-[11px] text-fog-300 hover:text-tide-200"
                    >
                      {open === r.id ? "Hide" : "Cite"}
                    </button>
                  </td>
                </tr>
                {open === r.id && (
                  <tr id={`cite-${r.id}`} className="bg-ink-900/70">
                    <td colSpan={6} className="px-3 py-3">
                      <dl className="grid gap-x-4 gap-y-1 text-[11px] sm:grid-cols-[auto_1fr]">
                        <dt className="text-fog-500">Evidence ID</dt>
                        <dd className="num">{r.id}</dd>
                        <dt className="text-fog-500">Printed site</dt>
                        <dd>{r.siteAsPrinted}</dd>
                        <dt className="text-fog-500">Report</dt>
                        <dd>{r.reportTitle}</dd>
                        <dt className="text-fog-500">Page</dt>
                        <dd>
                          {r.pageLabel}
                          {r.pageVerified ? " · text-verified on cited page" : ""}
                          {r.manualCheck === "compared" ? " · value checked visually" : ""}
                        </dd>
                        <dt className="text-fog-500">Links</dt>
                        <dd className="flex gap-3">
                          <a className="text-tide-300 hover:underline" href={r.localUrl} target="_blank" rel="noopener">
                            Bundled PDF
                          </a>
                          <a className="text-fog-300 hover:underline" href={r.officialUrl} target="_blank" rel="noopener noreferrer">
                            MPPCB original
                          </a>
                        </dd>
                      </dl>
                      <div className="mt-2">
                        <CopyButton text={r.citation} label="Copy citation" />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
