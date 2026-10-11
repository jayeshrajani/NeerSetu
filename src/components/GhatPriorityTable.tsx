import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import type { Reason, SiteSummary } from "@/types/ghatwatch";
import { getObservation } from "@/lib/data";
import { REASON_TONE } from "@/lib/ui-labels";
import { ConcernBadge, IdentityFlag, PriorityBadge, UnverifiedStatus } from "@/components/Badges";
import { CoverageIndicator } from "@/components/CoverageIndicator";
import { EvidenceCitation } from "@/components/EvidenceCitation";
import { SelectToggle } from "@/components/BriefSelection";

export function ReasonItem({ r, max = 4 }: { r: Reason; max?: number }) {
  const ids = r.observationIds.slice(0, max);
  return (
    <details className={`group rounded-lg border px-2.5 py-1.5 text-xs ${REASON_TONE[r.tone]}`}>
      <summary className="flex items-start gap-1.5">
        <ChevronDown className="mt-0.5 size-3.5 shrink-0 transition group-open:rotate-180" aria-hidden />
        <span>{r.label}</span>
      </summary>
      <div className="mt-2 grid gap-1.5 text-fog-300">
        <p className="text-[11px] leading-relaxed text-fog-500">{r.why}</p>
        {r.coverageAssertion && (
          <p className="rounded border border-dashed border-gap-400/40 px-2 py-1 text-[11px] text-gap-300">
            Source-coverage assertion: {r.coverageAssertion.statement}
          </p>
        )}
        {ids.map((id) => {
          const o = getObservation(id);
          return o ? <EvidenceCitation key={id} o={o} compact /> : null;
        })}
        {r.observationIds.length > max && <p className="text-[11px] text-fog-500">+{r.observationIds.length - max} more on the ghat page</p>}
      </div>
    </details>
  );
}

export function GhatPriorityTable({ summaries, scopeQuery }: { summaries: SiteSummary[]; scopeQuery: string }) {
  return (
    <div className="grid gap-3">
      <div className="hidden grid-cols-[3.5rem_minmax(11rem,1.2fr)_minmax(9.5rem,0.85fr)_minmax(15rem,1.7fr)_minmax(11.5rem,0.9fr)_minmax(10rem,0.9fr)_6.5rem] gap-4 px-5 text-[11px] uppercase tracking-[0.14em] text-fog-500 xl:grid">
        <span>Rank</span>
        <span>Ghat</span>
        <span>Historical concern</span>
        <span>Why (evidence-linked)</span>
        <span>Evidence coverage</span>
        <span>Sampling priority</span>
        <span className="sr-only">Actions</span>
      </div>
      <ol className="grid gap-3">
        {summaries.map((s, i) => (
          <li
            key={s.id}
            style={{ animationDelay: `${i * 60}ms` }}
            className="glass grid grid-cols-1 gap-4 rounded-2xl p-4 sm:p-5 [&>*]:min-w-0 xl:grid-cols-[3.5rem_minmax(11rem,1.2fr)_minmax(9.5rem,0.85fr)_minmax(15rem,1.7fr)_minmax(11.5rem,0.9fr)_minmax(10rem,0.9fr)_6.5rem] xl:items-start"
          >
            <div className="flex items-center gap-3 xl:block">
              <span className={`num block font-display text-3xl font-semibold ${s.rank ? "text-fog-100" : "text-gap-400"}`} aria-label={s.rank ? `Rank ${s.rank}` : "Unranked: insufficient evidence"}>
                {s.rank ? String(s.rank).padStart(2, "0") : "—"}
              </span>
            </div>
            <div className="min-w-0">
              <Link href={`/ghats/${s.id}${scopeQuery}`} className="group inline-flex items-start gap-1 font-display text-lg font-medium leading-tight text-fog-100 hover:text-tide-200">
                {s.canonicalName}
                <ArrowUpRight className="mt-0.5 size-4 shrink-0 opacity-50 transition group-hover:opacity-100" aria-hidden />
              </Link>
              <p className="mt-0.5 text-xs text-fog-500">
                {s.waterBody} · <span className="font-hindi">{s.nameHi}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {s.needsIdentityVerification && <IdentityFlag note={s.identityNote} />}
                <UnverifiedStatus />
              </div>
            </div>
            <div className="grid gap-2">
              <span className="text-[11px] uppercase tracking-[0.14em] text-fog-500 xl:hidden">Historical concern</span>
              <ConcernBadge concern={s.historicalConcern} index={s.concernIndex} compact />
              {s.components ? (
                <p className="text-[11px] leading-relaxed text-fog-500">
                  <span className="num text-fog-300">{s.components.numericComparable}</span> numeric DO/BOD/pH readings over{" "}
                  <span className="num text-fog-300">{s.components.validWindows}</span> festival windows · not a safety rating
                </p>
              ) : (
                <p className="text-[11px] text-gap-300">Fewer than 3 numeric readings across 2 parameters in this scope — not scored, not &quot;clean&quot;.</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <span className="text-[11px] uppercase tracking-[0.14em] text-fog-500 xl:hidden">Why</span>
              {s.topReasons.slice(0, 3).map((r, k) => (
                <ReasonItem key={`${r.code}-${k}`} r={r} />
              ))}
              {s.topReasons.length > 3 && (
                <Link href={`/ghats/${s.id}${scopeQuery}#reasons`} className="text-[11px] text-fog-500 hover:text-tide-300">
                  +{s.topReasons.length - 3} more reasons
                </Link>
              )}
            </div>
            <div>
              <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-fog-500 xl:hidden">Evidence coverage</span>
              <CoverageIndicator c={s.coverage} />
            </div>
            <div className="grid gap-1.5">
              <span className="text-[11px] uppercase tracking-[0.14em] text-fog-500 xl:hidden">Sampling priority</span>
              <PriorityBadge priority={s.samplingPriority} />
              <p className="text-[11px] leading-relaxed text-fog-500">{s.samplingPriorityWhy}</p>
            </div>
            <div className="flex gap-2 xl:flex-col">
              <SelectToggle id={s.id} name={s.canonicalName} />
              <Link href={`/ghats/${s.id}${scopeQuery}`} className="inline-flex items-center justify-center rounded-lg border keyline px-2.5 py-1.5 text-xs text-fog-300 hover:border-tide-400/40 hover:text-tide-200">
                Evidence
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
