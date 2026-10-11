import Link from "next/link";
import type { Filters, Observation, SiteSummary } from "@/types/ghatwatch";
import { BenchmarkBadge } from "@/components/Badges";
import { displayValue, PHASE_LABEL } from "@/lib/provenance";
import { engine } from "@/lib/data";

/** Unscored exploration of one parameter across sites in scope. Never feeds the ranking. */
export function ParameterView({ parameter, rows, summaries, f, scopeQuery }: { parameter: string; rows: Observation[]; summaries: SiteSummary[]; f: Filters; scopeQuery: string }) {
  const crit = engine.describe(parameter);
  return (
    <section aria-labelledby="pv-h" className="glass rounded-2xl p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="pv-h" className="font-display text-lg">
          Parameter view: {parameter}
        </h2>
        <p className="text-xs text-fog-500">
          {crit ? `Class B screening ${crit}` : "No Class B limit in the supplied criteria — contextual reading only"} · units assumed · this view does not change the ranking
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-fog-300">No rows for {parameter} in this scope. That is missing evidence, not a clean result.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <caption className="sr-only">
              {parameter} readings by ghat, {f.year === "all" ? "2023–2025" : f.year}
            </caption>
            <thead className="text-fog-500">
              <tr>
                <th scope="col" className="py-2 pr-3 font-normal">
                  Ghat
                </th>
                <th scope="col" className="py-2 pr-3 font-normal">
                  Readings (year · festival · phase)
                </th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => {
                const r = rows.filter((o) => o.siteId === s.id);
                return (
                  <tr key={s.id} className="border-t keyline align-top">
                    <th scope="row" className="py-2 pr-3 font-normal text-fog-100">
                      <Link href={`/ghats/${s.id}${scopeQuery}`} className="hover:text-tide-200">
                        {s.canonicalName}
                      </Link>
                    </th>
                    <td className="py-2">
                      {r.length === 0 ? (
                        <span className="text-gap-300">no rows in scope</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {r.map((o) => (
                            <span key={o.id} title={`${o.id} · CSV line ${o.sourceCsvLine} · p.${o.sourcePageRaw}`} className="inline-flex items-center gap-1.5 rounded-md border keyline px-2 py-1">
                              <span className="text-fog-500">
                                {String(o.year).slice(2)} {o.festival[0]} {PHASE_LABEL[o.phase]!.split(" ")[0]}
                              </span>
                              <span className={`num ${o.measurementStatus === "numeric" ? "text-fog-100" : "text-gap-300"}`}>{displayValue(o)}</span>
                              {o.benchmarkStatus === "outside_screening_benchmark" && <BenchmarkBadge status={o.benchmarkStatus} />}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
