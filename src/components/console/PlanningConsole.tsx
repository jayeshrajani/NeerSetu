"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Info, Pause, Play, RotateCcw } from "lucide-react";
import type { Basis } from "@/lib/geo";
import type { FestivalWindow } from "@/lib/outlook";
import type { LabelAnchor, MapSite, Stage } from "@/components/map/GhatMapScene";
import { markerHeight } from "@/components/map/markerHeight";
import { MapFallback2D } from "@/components/console/MapFallback2D";

const GhatMapScene = dynamic(() => import("@/components/map/GhatMapScene"), { ssr: false });

export interface ConsoleSite {
  id: string;
  name: string;
  nameHi: string;
  short: string;
  waterBody: string;
  rank: number | null;
  index: number | null;
  concern: string;
  concernLabel: string;
  hex: string;
  priority: "urgent_retest" | "priority_retest" | "routine_verify";
  priorityLabel: string;
  priorityWhy: string;
  ambiguous: boolean;
  anchors: { x: number; z: number; basis: Basis; label: string; basisLabel: string; osm: string }[];
  windows: FestivalWindow[];
  numericComparable: number;
  findings: { text: string; tone: "critical" | "warning" | "gap" | "info"; cite: { href: string; label: string; more: number } | null }[];
}

export interface ConsoleData {
  today: string;
  todayLabel: string;
  overridden: boolean;
  dateError: string | null;
  campaign: {
    festival: string | null;
    name: string | null;
    date: string | null;
    dateLabel: string | null;
    daysTo: number | null;
    stage: string;
    stageLabel: string;
    source: string | null;
    sourceUrl: string | null;
  };
  headline: string[];
  risks: RiskCardData[];
  watch: RiskCardData | null;
  steps: {
    key: string;
    from: string;
    to: string;
    fromLabel: string;
    toLabel: string;
    status: "past" | "now" | "upcoming";
    title: string;
    detail: string;
    how: string[];
    sites: { id: string; note: string; cite: { href: string; label: string } | null }[];
    siteIds: string[];
    evidenceIds: string[];
    kind: string;
  }[];
  sites: ConsoleSite[];
  lakes: { id: string; name: string; x: number; z: number }[];
  meta: { years: string; rows: number; attribution: string };
}

const TONE: Record<string, string> = {
  critical: "bg-crit-400",
  warning: "bg-warn-400",
  gap: "hatch border border-gap-400",
  info: "bg-fog-500",
};

const PRIORITY_TEXT: Record<ConsoleSite["priority"], string> = {
  urgent_retest: "text-crit-300",
  priority_retest: "text-warn-300",
  routine_verify: "text-fog-300",
};

let webglCache: boolean | undefined;
function hasWebGL() {
  if (webglCache !== undefined) return webglCache;
  try {
    const c = document.createElement("canvas");
    webglCache = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webglCache = false;
  }
  return webglCache;
}
const noop = () => () => {};
const subscribeMotion = (cb: () => void) => {
  const m = window.matchMedia("(prefers-reduced-motion: reduce)");
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

function Seasons({ windows, festival, size = "sm" }: { windows: FestivalWindow[]; festival: string | null; size?: "sm" | "lg" }) {
  return (
    <div className={`flex ${size === "lg" ? "gap-4" : "gap-1"}`} aria-label={`${festival ?? ""} seasons 2023 to 2025`}>
      {windows.map((w) => {
        const cls = !w.present ? "hatch border border-gap-400/70" : w.numeric === 0 ? "border border-dashed border-gap-400" : w.outside > 0 ? "bg-crit-400" : "bg-sage-400";
        const title = !w.present ? `${w.year}: no table in the reports` : `${w.year}: ${w.outside} of ${w.numeric} DO/BOD/pH readings outside screening`;
        return size === "lg" ? (
          <div key={w.year} className="flex items-center gap-2">
            <span className={`size-3 ${cls}`} />
            <span className="num text-xs text-fog-300">
              {w.year} <span className="text-fog-500">{w.present ? `${w.outside}/${w.numeric} out` : "no table"}</span>
            </span>
          </div>
        ) : (
          <span key={w.year} title={title} className={`size-2.5 ${cls}`} />
        );
      })}
    </div>
  );
}

export function PlanningConsole({ data, initialView, initialSite }: { data: ConsoleData; initialView: "india" | "bhopal"; initialSite: string | null }) {
  const [rawStage, setStage] = useState<Stage>(initialView === "bhopal" ? "bhopal" : "india");
  const webgl = useSyncExternalStore<boolean | null>(noop, hasWebGL, () => null);
  const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
  const [motionPref, setMotionPref] = useState<boolean | null>(null);
  const animate = motionPref ?? !reduced;
  const setAnimate = (fn: (a: boolean) => boolean) => setMotionPref(fn(animate));
  const stage: Stage = webgl === false ? "bhopal" : rawStage;
  const [selectedId, setSelectedId] = useState<string | null>(initialSite && data.sites.some((s) => s.id === initialSite) ? initialSite : null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [openStep, setOpenStep] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const labelRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    if (stage !== "bhopal") return;
    const q = new URLSearchParams(window.location.search);
    q.set("view", "map");
    if (selectedId) q.set("site", selectedId);
    else q.delete("site");
    window.history.replaceState(null, "", `/?${q.toString()}`);
  }, [stage, selectedId]);

  const mapSites: MapSite[] = useMemo(
    () => data.sites.map((s) => ({ id: s.id, short: s.short, rank: s.rank, index: s.index, hex: s.hex, urgent: s.priority === "urgent_retest", anchors: s.anchors })),
    [data.sites],
  );
  const labelAnchors: LabelAnchor[] = useMemo(
    () => [
      ...data.sites.flatMap((s) => s.anchors.map((a, i) => ({ key: `site:${s.id}:${i}`, pos: [a.x, markerHeight(s.index) + 0.15, a.z] as [number, number, number] }))),
      ...data.lakes.map((l) => ({ key: `lake:${l.id}`, pos: [l.x, 0.05, l.z] as [number, number, number], minDist: 70 })),
    ],
    [data.sites, data.lakes],
  );
  const setLabel = useCallback((key: string) => (el: HTMLElement | null) => {
    if (el) labelRefs.current.set(key, el);
    else labelRefs.current.delete(key);
  }, []);

  const selected = data.sites.find((s) => s.id === selectedId) ?? null;
  const c = data.campaign;
  const fest = c.festival;
  const festQ = fest ? `?festival=${fest}` : "";

  return (
    <div className="relative grid lg:h-[calc(100dvh-52px)] lg:min-h-[600px] lg:grid-cols-[minmax(0,1fr)_auto]">
      {/* map */}
      <section aria-label="Map of Bhopal immersion sites" className="relative h-[58vh] min-h-[380px] overflow-hidden bg-ink-950 lg:h-auto">
        {webgl === false ? (
          <MapFallback2D sites={data.sites} selectedId={selectedId} onSelect={setSelectedId} />
        ) : webgl ? (
          <GhatMapScene
            sites={mapSites}
            stage={stage}
            onArrive={() => setStage("bhopal")}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            onSelect={setSelectedId}
            labelRefs={labelRefs}
            labelAnchors={labelAnchors}
            animate={animate}
          />
        ) : null}

        {/* projected labels */}
        {webgl && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            {data.lakes.map((l) => (
              <span key={l.id} ref={setLabel(`lake:${l.id}`)} style={{ opacity: 0 }} className="absolute left-0 top-0 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-[#9fc3c9]/80 transition-opacity">
                {l.name}
              </span>
            ))}
            {data.sites.map((s) =>
              s.anchors.map((a, i) => {
                const on = hoveredId === s.id || selectedId === s.id;
                return (
                  <span
                    key={`${s.id}-${i}`}
                    ref={setLabel(`site:${s.id}:${i}`)}
                    data-hidden={i > 0 && !on ? "1" : "0"}
                    style={{ opacity: 0 }}
                    className={`absolute left-0 top-0 whitespace-nowrap border px-1.5 py-0.5 text-[11px] leading-tight transition-colors ${on ? "z-10 border-fog-100 bg-fog-100 text-ink-950" : selectedId ? "border-ink-700 bg-ink-950/80 text-fog-500" : "border-ink-600 bg-ink-950/85 text-fog-100"}`}
                  >
                    <span className="num mr-1 text-[10px] opacity-70">{s.rank ?? "–"}</span>
                    {s.short}
                    {s.anchors.length > 1 && <span className="ml-1 opacity-70">?{i + 1}</span>}
                  </span>
                );
              }),
            )}
          </div>
        )}

        {/* intro */}
        <AnimatePresence>
          {stage === "india" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.35 } }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950 via-ink-950/85 to-transparent px-5 pb-8 pt-24 sm:px-10 sm:pb-12"
            >
              <div className="max-w-[680px]">
                <p className="eyebrow">
                  {data.todayLabel} · IST {data.overridden ? "· rehearsal date" : "· today"}
                </p>
                {c.daysTo !== null && c.daysTo >= 0 ? (
                  <p className="mt-4 text-lg text-fog-300">
                    <span className="num text-4xl font-medium text-marigold-400 sm:text-5xl">{c.daysTo}</span>
                    <span className="ml-3">day{c.daysTo === 1 ? "" : "s"} to {c.name?.replace(/ \d{4}$/, "")} · {c.dateLabel}</span>
                  </p>
                ) : (
                  <p className="mt-4 text-lg text-fog-300">{c.stageLabel}</p>
                )}
                <h1 className="mt-4 text-[28px] font-semibold leading-[1.15] tracking-tight sm:text-[40px]">
                  Seven ghats. Three years of readings. Where should the water be tested first?
                </h1>
                <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-fog-300">
                  GhatWatch reads {data.meta.rows.toLocaleString("en-IN")} MPPCB measurements from {data.meta.years}, compares them with CPCB bathing-water
                  screening levels, and turns the {fest ?? "festival"} history into a dated plan for this year.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStage("flying")}
                    className="group inline-flex items-center gap-2 bg-marigold-400 px-5 py-3 text-[15px] font-medium text-ink-950 transition hover:bg-[#ffbb55]"
                  >
                    Test the waters <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                  </button>
                  <button type="button" onClick={() => setStage("bhopal")} className="px-3 py-3 text-sm text-fog-500 underline hover:text-fog-100">
                    Skip the fly-in
                  </button>
                </div>
                <p className="mt-6 text-[11px] text-fog-500">Historical data, not live. Ghat positions come from OpenStreetMap names, not surveys — each marker says how it was placed.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* map chrome */}
        {stage === "bhopal" && (
          <>
            <RankRail sites={data.sites} festival={fest} selectedId={selectedId} hoveredId={hoveredId} onSelect={setSelectedId} onHover={setHoveredId} />
            <div className="absolute right-3 top-3 flex gap-1">
              <button type="button" onClick={() => setSelectedId(null)} className={chip}>
                <RotateCcw className="size-3.5" aria-hidden /> Overview
              </button>
              {webgl && (
                <button type="button" onClick={() => setAnimate((a) => !a)} aria-pressed={!animate} className={chip}>
                  {animate ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />} Motion
                </button>
              )}
              <button type="button" onClick={() => setShowKey((k) => !k)} aria-expanded={showKey} className={chip}>
                <Info className="size-3.5" aria-hidden /> Key
              </button>
            </div>
            {showKey && (
              <div className="absolute right-3 top-12 w-[300px] border border-ink-600 bg-ink-900 p-3 text-[12px] text-fog-300">
                <p className="mb-2 font-medium text-fog-100">How markers are placed</p>
                <p className="mb-2 text-fog-500">The MPPCB reports have no coordinates. Markers use OpenStreetMap names:</p>
                <ul className="grid gap-1.5">
                  <li>▮ Solid column — place named on the report</li>
                  <li>◯ Ring around it — only the lake is known</li>
                  <li>▯ Wireframe — name match only (weak)</li>
                  <li>┄ Dashed link — one record, two possible places</li>
                </ul>
                <p className="mt-2 text-fog-500">Height = concern score. Red pulse = urgent re-test.</p>
              </div>
            )}
            <p className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-fog-500">© OpenStreetMap contributors · Natural Earth · positions approximate</p>
          </>
        )}
      </section>

      {/* plan panel */}
      <AnimatePresence>
        {stage === "bhopal" && (
          <motion.aside
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="flex min-h-0 w-full flex-col border-t keyline bg-ink-900 lg:w-[420px] lg:border-l lg:border-t-0"
            aria-label="What to do next"
          >
            {selected ? (
              <SiteSheet site={selected} data={data} festQ={festQ} onBack={() => setSelectedId(null)} />
            ) : (
              <>
                <header className="border-b keyline px-6 pb-5 pt-6">
                  {c.date ? (
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[13px] text-fog-500">{data.overridden ? `Rehearsal date ${data.todayLabel}` : `Today, ${data.todayLabel}`}</p>
                        <h2 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight">{c.name?.replace(/ \d{4}$/, "")}</h2>
                        <p className="text-[13px] text-fog-300">{c.dateLabel}</p>
                      </div>
                      {c.daysTo !== null && c.daysTo >= 0 && (
                        <p className="num text-right leading-none">
                          <span className="block text-[44px] text-marigold-400">{c.daysTo}</span>
                          <span className="text-[11px] text-fog-500">day{c.daysTo === 1 ? "" : "s"} left</span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <h2 className="text-xl font-semibold">{c.stageLabel}</h2>
                  )}
                  {data.dateError && <p className="mt-2 text-xs text-crit-300">{data.dateError}</p>}
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  <RankRail className="border-b keyline lg:hidden" sites={data.sites} festival={fest} selectedId={selectedId} hoveredId={hoveredId} onSelect={setSelectedId} onHover={setHoveredId} />
                  {data.risks.length > 0 && (
                    <section aria-labelledby="risk-h" className="border-b keyline px-6 pb-5 pt-5">
                      <h3 id="risk-h" className="text-[13px] font-medium text-fog-500">
                        Highest risk this {fest ?? "festival"}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-fog-500">All seven ghats assumed in use. Based on past {fest} readings, not today&apos;s water.</p>
                      <ol className="mt-3 grid gap-3">
                        {data.risks.map((r) => (
                          <RiskItem key={r.siteId} card={r} site={data.sites.find((s) => s.id === r.siteId)!} onSite={setSelectedId} onHover={setHoveredId} />
                        ))}
                      </ol>
                      {data.watch && (
                        <div className="mt-4 border-t keyline pt-3">
                          <p className="text-[11px] text-fog-500">Also watch — high score, but missing recent data</p>
                          <ol className="mt-2">
                            <RiskItem card={data.watch} site={data.sites.find((s) => s.id === data.watch!.siteId)!} onSite={setSelectedId} onHover={setHoveredId} muted />
                          </ol>
                        </div>
                      )}
                    </section>
                  )}
                  <h3 className="px-6 pb-2 pt-5 text-[13px] font-medium text-fog-500">What to do next</h3>
                  <ol>
                    {data.steps.map((s, i) => (
                      <StepItem
                        key={s.key}
                        n={i + 1}
                        step={s}
                        open={openStep === s.key}
                        onToggle={() => setOpenStep(openStep === s.key ? null : s.key)}
                        sites={data.sites}
                        onSite={setSelectedId}
                        onHover={setHoveredId}
                      />
                    ))}
                  </ol>
                  {c.source && (
                    <p className="px-6 py-5 text-[11px] leading-relaxed text-fog-500">
                      Order based on past {fest} seasons ({data.meta.years}), not current water quality. Visarjan date: {c.source}.
                    </p>
                  )}
                </div>

                <footer className="flex items-center gap-4 border-t keyline px-6 py-3 text-[13px]">
                  <Link
                    href={`/brief?sites=${data.sites.filter((s) => s.priority === "urgent_retest").slice(0, 3).map((s) => s.id).join(",")}${fest ? `&festival=${fest}` : ""}`}
                    className="bg-fog-100 px-3 py-1.5 font-medium text-ink-950 hover:bg-white"
                  >
                    Draft officer brief
                  </Link>
                  <Link href={`/ranking${festQ}`} className="text-fog-500 hover:text-fog-100">
                    Full table
                  </Link>
                  <Link href="/methodology" className="text-fog-500 hover:text-fog-100">
                    Method
                  </Link>
                </footer>
              </>
            )}
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

const chip = "inline-flex items-center gap-1.5 border border-ink-600 bg-ink-900/95 px-2.5 py-1.5 text-xs text-fog-300 hover:text-fog-100";

interface RiskCardData {
  siteId: string;
  reasons: { text: string; tone: string; cite: { href: string; label: string } | null }[];
}

function RiskItem({ card, site, onSite, onHover, muted = false }: { card: RiskCardData; site: ConsoleSite; onSite: (id: string) => void; onHover: (id: string | null) => void; muted?: boolean }) {
  return (
    <li onMouseEnter={() => onHover(site.id)} onMouseLeave={() => onHover(null)}>
      <button type="button" onClick={() => onSite(site.id)} className="flex w-full items-baseline gap-2 text-left">
        <span className="size-2 shrink-0" style={{ background: site.hex }} />
        <span className={`text-[15px] ${muted ? "text-fog-300" : "text-fog-100"} underline decoration-ink-600 underline-offset-4 hover:decoration-fog-300`}>{site.name}</span>
        <span className="num ml-auto text-[11px] text-fog-500">#{site.rank ?? "–"}</span>
      </button>
      <ul className="mt-1.5 grid gap-1 pl-4">
        {card.reasons.map((r, i) => (
          <li key={i} className="text-[12.5px] leading-relaxed text-fog-300">
            {r.text}
            {r.cite && (
              <a href={r.cite.href} target="_blank" rel="noopener" className="num ml-1 whitespace-nowrap text-[11px] text-fog-500 underline hover:text-fog-100">
                {r.cite.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </li>
  );
}

function RankRail({
  sites,
  festival,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  className,
}: {
  sites: ConsoleSite[];
  festival: string | null;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  className?: string;
}) {
  return (
    <nav aria-label="Ghats ranked" className={className ?? "absolute left-3 top-3 hidden w-[236px] border border-ink-600 bg-ink-900/95 lg:block"}>
      <p className="border-b keyline px-3 py-2 text-[12px] text-fog-500">Ghats, ranked on past {festival ?? ""} seasons</p>
      <ol>
        {sites.map((s) => {
          const on = selectedId === s.id || hoveredId === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                onMouseEnter={() => onHover(s.id)}
                onMouseLeave={() => onHover(null)}
                aria-current={selectedId === s.id ? "true" : undefined}
                className={`grid w-full grid-cols-[18px_8px_1fr_auto] items-center gap-2 px-3 py-1.5 text-left text-[13px] transition ${on ? "bg-ink-700 text-fog-100" : "text-fog-300 hover:bg-ink-800"}`}
              >
                <span className="num text-[11px] text-fog-500">{s.rank ?? "–"}</span>
                <span className="size-2" style={{ background: s.hex }} />
                <span className="truncate">
                  {s.short}
                  {s.priority === "urgent_retest" && <span className="ml-1.5 text-crit-300" title="Urgent re-test">●</span>}
                </span>
                <span className="num text-[11px] text-fog-500">{s.index !== null ? Math.round(s.index) : "n/a"}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepItem({
  n,
  step,
  open,
  onToggle,
  sites,
  onSite,
  onHover,
}: {
  n: number;
  step: ConsoleData["steps"][number];
  open: boolean;
  onToggle: () => void;
  sites: ConsoleSite[];
  onSite: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const when = step.from === step.to ? step.toLabel : step.status === "now" ? `by ${step.toLabel}` : `${step.fromLabel} – ${step.toLabel}`;
  return (
    <li className={`border-t keyline ${step.status === "past" ? "opacity-40" : ""}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="grid w-full grid-cols-[24px_1fr_auto] items-baseline gap-3 px-6 py-3.5 text-left hover:bg-ink-850">
        <span className={`num text-[13px] ${step.status === "now" ? "text-marigold-400" : "text-fog-500"}`}>{n}</span>
        <span className="text-[15px] text-fog-100">{step.title}</span>
        <span className="num whitespace-nowrap text-[12px] text-fog-500">{step.status === "past" ? "closed" : when}</span>
      </button>
      {open && (
        <div className="grid gap-3 px-6 pb-5 pl-[60px] text-[13px] leading-relaxed text-fog-300">
          <p>{step.detail}</p>
          <ul className="grid gap-1">
            {step.how.map((h, i) => (
              <li key={i} className="grid grid-cols-[10px_1fr] gap-2">
                <span className="text-fog-500">–</span>
                <span>{h}</span>
              </li>
            ))}
          </ul>
          {step.sites.length > 0 && (
            <ol className="grid border-t keyline">
              {step.sites.map((x, i) => {
                const s = sites.find((y) => y.id === x.id)!;
                return (
                  <li key={x.id} className="grid grid-cols-[16px_1fr_auto] items-baseline gap-2 border-b keyline py-2">
                    <span className="num text-[11px] text-fog-500">{i + 1}</span>
                    <button type="button" onClick={() => onSite(x.id)} onMouseEnter={() => onHover(x.id)} onMouseLeave={() => onHover(null)} className="text-left">
                      <span className="text-fog-100 underline decoration-ink-600 underline-offset-4 hover:decoration-fog-300">{s.short}</span>
                      <span className="block text-[12px] text-fog-500">{x.note}</span>
                    </button>
                    {x.cite && (
                      <a href={x.cite.href} target="_blank" rel="noopener" className="num text-[11px] text-fog-500 underline hover:text-fog-100">
                        {x.cite.label}
                      </a>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}
    </li>
  );
}

function SiteSheet({ site, data, festQ, onBack }: { site: ConsoleSite; data: ConsoleData; festQ: string; onBack: () => void }) {
  const marker = site.anchors[0]!;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
      <button type="button" onClick={onBack} className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-fog-500 hover:text-fog-100">
        <ArrowLeft className="size-3.5" aria-hidden /> What to do next
      </button>
      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <p className="num text-[12px] text-fog-500">#{site.rank ?? "–"} of {data.sites.length}</p>
          <h3 className="text-[22px] font-semibold leading-tight tracking-tight">{site.name}</h3>
          <p className="font-hindi text-[14px] text-fog-500">{site.nameHi}</p>
        </div>
        <p className="num text-[32px] leading-none" style={{ color: site.hex }}>
          {site.index !== null ? Math.round(site.index) : "n/a"}
        </p>
      </div>
      <p className={`mt-3 text-[14px] ${PRIORITY_TEXT[site.priority]}`}>{site.priorityLabel}</p>

      <div className="mt-5">
        <Seasons windows={site.windows} festival={data.campaign.festival} size="lg" />
      </div>

      <ul className="mt-5 grid gap-3 border-t keyline pt-4">
        {site.findings.slice(0, 4).map((f, i) => (
          <li key={i} className="grid grid-cols-[10px_1fr] gap-3 text-[13px] leading-relaxed text-fog-300">
            <span className={`mt-1.5 size-2 ${TONE[f.tone]}`} />
            <span>
              {f.text}
              {f.cite && (
                <a href={f.cite.href} target="_blank" rel="noopener" className="num ml-1.5 whitespace-nowrap text-[11px] text-fog-500 underline hover:text-fog-100">
                  {f.cite.label}
                </a>
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-5 border-t keyline pt-4 text-[12px] text-fog-500">
        Map position: {marker.basisLabel.toLowerCase()}
        {site.anchors.length > 1 ? " · two candidate places" : ""}.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={`/ghats/${site.id}${festQ}`} className="bg-fog-100 px-3 py-2 text-[13px] font-medium text-ink-950 hover:bg-white">
          All readings & sources
        </Link>
        <Link href={`/brief?sites=${site.id}${festQ ? `&${festQ.slice(1)}` : ""}`} className="border border-ink-600 px-3 py-2 text-[13px] text-fog-300 hover:text-fog-100">
          Brief
        </Link>
      </div>
    </div>
  );
}
