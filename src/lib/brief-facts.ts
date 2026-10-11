import type { Filters, Observation, SiteSummary } from "@/types/ghatwatch";
import { engine, getSite, manifest, observations as allObservations, sites as allSites } from "@/lib/data";
import { describeScope, scopeObservations } from "@/lib/filters";
import { rankSites } from "@/lib/scoring";
import { citationFor } from "@/lib/provenance";

export const MAX_BRIEF_SITES = 3;

export interface BriefEvidence {
  ref: number;
  evidenceId: string;
  parameter: string;
  valuePrinted: string;
  numericValue: number;
  unit: string | null;
  year: number;
  festival: Observation["festival"];
  phase: Observation["phase"];
  benchmark: string;
  outside: boolean;
}

export interface BriefSiteFacts {
  siteId: string;
  name: string;
  nameHi: string;
  waterBody: string;
  rank: number | null;
  concern: SiteSummary["historicalConcern"];
  concernIndex: number | null;
  samplingPriority: SiteSummary["samplingPriority"];
  identityAmbiguous: boolean;
  identityNote: string | null;
  aliasesByFestival: Record<string, string[]>;
  evidence: BriefEvidence[];
  counts: {
    doBelow: number;
    doTotal: number;
    bodAbove: number;
    bodTotal: number;
    phOut: number;
    phTotal: number;
    validWindows: number;
    windowsWithExceedance: number;
    outsideTotal: number;
    outsidePre: number;
  };
  gaps: {
    absentWindows: { year: number; festival: Observation["festival"] }[];
    notSampled: number;
    notSampledWindows: string[];
  };
}

export interface BriefCitation {
  ref: number;
  evidenceId: string;
  reportYear: number;
  reportTitle: string;
  reportTitleHi: string;
  page: number | null;
  pageVerified: boolean;
  csvLine: number;
  officialUrl: string;
}

export interface GroundedBriefFacts {
  scope: string;
  filters: Filters;
  dataYears: string;
  sites: BriefSiteFacts[];
  citations: BriefCitation[];
  allowedEvidenceIds: string[];
  /** Every number a generated sentence may legitimately contain. */
  allowedNumbers: number[];
}

export type BriefFactsResult = { ok: true; facts: GroundedBriefFacts } | { ok: false; error: string };

export function validateSiteIds(ids: string[]): string | null {
  if (!ids.length) return "Select at least one ghat.";
  if (ids.length > MAX_BRIEF_SITES) return `Select at most ${MAX_BRIEF_SITES} ghats.`;
  if (new Set(ids).size !== ids.length) return "Duplicate ghat selection.";
  const unknown = ids.filter((id) => !getSite(id));
  if (unknown.length) return "Unknown ghat in selection.";
  return null;
}

export function buildBriefFacts(siteIds: string[], f: Filters): BriefFactsResult {
  const err = validateSiteIds(siteIds);
  if (err) return { ok: false, error: err };
  const ranked = rankSites(allObservations, allSites, engine, f);
  const scoped = scopeObservations(allObservations, f);
  const citations: BriefCitation[] = [];
  const refFor = (o: Observation) => {
    const existing = citations.find((c) => c.evidenceId === o.id);
    if (existing) return existing.ref;
    const c = citationFor(o);
    const ref = citations.length + 1;
    citations.push({
      ref,
      evidenceId: o.id,
      reportYear: o.year,
      reportTitle: c.reportTitle,
      reportTitleHi: c.reportTitleHi,
      page: c.page,
      pageVerified: c.pageVerified,
      csvLine: c.csvLine,
      officialUrl: c.officialUrl,
    });
    return ref;
  };

  const out: BriefSiteFacts[] = [];
  for (const id of siteIds) {
    const s = ranked.find((x) => x.id === id);
    const site = getSite(id);
    if (!s || !site) continue;
    const siteObs = scoped.filter((o) => o.siteId === id);
    const num = siteObs.filter((o) => o.measurementStatus === "numeric" && o.numericValue !== null);
    const byP = (p: string) => num.filter((o) => o.parameter === p);
    const doR = byP("Dissolved oxygen");
    const bodR = byP("BOD");
    const phR = byP("pH");
    const outside = num.filter((o) => o.benchmarkStatus === "outside_screening_benchmark");

    const picks: Observation[] = [];
    const add = (o: Observation | undefined) => o && !picks.includes(o) && picks.push(o);
    const minBy = (rows: Observation[]) =>
      rows.length ? rows.reduce((a, b) => ((b.numericValue as number) < (a.numericValue as number) || ((b.numericValue as number) === (a.numericValue as number) && b.year > a.year) ? b : a)) : undefined;
    const maxBy = (rows: Observation[]) =>
      rows.length ? rows.reduce((a, b) => ((b.numericValue as number) > (a.numericValue as number) || ((b.numericValue as number) === (a.numericValue as number) && b.year > a.year) ? b : a)) : undefined;
    add(minBy(doR.filter((o) => o.benchmarkStatus === "outside_screening_benchmark")));
    add(maxBy(bodR.filter((o) => o.benchmarkStatus === "outside_screening_benchmark")));
    const phOut = phR.filter((o) => o.benchmarkStatus === "outside_screening_benchmark");
    add(phOut.sort((a, b) => Math.abs((b.numericValue as number) - 7.5) - Math.abs((a.numericValue as number) - 7.5))[0]);
    const latestYear = Math.max(...num.map((o) => o.year), 0);
    add(minBy(doR.filter((o) => o.year === latestYear && o.benchmarkStatus === "outside_screening_benchmark")));

    const evidence: BriefEvidence[] = picks.slice(0, 4).map((o) => ({
      ref: refFor(o),
      evidenceId: o.id,
      parameter: o.parameter,
      valuePrinted: o.valueAsPrinted,
      numericValue: o.numericValue as number,
      unit: o.unitAssumed,
      year: o.year,
      festival: o.festival,
      phase: o.phase,
      benchmark: engine.describe(o.parameter) ?? "",
      outside: o.benchmarkStatus === "outside_screening_benchmark",
    }));

    const notSampled = siteObs.filter((o) => ["Dissolved oxygen", "BOD", "pH"].includes(o.parameter) && o.measurementStatus === "not_sampled");
    out.push({
      siteId: id,
      name: site.canonicalName,
      nameHi: site.nameHi,
      waterBody: site.waterBody,
      rank: s.rank,
      concern: s.historicalConcern,
      concernIndex: s.concernIndex,
      samplingPriority: s.samplingPriority,
      identityAmbiguous: s.needsIdentityVerification,
      identityNote: site.identityNote,
      aliasesByFestival: site.printedAliasesByFestival,
      evidence,
      counts: {
        doBelow: doR.filter((o) => o.benchmarkStatus === "outside_screening_benchmark").length,
        doTotal: doR.length,
        bodAbove: bodR.filter((o) => o.benchmarkStatus === "outside_screening_benchmark").length,
        bodTotal: bodR.length,
        phOut: phOut.length,
        phTotal: phR.length,
        validWindows: s.components?.validWindows ?? s.windows.length,
        windowsWithExceedance: s.windows.filter((w) => w.hasExceedance).length,
        outsideTotal: outside.length,
        outsidePre: outside.filter((o) => o.phase === "pre").length,
      },
      gaps: {
        absentWindows: s.coverage.sourceAbsentWindows,
        notSampled: notSampled.length,
        notSampledWindows: [...new Set(notSampled.map((o) => `${o.year} ${o.festival}`))],
      },
    });
  }

  const allowed = new Set<number>([2023, 2024, 2025, 2026, 20, 5, 3, 6.5, 8.5, MAX_BRIEF_SITES, out.length]);
  for (const s of out) {
    if (s.rank !== null) allowed.add(s.rank);
    if (s.concernIndex !== null) allowed.add(s.concernIndex);
    Object.values(s.counts).forEach((n) => allowed.add(n));
    allowed.add(s.gaps.notSampled);
    s.evidence.forEach((e) => {
      allowed.add(e.numericValue);
      allowed.add(e.year);
    });
  }
  citations.forEach((c) => {
    allowed.add(c.ref);
    if (c.page !== null) allowed.add(c.page);
  });

  return {
    ok: true,
    facts: {
      scope: describeScope(f),
      filters: f,
      dataYears: `${manifest.dataYearMin}–${manifest.dataYearMax}`,
      sites: out,
      citations,
      allowedEvidenceIds: citations.map((c) => c.evidenceId),
      allowedNumbers: [...allowed].sort((a, b) => a - b),
    },
  };
}
