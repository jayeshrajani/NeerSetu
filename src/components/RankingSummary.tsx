"use client";

import { useEffect, useState } from "react";
import type { Filters } from "@/types/ghatwatch";
import type { RankingNarrative } from "@/lib/ranking-summary";

type SummaryResponse = { mode: "ai" | "template"; summary: RankingNarrative; notice?: string };
const requests = new Map<string, Promise<SummaryResponse>>();

export function RankingSummary({ siteIds, filters, fallback, aiAvailable }: {
  siteIds: string[]; filters: Filters; fallback: RankingNarrative; aiAvailable: boolean;
}) {
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [result, setResult] = useState<SummaryResponse>({ mode: "template", summary: fallback });
  const [loading, setLoading] = useState(aiAvailable);
  const body = JSON.stringify({ siteIds, filters: { year: filters.year, festival: filters.festival, phase: filters.phase }, presentation: "summary" });

  useEffect(() => {
    if (!aiAvailable) return;
    let active = true;
    let request = requests.get(body);
    if (!request) {
      request = fetch("/api/brief", { method: "POST", headers: { "content-type": "application/json" }, body })
        .then(async (response) => {
          if (!response.ok) throw new Error("Summary unavailable");
          const data = await response.json() as SummaryResponse;
          if (!data.summary) throw new Error("Summary missing");
          return data;
        });
      if (requests.size >= 30) requests.clear();
      requests.set(body, request);
    }
    request.then((data) => { if (active) setResult(data); })
      .catch(() => {
        requests.delete(body);
        if (active) setResult({ mode: "template", summary: fallback, notice: "AI is unavailable. Showing the plain-language summary." });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [aiAvailable, body, fallback]);

  const hindi = language === "hi";
  return (
    <section aria-labelledby="summary-heading" aria-busy={loading} className="border-b keyline py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="summary-heading" className="text-lg font-semibold">{hindi ? "संक्षेप में" : "In brief"}</h2>
        <div className="flex rounded-lg border keyline p-0.5" role="group" aria-label="Summary language">
          {(["en", "hi"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={language === value} onClick={() => setLanguage(value)} className={`rounded px-3 py-1 text-sm ${language === value ? "bg-ink-700 text-fog-100" : "text-fog-500"}`}>
              {value === "en" ? "English" : "हिन्दी"}
            </button>
          ))}
        </div>
      </div>
      <div lang={language} className={`mt-3 max-w-[85ch] text-sm leading-relaxed text-fog-300 ${hindi ? "font-hindi" : ""}`}>
        <p>{hindi ? result.summary.purposeHi : result.summary.purposeEn}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          {(hindi ? result.summary.actionsHi : result.summary.actionsEn).map((action) => <li key={action}>{action}</li>)}
        </ul>
      </div>
      <p role="status" className="mt-3 text-xs text-fog-500">{loading ? "Simplifying with AI…" : result.mode === "ai" ? "AI wording · checked against source facts" : result.notice ? "AI unavailable · source-based summary" : "Source-based summary"}</p>
    </section>
  );
}