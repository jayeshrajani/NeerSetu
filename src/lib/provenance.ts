import type { Observation } from "@/types/ghatwatch";
import { manifest } from "@/lib/data";

export interface Citation {
  observationId: string;
  csvFile: string;
  csvLine: number;
  reportYear: number;
  reportTitle: string;
  reportTitleHi: string;
  reportFile: string;
  officialUrl: string;
  /** Local PDF link with #page=N, only when the page was text-verified. */
  localUrl: string;
  page: number | null;
  pageVerified: boolean;
  pageLabel: string;
  manualCheck: Observation["manualCheck"];
  text: string;
}

export function reportFor(year: number) {
  return manifest.reports[String(year)];
}

export function citationFor(o: Observation): Citation {
  const r = reportFor(o.year);
  const verified = o.sourcePdfViewerPage !== null;
  const page = o.sourcePdfViewerPage ?? o.sourcePageRaw;
  const pageLabel = verified
    ? `PDF p. ${page}`
    : page !== null
      ? `source metadata page ${page} (not independently verified)`
      : "page not recorded";
  const localUrl = `/reports/${o.year}${verified ? `#page=${page}` : ""}`;
  const value = o.valueAsPrinted === "" ? "(blank)" : o.valueAsPrinted;
  const text = `${r?.title ?? `Report ${o.year}`}, ${pageLabel} — ${o.siteAsPrinted}; ${o.festival} ${o.year}, ${o.phase}-immersion; ${o.parameterAsPrinted} = ${value}. [GhatWatch ${o.id}; ${o.sourceCsv} line ${o.sourceCsvLine}]`;
  return {
    observationId: o.id,
    csvFile: o.sourceCsv,
    csvLine: o.sourceCsvLine,
    reportYear: o.year,
    reportTitle: r?.title ?? `Report ${o.year}`,
    reportTitleHi: r?.titleHi ?? `रिपोर्ट ${o.year}`,
    reportFile: r?.file ?? "unknown",
    officialUrl: r?.url ?? "",
    localUrl,
    page,
    pageVerified: verified,
    pageLabel,
    manualCheck: o.manualCheck,
    text,
  };
}

export const PHASE_LABEL: Record<string, string> = { pre: "Pre-immersion", during: "During immersion", after: "One week after" };
export const PHASE_LABEL_HI: Record<string, string> = { pre: "विसर्जन से पहले", during: "विसर्जन के दौरान", after: "एक सप्ताह बाद" };

export function displayValue(o: Pick<Observation, "measurementStatus" | "valueAsPrinted" | "numericValue" | "unitAssumed">): string {
  switch (o.measurementStatus) {
    case "numeric":
      return `${o.valueAsPrinted}${o.unitAssumed ? ` ${o.unitAssumed}` : ""}`;
    case "below_detection_limit":
      return "BDL";
    case "not_detected":
      return "ND";
    case "not_sampled":
      return `not sampled${o.valueAsPrinted ? ` (printed “${o.valueAsPrinted}”)` : " (blank)"}`;
    case "not_in_source":
      return "no table in source";
    default:
      return `unparsed (“${o.valueAsPrinted}”)`;
  }
}
