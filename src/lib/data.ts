import observationsJson from "@/generated/observations.json";
import sitesJson from "@/generated/sites.json";
import standardsJson from "@/generated/standards.json";
import manifestJson from "@/generated/data-manifest.json";
import { StandardsEngine } from "@/lib/standards";
import type { DataManifest, Observation, RawObservation, SiteRecord, StandardsFile } from "@/types/ghatwatch";

export const manifest = manifestJson as unknown as DataManifest;
export const standardsFile = standardsJson as unknown as StandardsFile;
export const engine = new StandardsEngine(standardsFile);
export const sites = sitesJson as unknown as SiteRecord[];

export function enrich(raw: RawObservation[], eng: StandardsEngine = engine): Observation[] {
  return raw.map((r) => {
    const report = manifest.reports[String(r.year)];
    const rule = eng.ruleFor(r.parameter);
    return {
      ...r,
      unitsAreInferred: true as const,
      sourcePdfFilename: report?.file ?? "unknown",
      sourceReportUrl: report?.url ?? "",
      benchmarkId: rule?.criterionId ?? null,
      benchmarkStatus: eng.evaluate(r.parameter, r.measurementStatus, r.numericValue),
    };
  });
}

export const rawObservations = observationsJson as unknown as RawObservation[];
export const observations: Observation[] = enrich(rawObservations);
const byId = new Map(observations.map((o) => [o.id, o]));

export function getObservation(id: string): Observation | undefined {
  return byId.get(id);
}

export function getSite(id: string): SiteRecord | undefined {
  return sites.find((s) => s.id === id);
}

export const PARAMETERS = [
  "pH",
  "Dissolved oxygen",
  "BOD",
  "COD",
  "Total solids",
  "Dissolved solids",
  "Suspended solids",
  "Turbidity",
  "Conductivity",
  "Chromium",
  "Lead",
  "Zinc",
  "Copper",
] as const;

export const YEARS = [2023, 2024, 2025] as const;
export const FESTIVALS = ["Ganesh", "Durga"] as const;
export const PHASES = ["pre", "during", "after"] as const;
