import type { BenchmarkStatus, HistoricalConcern, MeasurementStatus, Reason, SamplingPriority } from "@/types/ghatwatch";

export const CONCERN_UI: Record<HistoricalConcern, { label: string; short: string; cls: string; dot: string; hex: string }> = {
  elevated: {
    label: "Elevated historical concern",
    short: "Elevated",
    cls: "border-crit-400/50 text-crit-300",
    dot: "bg-crit-400",
    hex: "#e76f51",
  },
  moderate: {
    label: "Moderate historical concern",
    short: "Moderate",
    cls: "border-warn-400/50 text-warn-300",
    dot: "bg-warn-400",
    hex: "#e9c46a",
  },
  lower_observed: {
    label: "Lower observed historical concern",
    short: "Lower observed",
    cls: "border-sage-400/50 text-sage-400",
    dot: "bg-sage-400",
    hex: "#8fb8a8",
  },
  insufficient_evidence: {
    label: "Insufficient evidence to score",
    short: "Insufficient evidence",
    cls: "border-dashed border-gap-400/60 bg-transparent text-gap-300",
    dot: "bg-gap-400",
    hex: "#8c9aa3",
  },
};

export const PRIORITY_UI: Record<SamplingPriority, { label: string; cls: string }> = {
  urgent_retest: { label: "Urgent re-test", cls: "border-crit-400/60 text-crit-300" },
  priority_retest: { label: "Priority re-test", cls: "border-warn-400/50 text-warn-300" },
  routine_verify: { label: "Routine verification", cls: "border-fog-500/40 text-fog-300" },
};

export const BENCHMARK_UI: Record<BenchmarkStatus, { label: string; cls: string }> = {
  outside_screening_benchmark: { label: "Outside Class B screening", cls: "border-crit-400/40 bg-crit-400/10 text-crit-300" },
  within_screening_benchmark: { label: "Within Class B screening", cls: "border-tide-400/25 bg-tide-400/5 text-tide-300" },
  indeterminate: { label: "Not comparable", cls: "border-dashed border-gap-400/60 text-gap-300" },
  no_class_b_benchmark: { label: "No Class B limit", cls: "border-fog-500/25 text-fog-500" },
};

export const STATUS_UI: Record<MeasurementStatus, string> = {
  numeric: "Numeric",
  below_detection_limit: "BDL — below detection limit",
  not_detected: "ND — not detected",
  not_sampled: "Not sampled",
  not_in_source: "No table in source",
  unparsed: "Unparsed",
};

export const REASON_TONE: Record<Reason["tone"], string> = {
  critical: "text-crit-300 border-crit-400/30 bg-crit-400/[0.07]",
  warning: "text-warn-300 border-warn-400/25 bg-warn-400/[0.06]",
  gap: "text-gap-300 border-dashed border-gap-400/40",
  info: "text-fog-300 border-fog-500/25",
};

export const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
