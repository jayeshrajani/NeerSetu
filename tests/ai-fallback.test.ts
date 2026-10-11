import { describe, expect, it, vi } from "vitest";
import { buildBriefFacts } from "@/lib/brief-facts";
import { composeNarrative, providerFromEnv } from "@/lib/ai";
import type { BriefNarrativeProvider } from "@/lib/ai/provider";
import { validateGeneratedBrief } from "@/lib/brief-validation";
import { DEFAULT_FILTERS } from "@/lib/filters";

const facts = (() => {
  const r = buildBriefFacts(["bairagarh-sant-hirdaram-kund"], DEFAULT_FILTERS);
  if (!r.ok) throw new Error(r.error);
  return r.facts;
})();

const good = () => ({
  purposeEn: "Plan fresh DO, BOD and pH sampling at Bairagarh (Sant Hirdaram) kund before Durga visarjan on 20 October 2026.",
  purposeHi: "दुर्गा विसर्जन (20 अक्टूबर 2026) से पहले बैरागढ़ (संत हिरदाराम) कुंड पर DO, BOD और pH का नया नमूना लेने की योजना।",
  actionsEn: ["Take a pre-immersion sample.", "Inspect the kund for cleaning needs."],
  actionsHi: ["विसर्जन-पूर्व नमूना लें।", "सफ़ाई हेतु कुंड का निरीक्षण करें।"],
  evidenceIdsUsed: [facts.allowedEvidenceIds[0]!],
  siteIdsUsed: ["bairagarh-sant-hirdaram-kund"],
});

const fake = (json: unknown, delayMs = 0): BriefNarrativeProvider => ({
  id: "anthropic",
  configured: true,
  generate: (_f, signal) =>
    new Promise((resolve, reject) => {
      const t = setTimeout(() => resolve({ json, model: "test-model" }), delayMs);
      signal.addEventListener("abort", () => {
        clearTimeout(t);
        const e = new Error("aborted");
        e.name = "AbortError";
        reject(e);
      });
    }),
});

describe("U07 / U08 — AI optional, guarded, with fallback", () => {
  it("AI_PROVIDER=none or missing key/model → not configured, template used", async () => {
    expect(providerFromEnv({ AI_PROVIDER: "none" }).configured).toBe(false);
    expect(providerFromEnv({ AI_PROVIDER: "anthropic", AI_MODEL: "x" }).configured).toBe(false);
    expect(providerFromEnv({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" }).configured).toBe(false);
    expect(providerFromEnv({ AI_PROVIDER: "openai_compatible", AI_MODEL: "m", OPENAI_COMPATIBLE_BASE_URL: "http://169.254.169.254", OPENAI_COMPATIBLE_API_KEY: "k" }).configured).toBe(false);
    expect(providerFromEnv({ AI_PROVIDER: "cerebras", AI_MODEL: "m", CEREBRAS_API_KEY: "k" }).id).toBe("cerebras");
    const r = await composeNarrative(facts, providerFromEnv({}), 1000);
    expect(r).toMatchObject({ mode: "template", reason: "not_configured" });
  });

  it("valid grounded output is accepted", async () => {
    const r = await composeNarrative(facts, fake(good()), 1000);
    expect(r.mode).toBe("ai");
  });

  it("U08 fake evidence/site IDs, invented numbers and unsafe claims are rejected", () => {
    expect(validateGeneratedBrief({ ...good(), evidenceIdsUsed: ["bhp-L9999-deadbeef"] }, facts).ok).toBe(false);
    expect(validateGeneratedBrief({ ...good(), siteIdsUsed: ["khatlapura-ghat"] }, facts).ok).toBe(false);
    expect(validateGeneratedBrief({ ...good(), purposeEn: "DO fell to 1.7 mg/l at Bairagarh (Sant Hirdaram) kund last week." }, facts).ok).toBe(false);
    expect(validateGeneratedBrief({ ...good(), purposeEn: "The water at Bairagarh is safe for immersion after cleaning work." }, facts).ok).toBe(false);
    expect(validateGeneratedBrief({ ...good(), purposeEn: "Low oxygen at Bairagarh was caused by idol immersion every year." }, facts).ok).toBe(false);
    expect(validateGeneratedBrief({ ...good(), purposeHi: "बैरागढ़ का पानी स्वास्थ्य के लिए हानिकारक है और यह गंभीर है।" }, facts).ok).toBe(false);
    expect(validateGeneratedBrief({ ...good(), actionsEn: ["<script>alert(1)</script> sample"] }, facts).ok).toBe(false);
    expect(validateGeneratedBrief({ ...good(), purposeEn: "Prempura ghat also needs sampling before the festival." }, facts).ok).toBe(false);
    expect(validateGeneratedBrief({ ...good(), extra: 1 }, facts).ok).toBe(false);
  });

  it("invalid output, provider error and timeout all fall back to the template", async () => {
    expect(await composeNarrative(facts, fake({ nope: true }), 1000)).toMatchObject({ mode: "template", reason: "validation_failed" });
    const failing: BriefNarrativeProvider = { id: "cerebras", configured: true, generate: async () => Promise.reject(new Error("HTTP 401")) };
    expect(await composeNarrative(facts, failing, 1000)).toMatchObject({ mode: "template", reason: "provider_error" });
    vi.useFakeTimers();
    const p = composeNarrative(facts, fake(good(), 10_000), 1000);
    vi.advanceTimersByTime(1500);
    expect(await p).toMatchObject({ mode: "template", reason: "timeout" });
    vi.useRealTimers();
  });

  it("an invalid key reaching the real adapter degrades gracefully (network mocked)", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"error":"invalid x-api-key"}', { status: 401 }));
    const p = providerFromEnv({ AI_PROVIDER: "anthropic", AI_MODEL: "configured-model", ANTHROPIC_API_KEY: "bad" });
    const r = await composeNarrative(facts, p, 2000);
    expect(r).toMatchObject({ mode: "template", reason: "provider_error" });
    expect(JSON.stringify(r)).not.toContain("bad");
    spy.mockRestore();
  });
});
