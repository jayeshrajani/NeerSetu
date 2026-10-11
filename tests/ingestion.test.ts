import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { manifest, observations, rawObservations, sites } from "@/lib/data";
import { DATA_DIR, readCsv } from "./helpers";

const PRIMARY = "bhopal_ghats_2023_2025.csv";

describe("D — ingestion and audit", () => {
  const primary = readCsv(PRIMARY);

  it("D01 primary file has 1,524 data rows and the recorded hash", () => {
    expect(primary.rows).toHaveLength(1524);
    expect(rawObservations).toHaveLength(1524);
    expect(manifest.primaryRowCount).toBe(1524);
    const sha = createHash("sha256").update(readFileSync(join(DATA_DIR, PRIMARY))).digest("hex");
    expect(manifest.inputSha256[PRIMARY]).toBe(sha);
  });

  it("D01b every observation keeps its CSV line and the line holds the same printed value", () => {
    for (const o of observations) {
      const row = primary.rows[o.sourceCsvLine - 2]!;
      expect(row.value_as_printed).toBe(o.valueAsPrinted);
      expect(row.parameter).toBe(o.parameter);
      expect(row.site).toBe(o.siteCanonical);
    }
    expect(new Set(observations.map((o) => o.id)).size).toBe(1524);
  });

  it("D02 exactly seven standardised sites with stable IDs", () => {
    const labels = new Set(primary.rows.map((r) => r.site));
    expect(labels.size).toBe(7);
    expect(sites.map((s) => s.id)).toEqual([
      "bairagarh-sant-hirdaram-kund",
      "khatlapura-ghat",
      "prempura-ghat",
      "rani-kamlapati-kamla-park",
      "hathaikheda-dam-kund",
      "malikhedi-kund",
      "shahpura-lake-ghat",
    ]);
    for (const s of sites) expect(labels.has(s.canonicalName)).toBe(true);
  });

  it("D03 2025 sample is a subset of primary and never added to totals", () => {
    const sample = readCsv("sample_bhopal_2025.csv");
    expect(sample.rows).toHaveLength(453);
    const key = (r: Record<string, string>) => primary.header.map((h) => r[h]).join("\u001f");
    const prim = new Map<string, number>();
    for (const r of primary.rows) prim.set(key(r), (prim.get(key(r)) ?? 0) + 1);
    for (const r of sample.rows) {
      const n = prim.get(key(r)) ?? 0;
      expect(n).toBeGreaterThan(0);
      prim.set(key(r), n - 1);
    }
    expect(observations.length).not.toBe(1524 + 453);
    expect(manifest.sampleCheck.isSubset).toBe(true);
  });

  it("D08 no duplicate natural keys; anomalies would be listed in the manifest", () => {
    const keys = new Set(observations.map((o) => [o.siteId, o.year, o.festival, o.phase, o.parameter].join("|")));
    expect(keys.size).toBe(observations.length);
    expect(observations.filter((o) => o.measurementStatus === "unparsed")).toHaveLength(0);
    expect(Array.isArray(manifest.validationWarnings)).toBe(true);
  });

  it("D09 statewide file: 879 needs_check rows documented, never in rankings", () => {
    const sw = readCsv("mp_immersion_sites_2023_2025.csv");
    expect(sw.rows).toHaveLength(21600);
    expect(sw.rows.filter((r) => r.needs_check === "yes")).toHaveLength(879);
    expect(observations.every((o) => o.sourceCsv === PRIMARY)).toBe(true);
    const audit = readFileSync(join(process.cwd(), "docs", "DATA_AUDIT.md"), "utf-8");
    expect(audit).toContain("879");
  });

  it("D10 all thirteen parameters and printed fields survive normalisation", () => {
    expect(new Set(observations.map((o) => o.parameter)).size).toBe(13);
    const printed = new Set(observations.map((o) => o.parameterAsPrinted));
    expect(printed.has("D.Oxygen")).toBe(true);
    expect(printed.has("suspended-solids")).toBe(true);
    expect(observations.every((o) => o.siteAsPrinted.length > 0)).toBe(true);
    expect(observations.some((o) => o.unitAssumed === "µS/cm")).toBe(true);
  });

  it("cross-check: TS benchmark engine agrees with the independent Python counts", () => {
    const cc = manifest.crossCheck;
    const out = (p: string) => observations.filter((o) => o.parameter === p && o.benchmarkStatus === "outside_screening_benchmark").length;
    const num = (p: string) => observations.filter((o) => o.parameter === p && o.measurementStatus === "numeric").length;
    expect(num("Dissolved oxygen")).toBe(cc.doNumeric);
    expect(out("Dissolved oxygen")).toBe(cc.doBelow5);
    expect(num("BOD")).toBe(cc.bodNumeric);
    expect(out("BOD")).toBe(cc.bodAbove3);
    expect(out("pH")).toBe(cc.phOutside6_5to8_5);
    // published guide statements
    expect([cc.doBelow5, cc.doNumeric]).toEqual([42, 116]);
    expect([cc.bodAbove3, cc.bodNumeric]).toEqual([100, 112]);
  });
});
