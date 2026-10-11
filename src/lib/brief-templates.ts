import { FESTIVAL_CALENDAR, fmtDate } from "@/lib/calendar";
import type { BriefSiteFacts, GroundedBriefFacts } from "@/lib/brief-facts";

export type Lang = "en" | "hi";

export interface BriefItem {
  text: string;
  refs: number[];
  heading?: boolean;
}
export interface BriefSection {
  id: "purpose" | "evidence" | "unknowns" | "actions" | "sources";
  heading: string;
  items: BriefItem[];
}
export interface RenderedBrief {
  lang: Lang;
  title: string;
  meta: string;
  sections: BriefSection[];
  reviewLine: string;
}

const CONCERN = {
  en: {
    elevated: "elevated historical concern",
    moderate: "moderate historical concern",
    lower_observed: "lower observed historical concern (not a safety rating)",
    insufficient_evidence: "insufficient evidence to score",
  },
  hi: {
    elevated: "ऐतिहासिक चिंता: उच्च",
    moderate: "ऐतिहासिक चिंता: मध्यम",
    lower_observed: "ऐतिहासिक चिंता: अपेक्षाकृत कम दर्ज (यह सुरक्षा रेटिंग नहीं है)",
    insufficient_evidence: "अंक देने हेतु पर्याप्त साक्ष्य नहीं",
  },
} as const;

const PRIORITY = {
  en: { urgent_retest: "urgent re-test", priority_retest: "priority re-test", routine_verify: "routine verification" },
  hi: { urgent_retest: "तत्काल पुनः जाँच", priority_retest: "प्राथमिकता से पुनः जाँच", routine_verify: "नियमित सत्यापन" },
} as const;

const FEST_HI: Record<string, string> = { Ganesh: "गणेश", Durga: "दुर्गा" };
const PHASE = {
  en: { pre: "pre-immersion", during: "during immersion", after: "one week after" },
  hi: { pre: "विसर्जन से पहले", during: "विसर्जन के दौरान", after: "एक सप्ताह बाद" },
} as const;
const PARAM = {
  en: (p: string) => (p === "Dissolved oxygen" ? "DO" : p),
  hi: (p: string) => (p === "Dissolved oxygen" ? "घुलित ऑक्सीजन (DO)" : p),
};

const cite = (refs: number[]) => (refs.length ? ` [${refs.join(", ")}]` : "");

function evidenceLines(s: BriefSiteFacts, lang: Lang): BriefItem[] {
  const items: BriefItem[] = [];
  const head =
    lang === "en"
      ? `${s.name}${s.rank ? ` (rank ${s.rank})` : ""}: ${CONCERN.en[s.concern]}; ${PRIORITY.en[s.samplingPriority]}.`
      : `${s.nameHi}${s.rank ? ` (क्रम ${s.rank})` : ""}: ${CONCERN.hi[s.concern]}; ${PRIORITY.hi[s.samplingPriority]}।`;
  items.push({ text: head, refs: [], heading: true });
  for (const e of s.evidence) {
    const unit = e.unit ? ` ${e.unit}` : "";
    items.push(
      lang === "en"
        ? { text: `${PARAM.en(e.parameter)} ${e.valuePrinted}${unit} — ${e.year} ${e.festival}, ${PHASE.en[e.phase]}.`, refs: [e.ref] }
        : { text: `${PARAM.hi(e.parameter)} ${e.valuePrinted}${unit} — ${e.year} ${FEST_HI[e.festival]}, ${PHASE.hi[e.phase]}।`, refs: [e.ref] },
    );
  }
  const c = s.counts;
  if (c.doTotal || c.bodTotal) {
    items.push(
      lang === "en"
        ? { text: `DO < 5 in ${c.doBelow}/${c.doTotal} readings; BOD > 3 in ${c.bodAbove}/${c.bodTotal}; pH outside 6.5–8.5 in ${c.phOut}/${c.phTotal}.`, refs: [] }
        : { text: `DO < 5: ${c.doBelow}/${c.doTotal} रीडिंग; BOD > 3: ${c.bodAbove}/${c.bodTotal}; pH 6.5–8.5 से बाहर: ${c.phOut}/${c.phTotal}।`, refs: [] },
    );
  }
  if (c.outsideTotal) {
    items.push(
      lang === "en"
        ? { text: `Recurring: ${c.windowsWithExceedance}/${c.validWindows} sampled festival windows; ${c.outsidePre} of ${c.outsideTotal} outside readings were pre-immersion.`, refs: [] }
        : { text: `बार-बार: ${c.windowsWithExceedance}/${c.validWindows} नमूना-अवधियाँ; मानक से बाहर ${c.outsideTotal} में से ${c.outsidePre} रीडिंग विसर्जन से पहले की।`, refs: [] },
    );
  }
  if (!c.doTotal && !c.bodTotal && !c.phTotal) {
    items.push(
      lang === "en"
        ? { text: "No numeric DO/BOD/pH reading in the selected scope — an evidence gap, not a clean result.", refs: [] }
        : { text: "चयनित दायरे में DO/BOD/pH की कोई संख्यात्मक रीडिंग नहीं — यह साक्ष्य की कमी है, स्वच्छ परिणाम नहीं।", refs: [] },
    );
  }
  return items;
}

function unknowns(f: GroundedBriefFacts, lang: Lang): BriefItem[] {
  const items: BriefItem[] = [];
  for (const s of f.sites) {
    for (const a of s.gaps.absentWindows) {
      items.push(
        lang === "en"
          ? { text: `${s.name}: no ${a.year} ${a.festival} table in the reports.`, refs: [] }
          : { text: `${s.nameHi}: रिपोर्टों में ${a.year} ${FEST_HI[a.festival]} की तालिका नहीं।`, refs: [] },
      );
    }
    if (s.gaps.notSampled) {
      items.push(
        lang === "en"
          ? { text: `${s.name}: ${s.gaps.notSampled} DO/BOD/pH ${s.gaps.notSampled === 1 ? "entry" : "entries"} not sampled (${s.gaps.notSampledWindows.join(", ")}).`, refs: [] }
          : { text: `${s.nameHi}: ${s.gaps.notSampled} DO/BOD/pH प्रविष्टियों का नमूना नहीं लिया गया (${s.gaps.notSampledWindows.map((w) => w.replace("Ganesh", "गणेश").replace("Durga", "दुर्गा")).join(", ")})।`, refs: [] },
      );
    }
    if (s.identityAmbiguous) {
      const g = s.aliasesByFestival.Ganesh?.[0] ?? "—";
      const d = s.aliasesByFestival.Durga?.[0] ?? "—";
      items.push(
        lang === "en"
          ? { text: `${s.name}: Ganesh tables print “${g}”, Durga tables print “${d}” — possibly two places.`, refs: [] }
          : { text: `${s.nameHi}: गणेश तालिकाओं में “${g}” और दुर्गा तालिकाओं में “${d}” छपा है — ये दो अलग स्थान हो सकते हैं।`, refs: [] },
      );
    }
  }
  const standing =
    lang === "en"
      ? [
          `Historical (${f.dataYears}) only — current water quality unknown; units assumed.`,
          "Coliform not measured, so Class B compliance cannot be stated; 2026 authorisation unverified.",
          "Phase differences alone do not establish the effect of immersion.",
        ]
      : [
          `रीडिंग केवल ${f.dataYears} की हैं; वर्तमान जल गुणवत्ता अज्ञात है। इकाइयाँ मानी गई हैं (रिपोर्टों में छपी नहीं)।`,
          "कुल कोलिफॉर्म मापा नहीं गया, अतः Class B अनुरूपता नहीं कही जा सकती। 2026 विसर्जन अनुमति सत्यापित नहीं है।",
          "चरणों के बीच अंतर अकेले विसर्जन का प्रभाव सिद्ध नहीं करता।",
        ];
  standing.forEach((text) => items.push({ text, refs: [] }));
  return items;
}

export function deterministicActions(f: GroundedBriefFacts, lang: Lang): BriefItem[] {
  const items: BriefItem[] = [];
  const name = (s: BriefSiteFacts) => (lang === "en" ? s.name : s.nameHi);
  const retest = f.sites.filter((s) => s.samplingPriority !== "routine_verify");
  if (retest.length) {
    const names = retest.map(name).join(lang === "en" ? ", " : ", ");
    items.push(
      lang === "en"
        ? { text: `${names}: fresh DO, BOD and pH samples before 20 Oct, during immersion and one week after.`, refs: [] }
        : { text: `${names}: 20 अक्टूबर से पहले, विसर्जन के दौरान और एक सप्ताह बाद DO, BOD व pH के नए नमूने लें।`, refs: [] },
    );
  }
  const routine = f.sites.filter((s) => s.samplingPriority === "routine_verify");
  if (routine.length) {
    items.push(
      lang === "en"
        ? { text: `${routine.map(name).join(", ")}: verify with a pre-immersion sample; historical readings are not a safety clearance.`, refs: [] }
        : { text: `${routine.map(name).join(", ")}: विसर्जन-पूर्व नमूने से सत्यापन करें; ऐतिहासिक रीडिंग सुरक्षा की स्वीकृति नहीं है।`, refs: [] },
    );
  }
  for (const s of f.sites.filter((x) => x.identityAmbiguous)) {
    items.push(
      lang === "en"
        ? { text: `${s.name}: confirm the physical site before dispatch.`, refs: [] }
        : { text: `${s.nameHi}: टीम भेजने से पहले भौतिक स्थल की पुष्टि करें।`, refs: [] },
    );
  }
  for (const s of f.sites.filter((x) => x.gaps.absentWindows.length)) {
    const w = s.gaps.absentWindows.map((a) => `${a.year} ${lang === "en" ? a.festival : FEST_HI[a.festival]}`).join(", ");
    items.push(
      lang === "en"
        ? { text: `${s.name}: ask MPPCB R.O. Bhopal for any ${w} table.`, refs: [] }
        : { text: `${s.nameHi}: MPPCB क्षेत्रीय कार्यालय भोपाल से ${w} की तालिका माँगें।`, refs: [] },
    );
  }
  items.push(
    lang === "en"
      ? { text: "Inspect for cleaning needs; refer aeration or treatment decisions to the technical team.", refs: [] }
      : { text: "सफ़ाई हेतु निरीक्षण करें; वातन (aeration) या उपचार का निर्णय तकनीकी टीम को भेजें।", refs: [] },
  );
  return items;
}

export function deterministicPurpose(f: GroundedBriefFacts, lang: Lang): BriefItem[] {
  const next = FESTIVAL_CALENDAR[FESTIVAL_CALENDAR.length - 1];
  const whenEn = next ? `${next.festival} visarjan (${fmtDate(next.date, { day: "numeric", month: "short", year: "numeric" })})` : "the next visarjan";
  const whenHi = next ? `${next.nameHi.replace(/ \d{4}$/, "")} (${fmtDate(next.date, { day: "numeric", month: "short", year: "numeric" })})` : "अगले विसर्जन";
  return [
    lang === "en"
      ? { text: `Prioritise fresh testing and inspection before ${whenEn}. Scope: ${f.scope}.`, refs: [] }
      : { text: `${whenHi} से पहले नए परीक्षण व निरीक्षण की प्राथमिकता तय करना। दायरा: ${f.scope.replace("Ganesh + Durga", "गणेश + दुर्गा").replace("Durga", "दुर्गा").replace("Ganesh", "गणेश").replace("all phases", "सभी चरण")}।`, refs: [] },
  ];
}

function sources(f: GroundedBriefFacts, lang: Lang): BriefItem[] {
  const items: BriefItem[] = f.citations.map((c) => {
    const page = c.page === null ? "" : c.pageVerified ? (lang === "en" ? ` p.${c.page}` : ` पृ.${c.page}`) : lang === "en" ? ` source p.${c.page} (unverified)` : ` स्रोत पृ.${c.page} (असत्यापित)`;
    return {
      text: `[${c.ref}] MPPCB ${c.reportYear}${page}, CSV L${c.csvLine}`,
      refs: [],
    };
  });
  items.push(
    lang === "en"
      ? { text: "Screening: CPCB Class B (bathing) — DO ≥ 5 mg/l, BOD ≤ 3 mg/l, pH 6.5–8.5. A comparison, not a legal designation.", refs: [] }
      : { text: "तुलना: CPCB Class B (स्नान) — DO ≥ 5 mg/l, BOD ≤ 3 mg/l, pH 6.5–8.5। यह केवल तुलना है, कानूनी श्रेणी नहीं।", refs: [] },
  );
  return items;
}

export interface NarrativeOverride {
  purpose?: string;
  actions?: string[];
}

export function renderBrief(f: GroundedBriefFacts, lang: Lang, override?: NarrativeOverride, reviewed = false): RenderedBrief {
  const en = lang === "en";
  return {
    lang,
    title: en ? "GhatWatch officer brief — pre-visarjan testing priorities" : "GhatWatch अधिकारी संक्षेप — विसर्जन-पूर्व जाँच प्राथमिकताएँ",
    meta: en
      ? `MPPCB monitoring ${f.dataYears} · not live · for officer and technical review.`
      : `MPPCB निगरानी ${f.dataYears} · लाइव डेटा नहीं · अधिकारी व तकनीकी समीक्षा हेतु।`,
    sections: [
      { id: "purpose", heading: en ? "1. Purpose" : "1. उद्देश्य", items: override?.purpose ? [{ text: override.purpose, refs: [] }] : deterministicPurpose(f, lang) },
      { id: "evidence", heading: en ? "2. Observed historical evidence" : "2. दर्ज ऐतिहासिक साक्ष्य", items: f.sites.flatMap((s) => evidenceLines(s, lang)) },
      { id: "unknowns", heading: en ? "3. What remains unknown" : "3. क्या अज्ञात है", items: unknowns(f, lang) },
      {
        id: "actions",
        heading: en ? "4. Proposed actions for officer / technical review" : "4. अधिकारी / तकनीकी समीक्षा हेतु प्रस्तावित कदम",
        items: override?.actions?.length ? override.actions.map((text) => ({ text, refs: [] })) : deterministicActions(f, lang),
      },
      { id: "sources", heading: en ? "5. Sources" : "5. स्रोत", items: sources(f, lang) },
    ],
    reviewLine: en ? `Reviewed by officer: [${reviewed ? "x" : " "}]` : `अधिकारी द्वारा समीक्षा: [${reviewed ? "x" : " "}]`,
  };
}

export function briefToText(b: RenderedBrief): string {
  const lines = [b.title, b.meta, ""];
  for (const s of b.sections) {
    lines.push(s.heading);
    for (const it of s.items) lines.push(`${s.id === "sources" ? "" : it.heading ? "" : "• "}${it.text}${cite(it.refs)}`);
    lines.push("");
  }
  lines.push(b.reviewLine);
  return lines.join("\n");
}

export function wordCount(b: RenderedBrief): number {
  return briefToText(b).split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}
