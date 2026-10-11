import { z } from "zod";
import type { GroundedBriefFacts } from "@/lib/brief-facts";
import { sites as allSites } from "@/lib/data";

export const MAX_TEXT = 900;
export const MAX_ACTIONS = 6;

export const generatedBriefSchema = z
  .object({
    purposeEn: z.string().min(20).max(MAX_TEXT),
    purposeHi: z.string().min(20).max(MAX_TEXT),
    actionsEn: z.array(z.string().min(5).max(400)).min(1).max(MAX_ACTIONS),
    actionsHi: z.array(z.string().min(5).max(400)).min(1).max(MAX_ACTIONS),
    evidenceIdsUsed: z.array(z.string().max(40)).max(20),
    siteIdsUsed: z.array(z.string().max(60)).max(3),
  })
  .strict();

export type GeneratedBilingualBrief = z.infer<typeof generatedBriefSchema>;

// Claims the data cannot support (safety, causation, legal status, health).
const FORBIDDEN_EN =
  /\b(safe|unsafe|safety clearance|certif\w*|compliant|compliance|approved|banned|illegal|legal(ly)?|caus(e|ed|es|ing)|due to immersion|health|disease|toxic|poison\w*|fish kill)\b/i;
const FORBIDDEN_HI = /(सुरक्षित|असुरक्षित|स्वास्थ्य|बीमारी|प्रमाणित|अनुमोदित|प्रतिबंधित|ज़हरीला|जहरीला|विषैला)/;
const HTML = /<[^>]+>|javascript:|\]\(/i;

const NUMBER = /\d+(?:\.\d+)?/g;
const DEVANAGARI_DIGITS = /[०-९]/;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  value?: GeneratedBilingualBrief;
}

export function validateGeneratedBrief(raw: unknown, facts: GroundedBriefFacts): ValidationResult {
  const parsed = generatedBriefSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: ["schema: " + parsed.error.issues.map((i) => i.path.join(".") + " " + i.message).join("; ")] };
  const v = parsed.data;
  const errors: string[] = [];
  const allowedIds = new Set(facts.allowedEvidenceIds);
  for (const id of v.evidenceIdsUsed) if (!allowedIds.has(id)) errors.push(`unknown evidenceId ${id}`);
  const selected = new Set(facts.sites.map((s) => s.siteId));
  for (const id of v.siteIdsUsed) if (!selected.has(id)) errors.push(`unknown or unselected siteId ${id}`);

  const allowedNums = new Set(facts.allowedNumbers.map((n) => String(+n)));
  const texts = [v.purposeEn, v.purposeHi, ...v.actionsEn, ...v.actionsHi];
  for (const t of texts) {
    if (HTML.test(t)) errors.push("markup or links are not allowed");
    if (DEVANAGARI_DIGITS.test(t)) errors.push("numbers must use the same digits as the source");
    for (const m of t.match(NUMBER) ?? []) if (!allowedNums.has(String(+m))) errors.push(`number ${m} is not in the supplied facts`);
  }
  for (const t of [v.purposeEn, ...v.actionsEn]) {
    const m = t.match(FORBIDDEN_EN);
    if (m) errors.push(`unsupported claim term “${m[0]}”`);
  }
  for (const t of [v.purposeHi, ...v.actionsHi]) {
    const m = t.match(FORBIDDEN_HI);
    if (m) errors.push(`unsupported claim term “${m[0]}”`);
  }
  const unselected = allSites.filter((s) => !selected.has(s.id));
  const keyword = (name: string) => name.split(/[\s(/]/)[0]!.toLowerCase();
  for (const s of unselected) {
    const k = keyword(s.canonicalName);
    const kHi = s.nameHi.split(/[\s(/]/)[0]!;
    if (texts.some((t) => t.toLowerCase().includes(k) || t.includes(kHi))) errors.push(`mentions unselected site ${s.canonicalName}`);
  }
  return errors.length ? { ok: false, errors: [...new Set(errors)] } : { ok: true, errors: [], value: v };
}
