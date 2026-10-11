import { describe, expect, it, vi } from "vitest";
import { generateChat } from "@/lib/ai/chat-provider";
import { buildChatGrounding, validateChatAnswer } from "@/lib/chat-grounding";
import { extractJson } from "@/lib/ai/provider";
import { POST } from "@/app/api/chat/route";
import { PAST_READINGS_QUESTION, type ChatAnswer } from "@/lib/chat";

describe.skipIf(process.env.NEERSETU_LIVE_CHAT !== "1")("Live chat quality (explicit opt-in)", () => {
  it.each([
    "What was the lowest dissolved oxygen at Khatlapura during Durga, and what should we do about it?",
    "Which past readings at Khatlapura need a fresh check?",
    "Which past readings at Khatlapura need a fresh check?",
    "Which past readings at Khatlapura need a fresh check?",
  ])("answers %s with evidence and actions", async (question) => {
    process.loadEnvFile(".env");
    const request = { messages: [{ role: "user" as const, content: question }] };
    const grounding = buildChatGrounding(request);
    const original = globalThis.fetch;
    let modelText = "";
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const response = await original(input, init);
      const body = await response.clone().json();
      modelText = body.choices?.[0]?.message?.content ?? "";
      return response;
    });
    try {
      let answer: ChatAnswer;
      if (question === PAST_READINGS_QUESTION) {
        const response = await POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify(request) }));
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.mode).toBe("evidence");
        expect(spy).not.toHaveBeenCalled();
        answer = validateChatAnswer(body.answer, grounding);
      } else {
        await generateChat(request, grounding, AbortSignal.timeout(60_000));
        answer = validateChatAnswer(extractJson(modelText), grounding);
      }
      expect(answer.language).toBe("en");
      expect(answer.answer.some((block) => block.evidenceIds.length > 0)).toBe(true);
      if (question.includes("lowest dissolved oxygen")) {
        const lowest = Math.min(...grounding.evidence.filter((item) => item.status === "numeric").map((item) => Number(item.value)));
        expect(answer.answer.some((block) => block.text.includes(String(lowest)) && block.evidenceIds.some((id) => grounding.evidence.some((item) => item.id === id && Number(item.value) === lowest)))).toBe(true);
      }
      expect(answer.nextSteps.length).toBeGreaterThan(0);
    } catch (error) {
      if (modelText) {
        try { validateChatAnswer(extractJson(modelText), grounding); } catch (rejection) {
          throw new Error(`Live answer rejected: ${rejection instanceof Error ? rejection.message : "invalid output"}\n${modelText}`);
        }
      }
      throw error;
    } finally {
      spy.mockRestore();
    }
  }, 65_000);
});