import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { engine, observations, sites } from "@/lib/data";
import { buildBriefFacts, MAX_BRIEF_SITES } from "@/lib/brief-facts";
import { renderBrief } from "@/lib/brief-templates";
import { describeScope, parseFilters } from "@/lib/filters";
import { rankSites } from "@/lib/scoring";
import { providerFromEnv } from "@/lib/ai";
import { BriefComposer } from "@/components/BriefComposer";
import { ConcernBadge, PriorityBadge } from "@/components/Badges";

export const metadata: Metadata = { title: "Officer brief" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function BriefPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const parsed = parseFilters(sp);
  const f = parsed.filters;
  const raw = Array.isArray(sp.sites) ? sp.sites.join(",") : (sp.sites ?? "");
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
  const facts = ids.length ? buildBriefFacts(ids, f) : null;
  const ranked = rankSites(observations, sites, engine, f);

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
      <div data-noprint className="pt-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-fog-500 hover:text-tide-200">
          <ArrowLeft className="size-4" aria-hidden /> Back to plan
        </Link>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight">Officer action brief</h1>
        <p className="mt-2 max-w-[75ch] text-sm text-fog-500">
          English and Hindi drafts built only from cited source rows. Proposed actions are for officer and technical review — not orders, approvals or
          safety determinations. Scope: <span className="text-fog-300">{describeScope(f)}</span>.
        </p>
        {!parsed.ok && (
          <p role="alert" className="mt-3 text-sm text-crit-300">
            {parsed.errors.join(" ")} Using full scope.
          </p>
        )}
      </div>

      <form data-noprint method="get" action="/brief" className="glass mt-6 rounded-2xl p-5">
        <fieldset>
          <legend className="font-display text-base">Select 1–{MAX_BRIEF_SITES} ghats</legend>
          {f.year !== "all" && <input type="hidden" name="year" value={f.year} />}
          {f.festival !== "all" && <input type="hidden" name="festival" value={f.festival} />}
          {f.phase !== "all" && <input type="hidden" name="phase" value={f.phase} />}
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {ranked.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-start gap-3 rounded-xl border keyline px-3 py-2.5 transition hover:border-tide-400/40 has-[:checked]:border-tide-400/60 has-[:checked]:bg-tide-400/10">
                <input type="checkbox" name="sites" value={s.id} defaultChecked={ids.includes(s.id)} className="mt-1 size-4 accent-[#f4a93b]" />
                <span className="min-w-0">
                  <span className="block text-sm text-fog-100">
                    {s.rank ? <span className="num mr-1 text-fog-500">#{s.rank}</span> : null}
                    {s.canonicalName}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    <ConcernBadge concern={s.historicalConcern} compact />
                    <PriorityBadge priority={s.samplingPriority} />
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="mt-4 rounded-lg bg-tide-400 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-tide-300">
          Generate brief
        </button>
      </form>

      <div className="mt-6">
        {facts === null ? (
          <p data-noprint className="text-sm text-fog-500">
            Choose ghats above, or pick them from the ranking with the “Brief” buttons.
          </p>
        ) : !facts.ok ? (
          <p role="alert" className="rounded-xl border border-crit-400/40 bg-crit-400/10 px-4 py-3 text-sm text-crit-300">
            {facts.error}
          </p>
        ) : (
          <BriefComposer
            key={`${ids.join(",")}|${describeScope(f)}`}
            siteIds={facts.facts.sites.map((s) => s.siteId)}
            filters={f}
            templateEn={renderBrief(facts.facts, "en")}
            templateHi={renderBrief(facts.facts, "hi")}
            aiAvailable={providerFromEnv().configured}
          />
        )}
      </div>
    </div>
  );
}
