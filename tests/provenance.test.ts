import { describe, expect, it } from "vitest";
import { engine, getObservation, manifest, observations, sites } from "@/lib/data";
import { DEFAULT_FILTERS } from "@/lib/filters";
import { citationFor } from "@/lib/provenance";
import { rankSites } from "@/lib/scoring";
import { readCsv } from "./helpers";

describe("T — traceability and honest interpretation", () => {
  const primary = readCsv("bhopal_ghats_2023_2025.csv");

  it("T01 every ranking reason and worst-value readout resolves to a CSV line", () => {
    for (const s of rankSites(observations, sites, engine, DEFAULT_FILTERS)) {
      const ids = [...s.topReasons.flatMap((r) => r.observationIds), s.worstDo?.id, s.worstBod?.id].filter(Boolean) as string[];
      for (const id of ids) {
        const o = getObservation(id)!;
        expect(o).toBeDefined();
        const row = primary.rows[o.sourceCsvLine - 2]!;
        expect(row.site).toBe(o.siteCanonical);
        expect(row.value_as_printed).toBe(o.valueAsPrinted);
      }
    }
  });

  it("T02 every measurement has report file/URL/year and page metadata", () => {
    for (const o of observations) {
      const c = citationFor(o);
      expect(c.reportFile).toBe(manifest.reports[String(o.year)]!.file);
      expect(c.officialUrl).toMatch(/^https:\/\/www\.mppcb\.mp\.gov\.in\/proc\/mon\//);
      expect(c.page).not.toBeNull();
      expect(c.text).toContain(`line ${o.sourceCsvLine}`);
    }
  });

  it("T03 deep links only when the page was verified; otherwise labelled unverified", () => {
    for (const o of observations) {
      const c = citationFor(o);
      if (o.sourcePdfViewerPage === null) {
        expect(c.localUrl).not.toContain("#page=");
        expect(c.pageLabel).toMatch(/not independently verified/);
      } else {
        expect(c.localUrl).toBe(`/reports/${o.year}#page=${o.sourcePdfViewerPage}`);
        expect(o.sourcePdfViewerPage).toBe(o.sourcePageRaw);
      }
    }
    expect(manifest.pageVerification.rowsWithVerifiedViewerPage).toBeGreaterThan(0);
  });

  it("T03b demo rows are page-verified and match the PDF (Bairagarh 2025 Ganesh DO=0, BOD=8, p.28)", () => {
    const pick = (p: string) => observations.find((o) => o.siteId === "bairagarh-sant-hirdaram-kund" && o.year === 2025 && o.festival === "Ganesh" && o.phase === "during" && o.parameter === p)!;
    expect(pick("Dissolved oxygen")).toMatchObject({ numericValue: 0, sourcePdfViewerPage: 28, manualCheck: "compared" });
    expect(pick("BOD")).toMatchObject({ numericValue: 8, sourcePdfViewerPage: 28, manualCheck: "compared" });
  });

  it("T04 Rani Kamlapati / Kamla Park identity is medium confidence and has no coordinates", () => {
    const s = sites.find((x) => x.id === "rani-kamlapati-kamla-park")!;
    expect(s.identityConfidence).toBe("medium");
    expect(s.identityNote).toMatch(/two different physical places/);
    expect(JSON.stringify(s)).not.toMatch(/lat|lng|longitude|latitude|coord/i);
  });

  it("T05 2026 operational status is unverified for every site", () => {
    expect(rankSites(observations, sites, engine, DEFAULT_FILTERS).every((s) => s.operationalStatus2026 === "unverified")).toBe(true);
  });

  it("T08 units are flagged inferred and data years are 2023–2025", () => {
    expect(observations.every((o) => o.unitsAreInferred === true)).toBe(true);
    expect([manifest.dataYearMin, manifest.dataYearMax]).toEqual([2023, 2025]);
  });
});
