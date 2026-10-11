import { type BriefNarrativeProvider, ProviderError } from "@/lib/ai/provider";

export const noneProvider: BriefNarrativeProvider = {
  id: "none",
  configured: false,
  async generate() {
    throw new ProviderError("AI provider is not configured", "not_configured");
  },
};
