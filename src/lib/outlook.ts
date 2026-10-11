import type { Festival, Filters, Observation, SiteSummary } from "@/types/ghatwatch";
import { engine, observations, sites } from "@/lib/data";
import { DEFAULT_FILTERS } from "@/lib/filters";
import { rankSites, SCORING } from "@/lib/scoring";
import { type Campaign, addDays, campaignFor, fmtDate } from "@/lib/calendar";

export interface Finding {
  text: string;
  ids: string[];
  tone: "critical" | "warning" | "gap" | "info";
}

export interface FestivalWindow {
  year: number;
  present: boolean;
  numeric: number;
  outside: number;
}

export interface SiteOutlook {
  summary: SiteSummary;
  windows: FestivalWindow[];
  findings: Finding[];
}

export interface ActionStep {
  key: string;
  from: string;
  to: string;
  status: "past" | "now" | "upcoming";
  title: string;
  detail: string;
  how: string[];
  sites: { id: string; note: string; evidenceIds: string[] }[];
  siteIds: string[];
  evidenceIds: string[];
  kind: "confirm" | "sample" | "request" | "inspect";
}

export interface RiskCard {
  siteId: string;
  reasons: Finding[];
}

export interface Outlook {
  campaign: Campaign;
  festival: Festival | null;
  filters: Filters;
  sites: SiteOutlook[];
  steps: ActionStep[];
  headline: Finding[];
  /** Ghats with severe readings in past seasons of the upcoming festival, highest concern first. */
  risks: RiskCard[];
  /** Highest-scored ghat that is not in `risks` and has no table for the latest season. */
  watch: RiskCard | null;
}

const PHASE_WORD: Record<string, string> = { pre: "before immersion", during: "during immersion", after: "one week after" };
const fmt = (n: number) => String(+n.toFixed(2));

function windowsFor(siteId: string, festival: Festival, scoped: Observation[]): FestivalWindow[] {
  return [2023, 2024, 2025].map((year) => {
    const rows = scoped.filter((o) => o.siteId === siteId && o.year === year && o.festival === festival && ["Dissolved oxygen", "BOD", "pH"].includes(o.parameter));
    return {
      year,
      present: observations.some((o) => o.siteId === siteId && o.year === year && o.festival === festival),
      numeric: rows.filter((o) => o.measurementStatus === "numeric").length,
      outside: rows.filter((o) => o.benchmarkStatus === "outside_screening_benchmark").length,
    };
  });
}

function findingsFor(s: SiteSummary, festival: Festival | null, scoped: Observation[]): Finding[] {
  const out: Finding[] = [];
  const mine = scoped.filter((o) => o.siteId === s.id && o.measurementStatus === "numeric" && o.numericValue !== null);
  const label = festival ?? "festival";
  const doRows = mine.filter((o) => o.parameter === "Dissolved oxygen");
  const bodRows = mine.filter((o) => o.parameter === "BOD");
  const worst = (rows: Observation[], lower: boolean) =>
    rows.reduce<Observation | null>((a, b) => (!a ? b : lower ? ((b.numericValue as number) < (a.numericValue as number) ? b : a) : (b.numericValue as number) > (a.numericValue as number) ? b : a), null);
  const wDo = worst(doRows, true);
  if (wDo && (wDo.numericValue as number) < 5) {
    const zeros = doRows.filter((o) => o.numericValue === 0);
    out.push({
      text:
        zeros.length > 0
          ? `Dissolved oxygen was recorded as 0 mg/l in ${zeros.length} ${label} reading${zeros.length > 1 ? "s" : ""} (${zeros.map((o) => `${o.year} ${PHASE_WORD[o.phase]}`).join("; ")}).`
          : `Lowest ${label} dissolved oxygen: ${fmt(wDo.numericValue as number)} mg/l in ${wDo.year}, ${PHASE_WORD[wDo.phase]} (screening minimum 5).`,
      ids: zeros.length ? zeros.map((o) => o.id) : [wDo.id],
      tone: (wDo.numericValue as number) <= SCORING.severeTriggers.doAtOrBelow ? "critical" : "warning",
    });
  }
  const wBod = worst(bodRows, false);
  if (wBod && (wBod.numericValue as number) > 3) {
    out.push({
      text: `Highest ${label} BOD: ${fmt(wBod.numericValue as number)} mg/l in ${wBod.year}, ${PHASE_WORD[wBod.phase]} (screening maximum 3).`,
      ids: [wBod.id],
      tone: (wBod.numericValue as number) >= SCORING.severeTriggers.bodAtOrAbove ? "critical" : "warning",
    });
  }
  const preOut = mine.filter((o) => o.phase === "pre" && o.benchmarkStatus === "outside_screening_benchmark");
  if (preOut.length) {
    const latest = Math.max(...preOut.map((o) => o.year));
    const l = preOut.filter((o) => o.year === latest);
    out.push({
      text: `Already outside the screening level before immersion in ${latest}: ${l.map((o) => `${o.parameter === "Dissolved oxygen" ? "DO" : o.parameter} ${o.valueAsPrinted}`).join(", ")}. Immersion alone does not explain the readings.`,
      ids: l.map((o) => o.id),
      tone: "info",
    });
  }
  const withEx = s.windows.filter((w) => w.hasExceedance);
  if (s.windows.length >= 2) {
    out.push({
      text: `Outside-screening readings in ${withEx.length} of ${s.windows.length} sampled ${label} seasons.`,
      ids: withEx.flatMap((w) => w.observationIds).filter((id) => scoped.find((o) => o.id === id)?.benchmarkStatus === "outside_screening_benchmark"),
      tone: "info",
    });
  }
  for (const a of s.coverage.sourceAbsentWindows) {
    out.push({ text: `No ${a.year} ${a.festival} table exists in the MPPCB reports — missing, not clean.`, ids: [], tone: "gap" });
  }
  if (s.needsIdentityVerification) out.push({ text: s.identityNote ?? "Site name is ambiguous. Confirm the physical point.", ids: [], tone: "gap" });
  return out;
}

/** One short line on why a site sits where it does in the plan, with the row it rests on. */
function siteNote(s: SiteSummary, scoped: Observation[], festival: Festival): { text: string; ids: string[] } {
  const mine = scoped.filter((o) => o.siteId === s.id && o.measurementStatus === "numeric" && o.numericValue !== null);
  const pick = (p: string, lower: boolean) =>
    mine.filter((o) => o.parameter === p).reduce<Observation | null>((a, b) => (!a ? b : lower ? ((b.numericValue as number) < (a.numericValue as number) ? b : a) : (b.numericValue as number) > (a.numericValue as number) ? b : a), null);
  const lowDo = pick("Dissolved oxygen", true);
  const highBod = pick("BOD", false);
  if (lowDo && (lowDo.numericValue as number) <= SCORING.severeTriggers.doAtOrBelow) return { text: `DO ${lowDo.valueAsPrinted} mg/l · ${festival} ${lowDo.year}`, ids: [lowDo.id] };
  if (highBod && (highBod.numericValue as number) >= SCORING.severeTriggers.bodAtOrAbove) return { text: `BOD ${highBod.valueAsPrinted} mg/l · ${festival} ${highBod.year}`, ids: [highBod.id] };
  if (lowDo && (lowDo.numericValue as number) < 5) return { text: `DO down to ${lowDo.valueAsPrinted} mg/l · ${festival} ${lowDo.year}`, ids: [lowDo.id] };
  if (highBod && (highBod.numericValue as number) > 3) return { text: `BOD up to ${highBod.valueAsPrinted} mg/l · ${festival} ${highBod.year}`, ids: [highBod.id] };
  if (!mine.length) return { text: `No ${festival} readings on record`, ids: [] };
  return { text: `No exceedance in past ${festival} seasons`, ids: [] };
}

const num = (o: Observation) => o.numericValue as number;
const DO = "Dissolved oxygen";

/** Comparative, row-cited reasons for one ghat against the other six, within one festival's seasons. */
function riskReasons(s: SiteSummary, all: SiteSummary[], scoped: Observation[], festival: Festival): Finding[] {
  const rows = (id: string, p: string) => scoped.filter((o) => o.siteId === id && o.parameter === p && o.measurementStatus === "numeric" && o.numericValue !== null);
  const minOf = (r: Observation[]) => r.reduce<Observation | null>((a, b) => (!a || num(b) < num(a) ? b : a), null);
  const maxOf = (r: Observation[]) => r.reduce<Observation | null>((a, b) => (!a || num(b) > num(a) ? b : a), null);
  const ph = (o: Observation) => `${o.year}, ${PHASE_WORD[o.phase]}`;
  const out: Finding[] = [];

  const zeros = rows(s.id, DO).filter((o) => num(o) === 0);
  const othersWithZero = all.filter((x) => x.id !== s.id && rows(x.id, DO).some((o) => num(o) === 0));
  if (zeros.length) {
    out.push({
      text: `Dissolved oxygen hit 0 mg/l (${zeros.map(ph).join("; ")})${othersWithZero.length ? "" : ` — the only ghat to reach zero in a ${festival} season`}.`,
      ids: zeros.map((o) => o.id),
      tone: "critical",
    });
  }

  const latest = Math.max(...scoped.map((o) => o.year));
  const latestDo = rows(s.id, DO).filter((o) => o.year === latest);
  if (latestDo.length >= 2 && latestDo.every((o) => num(o) < 5)) {
    out.push({
      text: `In ${festival} ${latest}, oxygen stayed below 5 mg/l in every phase sampled (${latestDo.map((o) => o.valueAsPrinted).join(", ")} mg/l).`,
      ids: latestDo.map((o) => o.id),
      tone: "critical",
    });
  } else {
    const myLatestMin = minOf(latestDo);
    const othersLatest = all.filter((x) => x.id !== s.id).map((x) => minOf(rows(x.id, DO).filter((o) => o.year === latest))).filter(Boolean) as Observation[];
    if (myLatestMin && num(myLatestMin) < 5 && othersLatest.every((o) => num(o) > num(myLatestMin))) {
      out.push({ text: `Lowest oxygen of any ghat in ${festival} ${latest}: ${myLatestMin.valueAsPrinted} mg/l (${PHASE_WORD[myLatestMin.phase]}).`, ids: [myLatestMin.id], tone: "critical" });
    }
  }

  const myBod = maxOf(rows(s.id, "BOD"));
  const otherBod = all.filter((x) => x.id !== s.id).map((x) => maxOf(rows(x.id, "BOD"))).filter(Boolean) as Observation[];
  if (myBod && num(myBod) > 3) {
    const top = otherBod.every((o) => num(o) < num(myBod));
    out.push({
      text: top
        ? `Highest BOD of all seven ghats in ${festival} seasons: ${myBod.valueAsPrinted} mg/l (${ph(myBod)}) — ${+(num(myBod) / 3).toFixed(1)}× the screening level.`
        : `BOD reached ${myBod.valueAsPrinted} mg/l (${ph(myBod)}) — ${+(num(myBod) / 3).toFixed(1)}× the screening level.`,
      ids: [myBod.id],
      tone: num(myBod) >= SCORING.severeTriggers.bodAtOrAbove ? "critical" : "warning",
    });
  }

  const seasons = [...new Set(scoped.map((o) => o.year))].sort();
  const outside = seasons.map((y) => scoped.filter((o) => o.siteId === s.id && o.year === y && o.benchmarkStatus === "outside_screening_benchmark"));
  const present = seasons.filter((y) => observations.some((o) => o.siteId === s.id && o.year === y && o.festival === festival));
  if (present.length >= 3 && outside[outside.length - 1]!.length > outside[0]!.length) {
    out.push({
      text: `Getting worse: readings outside the screening level went ${outside.map((r) => r.length).join(" → ")} across ${seasons.join(", ")}.`,
      ids: outside[outside.length - 1]!.map((o) => o.id),
      tone: "warning",
    });
  }

  const missing = s.coverage.sourceAbsentWindows.filter((w) => w.year === latest);
  if (missing.length) {
    const last = Math.max(...present, 0);
    out.push({ text: `No ${festival} ${latest} table in the reports — last tested ${last || "never"}. Treat as untested, not clean.`, ids: [], tone: "gap" });
  }
  return out;
}

/** Everything the planning view needs for a given date: festival-specific history, findings and a dated action plan. */
export function buildOutlook(today: string): Outlook {
  const campaign = campaignFor(today);
  const festival = campaign.festival?.festival ?? null;
  const filters: Filters = { ...DEFAULT_FILTERS, festival: festival ?? "all" };
  const ranked = rankSites(observations, sites, engine, filters);
  const scoped = observations.filter((o) => festival === null || o.festival === festival);
  const outlook: SiteOutlook[] = ranked.map((s) => ({
    summary: s,
    windows: festival ? windowsFor(s.id, festival, scoped) : [],
    findings: findingsFor(s, festival, scoped),
  }));

  const steps: ActionStep[] = [];
  const f = campaign.festival;
  if (f) {
    const status = (from: string, to: string): ActionStep["status"] => (to < today ? "past" : from <= today ? "now" : "upcoming");
    const order: Record<SiteSummary["samplingPriority"], number> = { urgent_retest: 0, priority_retest: 1, routine_verify: 2 };
    const byNeed = [...ranked].sort((a, b) => order[a.samplingPriority] - order[b.samplingPriority] || (a.rank ?? 99) - (b.rank ?? 99));
    const dayBefore = addDays(f.date, -1);
    const absent = ranked.filter((s) => s.coverage.sourceAbsentWindows.length);
    const severe = ranked.filter((s) => s.severeObservationIds.length);
    const note = (s: SiteSummary) => siteNote(s, scoped, f.festival);
    const d = (iso: string) => fmtDate(iso, { day: "numeric", month: "short" });

    steps.push({
      key: "pre",
      from: today < f.date ? today : f.date,
      to: dayBefore,
      status: status(today, dayBefore),
      kind: "sample",
      title: "Take baseline samples",
      detail: `Measure DO, BOD and pH at every ghat before immersion starts, worst history first. Without a baseline, ${d(f.date)} readings cannot be compared.`,
      how: [
        "Collect one sample per ghat before immersion begins.",
        "Record the exact sampling point; repeat at the same point later.",
        "Order below is by past " + f.festival + " readings, not by current water quality.",
      ],
      sites: byNeed.map((s) => ({ id: s.id, note: note(s).text, evidenceIds: note(s).ids })),
      siteIds: byNeed.map((s) => s.id),
      evidenceIds: severe.flatMap((s) => s.severeObservationIds).slice(0, 12),
    });
    if (absent.length) {
      steps.push({
        key: "request",
        from: today,
        to: dayBefore,
        status: status(today, dayBefore),
        kind: "request",
        title: "Ask MPPCB for missing reports",
        detail: `The supplied reports have no ${f.festival} table for ${absent.length} ghat${absent.length > 1 ? "s" : ""}. Until found, treat them as untested — not clean.`,
        how: ["Write to MPPCB Regional Office, Bhopal, asking whether these tables exist.", "If they do not, these ghats need a full pre / during / after series this year."],
        sites: absent.map((s) => ({ id: s.id, note: `No ${s.coverage.sourceAbsentWindows.map((a) => `${a.year} ${a.festival}`).join(", ")} table`, evidenceIds: [] })),
        siteIds: absent.map((s) => s.id),
        evidenceIds: [],
      });
    }
    if (severe.length) {
      steps.push({
        key: "inspect",
        from: today,
        to: dayBefore,
        status: status(today, dayBefore),
        kind: "inspect",
        title: "Inspect the worst-history ghats",
        detail: `These ghats recorded DO ≤ ${SCORING.severeTriggers.doAtOrBelow} mg/l or BOD ≥ ${SCORING.severeTriggers.bodAtOrAbove} mg/l in past ${f.festival} seasons.`,
        how: ["Visit before immersion: look for stagnant water, waste, drains and outfalls.", "Plan cleaning and idol-collection arrangements.", "Send any aeration or treatment decision to the technical team."],
        sites: severe.map((s) => ({ id: s.id, note: note(s).text, evidenceIds: note(s).ids })),
        siteIds: severe.map((s) => s.id),
        evidenceIds: severe.flatMap((s) => s.severeObservationIds).slice(0, 12),
      });
    }
    steps.push({
      key: "during",
      from: f.date,
      to: f.date,
      status: status(f.date, f.date),
      kind: "sample",
      title: "Sample on visarjan day",
      detail: "Repeat DO, BOD and pH at the same points while immersion is happening.",
      how: ["Same ghats, same points, same three parameters.", "Note the sampling time."],
      sites: [],
      siteIds: ranked.map((s) => s.id),
      evidenceIds: [],
    });
    steps.push({
      key: "after",
      from: campaign.afterDate as string,
      to: campaign.afterDate as string,
      status: status(campaign.afterDate as string, campaign.afterDate as string),
      kind: "sample",
      title: "Sample one week later",
      detail: "MPPCB's third phase. It shows whether water recovered after immersion.",
      how: ["Same points again on " + d(campaign.afterDate as string) + ".", "Compare with the baseline, not with Class B alone."],
      sites: [],
      siteIds: ranked.map((s) => s.id),
      evidenceIds: [],
    });
  }

  const zeroDo = scoped.filter((o) => o.parameter === "Dissolved oxygen" && o.measurementStatus === "numeric" && o.numericValue === 0);
  const doNum = scoped.filter((o) => o.parameter === "Dissolved oxygen" && o.measurementStatus === "numeric");
  const doLow = doNum.filter((o) => o.benchmarkStatus === "outside_screening_benchmark");
  const bodNum = scoped.filter((o) => o.parameter === "BOD" && o.measurementStatus === "numeric");
  const bodHigh = bodNum.filter((o) => o.benchmarkStatus === "outside_screening_benchmark");
  const headline: Finding[] = [
    { text: `${doLow.length} of ${doNum.length} ${festival ?? ""} DO readings below 5 mg/l`.replace("  ", " "), ids: doLow.map((o) => o.id), tone: "warning" },
    { text: `${bodHigh.length} of ${bodNum.length} ${festival ?? ""} BOD readings above 3 mg/l`.replace("  ", " "), ids: bodHigh.map((o) => o.id), tone: "warning" },
  ];
  if (zeroDo.length) headline.push({ text: `${zeroDo.length} reading${zeroDo.length > 1 ? "s" : ""} of DO = 0 mg/l`, ids: zeroDo.map((o) => o.id), tone: "critical" });

  let risks: RiskCard[] = [];
  let watch: RiskCard | null = null;
  if (festival) {
    const urgent = ranked.filter((s) => s.samplingPriority === "urgent_retest");
    const pool = urgent.length ? urgent : ranked.filter((s) => s.rank !== null).slice(0, 3);
    risks = pool.map((s) => ({ siteId: s.id, reasons: riskReasons(s, ranked, scoped, festival).slice(0, 3) }));
    const w = ranked.find((s) => !pool.includes(s) && s.coverage.sourceAbsentWindows.length);
    if (w) watch = { siteId: w.id, reasons: riskReasons(w, ranked, scoped, festival).slice(0, 2) };
  }

  return { campaign, festival, filters, sites: outlook, steps, headline, risks, watch };
}
