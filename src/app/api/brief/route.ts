import { z } from "zod";
import { buildBriefFacts, MAX_BRIEF_SITES } from "@/lib/brief-facts";
import { renderBrief } from "@/lib/brief-templates";
import { parseFilters } from "@/lib/filters";
import { composeNarrative, providerFromEnv, timeoutFromEnv } from "@/lib/ai";

export const dynamic = "force-dynamic";

const MAX_BODY = 2048;
const bodySchema = z
  .object({
    siteIds: z.array(z.string().max(60)).min(1).max(MAX_BRIEF_SITES),
    filters: z
      .object({
        year: z.union([z.literal("all"), z.number().int()]).optional(),
        festival: z.string().max(10).optional(),
        phase: z.string().max(10).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

// Best-effort per-instance throttle so a public demo cannot burn model tokens.
const hits = new Map<string, number[]>();
function throttled(key: string, limit = 8, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > limit;
}

const bad = (message: string, status = 400) => Response.json({ error: message }, { status });

export async function POST(req: Request) {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > MAX_BODY) return bad("Request too large.", 413);
  let text: string;
  try {
    text = await req.text();
  } catch {
    return bad("Could not read request.");
  }
  if (text.length > MAX_BODY) return bad("Request too large.", 413);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return bad("Request must be JSON.");
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return bad("Invalid brief request: choose 1–3 known ghats and valid filters.");

  const fr = parsed.data.filters ?? {};
  const filters = parseFilters({
    year: fr.year === undefined ? undefined : String(fr.year),
    festival: fr.festival,
    phase: fr.phase,
  });
  if (!filters.ok) return bad("Invalid filters.");

  const facts = buildBriefFacts(parsed.data.siteIds, filters.filters);
  if (!facts.ok) return bad(facts.error);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (throttled(ip)) {
    return Response.json({
      mode: "template",
      notice: "Too many AI requests; showing the evidence-based template.",
      briefEn: renderBrief(facts.facts, "en"),
      briefHi: renderBrief(facts.facts, "hi"),
    });
  }

  const result = await composeNarrative(facts.facts, providerFromEnv(), timeoutFromEnv());
  if (result.mode === "ai") {
    const n = result.narrative;
    return Response.json({
      mode: "ai",
      provider: result.provider,
      evidenceIdsUsed: n.evidenceIdsUsed,
      briefEn: renderBrief(facts.facts, "en", { purpose: n.purposeEn, actions: n.actionsEn }),
      briefHi: renderBrief(facts.facts, "hi", { purpose: n.purposeHi, actions: n.actionsHi }),
    });
  }
  if (result.details) console.warn("[api/brief] AI output rejected:", result.details.join(" | "));
  return Response.json({
    mode: "template",
    notice: result.notice,
    reason: result.reason,
    briefEn: renderBrief(facts.facts, "en"),
    briefHi: renderBrief(facts.facts, "hi"),
  });
}

export function GET() {
  return bad("Use POST.", 405);
}
