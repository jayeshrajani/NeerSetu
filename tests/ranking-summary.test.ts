import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/brief/route";
import { buildBriefFacts } from "@/lib/brief-facts";
import { DEFAULT_FILTERS } from "@/lib/filters";
import { rankingFallback } from "@/lib/ranking-summary";
import { userPrompt } from "@/lib/ai/provider";

const siteIds = ["bairagarh-sant-hirdaram-kund"];
const built = buildBriefFacts(siteIds, DEFAULT_FILTERS);
if (!built.ok) throw new Error(built.error);
const facts = built.facts;
const narrative = {
  purposeEn: "Review Bairagarh based on past tests. Current water quality is unknown.",
  purposeHi: "पुराने परीक्षणों के आधार पर बैरागढ़ की जांच करें। अभी की जल गुणवत्ता अज्ञात है।",
  actionsEn: ["Take fresh water samples.", "Check the missing records."],
  actionsHi: ["पानी के नए नमूने लें।", "अधूरे रिकॉर्ड की जांच करें।"],
  evidenceIdsUsed: [facts.allowedEvidenceIds[0]],
  siteIdsUsed: siteIds,
};

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

function request() {
  return new Request("http://localhost/api/brief", { method: "POST", body: JSON.stringify({ siteIds, presentation: "summary" }) });
}

function providerResponse(output: unknown) {
  vi.stubEnv("AI_PROVIDER", "cerebras");
  vi.stubEnv("AI_MODEL", "qwen-3.8-27b");
  vi.stubEnv("CEREBRAS_API_KEY", "test-key");
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] })));
}

describe("Plain-language ranking summaries", () => {
  it("fallback stays bilingual and separates past data from current status", () => {
    const fallback = rankingFallback(facts);
    expect(fallback.purposeEn).toContain("current water quality is unknown");
    expect(fallback.purposeHi).toContain("अज्ञात");
    expect(fallback.purposeEn).toContain(facts.sites[0]!.name);
  });

  it("summary prompt requests short wording without a hard-coded festival date", () => {
    const prompt = userPrompt({ ...facts, presentation: "summary" });
    expect(prompt).toContain("Avoid acronyms, scores, numbers");
    expect(prompt).not.toContain("20 October 2026");
  });

  it("does not imply a rank when evidence is insufficient", () => {
    const fallback = rankingFallback({ ...facts, sites: facts.sites.map((site) => ({ ...site, rank: null })) });
    expect(fallback.purposeEn).toContain("too little evidence to rank");
    expect(fallback.purposeEn).not.toContain("first in this ranking");
  });

  it("returns validated bilingual wording without full brief noise", async () => {
    const fetchSpy = providerResponse(narrative);
    const response = await POST(request());
    const result = await response.json();
    expect(result).toMatchObject({ mode: "ai", provider: "cerebras", summary: { purposeEn: narrative.purposeEn } });
    expect(result.briefEn).toBeUndefined();
    expect(result.summary.actionsEn).toEqual(rankingFallback(facts).actionsEn);
    expect(result.summary.actionsHi).toEqual(rankingFallback(facts).actionsHi);
    expect(JSON.stringify(result)).not.toContain("test-key");
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string)).toMatchObject({ max_tokens: 1500, reasoning_effort: "none" });
  });

  it("rejects unsupported claims and retains the fallback", async () => {
    providerResponse({ ...narrative, purposeEn: "The water at Bairagarh is safe for immersion." });
    expect(await (await POST(request())).json()).toMatchObject({ mode: "template", reason: "validation_failed", summary: rankingFallback(facts) });
  });

  it("rejects uncited or overly long summaries", async () => {
    providerResponse({ ...narrative, evidenceIdsUsed: [] });
    expect(await (await POST(request())).json()).toMatchObject({ mode: "template", reason: "validation_failed" });
    vi.restoreAllMocks();
    providerResponse({ ...narrative, actionsEn: ["Take fresh samples. ".repeat(12)] });
    expect(await (await POST(request())).json()).toMatchObject({ mode: "template", reason: "validation_failed" });
  });

  it("falls back without calling a provider when AI is off", async () => {
    vi.stubEnv("AI_PROVIDER", "none");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await (await POST(request())).json()).toMatchObject({ mode: "template", reason: "not_configured" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});