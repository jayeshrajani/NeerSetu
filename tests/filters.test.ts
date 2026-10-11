import { describe, expect, it } from "vitest";
import { engine, observations, sites } from "@/lib/data";
import { DEFAULT_FILTERS, describeScope, filtersToQuery, parseFilters, scopeObservations } from "@/lib/filters";
import { rankSites } from "@/lib/scoring";
import type { Filters } from "@/types/ghatwatch";

describe("S12 / U02 / U09 — filters", () => {
  it("parses valid query state and rejects unknown values without silently changing scope", () => {
    expect(parseFilters({ year: "2025", festival: "Durga", phase: "pre" })).toEqual({
      ok: true,
      filters: { year: 2025, festival: "Durga", phase: "pre", parameter: "all" },
    });
    const bad = parseFilters({ year: "2031", festival: "Diwali", phase: "<script>" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors).toHaveLength(3);
    expect(parseFilters({}).ok).toBe(true);
    expect(filtersToQuery({ year: 2024, festival: "all" })).toBe("?year=2024");
  });

  it("S12 filtered ranking uses only matching facts and refreshes reasons/IDs", () => {
    const f: Filters = { ...DEFAULT_FILTERS, year: 2024, festival: "Ganesh" };
    const scoped = new Set(scopeObservations(observations, f).map((o) => o.id));
    const r = rankSites(observations, sites, engine, f);
    for (const s of r) {
      for (const w of s.windows) {
        expect(w.year).toBe(2024);
        expect(w.festival).toBe("Ganesh");
      }
      for (const reason of s.topReasons) reason.observationIds.forEach((id) => expect(scoped.has(id)).toBe(true));
      expect(s.coverage.nominalWindows).toBe(1);
    }
    expect(describeScope(f)).toBe("2024 · Ganesh · all phases");
    const all = rankSites(observations, sites, engine, DEFAULT_FILTERS);
    expect(r.map((s) => s.concernIndex)).not.toEqual(all.map((s) => s.concernIndex));
  });

  it("parameter view filter does not change the scoring", () => {
    const a = rankSites(observations, sites, engine, DEFAULT_FILTERS);
    const b = rankSites(observations, sites, engine, { ...DEFAULT_FILTERS, parameter: "Lead" });
    expect(b.map((s) => [s.id, s.concernIndex])).toEqual(a.map((s) => [s.id, s.concernIndex]));
  });

  it("2025 Durga scope: absent sites show insufficient evidence + retest, not low concern", () => {
    const r = rankSites(observations, sites, engine, { ...DEFAULT_FILTERS, year: 2025, festival: "Durga" });
    for (const id of ["bairagarh-sant-hirdaram-kund", "malikhedi-kund"]) {
      const s = r.find((x) => x.id === id)!;
      expect(s.historicalConcern).toBe("insufficient_evidence");
      expect(s.rank).toBeNull();
      expect(s.samplingPriority).toBe("priority_retest");
    }
  });
});
