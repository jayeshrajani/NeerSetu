import { type BriefNarrativeProvider, ProviderError, SYSTEM_PROMPT, extractJson, readBounded, userPrompt } from "@/lib/ai/provider";

/** OpenAI-style /chat/completions. Used for Cerebras (https://api.cerebras.ai/v1) and any server-configured compatible endpoint. */
export function openAiCompatibleProvider(
  id: "cerebras" | "openai_compatible",
  baseUrl: string,
  apiKey: string,
  model: string,
): BriefNarrativeProvider {
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  return {
    id,
    configured: true,
    async generate(facts, signal) {
      const res = await fetch(url, {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 1500,
          ...(facts.presentation === "summary" && id === "cerebras" && model === "qwen-3.8-27b" ? { reasoning_effort: "none" } : {}),
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt(facts) },
          ],
        }),
      });
      const text = await readBounded(res);
      if (!res.ok) throw new ProviderError(`${id} HTTP ${res.status}`, "http");
      let body: { choices?: { message?: { content?: string | null } }[] };
      try {
        body = JSON.parse(text);
      } catch {
        throw new ProviderError(`${id} returned non-JSON`, "bad_output");
      }
      return { json: extractJson(body.choices?.[0]?.message?.content ?? ""), model };
    },
  };
}
