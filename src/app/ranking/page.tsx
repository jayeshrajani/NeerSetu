import Link from "next/link";
import { Suspense } from "react";
import { engine, manifest, observations, sites } from "@/lib/data";
import { describeScope, filtersToQuery, parseFilters, scopeObservations, viewObservations } from "@/lib/filters";
import { rankSites, SCORING } from "@/lib/scoring";
import { FiltersBar } from "@/components/FiltersBar";
import { GhatPriorityTable } from "@/components/GhatPriorityTable";
import { BriefSelectionProvider } from "@/components/BriefSelection";
import { ParameterView } from "@/components/ParameterView";
import { RankingSummary } from "@/components/RankingSummary";
import { buildBriefFacts } from "@/lib/brief-facts";
import { rankingFallback } from "@/lib/ranking-summary";
import { providerFromEnv } from "@/lib/ai";

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
  const summaryIds = ranked.slice(0, 3).map((site) => site.id);
  const summaryFacts = scoped.length ? buildBriefFacts(summaryIds, f) : null;

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
      <header className="border-b keyline pb-6 pt-10">
        <h1 className="text-3xl font-semibold">Which ghats need attention?</h1>
        <p className="mt-3 max-w-[80ch] text-sm leading-relaxed text-fog-300">
          Past water tests show where to look more closely. Current water quality and site status are unverified.
        </p>
        <Link href="/" className="mt-3 inline-block text-sm text-tide-300">Back to the plan</Link>
      </header>

      {summaryFacts?.ok && <RankingSummary key={scopeQuery} siteIds={summaryIds} filters={f} fallback={rankingFallback(summaryFacts.facts)} aiAvailable={providerFromEnv().configured} />}

      {/* filters */}
      <section id="ranking" aria-labelledby="rank-h" className="scroll-mt-28">
        <details className="mt-5 border-b keyline pb-4" open={f.year !== "all" || f.festival !== "all" || f.phase !== "all" || f.parameter !== "all"} data-noprint>
          <summary className="text-sm text-tide-300">Filter by year, festival or test</summary>
          <div className="mt-3">
          <Suspense fallback={<div className="h-14" />}>
            <FiltersBar basePath="/ranking" />
          </Suspense>
          </div>
        </details>

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
              Ghats to review
            </h2>
            <p className="mt-1 max-w-[80ch] text-sm text-fog-500">
              {describeScope(f)}. Order reflects past concern; sampling priority also considers missing evidence.
            </p>
          </div>
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
              <GhatPriorityTable summaries={ranked} scopeQuery={scopeQuery} compact />
            </BriefSelectionProvider>
          </div>
        )}

        {f.parameter !== "all" && (
          <div className="mt-8">
            <ParameterView parameter={f.parameter} rows={viewObservations(observations, f)} summaries={ranked} f={f} scopeQuery={scopeQuery} />
          </div>
        )}
      </section>
      <details className="my-8 border-t keyline pt-4 text-sm text-fog-500">
        <summary>Data and ranking method</summary>
        <p className="mt-3 max-w-[80ch] leading-relaxed">
          {manifest.primaryRowCount.toLocaleString("en-IN")} MPPCB readings, {manifest.dataYearMin}–{manifest.dataYearMax}. DO below 5 mg/l in {cc.doBelow5}/{cc.doNumeric} numeric readings;
          BOD above 3 mg/l in {cc.bodAbove3}/{cc.bodNumeric}; {absentAll} festival tables missing. Units assumed.
          Scoring uses DO, BOD and pH only, with year weights {Object.entries(SCORING.yearWeights).map(([year, weight]) => `${year}×${weight}`).join(", ")}.
        </p>
        <Link href="/methodology" className="mt-2 inline-block text-tide-300">Full methodology and limitations</Link>
      </details>
    </div>
  );
}
