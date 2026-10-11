import { type BriefNarrativeProvider, ProviderError, SYSTEM_PROMPT, extractJson, readBounded, userPrompt } from "@/lib/ai/provider";

export function anthropicProvider(apiKey: string, model: string): BriefNarrativeProvider {
  return {
    id: "anthropic",
    configured: true,
    async generate(facts, signal) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1500,
          temperature: 0.2,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt(facts) }],
        }),
      });
      const text = await readBounded(res);
      if (!res.ok) throw new ProviderError(`Anthropic HTTP ${res.status}`, "http");
      let body: { content?: { type: string; text?: string }[] };
      try {
        body = JSON.parse(text);
      } catch {
        throw new ProviderError("Anthropic returned non-JSON", "bad_output");
      }
      const out = (body.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
      return { json: extractJson(out), model };
    },
  };
}
