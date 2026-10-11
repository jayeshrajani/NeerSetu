import { describe, expect, it } from "vitest";
import { engine, observations, sites } from "@/lib/data";
import { DEFAULT_FILTERS } from "@/lib/filters";
import { rankSites, summariseSite } from "@/lib/scoring";
import { obs } from "./helpers";

const find = (siteId: string, year: number, festival: string, phase: string, parameter: string) =>
  observations.find((o) => o.siteId === siteId && o.year === year && o.festival === festival && o.phase === phase && o.parameter === parameter);

describe("D04–D07, S08–S09 — missing, censored and zero values", () => {
  it("D04 printed DO '0' stays numeric zero (Bairagarh 2025 Ganesh during)", () => {
    const o = find("bairagarh-sant-hirdaram-kund", 2025, "Ganesh", "during", "Dissolved oxygen")!;
    expect(o.valueAsPrinted).toBe("0");
    expect(o.numericValue).toBe(0);
    expect(o.measurementStatus).toBe("numeric");
    expect(o.benchmarkStatus).toBe("outside_screening_benchmark");
  });

  it("D05 blank, '_', '*', '**' are not_sampled with null value — never 0", () => {
    const ns = observations.filter((o) => o.measurementStatus === "not_sampled");
    expect(ns.length).toBe(61);
    expect(ns.every((o) => o.numericValue === null)).toBe(true);
    const printed = new Set(ns.map((o) => o.valueAsPrinted));
    for (const t of ["", "_", "*", "**"]) expect(printed.has(t)).toBe(true);
    const pre = find("bairagarh-sant-hirdaram-kund", 2025, "Ganesh", "pre", "Dissolved oxygen")!;
    expect(pre.measurementStatus).toBe("not_sampled");
    expect(pre.benchmarkStatus).toBe("indeterminate");
  });

  it("D06 BDL keeps its token and is neither a numeric pass nor a violation", () => {
    const bdl = observations.filter((o) => o.measurementStatus === "below_detection_limit");
    expect(bdl.length).toBe(174);
    expect(bdl.every((o) => o.valueAsPrinted === "BDL" && o.numericValue === null)).toBe(true);
    expect(bdl.every((o) => o.benchmarkStatus !== "within_screening_benchmark" && o.benchmarkStatus !== "outside_screening_benchmark")).toBe(true);
    // ND is distinct (none in this pack, but the engine treats it separately)
    expect(engine.evaluate("Lead", "not_detected", null)).toBe("no_class_b_benchmark");
    expect(engine.evaluate("BOD", "not_detected", null)).toBe("indeterminate");
  });

  it("D07 missing 2025 Durga tables are not_in_source windows, not fabricated rows", () => {
    for (const id of ["bairagarh-sant-hirdaram-kund", "malikhedi-kund"]) {
      expect(observations.some((o) => o.siteId === id && o.year === 2025 && o.festival === "Durga")).toBe(false);
      const s = rankSites(observations, sites, engine, DEFAULT_FILTERS).find((x) => x.id === id)!;
      expect(s.coverage.sourceAbsentWindows).toContainEqual({ year: 2025, festival: "Durga" });
      expect(s.coverage.phaseCoverage.filter((c) => c.year === 2025 && c.festival === "Durga").every((c) => c.state === "not_in_source")).toBe(true);
      expect(s.topReasons.some((r) => r.code === "absent_window" && r.coverageAssertion?.year === 2025)).toBe(true);
    }
  });

  it("S08 adding a not-sampled row never lowers severity or fabricates a pass", () => {
    const site = sites.find((s) => s.id === "khatlapura-ghat")!;
    const base = [obs({ parameter: "Dissolved oxygen", value: 3 }), obs({ parameter: "BOD", value: 6 }), obs({ parameter: "pH", value: 7 })];
    const a = summariseSite(site, base, engine, DEFAULT_FILTERS);
    const b = summariseSite(site, [...base, obs({ parameter: "Dissolved oxygen", value: null, phase: "pre" })], engine, DEFAULT_FILTERS);
    const c = summariseSite(site, [...base, obs({ parameter: "BOD", value: null, status: "below_detection_limit", printed: "BDL", phase: "after" })], engine, DEFAULT_FILTERS);
    expect(b.concernIndex).toBe(a.concernIndex);
    expect(c.concernIndex).toBe(a.concernIndex);
    expect(b.coverage.explicitNotSampledSlots).toBe(1);
    expect(b.coverage.numericRatio!).toBeLessThan(a.coverage.numericRatio!);
  });

  it("S09 a site without enough numeric comparisons is insufficient_evidence, never zero", () => {
    const site = sites.find((s) => s.id === "prempura-ghat")!;
    const s = summariseSite(site, [obs({ siteId: site.id, parameter: "Dissolved oxygen", value: 7 }), obs({ siteId: site.id, parameter: "BOD", value: null })], engine, DEFAULT_FILTERS);
    expect(s.concernIndex).toBeNull();
    expect(s.historicalConcern).toBe("insufficient_evidence");
    expect(s.rank).toBeNull();
    const none = summariseSite(site, [], engine, DEFAULT_FILTERS);
    expect(none.concernIndex).toBeNull();
    expect(none.samplingPriority).not.toBe("routine_verify");
  });
});
