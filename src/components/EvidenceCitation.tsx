import { ExternalLink, FileSearch } from "lucide-react";
import type { Observation } from "@/types/ghatwatch";
import { citationFor, displayValue, PHASE_LABEL } from "@/lib/provenance";
import { CopyButton } from "@/components/CopyButton";
import { BenchmarkBadge } from "@/components/Badges";
import { engine } from "@/lib/data";

/** Expandable citation: CSV line, printed fields, report + page, verification level, criterion. */
export function EvidenceCitation({ o, compact = false }: { o: Observation; compact?: boolean }) {
  const c = citationFor(o);
  const crit = engine.ruleFor(o.parameter);
  return (
    <details className="group rounded-lg border keyline bg-ink-900/60 open:bg-ink-850/80">
      <summary className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs">
        <FileSearch className="size-3.5 shrink-0 text-tide-400" aria-hidden />
        <span className="num text-fog-100">{o.parameter === "Dissolved oxygen" ? "DO" : o.parameter} {displayValue(o)}</span>
        <span className="text-fog-500">
          {o.year} {o.festival} · {PHASE_LABEL[o.phase]}
        </span>
        {!compact && <BenchmarkBadge status={o.benchmarkStatus} />}
        <span className="ml-auto text-fog-500 group-open:text-tide-300">{c.pageVerified ? `PDF p.${c.page}` : "page unverified"} ▾</span>
      </summary>
      <div className="grid gap-3 border-t keyline px-3 py-3 text-xs sm:grid-cols-2">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-fog-500">Evidence ID</dt>
          <dd className="num break-all text-fog-100">{o.id}</dd>
          <dt className="text-fog-500">CSV row</dt>
          <dd className="num">
            {o.sourceCsv} line {o.sourceCsvLine}
          </dd>
          <dt className="text-fog-500">Printed site</dt>
          <dd>{o.siteAsPrinted}</dd>
          <dt className="text-fog-500">Printed value</dt>
          <dd className="num">
            {o.parameterAsPrinted} = {o.valueAsPrinted === "" ? "(blank)" : `“${o.valueAsPrinted}”`}
            {o.flag ? <span className="text-fog-500"> · flag “{o.flag}”</span> : null}
          </dd>
          <dt className="text-fog-500">Unit</dt>
          <dd>{o.unitAssumed ? `${o.unitAssumed} (assumed — reports print none)` : "none (pH)"}</dd>
        </dl>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-fog-500">Report</dt>
          <dd>{c.reportTitle}</dd>
          <dt className="text-fog-500">Page</dt>
          <dd>
            {c.pageLabel}
            {c.pageVerified && <span className="text-tide-300"> · text-verified on cited page</span>}
            {c.manualCheck === "compared" && <span className="text-tide-300"> · value checked visually</span>}
          </dd>
          <dt className="text-fog-500">Criterion</dt>
          <dd>{crit ? `${crit.criterionId}: ${engine.describe(o.parameter)} (Class B screening comparison)` : "No Class B limit in supplied criteria"}</dd>
          <dt className="text-fog-500">Open</dt>
          <dd className="flex flex-wrap gap-3">
            <a className="inline-flex items-center gap-1 text-tide-300 underline-offset-2 hover:underline" href={c.localUrl} target="_blank" rel="noopener">
              Bundled PDF{c.pageVerified ? ` at p.${c.page}` : ""} <ExternalLink className="size-3" aria-hidden />
            </a>
            <a className="inline-flex items-center gap-1 text-fog-300 underline-offset-2 hover:underline" href={c.officialUrl} target="_blank" rel="noopener noreferrer">
              MPPCB original <ExternalLink className="size-3" aria-hidden />
            </a>
          </dd>
        </dl>
        <div className="sm:col-span-2">
          <CopyButton text={c.text} label="Copy citation" />
        </div>
      </div>
    </details>
  );
}
