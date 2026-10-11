import { describe, expect, it } from "vitest";
import { buildBriefFacts } from "@/lib/brief-facts";
import { briefToText, renderBrief, wordCount } from "@/lib/brief-templates";
import { DEFAULT_FILTERS } from "@/lib/filters";
import { getObservation } from "@/lib/data";

const CAUSAL = /\b(caused|causes|because of immersion|due to immersion)\b/i;
const SAFE = /\b(is safe|are safe|water is clean|approved for immersion|certified)\b/i;

describe("U04 / T07 — deterministic bilingual brief", () => {
  it("rejects empty, >3, duplicate and unknown selections", () => {
    expect(buildBriefFacts([], DEFAULT_FILTERS).ok).toBe(false);
    expect(buildBriefFacts(["a", "b", "c", "d"], DEFAULT_FILTERS).ok).toBe(false);
    expect(buildBriefFacts(["khatlapura-ghat", "khatlapura-ghat"], DEFAULT_FILTERS).ok).toBe(false);
    expect(buildBriefFacts(["../etc/passwd"], DEFAULT_FILTERS).ok).toBe(false);
  });

  it("renders English and Hindi with cited values, unknowns, actions and sources", () => {
    const r = buildBriefFacts(["bairagarh-sant-hirdaram-kund", "rani-kamlapati-kamla-park"], DEFAULT_FILTERS);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const en = renderBrief(r.facts, "en");
    const hi = renderBrief(r.facts, "hi");
    const enT = briefToText(en);
    const hiT = briefToText(hi);
    expect(en.sections.map((s) => s.id)).toEqual(["purpose", "evidence", "unknowns", "actions", "sources"]);
    expect(hi.sections.map((s) => s.id)).toEqual(["purpose", "evidence", "unknowns", "actions", "sources"]);
    expect(hiT).toMatch(/[\u0900-\u097F]/);
    expect(enT).toContain("DO 0 mg/l");
    expect(hiT).toContain("0 mg/l");
    expect(enT).toMatch(/no 2025 Durga table/);
    expect(enT).toMatch(/possibly two places/);
    expect(enT).toMatch(/Coliform not measured/);
    expect(enT).toMatch(/unverified/);
    expect(enT).toContain("Reviewed by officer: [ ]");
    expect(enT).not.toMatch(CAUSAL);
    expect(enT).not.toMatch(SAFE);
    // one page per language: ≤ 250 words for one ghat, ≤ 500 for the 3-ghat maximum
    expect(wordCount(en)).toBeLessThan(450);
    const one = buildBriefFacts(["khatlapura-ghat"], DEFAULT_FILTERS);
    if (one.ok) expect(wordCount(renderBrief(one.facts, "en"))).toBeLessThanOrEqual(250);
    const three = buildBriefFacts(["bairagarh-sant-hirdaram-kund", "rani-kamlapati-kamla-park", "malikhedi-kund"], DEFAULT_FILTERS);
    if (three.ok) expect(wordCount(renderBrief(three.facts, "en"))).toBeLessThanOrEqual(500);
  });

  it("every numeric evidence line in the brief is a real observation with the same printed value", () => {
    const r = buildBriefFacts(["khatlapura-ghat", "shahpura-lake-ghat", "prempura-ghat"], DEFAULT_FILTERS);
    if (!r.ok) throw new Error(r.error);
    for (const s of r.facts.sites)
      for (const e of s.evidence) {
        const o = getObservation(e.evidenceId)!;
        expect(o.valueAsPrinted).toBe(e.valuePrinted);
        expect(o.numericValue).toBe(e.numericValue);
        expect(r.facts.citations.find((c) => c.ref === e.ref)?.evidenceId).toBe(e.evidenceId);
      }
  });

  it("reviewed marker is only checked when the officer ticks it", () => {
    const r = buildBriefFacts(["khatlapura-ghat"], DEFAULT_FILTERS);
    if (!r.ok) throw new Error(r.error);
    expect(briefToText(renderBrief(r.facts, "hi", undefined, true))).toContain("अधिकारी द्वारा समीक्षा: [x]");
  });
});
