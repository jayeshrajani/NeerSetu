import { observations, sites, engine, manifest, PARAMETERS } from "@/lib/data";
import { DEFAULT_FILTERS } from "@/lib/filters";
import { rankSites } from "@/lib/scoring";
import { citationFor } from "@/lib/provenance";
import { resolveToday } from "@/lib/calendar";
import { chatAnswerSchema, PAST_READINGS_QUESTION, type ChatAnswer, type ChatRequest, type ChatSource } from "@/lib/chat";

export const CHAT_GUIDES = [
  { id: "cleanup", title: "Shoreline and floating-waste cleanup", text: "Separate flowers and other organic offerings from plastic, cloth and packaging at collection points. Collect reachable litter from the bank with litter pickers, gloves and closed footwear. Arrange municipal collection and approved disposal; do not leave filled bags at the bank. Trained municipal crews should retrieve floating debris with nets or skimmers from designated access points. Volunteers should not enter the water, lean over unstable edges, handle sharps, or operate boats. Mark sharps for trained handlers. General planning guidance, not a site-specific instruction or official order." },
  { id: "prevention", title: "Preventing waste at immersion", text: "Coordinate designated collection points for flowers, plastic and packaging before immersion. Keep bins away from edges and arrange collection before they overflow. Ask the local authority about designated immersion facilities and current rules; historical site names do not confirm current permission. Encourage organisers to separate removable decorations and use locally permitted materials. Brief volunteers on bank-only litter collection, queue routes and escalation contacts. Do not promise that any idol material or facility makes the lake pollution-free." },
  { id: "oxygen", title: "Low oxygen and oxygen demand", text: "Dissolved oxygen means oxygen available in the water. BOD means oxygen used while organic material breaks down; a high reading warrants investigation, not a claim about the cause. For a current concern, request fresh dissolved oxygen and oxygen-demand testing at documented locations and times. Ask the technical team to inspect possible wastewater inflows and accumulated organic waste. Removal of visible waste does not prove dissolved pollution is resolved. Aeration may be considered by qualified lake-management staff after checking measurements, lake conditions, equipment placement and power arrangements. Do not prescribe aerator size, duration, chemical dose or guaranteed recovery." },
  { id: "sampling", title: "Fresh testing and evidence", text: "Coordinate fresh samples through the authorised monitoring team or laboratory. Record the exact sampling point, date, time, recent weather, visible inflows and photos. Compare documented samples before, during and after the activity where appropriate. Let the laboratory specify containers, preservation, transport and test methods. Include dissolved oxygen, BOD and pH screening and ask for microbial testing where water-contact decisions are being considered. Historical results cannot tell us today's quality." },
  { id: "precautions", title: "Field and crowd precautions", text: "Keep public queues and volunteers away from unstable banks, slippery steps and vehicle routes. Coordinate barriers, lighting, designated access and rescue arrangements with the responsible authority. Use bank-based collection rather than entering water. Gloves and closed footwear help during litter handling but do not establish water-contact suitability. Keep children away from cleanup and restrict electrical equipment near wet areas to qualified crews. If an immediate incident or injury occurs, contact local emergency services rather than waiting for chat advice. No health diagnosis or water-safety certification." },
  { id: "inflows", title: "Sewage, smell, foam and visible incidents", text: "Smell, foam or discolouration alone cannot identify a pollutant or prove sewage. Document the exact location, time, photos, visible outfall and whether flow is ongoing, from a stable bank. Send the record to the municipal water/environment team for inspection and fresh testing. Keep people away from the affected access point while the responsible team reviews it. Source interception and sewer repairs are engineering work; do not block drains yourself or add bleach, disinfectant, acid or other chemicals to the lake. If fish distress or an active spill is reported, escalate promptly; do not assign a cause from appearance." },
  { id: "treatment", title: "Choosing cleanup versus treatment", text: "Nets, skimmers and shoreline collection remove visible litter; they do not remove every dissolved pollutant. Booms can gather floating debris only where trained teams assess flow, navigation, anchoring and retrieval. Sewage diversion, treatment systems, constructed wetlands, dredging and aeration require engineering assessment, permissions and maintenance; they are not interchangeable instant fixes. Start by identifying the inflow and fresh test results. Do not recommend chemical dosing, unverified microbial products, DIY lake treatment, dredging volumes, costs, timelines or performance guarantees. Ask the technical team to compare options against the measured problem." },
  { id: "screening", title: "What the evidence can and cannot establish", text: `CPCB Class B screening levels from the supplied criteria: dissolved oxygen ${engine.describe("Dissolved oxygen")}; BOD ${engine.describe("BOD")}; pH ${engine.describe("pH")}. These are screening comparisons, not a water-contact suitability decision. Coliform is unmeasured, units in the supplied tables are assumed, and current water quality and current site authorisation are unverified. Numeric zero is an actual reading. Blank, underscore, single or double asterisk mean not sampled. BDL and ND are censored readings, not zero. Missing tables do not mean clean water. Past concern, sampling priority, data coverage and current status are separate. Do not label water safe, unsafe, compliant, certified, approved or banned. Do not claim immersion caused a reading. Ranking uses historical concern and coverage, not a live forecast.` },
  { id: "identity", title: "Confirming a physical site", text: "Rani Kamlapati and Kamla Park may refer to different physical points; the organiser pack combines them with medium identity confidence. Confirm the location with the local authority before fieldwork. Map anchors are approximate and based on saved OpenStreetMap features, not surveyed sampling coordinates." },
] as const;

export function buildChatGrounding(request: ChatRequest) {
  const question = request.messages.filter((message) => message.role === "user").slice(-3).map((message) => message.content).join(" ").toLowerCase();
  const namedSites = sites.filter((site) => [site.id, site.canonicalName, site.nameHi, ...site.printedAliases].some((name) => {
    const normal = name.toLowerCase();
    return question.includes(normal) || normal.split(/[\s(),-]+/).some((word) => word.length >= 5 && question.includes(word) && !["bhopal", "lower", "upper", "visarjan", "immersion"].includes(word));
  }));
  const ranked = rankSites(observations, sites, engine, DEFAULT_FILTERS);
  const selectedIds = namedSites.length ? namedSites.map((site) => site.id) : request.siteId ? [request.siteId] : ranked.slice(0, 3).map((site) => site.id);
  const requestedYears = [2023, 2024, 2025].filter((year) => question.includes(String(year)));
  const festival = /durga|navratri|दुर्गा|नवरात्र/.test(question) ? "Durga" : /ganesh|ganpati|गणेश|गणपति/.test(question) ? "Ganesh" : null;
  const wanted = /\bbod\b/.test(question) ? "BOD" : /oxygen|\bdo\b|ऑक्सीजन/.test(question) ? "Dissolved oxygen" : /\bph\b/.test(question) ? "pH" : PARAMETERS.toSorted((first, second) => second.length - first.length).find((parameter) => question.includes(parameter.toLowerCase())) ?? null;
  const pool = observations.filter((observation) => selectedIds.includes(observation.siteId)
    && (!requestedYears.length || requestedYears.includes(observation.year))
    && (!festival || observation.festival === festival)
    && (!wanted || observation.parameter === wanted));
  const relevant = pool.toSorted((first, second) => {
    const weight = (observation: typeof first) => observation.benchmarkStatus === "outside_screening_benchmark" ? 0 : observation.measurementStatus !== "numeric" ? 1 : 2;
    return weight(first) - weight(second) || second.year - first.year;
  });
  const picked = selectedIds.flatMap((id) => {
    const rows = relevant.filter((observation) => observation.siteId === id);
    const extremes = (wanted ? [wanted] : ["Dissolved oxygen", "BOD", "pH"]).flatMap((parameter) => {
      const numeric = rows.filter((observation) => observation.parameter === parameter && observation.measurementStatus === "numeric" && observation.numericValue !== null).toSorted((first, second) => first.numericValue! - second.numericValue!);
      if (!numeric.length) return [];
      if (parameter === "Dissolved oxygen") return [numeric[0]!];
      if (parameter === "BOD") return [numeric.at(-1)!];
      return [numeric[0]!, numeric.at(-1)!];
    });
    const distinct = new Map([...extremes, ...rows.filter((observation) => observation.measurementStatus !== "numeric").slice(0, 2), ...rows].map((observation) => [observation.id, observation]));
    return [...distinct.values()].slice(0, Math.max(4, Math.floor(24 / selectedIds.length)));
  });
  const sources: ChatSource[] = picked.map((observation) => {
    const citation = citationFor(observation);
    return {
      id: observation.id, kind: "observation", label: `${observation.siteCanonical}: ${observation.parameter} ${observation.valueAsPrinted || "not sampled"}`,
      href: citation.localUrl,
      detail: `${observation.id} | ${observation.festival} ${observation.year}, ${observation.phase} | ${citation.csvFile} line ${citation.csvLine} | ${citation.pageLabel} | Units assumed`,
      csvHref: `${manifest.sourceRepo}/blob/${manifest.sourceCommit}/${manifest.sourcePath}/data/${citation.csvFile}#L${citation.csvLine}`, csvLine: citation.csvLine,
    };
  });
  sources.push(...CHAT_GUIDES.map((guide) => ({ id: guide.id, kind: "guidance" as const, label: guide.title, href: `/methodology#chat-${guide.id}`, detail: "General planning guidance, not a measurement or official order." })));
  return {
    today: resolveToday(undefined).today,
    scope: "Bhopal organiser-pack historical observations only. No live readings or current authorisation.",
    ranking: ranked.filter((site) => selectedIds.includes(site.id)).map((site) => ({ siteId: site.id, name: site.canonicalName, historicalConcern: site.historicalConcern, samplingPriority: site.samplingPriority, identityUncertain: site.needsIdentityVerification })),
    evidence: picked.map((observation) => ({ id: observation.id, site: observation.siteCanonical, parameter: observation.parameter, value: observation.valueAsPrinted, year: observation.year, festival: observation.festival, phase: observation.phase, status: observation.measurementStatus, unitAssumed: observation.unitAssumed, screening: observation.benchmarkStatus })),
    guides: CHAT_GUIDES,
    sources,
    criteriaSource: manifest.criteriaSource,
  };
}

export type ChatGrounding = ReturnType<typeof buildChatGrounding>;

export function starterEvidenceAnswer(request: ChatRequest, grounding: ChatGrounding): ChatAnswer | null {
  if (request.messages.at(-1)?.content.trim() !== PAST_READINGS_QUESTION) return null;
  const site = sites.find((item) => item.id === "khatlapura-ghat")!;
  const phases: Record<string, string> = { pre: "before immersion", during: "during immersion", after: "one week after immersion" };
  const labels: Record<string, string> = { "Dissolved oxygen": "oxygen in the water", BOD: "oxygen demand (BOD)", pH: "pH" };
  const readings = ["Dissolved oxygen", "BOD", "pH"].flatMap((parameter) => {
    const candidates = grounding.evidence.filter((item) => item.site === site.canonicalName && item.parameter === parameter && item.status === "numeric" && item.screening === "outside_screening_benchmark");
    const reading = candidates.toSorted((first, second) => engine.severity(parameter, Number(second.value)) - engine.severity(parameter, Number(first.value)))[0];
    return reading ? [reading] : [];
  });
  return validateChatAnswer({
    language: "en",
    answer: [
      ...readings.map((reading) => ({
        text: `${reading.site}: ${labels[reading.parameter]} was ${reading.value}${reading.unitAssumed ? ` ${reading.unitAssumed}` : ""} in ${reading.festival} ${reading.year}, ${phases[reading.phase]}. This was outside its screening level and warrants a fresh check.`,
        evidenceIds: [reading.id], guideIds: ["screening"],
      })),
      { text: readings.length ? "These are selected historical readings, not today's water conditions. Units are assumed from the supplied tables. Fresh testing is needed; this is not a complete list of past results." : "No outside-screening reading is available in this evidence selection. That does not establish today's condition; request fresh tests.", evidenceIds: [], guideIds: ["screening", "sampling"] },
    ],
    nextSteps: [
      { text: "Ask the authorised monitoring team to test oxygen in the water, oxygen demand and pH at documented points. Record the location, date, time and visible inflows.", evidenceIds: [], guideIds: ["sampling"] },
      { text: "Ask the technical team to inspect nearby wastewater inflows and accumulated organic waste. Use fresh results to decide whether further intervention is needed, not the old readings alone.", evidenceIds: [], guideIds: ["oxygen", "inflows"] },
    ],
    followUp: "",
  }, grounding);
}

export function validateChatAnswer(value: unknown, grounding: ChatGrounding) {
  const parsed = chatAnswerSchema.safeParse(value);
  if (!parsed.success) throw new Error(`Invalid chat answer structure: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  const answer = parsed.data;
  for (const block of [...answer.answer, ...answer.nextSteps]) {
    const evidence = block.evidenceIds.map((id) => grounding.evidence.find((item) => item.id === id));
    const guides = block.guideIds.map((id) => CHAT_GUIDES.find((item) => item.id === id));
    if (evidence.some((item) => !item) || guides.some((item) => !item)) throw new Error("Unknown chat source");
    const allowedNumbers = new Set([...evidence.map((item) => `${item?.value ?? ""} ${item?.year ?? ""}`), ...guides.map((item) => item?.text ?? "")].join(" ").match(/\d+(?:\.\d+)?/g) ?? []);
    if ((block.text.match(/\d+(?:\.\d+)?/g) ?? []).some((number) => !allowedNumbers.has(number))) throw new Error("Uncited numeric claim");
    if (/<[^>]+>|https?:\/\/|javascript:|[०-९]/i.test(block.text)) throw new Error("Markup, links or non-source digits");
    if (/\b(?:BDL|ND|not sampled|missing)\s+(?:means?|is|equals?)\s+(?:zero|0)\b/i.test(block.text)) throw new Error("Missing or censored value treated as zero");
    if (/\b(?:is|are|was|water is|paani|pani)\s+(?:safe|unsafe|compliant|certified|approved|banned)\b|\b(?:caused by immersion|immersion caused)\b/i.test(block.text)) throw new Error("Unsupported assurance or cause");
    if (/\b(?:add|pour|dose|mix)\b.{0,40}\b(?:bleach|chlorine|acid|disinfectant)\b/i.test(block.text) && !/\b(?:not|never|avoid|don't|do not)\b/i.test(block.text)) throw new Error("Chemical treatment instruction");
    if (block.evidenceIds.length === 0 && block.guideIds.length === 0 && !/\?|hello|namaste|hi\b|thank|shukriya|cannot|can't|outside|beyond|focus|tell me|bata/i.test(block.text)) throw new Error("Ungrounded chat advice");
  }
  if (/\d|[०-९]|<[^>]+>|https?:\/\/|javascript:/i.test(answer.followUp)) throw new Error("Unsupported follow-up content");
  return answer;
}