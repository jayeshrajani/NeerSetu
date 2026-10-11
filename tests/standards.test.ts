import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { StandardsEngine, parseCriteriaCsv, parseRule } from "@/lib/standards";
import { engine, observations, standardsFile } from "@/lib/data";
import { DATA_DIR } from "./helpers";

const csv = readFileSync(join(DATA_DIR, "cpcb_water_quality_criteria.csv"), "utf-8");

describe("S — standards engine", () => {
  it("S01 Class B parsed from the supplied criteria CSV; BOD maps to 'BOD (5 days 20C)'", () => {
    const criteria = parseCriteriaCsv(csv);
    expect(criteria).toHaveLength(19);
    const fromCsv = new StandardsEngine({
      criteria,
      classBParameterMap: { "Dissolved oxygen": "CPCB-B-dissolved-oxygen", BOD: "CPCB-B-bod-5-days-20c", pH: "CPCB-B-ph" },
    });
    expect(fromCsv.ruleFor("BOD")).toMatchObject({ parameter: "BOD (5 days 20C)", limitType: "max", max: 3 });
    expect(fromCsv.ruleFor("Dissolved oxygen")).toMatchObject({ limitType: "min", min: 5, unit: "mg/l" });
    expect(fromCsv.ruleFor("pH")).toMatchObject({ limitType: "range", min: 6.5, max: 8.5 });
    // generated standards.json agrees with a fresh parse
    expect(standardsFile.criteria.map((c) => c.id)).toEqual(criteria.map((c) => c.id));
    expect(engine.ruleFor("BOD")?.criterionId).toBe("CPCB-B-bod-5-days-20c");
    // no loose matching
    expect(engine.ruleFor("bod")).toBeNull();
    expect(engine.ruleFor("BOD (5 days 20C)")).toBeNull();
  });

  it("S01b range limits like '6-9' and '6.0-8.5' parse", () => {
    const crit = parseCriteriaCsv(csv);
    expect(parseRule(crit.find((c) => c.id === "CPCB-C-ph")!)).toMatchObject({ min: 6, max: 9 });
    expect(parseRule(crit.find((c) => c.id === "CPCB-E-ph")!)).toMatchObject({ min: 6, max: 8.5 });
  });

  it("S02 DO boundaries", () => {
    expect(engine.evaluate("Dissolved oxygen", "numeric", 4.9)).toBe("outside_screening_benchmark");
    expect(engine.evaluate("Dissolved oxygen", "numeric", 5)).toBe("within_screening_benchmark");
    expect(engine.evaluate("Dissolved oxygen", "numeric", 0)).toBe("outside_screening_benchmark");
    expect(engine.severity("Dissolved oxygen", 0)).toBe(1);
    expect(engine.severity("Dissolved oxygen", 5)).toBe(0);
  });

  it("S03 BOD boundaries", () => {
    expect(engine.evaluate("BOD", "numeric", 3)).toBe("within_screening_benchmark");
    expect(engine.evaluate("BOD", "numeric", 3.1)).toBe("outside_screening_benchmark");
    expect(engine.severity("BOD", 6)).toBe(1);
    expect(engine.severity("BOD", 4.5)).toBeCloseTo(0.5);
  });

  it("S04 pH boundaries", () => {
    expect(engine.evaluate("pH", "numeric", 6.49)).toBe("outside_screening_benchmark");
    expect(engine.evaluate("pH", "numeric", 8.51)).toBe("outside_screening_benchmark");
    expect(engine.evaluate("pH", "numeric", 6.5)).toBe("within_screening_benchmark");
    expect(engine.evaluate("pH", "numeric", 8.5)).toBe("within_screening_benchmark");
    expect(engine.severity("pH", 9.5)).toBeCloseTo(0.5);
  });

  it("S04b BDL, ND, not sampled and unparsed are indeterminate, never pass/fail", () => {
    for (const s of ["below_detection_limit", "not_detected", "not_sampled", "unparsed"] as const) {
      expect(engine.evaluate("Dissolved oxygen", s, null)).toBe("indeterminate");
    }
  });

  it("S05 parameters with no Class B criterion return no_class_b_benchmark", () => {
    for (const p of ["COD", "Total solids", "Dissolved solids", "Suspended solids", "Turbidity", "Conductivity", "Chromium", "Lead", "Zinc", "Copper"]) {
      expect(engine.evaluate(p, "numeric", 1)).toBe("no_class_b_benchmark");
    }
    // Class E conductivity limit is not applied
    const cond = observations.filter((o) => o.parameter === "Conductivity");
    expect(cond.every((o) => o.benchmarkStatus === "no_class_b_benchmark")).toBe(true);
  });

  it("S06 total coliform is listed but unmeasured; no coliform observations are created", () => {
    expect(standardsFile.unmeasuredClassBParameters).toEqual(["CPCB-B-total-coliform"]);
    expect(observations.some((o) => /coliform/i.test(o.parameter))).toBe(false);
  });
});
