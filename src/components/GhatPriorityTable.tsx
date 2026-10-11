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

const SIMPLE_REASONS: Record<Reason["code"], string> = {
  do_zero: "Oxygen was recorded as zero.",
  do_severe: "Very low oxygen in past samples.",
  bod_severe: "High oxygen demand in past samples.",
  do_below: "Low oxygen in past samples.",
  bod_above: "Raised oxygen demand in past samples.",
  ph_outside: "Some pH readings were outside the screening range.",
  recurrence: "Concerns appeared in more than one sampling period.",
  absent_window: "Some festival records are missing.",
  phases_not_sampled: "Some sampling stages have no readings.",
  identity: "Confirm which location the report names refer to.",
  no_comparable: "Too little evidence to compare this ghat.",
};

export function GhatPriorityTable({ summaries, scopeQuery, compact = false }: { summaries: SiteSummary[]; scopeQuery: string; compact?: boolean }) {
  if (compact) return (
    <ol className="divide-y keyline border-y">
      {summaries.map((s) => (
        <li key={s.id} className="grid gap-4 py-5 [&>*]:min-w-0 sm:grid-cols-[2rem_minmax(0,1fr)] lg:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-6">
          <span className="num text-xl text-fog-500" aria-label={s.rank ? `Rank ${s.rank}` : "Not enough evidence to rank"}>{s.rank ?? "?"}</span>
          <div>
            <Link href={`/ghats/${s.id}${scopeQuery}`} className="inline-flex items-start gap-1 font-display text-lg font-medium text-fog-100 hover:text-tide-200">
              {s.canonicalName}<ArrowUpRight className="mt-1 size-4 shrink-0" aria-hidden />
            </Link>
            <p className="mt-1 text-xs text-fog-500">{s.waterBody}</p>
            <div className="mt-2"><ConcernBadge concern={s.historicalConcern} compact /></div>
            {s.needsIdentityVerification && <div className="mt-2"><IdentityFlag note={s.identityNote} /></div>}
          </div>
          <div className="sm:col-start-2 lg:col-start-auto">
            <p className="text-sm leading-relaxed text-fog-300">{s.topReasons[0] ? SIMPLE_REASONS[s.topReasons[0].code] : "Past readings need a closer look."}</p>
            <details className="mt-2">
              <summary className="text-xs text-tide-300">Reasons and source readings</summary>
              <div className="mt-3 grid gap-2">
                {s.topReasons.map((reason, index) => <ReasonItem key={`${reason.code}-${index}`} r={reason} />)}
                <CoverageIndicator c={s.coverage} />
              </div>
            </details>
          </div>
          <div className="sm:col-start-2 lg:col-start-auto">
            <PriorityBadge priority={s.samplingPriority} />
            <p className="mt-2 text-sm text-fog-300">{s.components ? "Take fresh samples and review the results." : "Collect missing readings before comparing."}</p>
            <div className="mt-3"><SelectToggle id={s.id} name={s.canonicalName} /></div>
          </div>
        </li>
      ))}
    </ol>
  );
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
