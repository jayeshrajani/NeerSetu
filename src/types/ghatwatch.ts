export type Festival = "Ganesh" | "Durga";
export type Phase = "pre" | "during" | "after";
export type MeasurementStatus =
  | "numeric"
  | "below_detection_limit"
  | "not_detected"
  | "not_sampled"
  | "not_in_source"
  | "unparsed";
export type BenchmarkStatus =
  | "within_screening_benchmark"
  | "outside_screening_benchmark"
  | "indeterminate"
  | "no_class_b_benchmark";
export type IdentityConfidence = "high" | "medium" | "low" | "unknown";
export type PageVerification = "exact" | "loose" | "unverified";

/** Row as emitted by scripts/build_dataset.py (src/generated/observations.json). */
export interface RawObservation {
  id: string;
  sourceCsv: string;
  sourceCsvLine: number;
  siteId: string;
  siteCanonical: string;
  siteAsPrinted: string;
  siteMatchConfidence: IdentityConfidence;
  waterBody: string;
  year: number;
  festival: Festival;
  phase: Phase;
  parameter: string;
  parameterAsPrinted: string;
  numericValue: number | null;
  valueAsPrinted: string;
  flag: string;
  measurementStatus: MeasurementStatus;
  unitAssumed: string | null;
  sourcePageRaw: number | null;
  sourcePdfViewerPage: number | null;
  pageVerification: PageVerification;
  manualCheck: "compared" | "table_viewed" | null;
}

export interface Observation extends RawObservation {
  unitsAreInferred: true;
  sourcePdfFilename: string;
  sourceReportUrl: string;
  benchmarkId: string | null;
  benchmarkStatus: BenchmarkStatus;
}

export interface Criterion {
  id: string;
  csvLine: number;
  class: string;
  designatedBestUse: string;
  parameter: string;
  limitType: "min" | "max" | "range";
  limit: string;
  unit: string | null;
}

export interface ParsedRule {
  criterionId: string;
  parameter: string;
  limitType: "min" | "max" | "range";
  min: number | null;
  max: number | null;
  unit: string | null;
}

export interface StandardsFile {
  source: string;
  sourceCsv: string;
  screeningClass: string;
  classBParameterMap: Record<string, string>;
  unmeasuredClassBParameters: string[];
  criteria: Criterion[];
}

export interface SiteRecord {
  id: string;
  canonicalName: string;
  nameHi: string;
  waterBody: string;
  printedAliases: string[];
  printedAliasesByFestival: Record<Festival, string[]>;
  identityConfidence: IdentityConfidence;
  identityNote: string | null;
  rowCount: number;
  absentWindows: { year: number; festival: Festival }[];
}

export interface ReportInfo {
  file: string;
  title: string;
  titleHi: string;
  url: string;
  sha256: string;
}

export interface DataManifest {
  sourcePackName: string;
  sourceRepo: string;
  sourceCommit: string;
  sourcePath: string;
  dataYearMin: number;
  dataYearMax: number;
  primaryRowCount: number;
  uniqueSiteCount: number;
  sampleRowCount: number;
  criteriaRowCount: number;
  statewideRowCount: number | null;
  inputSha256: Record<string, string | null>;
  generatedAt: string;
  methodologyVersion: string;
  measurementStatusCounts: Partial<Record<MeasurementStatus, number>>;
  crossCheck: {
    doNumeric: number;
    doBelow5: number;
    doZero: number;
    bodNumeric: number;
    bodAbove3: number;
    phNumeric: number;
    phOutside6_5to8_5: number;
  };
  sampleCheck: Record<string, unknown>;
  absentWindows: { site: string; siteId: string; year: number; festival: Festival }[];
  pageVerification: {
    method: string | null;
    groupCounts: Record<string, number> | null;
    rowsWithVerifiedViewerPage: number;
    manualTablesChecked: number;
  };
  reports: Record<string, ReportInfo>;
  criteriaSource: string;
  validationWarnings: string[];
}

export type HistoricalConcern = "elevated" | "moderate" | "lower_observed" | "insufficient_evidence";
export type SamplingPriority = "urgent_retest" | "priority_retest" | "routine_verify";

export interface WindowMetric {
  year: number;
  festival: Festival;
  numericComparable: number;
  outside: number;
  meanSeverity: number;
  exceedanceFraction: number;
  hasExceedance: boolean;
  yearWeight: number;
  observationIds: string[];
}

/** A reason either cites observation rows or a documented source-coverage assertion. */
export interface Reason {
  code:
    | "do_zero"
    | "do_severe"
    | "bod_severe"
    | "do_below"
    | "bod_above"
    | "ph_outside"
    | "recurrence"
    | "absent_window"
    | "phases_not_sampled"
    | "identity"
    | "no_comparable";
  label: string;
  why: string;
  observationIds: string[];
  coverageAssertion?: { siteId: string; year: number; festival: Festival; statement: string };
  tone: "critical" | "warning" | "gap" | "info";
}

export interface PhaseCell {
  year: number;
  festival: Festival;
  phase: Phase;
  state: "full" | "partial" | "not_sampled" | "not_in_source" | "out_of_scope";
  numeric: number;
  recorded: number;
}

export interface Coverage {
  recordedBenchmarkedSlots: number;
  numericComparableSlots: number;
  censoredSlots: number;
  explicitNotSampledSlots: number;
  unparsedSlots: number;
  windowsAvailable: number;
  nominalWindows: number;
  sourceAbsentWindows: { year: number; festival: Festival }[];
  phaseCoverage: PhaseCell[];
  numericRatio: number | null;
  windowRatio: number | null;
}

export interface ScoreComponents {
  meanSeverityWeighted: number;
  exceedanceFractionWeighted: number;
  recurrenceFraction: number;
  validWindows: number;
  windowsWithExceedance: number;
  numericComparable: number;
  parameterTypes: number;
}

export interface SiteSummary {
  id: string;
  canonicalName: string;
  nameHi: string;
  waterBody: string;
  printedAliases: string[];
  identityConfidence: IdentityConfidence;
  identityNote: string | null;
  operationalStatus2026: "unverified";
  rank: number | null;
  historicalConcern: HistoricalConcern;
  concernIndex: number | null;
  components: ScoreComponents | null;
  windows: WindowMetric[];
  coverage: Coverage;
  samplingPriority: SamplingPriority;
  samplingPriorityWhy: string;
  needsIdentityVerification: boolean;
  severeObservationIds: string[];
  topReasons: Reason[];
  worstDo: { value: number; id: string } | null;
  worstBod: { value: number; id: string } | null;
}

export interface Filters {
  year: number | "all";
  festival: Festival | "all";
  phase: Phase | "all";
  parameter: string | "all";
}
