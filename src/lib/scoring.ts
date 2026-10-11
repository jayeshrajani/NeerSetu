import type {
  Festival,
  Filters,
  HistoricalConcern,
  Observation,
  Reason,
  SamplingPriority,
  SiteRecord,
  SiteSummary,
  WindowMetric,
} from "@/types/ghatwatch";
import { BENCHMARK_PARAMETERS, type StandardsEngine } from "@/lib/standards";
import { computeCoverage } from "@/lib/coverage";
import { scopeObservations, scopeYears } from "@/lib/filters";

/** Product heuristics — NOT CPCB/MPPCB official weights. Disclosed on /methodology. */
export const SCORING = {
  version: "1.0.0",
  yearWeights: { 2023: 1, 2024: 1.25, 2025: 1.5 } as Record<number, number>,
  weights: { meanSeverity: 0.45, exceedanceFraction: 0.35, recurrence: 0.2 },
  minNumericComparable: 3,
  minParameterTypes: 2,
  buckets: { elevated: 50, moderate: 20 },
  severeTriggers: { doAtOrBelow: 2.5, bodAtOrAbove: 9 },
} as const;

const isBench = (o: Observation) => (BENCHMARK_PARAMETERS as readonly string[]).includes(o.parameter);
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)));

export function bucketFor(index: number | null): HistoricalConcern {
  if (index === null) return "insufficient_evidence";
  if (index >= SCORING.buckets.elevated) return "elevated";
  if (index >= SCORING.buckets.moderate) return "moderate";
  return "lower_observed";
}

export function windowMetrics(siteObs: Observation[], engine: StandardsEngine): WindowMetric[] {
  const groups = new Map<string, Observation[]>();
  for (const o of siteObs) {
    if (!isBench(o) || o.measurementStatus !== "numeric" || o.numericValue === null) continue;
    const k = `${o.year}|${o.festival}`;
    const g = groups.get(k);
    if (g) g.push(o);
    else groups.set(k, [o]);
  }
  const out: WindowMetric[] = [];
  for (const [k, rows] of groups) {
    const [y, fe] = k.split("|") as [string, Festival];
    const year = Number(y);
    const sev = rows.map((o) => engine.severity(o.parameter, o.numericValue as number));
    const outside = rows.filter((o) => o.benchmarkStatus === "outside_screening_benchmark").length;
    out.push({
      year,
      festival: fe,
      numericComparable: rows.length,
      outside,
      meanSeverity: sev.reduce((a, b) => a + b, 0) / rows.length,
      exceedanceFraction: outside / rows.length,
      hasExceedance: outside > 0,
      yearWeight: SCORING.yearWeights[year] ?? 1,
      observationIds: rows.map((o) => o.id).sort(),
    });
  }
  return out.sort((a, b) => a.year - b.year || a.festival.localeCompare(b.festival));
}

function reasonsFor(
  site: SiteRecord,
  siteObs: Observation[],
  windows: WindowMetric[],
  coverageAbsent: { year: number; festival: Festival }[],
): Reason[] {
  const reasons: Reason[] = [];
  const bench = siteObs.filter((o) => isBench(o) && o.measurementStatus === "numeric" && o.numericValue !== null);
  const byParam = (p: string) => bench.filter((o) => o.parameter === p);
  const where = (o: Observation) => `${o.year} ${o.festival} ${o.phase}`;

  const doRows = byParam("Dissolved oxygen");
  const doZero = doRows.filter((o) => o.numericValue === 0);
  const doSevere = doRows.filter((o) => (o.numericValue as number) > 0 && (o.numericValue as number) <= SCORING.severeTriggers.doAtOrBelow);
  const doBelow = doRows.filter((o) => o.benchmarkStatus === "outside_screening_benchmark");
  if (doZero.length) {
    reasons.push({
      code: "do_zero",
      label: `DO recorded as 0 mg/l in ${doZero.length} reading${doZero.length > 1 ? "s" : ""}`,
      why: `Printed numeric zero (not blank) at ${doZero.map(where).join("; ")}. Class B screening minimum is 5 mg/l.`,
      observationIds: doZero.map((o) => o.id),
      tone: "critical",
    });
  }
  if (doSevere.length) {
    const min = doSevere.reduce((a, b) => ((a.numericValue as number) <= (b.numericValue as number) ? a : b));
    reasons.push({
      code: "do_severe",
      label: `DO at or below ${SCORING.severeTriggers.doAtOrBelow} mg/l in ${doSevere.length} reading${doSevere.length > 1 ? "s" : ""} (lowest ${fmt(min.numericValue as number)})`,
      why: `Heuristic severe trigger (DO ≤ ${SCORING.severeTriggers.doAtOrBelow} mg/l), not an official threshold. Readings: ${doSevere.map((o) => `${fmt(o.numericValue as number)} at ${where(o)}`).join("; ")}.`,
      observationIds: doSevere.map((o) => o.id),
      tone: "critical",
    });
  }
  const bodRows = byParam("BOD");
  const bodSevere = bodRows.filter((o) => (o.numericValue as number) >= SCORING.severeTriggers.bodAtOrAbove);
  if (bodSevere.length) {
    const max = bodSevere.reduce((a, b) => ((a.numericValue as number) >= (b.numericValue as number) ? a : b));
    reasons.push({
      code: "bod_severe",
      label: `BOD at or above ${SCORING.severeTriggers.bodAtOrAbove} mg/l in ${bodSevere.length} reading${bodSevere.length > 1 ? "s" : ""} (highest ${fmt(max.numericValue as number)})`,
      why: `Heuristic severe trigger (BOD ≥ ${SCORING.severeTriggers.bodAtOrAbove} mg/l, three times the Class B screening maximum of 3), not an official threshold. Readings: ${bodSevere.map((o) => `${fmt(o.numericValue as number)} at ${where(o)}`).join("; ")}.`,
      observationIds: bodSevere.map((o) => o.id),
      tone: "critical",
    });
  }
  if (doBelow.length && !doZero.length && !doSevere.length) {
    reasons.push({
      code: "do_below",
      label: `DO below Class B screening level in ${doBelow.length} of ${doRows.length} readings`,
      why: `Class B screening minimum 5 mg/l. Lowest: ${fmt(Math.min(...doBelow.map((o) => o.numericValue as number)))} mg/l.`,
      observationIds: doBelow.map((o) => o.id),
      tone: "warning",
    });
  } else if (doBelow.length) {
    reasons.push({
      code: "do_below",
      label: `DO below 5 mg/l in ${doBelow.length} of ${doRows.length} readings`,
      why: "Class B screening minimum 5 mg/l; includes the readings above.",
      observationIds: doBelow.map((o) => o.id),
      tone: "warning",
    });
  }
  const bodAbove = bodRows.filter((o) => o.benchmarkStatus === "outside_screening_benchmark");
  if (bodAbove.length) {
    reasons.push({
      code: "bod_above",
      label: `BOD above Class B screening level in ${bodAbove.length} of ${bodRows.length} readings`,
      why: `Class B screening maximum 3 mg/l. Highest: ${fmt(Math.max(...bodAbove.map((o) => o.numericValue as number)))} mg/l.`,
      observationIds: bodAbove.map((o) => o.id),
      tone: "warning",
    });
  }
  const phOut = byParam("pH").filter((o) => o.benchmarkStatus === "outside_screening_benchmark");
  if (phOut.length) {
    reasons.push({
      code: "ph_outside",
      label: `pH outside 6.5–8.5 in ${phOut.length} reading${phOut.length > 1 ? "s" : ""}`,
      why: phOut.map((o) => `${fmt(o.numericValue as number)} at ${where(o)}`).join("; "),
      observationIds: phOut.map((o) => o.id),
      tone: "warning",
    });
  }
  const withEx = windows.filter((w) => w.hasExceedance);
  if (windows.length >= 2 && withEx.length >= 2) {
    reasons.push({
      code: "recurrence",
      label: `Repeated finding across ${withEx.length} of ${windows.length} sampled festival windows`,
      why: `Windows with ≥1 DO/BOD/pH reading outside the screening benchmark: ${withEx.map((w) => `${w.year} ${w.festival}`).join(", ")}.`,
      observationIds: withEx.flatMap((w) => w.observationIds.filter((id) => siteObs.find((o) => o.id === id)?.benchmarkStatus === "outside_screening_benchmark")),
      tone: "info",
    });
  }
  for (const a of coverageAbsent) {
    reasons.push({
      code: "absent_window",
      label: `No ${a.year} ${a.festival} table in the supplied reports`,
      why: "The source pack has no table for this site and festival-year. This is missing evidence, not a clean result.",
      observationIds: [],
      coverageAssertion: {
        siteId: site.id,
        year: a.year,
        festival: a.festival,
        statement: `No rows for ${site.canonicalName} / ${a.year} / ${a.festival} exist in bhopal_ghats_2023_2025.csv.`,
      },
      tone: "gap",
    });
  }
  const notSampled = siteObs.filter((o) => isBench(o) && o.measurementStatus === "not_sampled");
  if (notSampled.length) {
    const groups = [...new Set(notSampled.map((o) => `${o.year} ${o.festival}`))];
    reasons.push({
      code: "phases_not_sampled",
      label: `${notSampled.length} DO/BOD/pH slot${notSampled.length > 1 ? "s" : ""} marked not sampled`,
      why: `Printed blank, '_', '*' or '**' in: ${groups.join(", ")}. Treated as missing, never as clean.`,
      observationIds: notSampled.map((o) => o.id),
      tone: "gap",
    });
  }
  if (site.identityConfidence !== "high") {
    reasons.push({
      code: "identity",
      label: "Location name ambiguous — confirm the physical site",
      why: site.identityNote ?? `Site match confidence is ${site.identityConfidence}.`,
      observationIds: [],
      tone: "gap",
    });
  }
  if (!bench.length) {
    reasons.push({
      code: "no_comparable",
      label: "No numeric DO/BOD/pH reading in this scope",
      why: "Nothing to compare against the screening benchmark. This is an evidence gap, not a satisfactory result.",
      observationIds: [],
      tone: "gap",
    });
  }
  return reasons;
}

function samplingPriorityFor(
  siteObs: Observation[],
  windows: WindowMetric[],
  absent: { year: number; festival: Festival }[],
  f: Filters,
): { priority: SamplingPriority; why: string; severeIds: string[] } {
  const severe = siteObs.filter(
    (o) =>
      o.measurementStatus === "numeric" &&
      o.numericValue !== null &&
      ((o.parameter === "Dissolved oxygen" && o.numericValue <= SCORING.severeTriggers.doAtOrBelow) ||
        (o.parameter === "BOD" && o.numericValue >= SCORING.severeTriggers.bodAtOrAbove)),
  );
  if (severe.length) {
    const yrs = [...new Set(severe.map((o) => o.year))].sort();
    return {
      priority: "urgent_retest",
      why: `Heuristic severe trigger (DO ≤ ${SCORING.severeTriggers.doAtOrBelow} or BOD ≥ ${SCORING.severeTriggers.bodAtOrAbove} mg/l) in ${yrs.join(", ")}. Historical — needs fresh sampling before visarjan.`,
      severeIds: severe.map((o) => o.id),
    };
  }
  const latest = Math.max(...scopeYears(f));
  const latestAbsent = absent.filter((a) => a.year === latest);
  const latestRows = siteObs.filter((o) => o.year === latest && isBench(o) && o.measurementStatus === "numeric");
  const onlyDuring = latestRows.length > 0 && latestRows.every((o) => o.phase === "during") && f.phase === "all";
  if (windows.some((w) => w.hasExceedance)) {
    return { priority: "priority_retest", why: "Screening-benchmark exceedances in the historical record.", severeIds: [] };
  }
  if (latestAbsent.length || onlyDuring || !latestRows.length) {
    return {
      priority: "priority_retest",
      why: latestAbsent.length
        ? `No ${latest} ${latestAbsent.map((a) => a.festival).join("/")} table in the supplied reports.`
        : onlyDuring
          ? `Only during-immersion readings exist for ${latest}.`
          : `No numeric DO/BOD/pH reading for ${latest} in this scope.`,
      severeIds: [],
    };
  }
  return { priority: "routine_verify", why: "No exceedance in scope. Still verify before use — this is not a safety or approval determination.", severeIds: [] };
}

export function summariseSite(site: SiteRecord, scoped: Observation[], engine: StandardsEngine, f: Filters): SiteSummary {
  const siteObs = scoped.filter((o) => o.siteId === site.id);
  const windows = windowMetrics(siteObs, engine);
  const coverage = computeCoverage(siteObs, site, f);
  const numericBench = siteObs.filter((o) => isBench(o) && o.measurementStatus === "numeric");
  const paramTypes = new Set(numericBench.map((o) => o.parameter)).size;

  let concernIndex: number | null = null;
  let components: SiteSummary["components"] = null;
  if (numericBench.length >= SCORING.minNumericComparable && paramTypes >= SCORING.minParameterTypes && windows.length) {
    const wSum = windows.reduce((a, w) => a + w.yearWeight, 0);
    const msw = windows.reduce((a, w) => a + w.yearWeight * w.meanSeverity, 0) / wSum;
    const efw = windows.reduce((a, w) => a + w.yearWeight * w.exceedanceFraction, 0) / wSum;
    const withEx = windows.filter((w) => w.hasExceedance).length;
    const rf = withEx / windows.length;
    const W = SCORING.weights;
    concernIndex = Math.round(1000 * (W.meanSeverity * msw + W.exceedanceFraction * efw + W.recurrence * rf)) / 10;
    components = {
      meanSeverityWeighted: msw,
      exceedanceFractionWeighted: efw,
      recurrenceFraction: rf,
      validWindows: windows.length,
      windowsWithExceedance: withEx,
      numericComparable: numericBench.length,
      parameterTypes: paramTypes,
    };
  }

  const sp = samplingPriorityFor(siteObs, windows, coverage.sourceAbsentWindows, f);
  const doNum = numericBench.filter((o) => o.parameter === "Dissolved oxygen");
  const bodNum = numericBench.filter((o) => o.parameter === "BOD");
  const pick = (rows: Observation[], better: (a: number, b: number) => boolean) =>
    rows.length
      ? rows.reduce((a, b) => (better(b.numericValue as number, a.numericValue as number) ? b : a))
      : null;
  const wDo = pick(doNum, (a, b) => a < b);
  const wBod = pick(bodNum, (a, b) => a > b);

  return {
    id: site.id,
    canonicalName: site.canonicalName,
    nameHi: site.nameHi,
    waterBody: site.waterBody,
    printedAliases: site.printedAliases,
    identityConfidence: site.identityConfidence,
    identityNote: site.identityNote,
    operationalStatus2026: "unverified",
    rank: null,
    historicalConcern: bucketFor(concernIndex),
    concernIndex,
    components,
    windows,
    coverage,
    samplingPriority: sp.priority,
    samplingPriorityWhy: sp.why,
    needsIdentityVerification: site.identityConfidence !== "high",
    severeObservationIds: sp.severeIds,
    topReasons: reasonsFor(site, siteObs, windows, coverage.sourceAbsentWindows),
    worstDo: wDo ? { value: wDo.numericValue as number, id: wDo.id } : null,
    worstBod: wBod ? { value: wBod.numericValue as number, id: wBod.id } : null,
  };
}

/** Ranked summaries: scored sites by index desc → comparable count desc → name; insufficient-evidence sites unranked, after. */
export function rankSites(observations: Observation[], siteList: SiteRecord[], engine: StandardsEngine, f: Filters): SiteSummary[] {
  const scoped = scopeObservations(observations, f);
  const all = siteList.map((s) => summariseSite(s, scoped, engine, f));
  const scored = all
    .filter((s) => s.concernIndex !== null)
    .sort(
      (a, b) =>
        (b.concernIndex as number) - (a.concernIndex as number) ||
        (b.components?.numericComparable ?? 0) - (a.components?.numericComparable ?? 0) ||
        a.canonicalName.localeCompare(b.canonicalName),
    );
  scored.forEach((s, i) => (s.rank = i + 1));
  const unscored = all.filter((s) => s.concernIndex === null).sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));
  return [...scored, ...unscored];
}

export const PRIORITY_ORDER: Record<SamplingPriority, number> = { urgent_retest: 0, priority_retest: 1, routine_verify: 2 };
