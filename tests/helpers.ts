import { readFileSync } from "node:fs";
import { join } from "node:path";
import { engine, sites } from "@/lib/data";
import { parseCsv } from "@/lib/standards";
import type { Festival, Observation, Phase } from "@/types/ghatwatch";

export const ROOT = process.cwd();
export const DATA_DIR = join(ROOT, "source-data", "organiser-track-2", "data");

export function readCsv(name: string): { header: string[]; rows: Record<string, string>[] } {
  const [header, ...body] = parseCsv(readFileSync(join(DATA_DIR, name), "utf-8"));
  return { header: header!, rows: body.map((r) => Object.fromEntries(header!.map((h, i) => [h, r[i] ?? ""]))) };
}

let seq = 0;
export function obs(p: {
  siteId?: string;
  year?: number;
  festival?: Festival;
  phase?: Phase;
  parameter: string;
  value: number | null;
  status?: Observation["measurementStatus"];
  printed?: string;
}): Observation {
  seq++;
  const site = sites.find((s) => s.id === (p.siteId ?? "khatlapura-ghat"))!;
  const status = p.status ?? (p.value === null ? "not_sampled" : "numeric");
  return {
    id: `t-${seq}`,
    sourceCsv: "fixture",
    sourceCsvLine: seq + 1,
    siteId: site.id,
    siteCanonical: site.canonicalName,
    siteAsPrinted: site.printedAliases[0]!,
    siteMatchConfidence: site.identityConfidence,
    waterBody: site.waterBody,
    year: p.year ?? 2025,
    festival: p.festival ?? "Ganesh",
    phase: p.phase ?? "during",
    parameter: p.parameter,
    parameterAsPrinted: p.parameter,
    numericValue: p.value,
    valueAsPrinted: p.printed ?? (p.value === null ? "" : String(p.value)),
    flag: status === "numeric" ? "" : status === "below_detection_limit" ? "BDL" : "not sampled",
    measurementStatus: status,
    unitAssumed: p.parameter === "pH" ? null : "mg/l",
    sourcePageRaw: 1,
    sourcePdfViewerPage: null,
    pageVerification: "unverified",
    manualCheck: null,
    unitsAreInferred: true,
    sourcePdfFilename: "fixture.pdf",
    sourceReportUrl: "",
    benchmarkId: engine.ruleFor(p.parameter)?.criterionId ?? null,
    benchmarkStatus: engine.evaluate(p.parameter, status, p.value),
  };
}
