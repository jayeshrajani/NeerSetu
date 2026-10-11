import Link from "next/link";
import { Suspense } from "react";
import { engine, manifest, observations, sites } from "@/lib/data";
import { describeScope, filtersToQuery, parseFilters, scopeObservations, viewObservations } from "@/lib/filters";
import { rankSites, SCORING } from "@/lib/scoring";
import { FiltersBar } from "@/components/FiltersBar";
import { GhatPriorityTable } from "@/components/GhatPriorityTable";
import { BriefSelectionProvider } from "@/components/BriefSelection";
import { PhaseLegend } from "@/components/CoverageIndicator";
import { ParameterView } from "@/components/ParameterView";

type SP = Promise<Record<string, string | string[] | undefined>>;

export const metadata = { title: "Ranking" };

export default async function RankingPage({ searchParams }: { searchParams: SP }) {
  const parsed = parseFilters(await searchParams);
  const f = parsed.filters;
  const ranked = rankSites(observations, sites, engine, f);
  const scoped = scopeObservations(observations, f);
  const scopeQuery = filtersToQuery({ year: f.year, festival: f.festival, phase: f.phase });
  const cc = manifest.crossCheck;
  const absentAll = manifest.absentWindows.length;

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
      <header className="border-b keyline pb-6 pt-10">
        <p className="eyebrow">Full ranking · all sites · filterable</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Historical concern, every reason, every source row</h1>
        <p className="mt-3 max-w-[80ch] text-sm leading-relaxed text-fog-300">
          {manifest.primaryRowCount.toLocaleString("en-IN")} MPPCB readings, {manifest.dataYearMin}–{manifest.dataYearMax}. DO below 5 mg/l in{" "}
          <span className="num">{cc.doBelow5}/{cc.doNumeric}</span> numeric readings; BOD above 3 mg/l in <span className="num">{cc.bodAbove3}/{cc.bodNumeric}</span>;{" "}
          <span className="num">{absentAll}</span> festival tables missing from the reports. Units assumed (reports print none).{" "}
          <Link href="/" className="underline hover:text-fog-100">
            Back to the plan
          </Link>
        </p>
      </header>

      {/* filters */}
      <section id="ranking" aria-labelledby="rank-h" className="scroll-mt-28">
        <div className="glass sticky top-[52px] z-20 mt-6 rounded-none border-x-0 px-4 py-3 sm:px-5" data-noprint>
          <Suspense fallback={<div className="h-14" />}>
            <FiltersBar basePath="/ranking" />
          </Suspense>
        </div>

        {!parsed.ok && (
          <div role="alert" className="mt-4 rounded-xl border border-crit-400/40 bg-crit-400/10 px-4 py-3 text-sm text-crit-300">
            {parsed.errors.join(" ")} Showing the full 2023–2025 scope instead.{" "}
            <Link href="/ranking" className="underline">
              Reset filters
            </Link>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="rank-h" className="font-display text-2xl font-semibold tracking-tight">
              Historical concern ranking
            </h2>
            <p className="mt-1 max-w-[80ch] text-sm text-fog-500">
              Scope: <span className="text-fog-300">{describeScope(f)}</span> · <span className="num">{scoped.length}</span> source rows in scope · scored on DO, BOD and
              pH only, recency weights {Object.entries(SCORING.yearWeights).map(([y, w]) => `${y}×${w}`).join(", ")}. Historical concern and sampling priority are
              computed separately. Nothing here says a site is safe, approved or open in 2026.
            </p>
          </div>
          <PhaseLegend />
        </div>

        {scoped.length === 0 ? (
          <div className="glass mt-6 rounded-2xl p-8 text-center">
            <p className="font-display text-lg">No source rows match this scope.</p>
            <p className="mt-2 text-sm text-fog-500">That means the supplied reports have no table here — not that the water was fine.</p>
            <Link href="/ranking" className="mt-4 inline-flex rounded-lg border keyline px-3 py-2 text-sm text-tide-300">
              Reset filters
            </Link>
          </div>
        ) : (
          <div className="mt-6">
            <BriefSelectionProvider names={Object.fromEntries(ranked.map((s) => [s.id, s.canonicalName.split(" (")[0]!.split(" /")[0]!]))} scopeQuery={scopeQuery}>
              <GhatPriorityTable summaries={ranked} scopeQuery={scopeQuery} />
            </BriefSelectionProvider>
          </div>
        )}

        {f.parameter !== "all" && (
          <div className="mt-8">
            <ParameterView parameter={f.parameter} rows={viewObservations(observations, f)} summaries={ranked} f={f} scopeQuery={scopeQuery} />
          </div>
        )}
      </section>
    </div>
  );
}
