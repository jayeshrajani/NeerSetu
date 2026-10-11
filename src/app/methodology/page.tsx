import Link from "next/link";
import type { Metadata } from "next";
import { engine, manifest, observations, sites, standardsFile } from "@/lib/data";
import { DEFAULT_FILTERS } from "@/lib/filters";
import { rankSites, SCORING } from "@/lib/scoring";
import { BASIS_LABEL, geo } from "@/lib/geo";
import { CHAT_GUIDES } from "@/lib/chat-grounding";

export const metadata: Metadata = { title: "Methodology" };

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-28 border-t keyline py-8">
      <h2 id={`${id}-h`} className="font-display text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <div className="mt-4 grid max-w-[85ch] gap-3 text-[15px] leading-relaxed text-fog-300">{children}</div>
    </section>
  );
}

const TOC: [string, string][] = [
  ["data", "Data inventory"],
  ["classb", "Why Class B, and what it is not"],
  ["criteria", "Criteria used"],
  ["missing", "Missing, censored and zero values"],
  ["score", "Historical concern index"],
  ["coverage", "Evidence coverage"],
  ["priority", "Sampling priority"],
  ["pages", "Source pages and verification"],
  ["identity", "Site names"],
  ["map", "How the map places ghats"],
  ["today", "How “today” changes the plan"],
  ["brief", "How briefs are built and checked"],
  ["chat", "Assistant and planning guidance"],
  ["limits", "What this tool cannot tell you"],
];

export default function MethodologyPage() {
  const ranked = rankSites(observations, sites, engine, DEFAULT_FILTERS);
  const example = ranked.find((s) => s.components) ?? ranked[0]!;
  const cc = manifest.crossCheck;
  const pv = manifest.pageVerification;
  return (
    <div className="mx-auto grid max-w-[1400px] gap-10 px-4 pt-10 sm:px-6 lg:grid-cols-[16rem_1fr]">
      <nav aria-label="On this page" className="hidden lg:block">
        <ol className="sticky top-28 grid gap-1 text-sm">
          {TOC.map(([id, t]) => (
            <li key={id}>
              <a href={`#${id}`} className="block rounded-md px-2 py-1 text-fog-500 hover:bg-ink-800 hover:text-tide-200">
                {t}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <article>
        <p className="text-[11px] uppercase tracking-[0.2em] text-tide-300">Methodology v{manifest.methodologyVersion}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">How NeerSetu ranks, and where it stops</h1>
        <p className="mt-4 max-w-[75ch] text-fog-300">
          NeerSetu is a historical screening and prioritisation aid. It is <strong className="text-fog-100">not a current live water report</strong>, not a safety
          certificate, not a legal compliance finding, and not evidence that idol immersion caused any reading. All numbers below are computed from the
          bundled source files at build time.
        </p>

        <Section id="data" title="Data inventory">
          <ul className="list-disc pl-5">
            <li>
              <b className="text-fog-100">bhopal_ghats_2023_2025.csv</b> — {manifest.primaryRowCount.toLocaleString("en-IN")} rows, one parameter reading each, {manifest.uniqueSiteCount} sites,
              {" "}
              {manifest.dataYearMin}–{manifest.dataYearMax}, Ganesh and Durga, pre / during / one week after. The only input to rankings.
            </li>
            <li>
              <b className="text-fog-100">sample_bhopal_2025.csv</b> — {manifest.sampleRowCount} rows; verified identical to the primary file&apos;s 2025 rows and never added
              to totals.
            </li>
            <li>
              <b className="text-fog-100">mp_immersion_sites_2023_2025.csv</b> — {manifest.statewideRowCount?.toLocaleString("en-IN")} statewide rows; background only, excluded
              (no site standardisation; 879 rows flagged needs_check; some tables duplicated across pages).
            </li>
            <li>
              <b className="text-fog-100">cpcb_water_quality_criteria.csv</b> — {manifest.criteriaRowCount} criteria rows, classes A–E.
            </li>
          </ul>
          <p>
            Source: organiser pack{" "}
            <a className="text-tide-300 underline-offset-2 hover:underline" href={`${manifest.sourceRepo}/tree/${manifest.sourceCommit}/${manifest.sourcePath}`}>
              {manifest.sourceRepo.replace("https://github.com/", "")}
            </a>{" "}
            at commit <span className="num">{manifest.sourceCommit.slice(0, 10)}</span>. Reports:{" "}
            {Object.entries(manifest.reports).map(([y, r], i) => (
              <span key={y}>
                {i > 0 && "; "}
                <a className="text-tide-300 underline-offset-2 hover:underline" href={r.url}>
                  {y}
                </a>
              </span>
            ))}
            . Full hashes and anomaly checks are in <span className="num">docs/DATA_AUDIT.md</span>.
          </p>
        </Section>

        <Section id="classb" title="Why Class B, and what it is not">
          <p>
            Immersion ghats are places where people enter the water, so CPCB Class B (<em>outdoor bathing, organised</em>) is a reasonable{" "}
            <b className="text-fog-100">comparison</b>. It is an explicit choice made by this tool — the ghats have not been officially designated Class B
            here, and a reading &ldquo;outside Class B screening&rdquo; is not a legal violation.
          </p>
          <p>
            Class B has four criteria. The ghat data contains three of them (DO, BOD, pH). <b className="text-fog-100">Total coliform was not measured</b>, so no site can be
            described as meeting Class B in full.
          </p>
        </Section>

        <Section id="criteria" title="Criteria used (from the supplied CSV)">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-fog-500">
                <tr>
                  <th className="py-2 font-normal">Criterion ID</th>
                  <th className="py-2 font-normal">Class</th>
                  <th className="py-2 font-normal">Parameter</th>
                  <th className="py-2 font-normal">Rule</th>
                  <th className="py-2 font-normal">Used for</th>
                </tr>
              </thead>
              <tbody>
                {standardsFile.criteria.map((c) => {
                  const mapped = Object.entries(standardsFile.classBParameterMap).find(([, id]) => id === c.id)?.[0];
                  return (
                    <tr key={c.id} className={`border-t keyline ${c.class === "B" ? "text-fog-100" : "text-fog-500"}`}>
                      <td className="num py-1.5 text-xs">{c.id}</td>
                      <td>{c.class}</td>
                      <td>{c.parameter}</td>
                      <td className="num">
                        {c.limitType} {c.limit} {c.unit ?? ""}
                      </td>
                      <td className="text-xs">{mapped ? `Screening of “${mapped}”` : c.class === "B" ? "Not measured in ghat data" : "Shown for reference only"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm">
            Comparisons are inclusive: DO 5.0 is within, 4.9 outside; BOD 3.0 within, 3.1 outside; pH 6.5 and 8.5 within, 6.49 and 8.51 outside. The immersion
            parameter <span className="num">BOD</span> is mapped explicitly to <span className="num">BOD (5 days 20C)</span>; nothing is matched loosely. COD, solids,
            turbidity, conductivity and the four metals have no Class B limit in this file and are shown as contextual readings — the Class E conductivity limit is
            not applied.
          </p>
        </Section>

        <Section id="missing" title="Missing, censored and zero values">
          <ul className="list-disc pl-5">
            <li>
              A printed <span className="num">0</span> is a real numeric zero (DO = 0 appears {cc.doZero} times, all at Bairagarh).
            </li>
            <li>Blank, <span className="num">_</span>, <span className="num">-</span>, <span className="num">*</span>, <span className="num">**</span> → not sampled. Never 0, never clean.</li>
            <li>
              <span className="num">BDL</span> (below detection limit) and <span className="num">ND</span> → censored: not zero, not missing, and not compared because no
              detection limit is published.
            </li>
            <li>A site/festival/year with no table in the pack → <em>not in source</em>. Shown as a gap; no rows are invented.</li>
            <li>None of these contribute a severity of zero. They contribute nothing to the score and are counted in coverage.</li>
          </ul>
          <p className="text-sm">
            Status counts: {Object.entries(manifest.measurementStatusCounts).map(([k, v]) => `${k} ${v}`).join(" · ")}; not-in-source windows: {manifest.absentWindows.length}.
          </p>
        </Section>

        <Section id="score" title="Historical concern index (non-official heuristic)">
          <p>For each numeric DO, BOD or pH reading, a bounded magnitude outside the screening level:</p>
          <pre className="num overflow-x-auto rounded-xl bg-ink-900 p-4 text-xs text-tide-200">
            {`DO severity  = clamp((5 − DO) / 5, 0, 1)
BOD severity = clamp((BOD − 3) / 3, 0, 1)
pH severity  = clamp(max(6.5 − pH, pH − 8.5, 0) / 2, 0, 1)`}
          </pre>
          <p>
            These are not probabilities, toxicity or health risk. Readings are grouped into <b className="text-fog-100">windows</b> = site × year × festival (Ganesh and
            Durga are never merged). Per window: mean severity, fraction outside, and whether any reading is outside. Windows are averaged with recency weights{" "}
            {Object.entries(SCORING.yearWeights).map(([y, w]) => `${y} = ${w}`).join(", ")}:
          </p>
          <pre className="num overflow-x-auto rounded-xl bg-ink-900 p-4 text-xs text-tide-200">
            {`concernIndex = 100 × ( ${SCORING.weights.meanSeverity} × weighted mean severity
                     + ${SCORING.weights.exceedanceFraction} × weighted fraction outside
                     + ${SCORING.weights.recurrence} × windows with ≥1 outside / sampled windows )`}
          </pre>
          <p>
            A site is scored only with ≥{SCORING.minNumericComparable} numeric readings across ≥{SCORING.minParameterTypes} of the three parameters in the selected scope;
            otherwise it is <em>insufficient evidence</em>, unranked, and never shown as low. Display bands: ≥{SCORING.buckets.elevated} elevated, ≥{SCORING.buckets.moderate}{" "}
            moderate, below that &ldquo;lower observed&rdquo; (never &ldquo;safe&rdquo;). Ties: more numeric readings first, then name. Filters recompute everything from
            matching rows; the parameter view never changes the score.
          </p>
          {example.components && (
            <p className="rounded-xl border keyline p-4 text-sm">
              Worked example, all years — <b className="text-fog-100">{example.canonicalName}</b>: mean severity {example.components.meanSeverityWeighted.toFixed(3)}, fraction
              outside {example.components.exceedanceFractionWeighted.toFixed(3)}, recurrence {example.components.windowsWithExceedance}/{example.components.validWindows} ⇒
              index <span className="num text-tide-200">{example.concernIndex?.toFixed(1)}</span>.
            </p>
          )}
          <p className="text-sm text-fog-500">
            Data note: BOD exceeds 3 mg/l in {cc.bodAbove3} of {cc.bodNumeric} numeric readings across all sites, so every scored site has a high fraction-outside
            component. DO severity and recurrence are what separate them. The index is for ordering attention, not for comparing to any official scale.
          </p>
        </Section>

        <Section id="coverage" title="Evidence coverage (kept separate from concern)">
          <p>Two transparent ratios instead of one confidence percentage:</p>
          <ul className="list-disc pl-5">
            <li>
              <b className="text-fog-100">Numeric DO/BOD/pH</b> = numeric readings ÷ DO/BOD/pH rows that exist in the source (including not sampled and BDL).
            </li>
            <li>
              <b className="text-fog-100">Festival tables</b> = site × year × festival windows present ÷ nominal windows in scope (3 years × 2 festivals = 6 for the full
              range). The nominal frame is an analytical reference, not an official sampling mandate.
            </li>
          </ul>
          <p>A phase grid shows each pre / during / after slot as full, partial, not sampled, or no table. Site identity confidence is a separate label.</p>
        </Section>

        <Section id="priority" title="Sampling / verification priority">
          <ol className="list-decimal pl-5">
            <li>
              <b className="text-crit-300">Urgent re-test</b> — any numeric DO ≤ {SCORING.severeTriggers.doAtOrBelow} mg/l (including 0) or BOD ≥ {SCORING.severeTriggers.bodAtOrAbove}{" "}
              mg/l in scope. Heuristic triggers, not official remediation thresholds.
            </li>
            <li>
              <b className="text-warn-300">Priority re-test</b> — any screening exceedance, or the latest year in scope is missing a festival table, has only
              during-immersion readings, or has no numeric reading.
            </li>
            <li>
              <b className="text-fog-100">Routine verification</b> — otherwise. Still not a safety or approval determination.
            </li>
          </ol>
          <p>
            A separate <em>identity</em> flag is raised for medium/low name confidence and coexists with any priority — an ambiguous name never lowers urgency. No action is
            dispatched automatically.
          </p>
        </Section>

        <Section id="pages" title="Source pages and how they were verified">
          <p>
            <span className="num">source_page</span> was tested against the bundled PDFs: it is the <b className="text-fog-100">1-based PDF viewer page</b> (the reports print no
            separate page numbers). An automated text check found the printed parameter line on the cited page for{" "}
            {pv.groupCounts ? `${(pv.groupCounts.exact ?? 0) + (pv.groupCounts.loose ?? 0)} of ${Object.values(pv.groupCounts).reduce((a, b) => a + b, 0)}` : "—"} parameter lines
            ({pv.rowsWithVerifiedViewerPage} rows). Only those rows get a <span className="num">#page=N</span> link; anything else is labelled &ldquo;not independently
            verified&rdquo;. {pv.manualTablesChecked} tables covering every year × festival were additionally checked by eye against rendered pages (see the data audit).
          </p>
          <p>A text match proves the values occur on that page; site attribution relies on the organiser&apos;s table parsing plus the visual checks.</p>
        </Section>

        <Section id="identity" title="Site names">
          <p>
            The pack maps varied printed names to seven standard names. <b className="text-fog-100">Rani Kamlapati ghat / Kamla Park kund</b> is medium confidence: Ganesh
            tables print a Kamla Park kund, Durga tables print a Rani Kamlapati ghat on the Lower Lake. They may be two places. NeerSetu keeps the pack&apos;s single record but
            flags it everywhere, and on the map shows both candidate places joined by a dashed line.
          </p>
        </Section>

        <Section id="map" title="How the map places ghats">
          <p>
            The MPPCB reports and the CSV contain <b className="text-fog-100">no coordinates</b>. The map uses OpenStreetMap features found by name and the lake printed in
            the CSV, and labels every marker with how it was placed:
          </p>
          <ul className="list-disc pl-5">
            {(Object.keys(BASIS_LABEL) as (keyof typeof BASIS_LABEL)[]).map((k) => (
              <li key={k}>
                <b className="text-fog-100">{BASIS_LABEL[k]}</b> — {geo.precision[k]}
              </li>
            ))}
          </ul>
          <ul className="list-disc pl-5 text-sm">
            {geo.sites.map((g) => (
              <li key={g.siteId}>
                {sites.find((s) => s.id === g.siteId)?.canonicalName}: {g.anchors.map((a) => `${a.label} (OSM ${a.osm})`).join("; ")}
              </li>
            ))}
          </ul>
          <p className="text-sm">
            Markers sharing one lake centre are fanned out slightly so both can be clicked; that offset is cosmetic. India outline: Natural Earth, India point-of-view
            edition, simplified for display — not an authoritative boundary. Lakes and anchors © OpenStreetMap contributors (ODbL), queried 11 Oct 2026; raw
            responses are in <span className="num">source-data/geo/</span>. Confirm the physical point before dispatching a team.
          </p>
        </Section>

        <Section id="today" title="How “today” changes the plan">
          <p>
            The home page reads today&apos;s date in IST (or <span className="num">?asOf=YYYY-MM-DD</span> for rehearsal) and finds the visarjan being prepared for in{" "}
            <span className="num">src/lib/calendar.ts</span> — currently only dates with a citable source (Durga visarjan 20 Oct 2026, from the organiser guide).
            The ranking is then recomputed on <b className="text-fog-100">that festival&apos;s past seasons only</b>, and the action list is dated around MPPCB&apos;s own
            design: pre-immersion baseline before the day, during-immersion on the day, and one week after. Steps whose window has passed are shown as closed. Nothing is
            forecast: the plan says where history argues for testing first, not what the water is like now.
          </p>
        </Section>

        <Section id="brief" title="How briefs are built and checked">
          <p>
            Every measurement, comparison and citation in a brief is assembled deterministically from the selected rows. If an AI provider is configured on the server, it may
            only rewrite the purpose sentence and the action wording. Its output must be strict JSON; every number must already be in the facts; evidence and site IDs must be
            on the allow-list; words implying safety, causation, legal status or health effects are rejected. Any failure, timeout or missing key falls back to the template,
            which is always complete. Briefs carry an unticked &ldquo;Reviewed by officer&rdquo; marker.
          </p>
          <p className="text-sm text-fog-500">Hindi text is a team translation and should be reviewed by a native-speaking officer before circulation.</p>
        </Section>

        <Section id="chat" title="Assistant and planning guidance">
          <p>
            The assistant explains selected historical observations and the general procedures below in English or Hinglish. These procedures are team-authored planning
            guidance, not MPPCB findings, official orders or engineered treatment plans. Each substantive reply links its observations or guidance. Numeric claims must be
            present in the cited source. Current conditions and permissions still require local confirmation. Replies do not replace an officer or technical review.
          </p>
          <p>
            Recent messages are sent to the configured AI provider only when a question is submitted. The conversation stays in browser memory, is not saved by NeerSetu,
            and is cleared by starting a new conversation or reloading. Do not share personal details or secrets. Provider retention follows the provider&apos;s own policy.
            If AI is unavailable or a reply fails checks, an explicit error is shown rather than a canned answer presented as AI.
          </p>
          {CHAT_GUIDES.map((guide) => (
            <details id={`chat-${guide.id}`} key={guide.id} className="scroll-mt-20 border-t keyline py-3">
              <summary className="font-semibold text-fog-100">{guide.title}</summary>
              <p className="mt-2 text-sm leading-relaxed">{guide.text}</p>
            </details>
          ))}
        </Section>

        <Section id="limits" title="What this tool cannot tell you">
          <ul className="list-disc pl-5">
            <li>Current (2026) water quality — the latest reading is from {manifest.dataYearMax}.</li>
            <li>Whether a site is authorised, open or banned for immersion in 2026 — status is &ldquo;unverified&rdquo; everywhere.</li>
            <li>Whether immersion caused a change — before/after differences have many possible causes, and many readings were already high before immersion.</li>
            <li>Health effects, fish kills or toxicity — not measured.</li>
            <li>Units — the reports print none; standard units are assumed.</li>
            <li>Coliform — not measured, so Class B compliance cannot be established.</li>
          </ul>
          <p>
            <Link href="/" className="text-tide-300 hover:underline">
              Back to the ranking
            </Link>
          </p>
        </Section>
      </article>
    </div>
  );
}
