import type { Festival, Filters, Observation, Phase } from "@/types/ghatwatch";
import { FESTIVALS, PARAMETERS, PHASES, YEARS } from "@/lib/data";

export const DEFAULT_FILTERS: Filters = { year: "all", festival: "all", phase: "all", parameter: "all" };

type Params = Record<string, string | string[] | undefined>;

export type FilterParse = { ok: true; filters: Filters } | { ok: false; errors: string[]; filters: Filters };

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Strict: unknown values are reported, never silently coerced into a different scope. */
export function parseFilters(params: Params): FilterParse {
  const errors: string[] = [];
  const f: Filters = { ...DEFAULT_FILTERS };
  const y = one(params.year);
  if (y && y !== "all") {
    const n = Number(y);
    if ((YEARS as readonly number[]).includes(n)) f.year = n;
    else errors.push(`Unknown year “${y.slice(0, 20)}”. Available: ${YEARS.join(", ")}.`);
  }
  const fe = one(params.festival);
  if (fe && fe !== "all") {
    if ((FESTIVALS as readonly string[]).includes(fe)) f.festival = fe as Festival;
    else errors.push(`Unknown festival “${fe.slice(0, 20)}”. Available: Ganesh, Durga.`);
  }
  const ph = one(params.phase);
  if (ph && ph !== "all") {
    if ((PHASES as readonly string[]).includes(ph)) f.phase = ph as Phase;
    else errors.push(`Unknown phase “${ph.slice(0, 20)}”. Available: pre, during, after.`);
  }
  const pa = one(params.parameter);
  if (pa && pa !== "all") {
    if ((PARAMETERS as readonly string[]).includes(pa)) f.parameter = pa;
    else errors.push(`Unknown parameter “${pa.slice(0, 30)}”.`);
  }
  return errors.length ? { ok: false, errors, filters: DEFAULT_FILTERS } : { ok: true, filters: f };
}

/** Scope used for scoring: year/festival/phase. The parameter filter never changes scoring. */
export function inScoringScope(o: Observation, f: Filters): boolean {
  return (
    (f.year === "all" || o.year === f.year) &&
    (f.festival === "all" || o.festival === f.festival) &&
    (f.phase === "all" || o.phase === f.phase)
  );
}

export function scopeObservations(obs: Observation[], f: Filters): Observation[] {
  return obs.filter((o) => inScoringScope(o, f));
}

export function viewObservations(obs: Observation[], f: Filters): Observation[] {
  return obs.filter((o) => inScoringScope(o, f) && (f.parameter === "all" || o.parameter === f.parameter));
}

export function scopeYears(f: Filters): number[] {
  return f.year === "all" ? [...YEARS] : [f.year];
}
export function scopeFestivals(f: Filters): Festival[] {
  return f.festival === "all" ? [...FESTIVALS] : [f.festival];
}
export function scopePhases(f: Filters): Phase[] {
  return f.phase === "all" ? [...PHASES] : [f.phase];
}

export function describeScope(f: Filters): string {
  const parts = [
    f.year === "all" ? "2023–2025" : String(f.year),
    f.festival === "all" ? "Ganesh + Durga" : f.festival,
    f.phase === "all" ? "all phases" : `${f.phase}-immersion phase only`,
  ];
  return parts.join(" · ");
}

export function filtersToQuery(f: Partial<Filters>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== "all") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function isDefaultScope(f: Filters): boolean {
  return f.year === "all" && f.festival === "all" && f.phase === "all";
}
