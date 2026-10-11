import { describe, expect, it } from "vitest";
import { engine, observations, sites } from "@/lib/data";
import { DEFAULT_FILTERS } from "@/lib/filters";
import { SCORING, bucketFor, rankSites, summariseSite, windowMetrics } from "@/lib/scoring";
import { obs } from "./helpers";

function shuffled<T>(a: T[], seed: number): T[] {
  const out = [...a];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

describe("S07–S11 — scoring and ranking", () => {
  const base = rankSites(observations, sites, engine, DEFAULT_FILTERS);

  it("S07 reordered input gives identical scores, order and reasons", () => {
    for (const seed of [1, 7, 42]) {
      const r = rankSites(shuffled(observations, seed), shuffled(sites, seed), engine, DEFAULT_FILTERS);
      expect(r.map((s) => [s.id, s.rank, s.concernIndex])).toEqual(base.map((s) => [s.id, s.rank, s.concernIndex]));
      expect(r.map((s) => s.topReasons.map((x) => [x.code, [...x.observationIds].sort()]))).toEqual(
        base.map((s) => s.topReasons.map((x) => [x.code, [...x.observationIds].sort()])),
      );
    }
  });

  it("formula: index recomputed from window metrics matches", () => {
    for (const s of base.filter((x) => x.concernIndex !== null)) {
      const w = s.windows;
      const ws = w.reduce((a, x) => a + x.yearWeight, 0);
      const msw = w.reduce((a, x) => a + x.yearWeight * x.meanSeverity, 0) / ws;
      const efw = w.reduce((a, x) => a + x.yearWeight * x.exceedanceFraction, 0) / ws;
      const rf = w.filter((x) => x.hasExceedance).length / w.length;
      expect(s.concernIndex).toBeCloseTo(100 * (0.45 * msw + 0.35 * efw + 0.2 * rf), 1);
      expect(s.historicalConcern).toBe(bucketFor(s.concernIndex));
    }
  });

  it("windows never combine Ganesh and Durga of the same year", () => {
    const s = sites.find((x) => x.id === "khatlapura-ghat")!;
    const w = windowMetrics(observations.filter((o) => o.siteId === s.id), engine);
    expect(w.map((x) => `${x.year} ${x.festival}`)).toEqual(["2023 Durga", "2023 Ganesh", "2024 Durga", "2024 Ganesh", "2025 Durga", "2025 Ganesh"]);
  });

  it("S10 ties resolve by evidence count then name; weights and denominators disclosed", () => {
    const site = sites[1]!;
    const a = summariseSite({ ...site, id: "a", canonicalName: "B site" }, [], engine, DEFAULT_FILTERS);
    expect(a.rank).toBeNull();
    const mk = (id: string, name: string, n: number) => {
      const rows = Array.from({ length: n }, (_, i) => obs({ siteId: site.id, parameter: i % 2 ? "BOD" : "Dissolved oxygen", value: i % 2 ? 6 : 2.5 }));
      return { site: { ...site, id, canonicalName: name }, rows: rows.map((r) => ({ ...r, siteId: id })) };
    };
    const x = mk("x", "Zeta", 4);
    const y = mk("y", "Alpha", 4);
    const z = mk("z", "Mid", 6);
    const ranked = rankSites([...x.rows, ...y.rows, ...z.rows], [x.site, y.site, z.site], engine, DEFAULT_FILTERS);
    expect(ranked.map((s) => s.id)).toEqual(["z", "y", "x"]);
    expect(SCORING.yearWeights).toEqual({ 2023: 1, 2024: 1.25, 2025: 1.5 });
    for (const s of base.filter((b) => b.components)) {
      expect(s.components!.validWindows).toBe(s.windows.length);
      expect(s.components!.numericComparable).toBe(s.windows.reduce((a, w) => a + w.numericComparable, 0));
    }
  });

  it("S11 sampling priority is independent of concern; identity flag coexists with urgency", () => {
    const rk = base.find((s) => s.id === "rani-kamlapati-kamla-park")!;
    expect(rk.needsIdentityVerification).toBe(true);
    expect(rk.identityConfidence).toBe("medium");
    expect(["urgent_retest", "priority_retest", "routine_verify"]).toContain(rk.samplingPriority);
    const bai = base.find((s) => s.id === "bairagarh-sant-hirdaram-kund")!;
    expect(bai.samplingPriority).toBe("urgent_retest");
    expect(bai.needsIdentityVerification).toBe(false);
    // a synthetic medium-identity site with a DO=0 is both urgent and flagged
    const site = sites.find((s) => s.id === "rani-kamlapati-kamla-park")!;
    const s = summariseSite(site, [obs({ siteId: site.id, parameter: "Dissolved oxygen", value: 0 })], engine, DEFAULT_FILTERS);
    expect(s.samplingPriority).toBe("urgent_retest");
    expect(s.needsIdentityVerification).toBe(true);
    expect(s.concernIndex).toBeNull();
  });

  it("every measurement-based reason cites real observation IDs; gap reasons cite a coverage assertion", () => {
    const ids = new Set(observations.map((o) => o.id));
    for (const s of base)
      for (const r of s.topReasons) {
        if (r.code === "absent_window") expect(r.coverageAssertion).toBeDefined();
        else if (r.code !== "identity" && r.code !== "no_comparable") {
          expect(r.observationIds.length).toBeGreaterThan(0);
          r.observationIds.forEach((id) => expect(ids.has(id)).toBe(true));
        }
      }
  });

  it("no site is labelled with a safe/approved concern", () => {
    for (const s of base) expect(["elevated", "moderate", "lower_observed", "insufficient_evidence"]).toContain(s.historicalConcern);
    expect(base.every((s) => s.operationalStatus2026 === "unverified")).toBe(true);
  });
});
