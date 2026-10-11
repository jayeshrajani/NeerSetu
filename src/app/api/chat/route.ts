import { chatRequestSchema, type ChatResponse } from "@/lib/chat";
import { buildChatGrounding } from "@/lib/chat-grounding";
import { generateChat } from "@/lib/ai/chat-provider";
import { timeoutFromEnv } from "@/lib/ai";
import { ProviderError } from "@/lib/ai/provider";
import { getSite } from "@/lib/data";

export const dynamic = "force-dynamic";
const MAX_BODY = 32_000;
const hits = new Map<string, { count: number; until: number }>();
const bad = (error: string, status = 400) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return bad("This chat accepts requests from NeerSetu only.", 403);
  if (Number(request.headers.get("content-length")) > MAX_BODY) return bad("Conversation too long. Start a new chat.", 413);
  const reader = request.body?.getReader();
  if (!reader) return bad("Ask a question first.");
  let text = "";
  let bytes = 0;
  const decoder = new TextDecoder();
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BODY) {
        await reader.cancel();
        return bad("Conversation too long. Start a new chat.", 413);
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } catch {
    return bad("Could not read the question. Try again.");
  } finally {
    reader.releaseLock();
  }
  let json: unknown;
  try { json = JSON.parse(text); } catch { return bad("Chat request must be JSON."); }
  const parsed = chatRequestSchema.safeParse(json);
  if (!parsed.success) return bad("Please send a question of up to 4000 characters with a short conversation history.");
  if (parsed.data.siteId && !getSite(parsed.data.siteId)) return bad("Unknown ghat.");
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const current = hits.get(key);
  const entry = current && current.until > now ? current : { count: 0, until: now + 60_000 };
  entry.count += 1;
  hits.set(key, entry);
  if (hits.size > 5000) for (const [id, hit] of hits) if (hit.until <= now) hits.delete(id);
  if (hits.size > 5000 || entry.count > 12) return bad("Too many questions at once. Please try again shortly.", 429);
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, request.signal]);
  const timer = setTimeout(() => controller.abort(), timeoutFromEnv());
  try {
    const grounding = buildChatGrounding(parsed.data);
    const answer = await generateChat(parsed.data, grounding, signal);
    const used = new Set([...answer.answer, ...answer.nextSteps].flatMap((block) => [...block.evidenceIds, ...block.guideIds]));
    const result: ChatResponse = { mode: "ai", answer, sources: grounding.sources.filter((source) => used.has(source.id)) };
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (signal.aborted) return bad("The AI took too long. Your question is still here; please retry.", 504);
    if (error instanceof ProviderError && error.kind === "not_configured") return bad("Conversation AI is not configured on this server. The evidence and planning tools remain available.", 503);
    if (error instanceof ProviderError && error.kind === "bad_output") return bad("That reply did not pass the evidence checks. Please retry or ask a more specific question.", 502);
    return bad("The AI service is unavailable right now. Your question is still here; please retry.", 502);
  } finally {
    clearTimeout(timer);
  }
}

export function GET() { return bad("Use POST.", 405); }