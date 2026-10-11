import type { Coverage, Festival, Filters, Observation, PhaseCell, SiteRecord } from "@/types/ghatwatch";
import { BENCHMARK_PARAMETERS } from "@/lib/standards";
import { scopeFestivals, scopePhases, scopeYears } from "@/lib/filters";
import { FESTIVALS, PHASES, YEARS } from "@/lib/data";

const isBench = (o: Observation) => (BENCHMARK_PARAMETERS as readonly string[]).includes(o.parameter);

/**
 * Coverage of the DO/BOD/pH screening parameters for one site within the filter scope.
 * Nominal windows = scoped years × scoped festivals: an analytical frame, not an official sampling mandate.
 */
export function computeCoverage(siteObs: Observation[], site: Pick<SiteRecord, "id">, f: Filters): Coverage {
  const bench = siteObs.filter(isBench);
  const years = scopeYears(f);
  const fests = scopeFestivals(f);
  const phases = scopePhases(f);
  const windowKey = (y: number, fe: Festival) => `${y}|${fe}`;
  const present = new Set(siteObs.map((o) => windowKey(o.year, o.festival)));

  const sourceAbsentWindows: { year: number; festival: Festival }[] = [];
  let windowsAvailable = 0;
  for (const y of years)
    for (const fe of fests) {
      if (present.has(windowKey(y, fe))) windowsAvailable++;
      else sourceAbsentWindows.push({ year: y, festival: fe });
    }

  const phaseCoverage: PhaseCell[] = [];
  for (const y of YEARS)
    for (const fe of FESTIVALS)
      for (const ph of PHASES) {
        const inScope = years.includes(y) && fests.includes(fe) && phases.includes(ph);
        const rows = bench.filter((o) => o.year === y && o.festival === fe && o.phase === ph);
        const numeric = rows.filter((o) => o.measurementStatus === "numeric").length;
        let state: PhaseCell["state"];
        if (!inScope) state = "out_of_scope";
        else if (!present.has(windowKey(y, fe))) state = "not_in_source";
        else if (numeric === 0) state = "not_sampled";
        else if (numeric < rows.length || rows.length < BENCHMARK_PARAMETERS.length) state = "partial";
        else state = "full";
        phaseCoverage.push({ year: y, festival: fe, phase: ph, state, numeric, recorded: rows.length });
      }

  const recorded = bench.length;
  const numeric = bench.filter((o) => o.measurementStatus === "numeric").length;
  const nominal = years.length * fests.length;
  return {
    recordedBenchmarkedSlots: recorded,
    numericComparableSlots: numeric,
    censoredSlots: bench.filter((o) => o.measurementStatus === "below_detection_limit" || o.measurementStatus === "not_detected").length,
    explicitNotSampledSlots: bench.filter((o) => o.measurementStatus === "not_sampled").length,
    unparsedSlots: bench.filter((o) => o.measurementStatus === "unparsed").length,
    windowsAvailable,
    nominalWindows: nominal,
    sourceAbsentWindows,
    phaseCoverage,
    numericRatio: recorded ? numeric / recorded : null,
    windowRatio: nominal ? windowsAvailable / nominal : null,
  };
}
