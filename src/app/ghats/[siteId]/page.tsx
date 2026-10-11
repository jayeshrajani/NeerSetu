import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, FileText, Info } from "lucide-react";
import { engine, getSite, observations, sites } from "@/lib/data";
import { describeScope, filtersToQuery, parseFilters, scopeObservations } from "@/lib/filters";
import { rankSites, SCORING } from "@/lib/scoring";
import { citationFor, displayValue, PHASE_LABEL } from "@/lib/provenance";
import { BENCHMARK_UI, STATUS_UI, pct } from "@/lib/ui-labels";
import { ConcernBadge, IdentityFlag, PriorityBadge, UnverifiedStatus } from "@/components/Badges";
import { PhaseGrid, PhaseLegend } from "@/components/CoverageIndicator";
import { ReasonItem } from "@/components/GhatPriorityTable";
import { PhaseTrendChart, type TrendPoint } from "@/components/PhaseTrendChart";
import { EvidenceTable, type EvidenceRow } from "@/components/EvidenceTable";
import { BASIS_LABEL, geo } from "@/lib/geo";

type Props = { params: Promise<{ siteId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export function generateStaticParams() {
  return sites.map((s) => ({ siteId: s.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = getSite((await params).siteId);
  return { title: s ? s.canonicalName : "Ghat not found" };
}

const fmt = (n: number) => String(+n.toFixed(3));

export default async function GhatPage({ params, searchParams }: Props) {
  const { siteId } = await params;
  const site = getSite(siteId);
  if (!site) notFound();
  const parsed = parseFilters(await searchParams);
  const f = parsed.filters;
  const summary = rankSites(observations, sites, engine, f).find((s) => s.id === site.id)!;
  const scoped = scopeObservations(observations, f).filter((o) => o.siteId === site.id);
  const allSite = observations.filter((o) => o.siteId === site.id);
  const scopeQuery = filtersToQuery({ year: f.year, festival: f.festival, phase: f.phase });

  const FEST_ORDER: Record<string, number> = { Ganesh: 0, Durga: 1 };
  const windows = [...new Set(scoped.map((o) => `${o.year} ${o.festival}`))].sort(
    (a, b) => a.slice(0, 4).localeCompare(b.slice(0, 4)) || FEST_ORDER[a.slice(5)]! - FEST_ORDER[b.slice(5)]!,
  );
  const trend = (param: string): TrendPoint[] =>
    scoped
      .filter((o) => o.parameter === param)
      .map((o) => ({
        window: `${o.year} ${o.festival}`,
        phase: o.phase,
        value: o.measurementStatus === "numeric" ? o.numericValue : null,
        status: STATUS_UI[o.measurementStatus],
        printed: o.valueAsPrinted,
        id: o.id,
      }));

  const rows: EvidenceRow[] = scoped.map((o) => {
    const c = citationFor(o);
    return {
      id: o.id,
      year: o.year,
      festival: o.festival,
      phase: o.phase,
      phaseLabel: PHASE_LABEL[o.phase]!,
      parameter: o.parameter,
      parameterAsPrinted: o.parameterAsPrinted,
      valueAsPrinted: o.valueAsPrinted,
      numericValue: o.numericValue,
      display: displayValue(o),
      status: o.measurementStatus,
      statusLabel: STATUS_UI[o.measurementStatus],
      benchmarkStatus: o.benchmarkStatus,
      benchmarkLabel: BENCHMARK_UI[o.benchmarkStatus].label,
      benchmarkText: engine.describe(o.parameter),
      csvLine: o.sourceCsvLine,
      siteAsPrinted: o.siteAsPrinted,
      reportTitle: c.reportTitle,
      pageLabel: c.pageLabel,
      pageVerified: c.pageVerified,
      manualCheck: o.manualCheck,
      localUrl: c.localUrl,
      officialUrl: c.officialUrl,
      citation: c.text,
    };
  });

  const num = (p: string) => scoped.filter((o) => o.parameter === p && o.measurementStatus === "numeric");
  const out = (p: string) => num(p).filter((o) => o.benchmarkStatus === "outside_screening_benchmark");
  const preOut = scoped.filter((o) => o.phase === "pre" && o.benchmarkStatus === "outside_screening_benchmark").length;
  const allOut = scoped.filter((o) => o.benchmarkStatus === "outside_screening_benchmark").length;
  const metals = ["Chromium", "Lead", "Zinc", "Copper", "COD", "Turbidity", "Conductivity"];
  const comps = summary.components;

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
      <div className="pt-8">
        <Link href={`/ranking${scopeQuery}`} className="inline-flex items-center gap-1.5 text-sm text-fog-500 hover:text-tide-200">
          <ArrowLeft className="size-4" aria-hidden /> Back to ranking
        </Link>
      </div>

      <header className="mt-5 grid gap-6 [&>*]:min-w-0 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-fog-500">
            Ghat evidence · {describeScope(f)}
            {summary.rank ? ` · rank ${summary.rank} of ${sites.length}` : " · unranked"}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{site.canonicalName}</h1>
          <p className="font-hindi mt-1 text-lg text-fog-300">{site.nameHi}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ConcernBadge concern={summary.historicalConcern} index={summary.concernIndex} />
            <PriorityBadge priority={summary.samplingPriority} />
            {summary.needsIdentityVerification && <IdentityFlag note={site.identityNote} />}
            <UnverifiedStatus />
          </div>
          {!parsed.ok && (
            <p role="alert" className="mt-3 text-sm text-crit-300">
              {parsed.errors.join(" ")} Showing full scope.
            </p>
          )}
        </div>
        <dl className="glass grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl p-5 text-sm">
          <dt className="text-fog-500">Water body</dt>
          <dd>{site.waterBody}</dd>
          <dt className="text-fog-500">Identity</dt>
          <dd>
            <span className={site.identityConfidence === "high" ? "text-tide-300" : "text-warn-300"}>{site.identityConfidence} confidence</span>
            {site.identityNote && <p className="mt-1 text-xs text-fog-500">{site.identityNote}</p>}
          </dd>
          <dt className="text-fog-500">Printed as</dt>
          <dd className="text-xs text-fog-300">
            {(["Ganesh", "Durga"] as const).map((fe) => (
              <p key={fe}>
                <span className="text-fog-500">{fe}:</span> {site.printedAliasesByFestival[fe].join(" · ") || "—"}
              </p>
            ))}
          </dd>
          <dt className="text-fog-500">2026 status</dt>
          <dd className="text-xs text-fog-300">Unverified. Water readings cannot say whether immersion is authorised here in 2026; confirm with BMC.</dd>
          <dt className="text-fog-500">Location</dt>
          <dd className="text-xs text-fog-300">
            No coordinates in the MPPCB data. The plan map places it by OpenStreetMap name only:{" "}
            {(geo.sites.find((g) => g.siteId === site.id)?.anchors ?? []).map((a) => `${a.label} — ${BASIS_LABEL[a.basis].toLowerCase()}`).join("; ")}.
          </dd>
        </dl>
      </header>

      <section aria-labelledby="syn-h" className="mt-10 grid gap-6 [&>*]:min-w-0 lg:grid-cols-[1.4fr_1fr]">
        <div className="glass rounded-2xl p-5">
          <h2 id="syn-h" className="font-display text-xl">
            What the record shows
          </h2>
          <ul className="mt-3 grid gap-2 text-sm leading-relaxed text-fog-300">
            <li>
              Dissolved oxygen below the 5 mg/l screening level in <b className="num text-fog-100">{out("Dissolved oxygen").length}</b> of{" "}
              <span className="num">{num("Dissolved oxygen").length}</span> numeric readings
              {summary.worstDo && (
                <>
                  ; lowest <b className="num text-crit-300">{fmt(summary.worstDo.value)} mg/l</b>
                </>
              )}
              .
            </li>
            <li>
              BOD above the 3 mg/l screening level in <b className="num text-fog-100">{out("BOD").length}</b> of <span className="num">{num("BOD").length}</span>
              {summary.worstBod && (
                <>
                  ; highest <b className="num text-warn-300">{fmt(summary.worstBod.value)} mg/l</b>
                </>
              )}
              .
            </li>
            <li>
              pH outside 6.5–8.5 in <b className="num text-fog-100">{out("pH").length}</b> of <span className="num">{num("pH").length}</span>.
            </li>
            {allOut > 0 && (
              <li>
                <span className="num">{preOut}</span> of <span className="num">{allOut}</span> outside-benchmark readings were already present{" "}
                <em>before</em> immersion — phase differences alone do not establish the effect of immersion.
              </li>
            )}
            <li className="text-fog-500">
              Coverage: <span className="num">{summary.coverage.numericComparableSlots}</span>/<span className="num">{summary.coverage.recordedBenchmarkedSlots}</span> DO/BOD/pH
              slots numeric ({pct(summary.coverage.numericRatio)}); <span className="num">{summary.coverage.windowsAvailable}</span>/
              <span className="num">{summary.coverage.nominalWindows}</span> festival tables present in the pack.
            </li>
          </ul>
          <details className="mt-4 rounded-xl border keyline px-4 py-3">
            <summary className="text-sm text-tide-300">How the concern index was computed for this scope</summary>
            {comps ? (
              <div className="mt-3 grid gap-3 text-xs text-fog-300 [&>*]:min-w-0">
                <p className="num rounded-lg bg-ink-900 px-3 py-2">
                  100 × (0.45 × {comps.meanSeverityWeighted.toFixed(3)} + 0.35 × {comps.exceedanceFractionWeighted.toFixed(3)} + 0.20 ×{" "}
                  {comps.recurrenceFraction.toFixed(3)}) = {summary.concernIndex?.toFixed(1)}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left">
                    <thead className="text-fog-500">
                      <tr>
                        <th className="py-1 font-normal">Window</th>
                        <th className="py-1 font-normal">Numeric DO/BOD/pH</th>
                        <th className="py-1 font-normal">Outside</th>
                        <th className="py-1 font-normal">Mean severity</th>
                        <th className="py-1 font-normal">Year weight</th>
                      </tr>
                    </thead>
                    <tbody className="num">
                      {summary.windows.map((w) => (
                        <tr key={`${w.year}${w.festival}`} className="border-t keyline">
                          <td className="py-1">
                            {w.year} {w.festival}
                          </td>
                          <td>{w.numericComparable}</td>
                          <td>{w.outside}</td>
                          <td>{w.meanSeverity.toFixed(3)}</td>
                          <td>{w.yearWeight}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-fog-500">
                  Recurrence = {comps.windowsWithExceedance}/{comps.validWindows} sampled windows with ≥1 outside reading. Unsampled windows are not in any
                  denominator. Weights are a disclosed product heuristic (v{SCORING.version}), not CPCB/MPPCB policy.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-gap-300">
                Not scored: needs ≥{SCORING.minNumericComparable} numeric DO/BOD/pH readings across ≥{SCORING.minParameterTypes} parameters in scope. This is
                insufficient evidence, not a low score.
              </p>
            )}
          </details>
        </div>
        <div id="reasons" className="grid content-start gap-2">
          <h2 className="font-display text-xl">Reasons, with evidence</h2>
          <p className="text-xs text-fog-500">{summary.samplingPriorityWhy}</p>
          {summary.topReasons.map((r, i) => (
            <ReasonItem key={`${r.code}-${i}`} r={r} max={12} />
          ))}
        </div>
      </section>

      <section aria-labelledby="cov-h" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="cov-h" className="font-display text-xl">
            Phase coverage, 2023–2025
          </h2>
          <PhaseLegend />
        </div>
        <div className="glass mt-3 overflow-x-auto rounded-2xl p-5">
          <PhaseGrid cells={summary.coverage.phaseCoverage} size="lg" />
          <p className="mt-3 text-xs text-fog-500">
            Each block = pre / during / one-week-after for one festival-year. The six-window frame is an analytical reference, not an official
            sampling mandate.
            {site.absentWindows.length > 0 && (
              <span className="text-crit-300"> No table in the supplied pack for: {site.absentWindows.map((a) => `${a.year} ${a.festival}`).join(", ")}.</span>
            )}
          </p>
        </div>
      </section>

      <section aria-labelledby="tr-h" className="mt-10">
        <h2 id="tr-h" className="font-display text-xl">
          Screening parameters by phase
        </h2>
        <p className="mt-1 text-xs text-fog-500">Each festival-year is its own line. Missing phases are gaps, never interpolated or zero-filled. Red dashed line = Class B screening level.</p>
        {windows.length === 0 ? (
          <p className="glass mt-3 rounded-2xl p-6 text-sm text-gap-300">No source table for this ghat in the selected scope.</p>
        ) : (
          <div className="mt-3 grid gap-4 [&>*]:min-w-0 lg:grid-cols-3">
            <PhaseTrendChart title="Dissolved oxygen" unit="mg/l" points={trend("Dissolved oxygen")} windows={windows} limits={[5]} limitLabel="Class B ≥ 5" />
            <PhaseTrendChart title="BOD" unit="mg/l" points={trend("BOD")} windows={windows} limits={[3]} limitLabel="Class B ≤ 3" />
            <PhaseTrendChart title="pH" unit="" points={trend("pH")} windows={windows} limits={[6.5, 8.5]} limitLabel="Class B 6.5–8.5" />
          </div>
        )}
      </section>

      <section aria-labelledby="ev-h" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="ev-h" className="font-display text-xl">
              Every source row ({rows.length} in scope · {allSite.length} total)
            </h2>
            <p className="mt-1 flex items-start gap-1.5 text-xs text-fog-500">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {metals.join(", ")} and solids have no Class B limit in the supplied criteria: shown as contextual readings, never pass/fail. BDL = below detection limit (not
              zero, not missing). Units are assumed.
            </p>
          </div>
          <Link href={`/brief?sites=${site.id}${scopeQuery ? `&${scopeQuery.slice(1)}` : ""}`} className="inline-flex items-center gap-2 rounded-xl bg-tide-400 px-4 py-2.5 text-sm font-medium text-ink-950 hover:bg-tide-300">
            <FileText className="size-4" aria-hidden /> Brief for this ghat
          </Link>
        </div>
        <div className="mt-4">
          <EvidenceTable rows={rows} />
        </div>
      </section>
    </div>
  );
}
