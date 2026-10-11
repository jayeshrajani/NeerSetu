"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ArrowLeft, ArrowRight, Info, Pause, Play, RotateCcw } from "lucide-react";
import type { Basis } from "@/lib/geo";
import type { FestivalWindow } from "@/lib/outlook";
import type { Insets, LabelAnchor, MapSite, Stage } from "@/components/map/GhatMapScene";
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

const EASE = [0.22, 1, 0.36, 1] as const;
const heroList: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.15 } },
};
const heroItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
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
  const stage: Stage = webgl === false ? "bhopal" : rawStage;
  const [selectedId, setSelectedId] = useState<string | null>(initialSite && data.sites.some((s) => s.id === initialSite) ? initialSite : null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [openStep, setOpenStep] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [recenter, setRecenter] = useState(0);
  const [chromeIn, setChromeIn] = useState(false);
  const chromeRef = useRef(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Map<string, HTMLElement>>(new Map());
  const sectionRef = useRef<HTMLElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const showChrome = stage === "bhopal" || chromeIn;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: Math.round(e!.contentRect.width), h: Math.round(e!.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const lg = box.w >= 1024;
  const insets: Insets = useMemo(() => {
    if (stage === "india") return lg ? { left: Math.min(640, box.w * 0.46), right: 0, top: 0, bottom: 0 } : { left: 0, right: 0, top: 0, bottom: box.h * 0.55 };
    return lg ? { left: 270, right: 448, top: 0, bottom: 56 } : { left: 0, right: 0, top: 0, bottom: 44 };
  }, [stage, lg, box.w, box.h]);

  useEffect(() => {
    if (stage !== "bhopal") return;
    const q = new URLSearchParams(window.location.search);
    q.set("view", "map");
    if (selectedId) q.set("site", selectedId);
    else q.delete("site");
    window.history.replaceState(null, "", `/?${q.toString()}`);
  }, [stage, selectedId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        if (stage === "flying") setStage("bhopal");
        else if (showKey) setShowKey(false);
        else if (selectedId) setSelectedId(null);
      } else if (e.key === "Enter" && stage === "india" && e.target === document.body) {
        setStage("flying");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, selectedId, showKey]);

  const onProgress = useCallback((p: number) => {
    if (progressRef.current) progressRef.current.style.transform = `scaleX(${p.toFixed(3)})`;
    if (p > 0.72 && !chromeRef.current) {
      chromeRef.current = true;
      setChromeIn(true);
    }
  }, []);
  const onArrive = useCallback(() => setStage("bhopal"), []);

  const mapSites: MapSite[] = useMemo(
    () => data.sites.map((s) => ({ id: s.id, short: s.short, rank: s.rank, index: s.index, hex: s.hex, urgent: s.priority === "urgent_retest", anchors: s.anchors })),
    [data.sites],
  );
  const labelAnchors: LabelAnchor[] = useMemo(
    () => [
      { key: "bhopal", pos: [0, 1, 0], stages: ["india"], maxDist: Infinity, avoid: false },
      ...data.sites.flatMap((s) => s.anchors.map((a, i) => ({ key: `site:${s.id}:${i}`, pos: [a.x, markerHeight(s.index) + 0.15, a.z] as [number, number, number] }))),
      ...data.lakes.map((l) => ({ key: `lake:${l.id}`, pos: [l.x, 0.05, l.z] as [number, number, number], maxDist: 70, avoid: false })),
    ],
    [data.sites, data.lakes],
  );
  const setLabel = useCallback(
    (key: string) => (el: HTMLElement | null) => {
      if (el) labelRefs.current.set(key, el);
      else labelRefs.current.delete(key);
    },
    [],
  );

  const selected = data.sites.find((s) => s.id === selectedId) ?? null;
  const c = data.campaign;
  const fest = c.festival;
  const festQ = fest ? `?festival=${fest}` : "";
  const festName = c.name?.replace(/ \d{4}$/, "") ?? null;
  const upcoming = data.steps.filter((s) => s.status !== "past").slice(0, 4);

  return (
    <div className="relative lg:h-[calc(100dvh-52px)] lg:min-h-[640px]">
      {/* map */}
      <section
        ref={sectionRef}
        aria-label="Map of Bhopal immersion sites"
        className={`relative overflow-hidden bg-[#0b0f12] transition-[height] duration-700 ease-out ${showChrome ? "h-[62svh] min-h-[380px]" : "h-[calc(100svh-52px)] min-h-[560px]"} lg:absolute lg:inset-0 lg:h-auto lg:min-h-0`}
      >
        {webgl === false ? (
          <MapFallback2D sites={data.sites} selectedId={selectedId} onSelect={setSelectedId} />
        ) : webgl ? (
          <GhatMapScene
            sites={mapSites}
            stage={stage}
            onArrive={onArrive}
            onProgress={onProgress}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            onSelect={setSelectedId}
            labelRefs={labelRefs}
            labelAnchors={labelAnchors}
            insets={insets}
            animate={animate}
            recenter={recenter}
          />
        ) : null}

        {/* projected labels */}
        {webgl && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div ref={setLabel("bhopal")} style={{ opacity: 0 }} className="absolute left-0 top-0 flex flex-col items-center transition-opacity duration-500">
              <span className="border border-marigold-400/40 bg-ink-950/80 px-2.5 py-1.5 text-center backdrop-blur-sm">
                <span className="num block text-[10px] tracking-[0.18em] text-marigold-400">BHOPAL</span>
                <span className="block text-[12px] text-fog-100">
                  {data.sites.length} ghats · {data.lakes.length} lakes
                </span>
              </span>
              <span className="h-7 w-px bg-gradient-to-b from-marigold-400/70 to-transparent" />
            </div>
            {data.lakes.map((l) => (
              <span
                key={l.id}
                ref={setLabel(`lake:${l.id}`)}
                style={{ opacity: 0 }}
                className="absolute left-0 top-0 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.16em] text-[#a9d3da]/80 transition-opacity duration-300 [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]"
              >
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
                    className={`absolute left-0 top-0 inline-flex items-center gap-1.5 whitespace-nowrap border px-1.5 py-0.5 text-[11px] leading-tight backdrop-blur-sm transition-[opacity,color,background-color,border-color] duration-200 ${on ? "z-10 border-fog-100 bg-fog-100 text-ink-950" : selectedId ? "border-ink-700/70 bg-ink-950/60 text-fog-500" : "border-ink-600/80 bg-ink-950/75 text-fog-100"}`}
                  >
                    <span className="size-1.5" style={{ background: s.hex }} />
                    <span className="num text-[10px] opacity-70">{s.rank ?? "–"}</span>
                    {s.short}
                    {s.anchors.length > 1 && <span className="opacity-70">?{i + 1}</span>}
                  </span>
                );
              }),
            )}
          </div>
        )}

        {/* intro */}
        <AnimatePresence>
          {stage === "india" && (
            <motion.div key="hero" className="pointer-events-none absolute inset-0" exit={{ opacity: 0, transition: { duration: 0.6, ease: EASE } }}>
              <div className="absolute inset-0 bg-[linear-gradient(to_top,#0b0f12_40%,rgba(11,15,18,0.85)_58%,transparent_80%)] lg:bg-[linear-gradient(to_right,#0b0f12_0%,rgba(11,15,18,0.94)_30%,rgba(11,15,18,0.55)_46%,transparent_60%)]" />
              <motion.div
                variants={heroList}
                initial="hidden"
                animate="show"
                className="pointer-events-auto absolute inset-x-0 bottom-0 px-5 pb-8 sm:px-10 lg:inset-y-0 lg:right-auto lg:flex lg:w-[min(640px,46%)] lg:flex-col lg:justify-center lg:pb-0 lg:pl-14 lg:pr-4"
              >
                <motion.p variants={heroItem} className="eyebrow flex items-center gap-2">
                  <span className="size-1.5 animate-pulse bg-marigold-400" />
                  {data.todayLabel} · IST {data.overridden ? "· rehearsal date" : "· today"}
                </motion.p>

                {c.daysTo !== null && c.daysTo >= 0 ? (
                  <motion.div variants={heroItem} className="mt-5 flex items-end gap-4">
                    <span className="num text-[64px] leading-[0.8] tracking-tight text-marigold-400 sm:text-[88px]">{c.daysTo}</span>
                    <span className="pb-1">
                      <span className="block text-[15px] text-fog-100">
                        day{c.daysTo === 1 ? "" : "s"} to {festName} visarjan
                      </span>
                      <span className="num block text-[12px] text-fog-500">{c.dateLabel}</span>
                    </span>
                  </motion.div>
                ) : (
                  <motion.p variants={heroItem} className="mt-5 text-lg text-fog-300">
                    {c.stageLabel}
                  </motion.p>
                )}

                <motion.h1 variants={heroItem} className="mt-6 text-balance text-[28px] font-semibold leading-[1.1] tracking-tight sm:text-[40px] xl:text-[46px]">
                  Seven ghats. Three years of readings. <span className="text-fog-500">Where should the water be tested first?</span>
                </motion.h1>

                <motion.p variants={heroItem} className="mt-5 max-w-[54ch] text-[15px] leading-relaxed text-fog-300">
                  GhatWatch reads {data.meta.rows.toLocaleString("en-IN")} MPPCB measurements from {data.meta.years}, compares them with CPCB bathing-water screening levels,
                  and turns the {fest ?? "festival"} history into a dated plan for this year.
                </motion.p>

                {upcoming.length > 0 && (
                  <motion.ol variants={heroItem} className="mt-7 hidden border-t border-ink-700 sm:grid" style={{ gridTemplateColumns: `repeat(${upcoming.length}, minmax(0, 1fr))` }}>
                    {upcoming.map((s) => (
                      <li key={s.key} className="relative pr-3 pt-3">
                        <span className={`absolute -top-[3px] left-0 size-1.5 ${s.status === "now" ? "bg-marigold-400" : "bg-fog-700"}`} />
                        <span className={`num block text-[11px] ${s.status === "now" ? "text-marigold-400" : "text-fog-500"}`}>
                          {s.from === s.to ? s.toLabel : `by ${s.toLabel}`}
                        </span>
                        <span className="mt-0.5 block text-[12.5px] leading-snug text-fog-300">{s.title}</span>
                      </li>
                    ))}
                  </motion.ol>
                )}

                <motion.div variants={heroItem} className="mt-8 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStage("flying")}
                    className="group inline-flex items-center gap-2 bg-marigold-400 px-5 py-3 text-[15px] font-medium text-ink-950 shadow-[0_0_40px_-8px_rgba(244,169,59,0.6)] transition hover:bg-[#ffbb55] active:scale-[0.98]"
                  >
                    Test the waters <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </button>
                  <button type="button" onClick={() => setStage("bhopal")} className="px-3 py-3 text-sm text-fog-500 underline decoration-ink-600 hover:text-fog-100">
                    Skip the fly-in
                  </button>
                  <span className="num hidden text-[11px] text-fog-700 lg:inline">or press Enter</span>
                </motion.div>

                <motion.p variants={heroItem} className="mt-6 max-w-[60ch] text-[11px] leading-relaxed text-fog-500">
                  Historical data, not live. Ghat positions come from OpenStreetMap names, not surveys — each marker says how it was placed.
                </motion.p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* fly-in HUD */}
        <AnimatePresence>
          {stage === "flying" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.35, duration: 0.5, ease: EASE } }}
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
              className="absolute inset-x-0 bottom-6 flex justify-center"
            >
              <div className="flex items-center gap-4 border border-ink-600/80 bg-ink-950/75 px-4 py-2.5 backdrop-blur-md">
                <span className="num text-[11px] uppercase tracking-[0.16em] text-fog-300">Flying to Bhopal</span>
                <span className="h-px w-32 overflow-hidden bg-ink-600 sm:w-44">
                  <span ref={progressRef} className="block h-full origin-left bg-marigold-400" style={{ transform: "scaleX(0)" }} />
                </span>
                <button type="button" onClick={() => setStage("bhopal")} className="text-[12px] text-fog-500 hover:text-fog-100">
                  Skip <kbd className="num ml-1 border border-ink-600 px-1 text-[10px]">Esc</kbd>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* map chrome */}
        <AnimatePresence>
          {showChrome && (
            <>
              <motion.div
                key="rail"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0, transition: { duration: 0.6, ease: EASE, delay: 0.1 } }}
                className="absolute left-3 top-3 hidden lg:block"
              >
                <RankRail sites={data.sites} festival={fest} selectedId={selectedId} hoveredId={hoveredId} onSelect={setSelectedId} onHover={setHoveredId} />
              </motion.div>
              <motion.div
                key="tools"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE, delay: 0.25 } }}
                className="absolute bottom-3 left-3 flex items-center gap-3"
              >
                <div className="flex border border-ink-600/80 bg-ink-950/75 backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(null);
                      setRecenter((n) => n + 1);
                    }}
                    className={tool}
                  >
                    <RotateCcw className="size-3.5" aria-hidden /> Overview
                  </button>
                  {webgl && (
                    <button type="button" onClick={() => setMotionPref(!animate)} aria-pressed={!animate} className={`${tool} border-l border-ink-700`}>
                      {animate ? <Pause className="size-3.5" aria-hidden /> : <Play className="size-3.5" aria-hidden />} Motion
                    </button>
                  )}
                  <button type="button" onClick={() => setShowKey((k) => !k)} aria-expanded={showKey} className={`${tool} border-l border-ink-700 ${showKey ? "text-fog-100" : ""}`}>
                    <Info className="size-3.5" aria-hidden /> Key
                  </button>
                </div>
                {webgl && <span className="hidden text-[11px] text-fog-500 xl:inline">Drag to pan · scroll to zoom · right-drag to tilt</span>}
              </motion.div>
            </>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showChrome && showKey && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-14 left-3 w-[300px] border border-ink-600/80 bg-ink-950/90 p-3 text-[12px] text-fog-300 backdrop-blur-md"
            >
              <p className="mb-2 font-medium text-fog-100">How markers are placed</p>
              <p className="mb-2 text-fog-500">The MPPCB reports have no coordinates. Markers use OpenStreetMap names:</p>
              <ul className="grid gap-1.5">
                <li>▮ Solid column — place named on the report</li>
                <li>◯ Ring around it — only the lake is known</li>
                <li>▯ Wireframe — name match only (weak)</li>
                <li>┄ Dashed link — one record, two possible places</li>
              </ul>
              <p className="mt-2 text-fog-500">Height = concern score. Red pulse = urgent re-test.</p>
            </motion.div>
          )}
        </AnimatePresence>
        {showChrome && (
          <p className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-fog-500 lg:right-[452px]">© OpenStreetMap contributors · Natural Earth · positions approximate</p>
        )}
      </section>

      {/* plan panel: overlays the map on desktop so the canvas never resizes */}
      <AnimatePresence>
        {showChrome && (
          <motion.aside
            initial={lg ? { opacity: 0, x: 40 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ type: "spring", stiffness: 120, damping: 22, mass: 0.9 }}
            className="flex min-h-0 w-full flex-col border-t keyline bg-ink-900 lg:absolute lg:bottom-3 lg:right-3 lg:top-3 lg:w-[420px] lg:border lg:border-ink-700/80 lg:bg-ink-900/85 lg:shadow-[0_24px_64px_-12px_rgba(0,0,0,0.65)] lg:backdrop-blur-xl"
            aria-label="What to do next"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={selected?.id ?? "plan"}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.22, ease: EASE }}
                className="flex min-h-0 flex-1 flex-col"
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
                            <h2 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight">{festName}</h2>
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
                      <div className="border-b keyline lg:hidden">
                        <RankRail flat sites={data.sites} festival={fest} selectedId={selectedId} hoveredId={hoveredId} onSelect={setSelectedId} onHover={setHoveredId} />
                      </div>
                      {data.risks.length > 0 && (
                        <section aria-labelledby="risk-h" className="border-b keyline px-6 pb-5 pt-5">
                          <h3 id="risk-h" className="text-[13px] font-medium text-fog-500">
                            Highest risk this {fest ?? "festival"}
                          </h3>
                          <p className="mt-0.5 text-[11px] text-fog-500">All seven ghats assumed in use. Based on past {fest} readings, not today&apos;s water.</p>
                          <ol className="mt-3 grid gap-2">
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
                        className="bg-fog-100 px-3 py-1.5 font-medium text-ink-950 transition hover:bg-white"
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
              </motion.div>
            </AnimatePresence>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

const tool = "inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-fog-300 transition-colors hover:bg-ink-800 hover:text-fog-100";

interface RiskCardData {
  siteId: string;
  reasons: { text: string; tone: string; cite: { href: string; label: string } | null }[];
}

function RiskItem({ card, site, onSite, onHover, muted = false }: { card: RiskCardData; site: ConsoleSite; onSite: (id: string) => void; onHover: (id: string | null) => void; muted?: boolean }) {
  return (
    <li onMouseEnter={() => onHover(site.id)} onMouseLeave={() => onHover(null)} className="border-l-2 py-1 pl-3 transition-colors hover:bg-ink-850" style={{ borderColor: site.hex }}>
      <button type="button" onClick={() => onSite(site.id)} className="flex w-full items-baseline gap-2 text-left">
        <span className={`text-[15px] ${muted ? "text-fog-300" : "text-fog-100"} underline decoration-ink-600 underline-offset-4 hover:decoration-fog-300`}>{site.name}</span>
        <span className="num ml-auto pr-2 text-[11px] text-fog-500">#{site.rank ?? "–"}</span>
      </button>
      <ul className="mt-1 grid gap-1">
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
  flat = false,
}: {
  sites: ConsoleSite[];
  festival: string | null;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  flat?: boolean;
}) {
  return (
    <nav aria-label="Ghats ranked" className={flat ? "" : "w-[252px] border border-ink-600/80 bg-ink-950/75 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md"}>
      <p className="border-b keyline px-3 py-2 text-[12px] text-fog-500">Ghats, ranked on past {festival ?? ""} seasons</p>
      <ol className="py-1">
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
                className={`grid w-full grid-cols-[16px_1fr_44px_22px] items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors ${on ? "bg-ink-700/80 text-fog-100" : "text-fog-300 hover:bg-ink-800/80"}`}
              >
                <span className="num text-[11px] text-fog-500">{s.rank ?? "–"}</span>
                <span className="truncate">
                  {s.short}
                  {s.priority === "urgent_retest" && <span className="ml-1.5 text-crit-300" title="Urgent re-test">●</span>}
                </span>
                <span className="h-1 bg-ink-700" aria-hidden>
                  <span className="block h-full transition-[width] duration-500" style={{ width: `${s.index ?? 0}%`, background: s.hex }} />
                </span>
                <span className="num text-right text-[11px] text-fog-500">{s.index !== null ? Math.round(s.index) : "n/a"}</span>
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
      <button type="button" onClick={onToggle} aria-expanded={open} className="grid w-full grid-cols-[24px_1fr_auto] items-baseline gap-3 px-6 py-3.5 text-left transition-colors hover:bg-ink-850">
        <span className={`num text-[13px] ${step.status === "now" ? "text-marigold-400" : "text-fog-500"}`}>{n}</span>
        <span className="text-[15px] text-fog-100">{step.title}</span>
        <span className={`num whitespace-nowrap text-[12px] ${step.status === "now" ? "text-marigold-400" : "text-fog-500"}`}>{step.status === "past" ? "closed" : when}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: EASE }} className="overflow-hidden">
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
          </motion.div>
        )}
      </AnimatePresence>
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
          <p className="num text-[12px] text-fog-500">
            #{site.rank ?? "–"} of {data.sites.length}
          </p>
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
