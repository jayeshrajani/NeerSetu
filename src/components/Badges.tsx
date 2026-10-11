import { AlertTriangle, CircleDashed, HelpCircle, MapPinOff } from "lucide-react";
import type { BenchmarkStatus, HistoricalConcern, SamplingPriority } from "@/types/ghatwatch";
import { BENCHMARK_UI, CONCERN_UI, PRIORITY_UI } from "@/lib/ui-labels";

export function ConcernBadge({ concern, index, compact = false }: { concern: HistoricalConcern; index?: number | null; compact?: boolean }) {
  const ui = CONCERN_UI[concern];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-2.5 py-1 text-xs font-medium ${ui.cls}`}>
      {concern === "insufficient_evidence" ? <CircleDashed className="size-3.5" aria-hidden /> : <span className={`size-1.5 rounded-full ${ui.dot}`} aria-hidden />}
      {compact ? ui.short : ui.label}
      {index !== undefined && index !== null && <span className="num opacity-80">· {index.toFixed(1)}</span>}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: SamplingPriority }) {
  const ui = PRIORITY_UI[priority];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium ${ui.cls}`}>
      {priority === "urgent_retest" && <AlertTriangle className="size-3.5" aria-hidden />}
      {ui.label}
    </span>
  );
}

export function BenchmarkBadge({ status }: { status: BenchmarkStatus }) {
  const ui = BENCHMARK_UI[status];
  return <span className={`inline-flex whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] ${ui.cls}`}>{ui.label}</span>;
}

export function IdentityFlag({ note }: { note?: string | null }) {
  return (
    <span title={note ?? undefined} className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-dashed border-warn-400/50 px-2 py-0.5 text-[11px] text-warn-300">
      <MapPinOff className="size-3.5" aria-hidden /> Identity: medium — confirm site
    </span>
  );
}

export function UnverifiedStatus() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border keyline px-2 py-0.5 text-[11px] text-fog-500">
      <HelpCircle className="size-3.5" aria-hidden /> 2026 authorisation unverified
    </span>
  );
}
