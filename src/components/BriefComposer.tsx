"use client";

import { useState } from "react";
import { Bot, Check, Copy, Printer, RotateCcw, ShieldCheck } from "lucide-react";
import { briefToText, type RenderedBrief } from "@/lib/brief-templates";
import { copyText } from "@/components/CopyButton";
import { BriefDoc } from "@/components/PrintBrief";
import type { Filters } from "@/types/ghatwatch";

type Mode = { kind: "template"; notice?: string } | { kind: "ai"; provider: string };

export function BriefComposer({
  siteIds,
  filters,
  templateEn,
  templateHi,
  aiAvailable,
}: {
  siteIds: string[];
  filters: Filters;
  templateEn: RenderedBrief;
  templateHi: RenderedBrief;
  aiAvailable: boolean;
}) {
  const [en, setEn] = useState(templateEn);
  const [hi, setHi] = useState(templateHi);
  const [mode, setMode] = useState<Mode>({ kind: "template" });
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const withReview = (b: RenderedBrief): RenderedBrief => ({ ...b, reviewLine: reviewed ? b.reviewLine.replace("[ ]", "[x]") : b.reviewLine });
  const textEn = briefToText(withReview(en));
  const textHi = briefToText(withReview(hi));

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2400);
  };
  const doCopy = async (t: string, label: string) => flash((await copyText(t)) ? `${label} copied` : "Copy failed — select the text manually");

  const refine = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/brief", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteIds, filters: { year: filters.year, festival: filters.festival, phase: filters.phase } }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(typeof body?.error === "string" ? body.error : "Request failed");
      setEn(body.briefEn);
      setHi(body.briefHi);
      setMode(body.mode === "ai" ? { kind: "ai", provider: String(body.provider) } : { kind: "template", notice: String(body.notice ?? "") });
    } catch {
      setEn(templateEn);
      setHi(templateHi);
      setMode({ kind: "template", notice: "AI wording is unavailable right now. Showing the evidence-based template." });
    } finally {
      setBusy(false);
    }
  };

  const btn = "inline-flex items-center gap-1.5 rounded-lg border keyline px-3 py-2 text-sm text-fog-300 transition hover:border-tide-400/40 hover:text-tide-200 disabled:opacity-50";
  return (
    <div>
      <div data-noprint className="glass sticky top-[68px] z-20 flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3">
        {mode.kind === "ai" ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-tide-400/40 bg-tide-400/10 px-2 py-1 text-xs text-tide-200">
            <Bot className="size-3.5" aria-hidden /> AI-assisted wording ({mode.provider}) · purpose &amp; actions only · facts validated
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md border keyline px-2 py-1 text-xs text-fog-300">
            <ShieldCheck className="size-3.5 text-tide-300" aria-hidden /> Evidence-based template
          </span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" className={btn} onClick={() => doCopy(textEn, "English brief")}>
            <Copy className="size-4" aria-hidden /> Copy English
          </button>
          <button type="button" className={btn} onClick={() => doCopy(textHi, "Hindi brief")}>
            <Copy className="size-4" aria-hidden /> Copy Hindi
          </button>
          <button type="button" className={btn} onClick={() => doCopy(`${textEn}\n\n----------\n\n${textHi}`, "Both briefs")}>
            <Copy className="size-4" aria-hidden /> Copy both
          </button>
          <button type="button" className={`${btn} border-tide-400/40 text-tide-200`} onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden /> Print / Save PDF
          </button>
          {aiAvailable &&
            (mode.kind === "ai" ? (
              <button
                type="button"
                className={btn}
                onClick={() => {
                  setEn(templateEn);
                  setHi(templateHi);
                  setMode({ kind: "template" });
                }}
              >
                <RotateCcw className="size-4" aria-hidden /> Use template
              </button>
            ) : (
              <button type="button" className={btn} onClick={refine} disabled={busy}>
                <Bot className="size-4" aria-hidden /> {busy ? "Refining…" : "Refine wording with AI"}
              </button>
            ))}
        </div>
        {mode.kind === "template" && mode.notice && (
          <p className="w-full text-xs text-warn-300" role="status">
            {mode.notice}
          </p>
        )}
        <p className="sr-only" aria-live="polite">
          {toast ?? ""}
        </p>
      </div>

      <label data-noprint className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-warn-400/40 px-3 py-2 text-sm text-warn-300">
        <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="size-4 accent-[#f4a93b]" />
        Reviewed by officer (marks the brief as human-reviewed; this is not a government approval)
      </label>

      <div className="print-sheet mt-5 grid gap-5 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5 sm:p-6">
          <BriefDoc brief={en} reviewed={reviewed} />
        </div>
        <div className="glass print-break rounded-2xl p-5 sm:p-6">
          <BriefDoc brief={hi} reviewed={reviewed} />
        </div>
      </div>

      {toast && (
        <div data-noprint className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-tide-400/40 bg-ink-900/95 px-4 py-2 text-sm text-tide-200 shadow-xl">
          <Check className="mr-1.5 inline size-4" aria-hidden />
          {toast}
        </div>
      )}
    </div>
  );
}
