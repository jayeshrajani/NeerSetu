import type { Metadata } from "next";
import { buildOutlook, type RiskCard } from "@/lib/outlook";
import { resolveToday, fmtDate } from "@/lib/calendar";
import { getObservation, manifest } from "@/lib/data";
import { citationFor } from "@/lib/provenance";
import { geo, project, BASIS_LABEL } from "@/lib/geo";
import { CONCERN_UI, PRIORITY_UI } from "@/lib/ui-labels";
import { shortName } from "@/lib/names";
import { PlanningConsole, type ConsoleData } from "@/components/console/PlanningConsole";

export const metadata: Metadata = { title: { absolute: "NeerSetu" } };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function Home({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const t = resolveToday(one(sp.asOf));
  const o = buildOutlook(t.today);

  // Sites that share one anchor point (same lake centre) are fanned out so both stay clickable.
  const placed = new Map<string, number>();
  const sites: ConsoleData["sites"] = o.sites.map(({ summary: s, windows, findings }) => {
    const g = geo.sites.find((x) => x.siteId === s.id)!;
    const anchors = g.anchors.map((a) => {
      let [x, z] = project(a.lon, a.lat);
      const key = `${a.lon.toFixed(4)},${a.lat.toFixed(4)}`;
      const n = placed.get(key) ?? 0;
      placed.set(key, n + 1);
      if (n > 0) {
        x += Math.cos(n * 2.1) * 0.45;
        z += Math.sin(n * 2.1) * 0.45;
      }
      return { x, z, basis: a.basis, label: a.label, basisLabel: BASIS_LABEL[a.basis], osm: a.osm };
    });
    return {
      id: s.id,
      name: s.canonicalName,
      nameHi: s.nameHi,
      short: shortName(s.canonicalName),
      waterBody: s.waterBody,
      rank: s.rank,
      index: s.concernIndex,
      concern: s.historicalConcern,
      concernLabel: CONCERN_UI[s.historicalConcern].short,
      hex: CONCERN_UI[s.historicalConcern].hex,
      priority: s.samplingPriority,
      priorityLabel: PRIORITY_UI[s.samplingPriority].label,
      priorityWhy: s.samplingPriorityWhy,
      ambiguous: s.needsIdentityVerification,
      anchors,
      windows,
      numericComparable: s.components?.numericComparable ?? 0,
      findings: findings.map((f) => {
        const first = f.ids.map(getObservation).find(Boolean);
        const c = first ? citationFor(first) : null;
        return {
          text: f.text,
          tone: f.tone,
          cite: c ? { href: c.localUrl, label: `MPPCB ${c.reportYear}${c.page ? ` p.${c.page}` : ""}`, more: f.ids.length - 1 } : null,
        };
      }),
    };
  });

  const toCard = (r: RiskCard) => ({
    siteId: r.siteId,
    reasons: r.reasons.map((f) => {
      const obs = f.ids.map(getObservation).find(Boolean);
      const c = obs ? citationFor(obs) : null;
      return { text: f.text, tone: f.tone, cite: c ? { href: c.localUrl, label: `${c.reportYear} p.${c.page}` } : null };
    }),
  });

  const data: ConsoleData = {
    today: t.today,
    todayLabel: fmtDate(t.today, { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
    overridden: t.overridden,
    dateError: t.error ?? null,
    campaign: {
      festival: o.festival,
      name: o.campaign.festival?.name ?? null,
      date: o.campaign.festival?.date ?? null,
      dateLabel: o.campaign.festival ? fmtDate(o.campaign.festival.date, { day: "numeric", month: "short", year: "numeric" }) : null,
      daysTo: o.campaign.daysToVisarjan,
      stage: o.campaign.stage,
      stageLabel: o.campaign.stageLabel,
      source: o.campaign.festival?.source ?? null,
      sourceUrl: o.campaign.festival?.sourceUrl ?? null,
    },
    headline: o.headline.map((h) => h.text),
    risks: o.risks.map(toCard),
    watch: o.watch ? toCard(o.watch) : null,
    steps: o.steps.map((s) => ({
      ...s,
      fromLabel: fmtDate(s.from, { day: "numeric", month: "short" }),
      toLabel: fmtDate(s.to, { day: "numeric", month: "short" }),
      sites: s.sites.map((x) => {
        const obs = x.evidenceIds.map(getObservation).find(Boolean);
        const c = obs ? citationFor(obs) : null;
        return { id: x.id, note: x.note, cite: c ? { href: c.localUrl, label: `p.${c.page}` } : null };
      }),
    })),
    sites,
    lakes: geo.lakes.map((l) => {
      const [x, z] = project(l.center[0], l.center[1]);
      return { id: l.id, name: l.name, x, z };
    }),
    meta: {
      years: `${manifest.dataYearMin}–${manifest.dataYearMax}`,
      rows: manifest.primaryRowCount,
      attribution: `${geo.attribution.osm} ${geo.attribution.india}`,
    },
  };

  return <PlanningConsole data={data} initialView={one(sp.view) === "map" ? "bhopal" : "india"} initialSite={one(sp.site) ?? null} />;
}
