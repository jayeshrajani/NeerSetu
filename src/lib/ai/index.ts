import type { GroundedBriefFacts } from "@/lib/brief-facts";
import { validateGeneratedBrief, type GeneratedBilingualBrief } from "@/lib/brief-validation";
import { type BriefNarrativeProvider, ProviderError } from "@/lib/ai/provider";
import { noneProvider } from "@/lib/ai/none";
import { anthropicProvider } from "@/lib/ai/anthropic";
import { openAiCompatibleProvider } from "@/lib/ai/openai-compatible";

type Env = Record<string, string | undefined>;

const CEREBRAS_DEFAULT_BASE = "https://api.cerebras.ai/v1";

/** Provider chosen only from server env. The browser can never supply a URL or key. */
export function providerFromEnv(env: Env = process.env): BriefNarrativeProvider {
  const kind = (env.AI_PROVIDER ?? "none").trim().toLowerCase();
  const model = (env.AI_MODEL ?? "").trim();
  if (kind === "none" || !model) return noneProvider;
  if (kind === "anthropic" && env.ANTHROPIC_API_KEY) return anthropicProvider(env.ANTHROPIC_API_KEY, model);
  if (kind === "cerebras" && env.CEREBRAS_API_KEY)
    return openAiCompatibleProvider("cerebras", env.CEREBRAS_BASE_URL?.trim() || CEREBRAS_DEFAULT_BASE, env.CEREBRAS_API_KEY, model);
  if (kind === "openai_compatible" && env.OPENAI_COMPATIBLE_BASE_URL && env.OPENAI_COMPATIBLE_API_KEY) {
    if (!/^https:\/\//i.test(env.OPENAI_COMPATIBLE_BASE_URL)) return noneProvider;
    return openAiCompatibleProvider("openai_compatible", env.OPENAI_COMPATIBLE_BASE_URL, env.OPENAI_COMPATIBLE_API_KEY, model);
  }
  return noneProvider;
}

export function timeoutFromEnv(env: Env = process.env): number {
  const n = Number(env.AI_TIMEOUT_MS);
  return Number.isFinite(n) && n >= 1000 && n <= 60_000 ? n : 12_000;
}

export type NarrativeResult =
  | { mode: "ai"; provider: string; model: string; narrative: GeneratedBilingualBrief }
  | { mode: "template"; reason: "not_configured" | "timeout" | "provider_error" | "validation_failed"; notice: string; details?: string[] };

/** One attempt, bounded by timeout. Any failure → deterministic template stays authoritative. */
export async function composeNarrative(
  facts: GroundedBriefFacts,
  provider: BriefNarrativeProvider,
  timeoutMs: number,
): Promise<NarrativeResult> {
  if (!provider.configured) {
    return { mode: "template", reason: "not_configured", notice: "AI wording is not configured. Showing the evidence-based template." };
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const out = await provider.generate(facts, ctrl.signal);
    const v = validateGeneratedBrief(out.json, facts);
    if (!v.ok || !v.value) {
      return {
        mode: "template",
        reason: "validation_failed",
        notice: "AI wording did not pass fact checks. Showing the evidence-based template.",
        details: v.errors.slice(0, 5),
      };
    }
    return { mode: "ai", provider: provider.id, model: out.model, narrative: v.value };
  } catch (e) {
    const aborted = ctrl.signal.aborted || (e instanceof Error && e.name === "AbortError");
    if (aborted) return { mode: "template", reason: "timeout", notice: "AI wording timed out. Showing the evidence-based template." };
    const kind = e instanceof ProviderError ? e.kind : "http";
    return {
      mode: "template",
      reason: kind === "bad_output" ? "validation_failed" : "provider_error",
      notice: "AI wording is unavailable right now. Showing the evidence-based template.",
    };
  } finally {
    clearTimeout(timer);
  }
}
