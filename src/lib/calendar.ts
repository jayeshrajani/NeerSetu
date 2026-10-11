import type { Festival } from "@/types/ghatwatch";

export interface FestivalDate {
  festival: Festival;
  name: string;
  nameHi: string;
  /** Visarjan day, Asia/Kolkata calendar date. */
  date: string;
  source: string;
  sourceUrl: string;
}

/** Only dates with a citable source. Add next year's dates here when they are published. */
export const FESTIVAL_CALENDAR: FestivalDate[] = [
  {
    festival: "Durga",
    name: "Durga visarjan 2026",
    nameHi: "दुर्गा विसर्जन 2026",
    date: "2026-10-20",
    source: "Track 2 participant guide (organisers), citing Drik Panchang",
    sourceUrl: "https://www.drikpanchang.com/navratri/durga-puja/durga-visarjan-date-time.html?year=2026",
  },
];

/** MPPCB samples one week after immersion (the CSV's "after" phase). */
export const AFTER_PHASE_DAYS = 7;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function isoInKolkata(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Today's date in IST, or a validated ?asOf=YYYY-MM-DD override (for rehearsals). */
export function resolveToday(asOf: string | undefined, now: Date = new Date()): { today: string; overridden: boolean; error?: string } {
  if (asOf) {
    const t = Date.parse(`${asOf}T00:00:00Z`);
    if (ISO.test(asOf) && Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === asOf) return { today: asOf, overridden: true };
    return { today: isoInKolkata(now), overridden: false, error: "Ignored invalid asOf date (use YYYY-MM-DD)." };
  }
  return { today: isoInKolkata(now), overridden: false };
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  return new Intl.DateTimeFormat("en-IN", { ...opts, timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

export type CampaignStage = "preparation" | "pre_window" | "visarjan_day" | "post_window" | "none";

export interface Campaign {
  today: string;
  festival: FestivalDate | null;
  daysToVisarjan: number | null;
  stage: CampaignStage;
  afterDate: string | null;
  stageLabel: string;
}

/** The festival the officer is preparing for: next visarjan, or the one whose one-week follow-up is still open. */
export function campaignFor(today: string, calendar: FestivalDate[] = FESTIVAL_CALENDAR): Campaign {
  const sorted = [...calendar].sort((a, b) => a.date.localeCompare(b.date));
  const active = sorted.find((f) => daysBetween(today, addDays(f.date, AFTER_PHASE_DAYS)) >= 0) ?? null;
  if (!active) return { today, festival: null, daysToVisarjan: null, stage: "none", afterDate: null, stageLabel: "No upcoming visarjan date configured" };
  const d = daysBetween(today, active.date);
  const afterDate = addDays(active.date, AFTER_PHASE_DAYS);
  const stage: CampaignStage = d > 7 ? "preparation" : d > 0 ? "pre_window" : d === 0 ? "visarjan_day" : "post_window";
  const stageLabel =
    stage === "preparation"
      ? `${d} days to ${active.name.replace(/ \d{4}$/, "")}`
      : stage === "pre_window"
        ? `${d} day${d === 1 ? "" : "s"} to visarjan — pre-immersion sampling window`
        : stage === "visarjan_day"
          ? "Visarjan day — during-immersion sampling"
          : `Post-immersion follow-up — one-week sample due ${fmtDate(afterDate, { day: "numeric", month: "short" })}`;
  return { today, festival: active, daysToVisarjan: d, stage, afterDate, stageLabel };
}
