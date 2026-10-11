import type { GroundedBriefFacts } from "@/lib/brief-facts";
import type { GeneratedBilingualBrief } from "@/lib/brief-validation";

export type RankingNarrative = Pick<GeneratedBilingualBrief, "purposeEn" | "purposeHi" | "actionsEn" | "actionsHi">;

export function rankingFallback(facts: GroundedBriefFacts): RankingNarrative {
  const incomplete = facts.sites.some((site) => site.rank === null);
  return {
    purposeEn: incomplete
      ? `Review the records for ${facts.sites.map((site) => site.name).join(", ")}. There is too little evidence to rank every selected ghat; current water quality is unknown.`
      : `Review ${facts.sites.map((site) => site.name).join(", ")} first in this ranking. Past tests guide this review; current water quality is unknown.`,
    purposeHi: incomplete
      ? `${facts.sites.map((site) => site.nameHi).join(", ")} के रिकॉर्ड की जांच करें। सभी चुने गए घाटों की तुलना के लिए पर्याप्त जानकारी नहीं है; अभी की जल गुणवत्ता अज्ञात है।`
      : `इस सूची में पहले ${facts.sites.map((site) => site.nameHi).join(", ")} की जांच करें। यह पुराने परीक्षणों पर आधारित है; अभी की जल गुणवत्ता अज्ञात है।`,
    actionsEn: ["Take fresh water samples and review the results.", "Check missing records before drawing conclusions."],
    actionsHi: ["पानी के नए नमूने लें और परिणामों की जांच करें।", "निष्कर्ष निकालने से पहले अधूरे रिकॉर्ड की जांच करें।"],
  };
}