# Architecture

## Layout

```text
.
├── .github/copilot-instructions.md
├── source-data/
│   ├── organiser-track-2/        # unmodified copy of the organiser Track 2 folder (commit 6b96823)
│   │   ├── PROBLEM-STATEMENT.md, ORGANISER_README.md, Track 2 guide PDF
│   │   ├── data/                 # 4 CSVs + DATA_DICTIONARY.md
│   │   └── resources/            # 6 PDFs (3 visarjan reports used for citations)
│   └── derived/
│       ├── pdf_line_verification.json   # output of scripts/verify_pdf_pages.py
│       └── manual_spot_checks.json      # 11 tables checked by eye
│   └── geo/                      # map inputs: NE India-POV outline, OSM Overpass lakes + anchors, site_locations.json
├── scripts/
│   ├── build_dataset.py          # stdlib-only ETL + audit → src/generated, docs/DATA_AUDIT.md
│   ├── build_geo.py              # stdlib-only: simplify outline/lakes, resolve anchors → src/generated/geo.json
│   └── verify_pdf_pages.py       # dev-only (needs pypdf): page-text check of every CSV row
├── src/
│   ├── generated/                # observations.json, sites.json, standards.json, data-manifest.json (committed)
│   ├── types/ghatwatch.ts
│   ├── lib/
│   │   ├── data.ts               # loads generated JSON, enriches with benchmark status
│   │   ├── standards.ts          # CSV parser, criteria parser, StandardsEngine (single comparison implementation)
│   │   ├── filters.ts            # strict URL filter parsing, scoping
│   │   ├── coverage.ts           # two coverage ratios + phase grid
│   │   ├── scoring.ts            # SCORING constants, windows, index, reasons, sampling priority, ranking
│   │   ├── provenance.ts         # citations, verified page links
│   │   ├── brief-facts.ts        # grounded fact bundle (≤3 sites)
│   │   ├── brief-templates.ts    # deterministic EN/HI brief
│   │   ├── brief-validation.ts   # zod schema + fact checks for AI output
│   │   ├── ui-labels.ts
│   │   ├── calendar.ts           # cited visarjan dates, IST today, campaign stage
│   │   ├── outlook.ts            # festival-scoped ranking, findings, dated action steps
│   │   ├── geo.ts                # local km projection around Bhopal, marker basis labels
│   │   └── ai/                   # provider.ts, none.ts, anthropic.ts, openai-compatible.ts, index.ts
│   ├── components/               # console/{PlanningConsole, MapFallback2D}, map/GhatMapScene (R3F), AppShell, FiltersBar,
│   │                             # GhatPriorityTable, CoverageIndicator, EvidenceCitation, EvidenceTable, PhaseTrendChart,
│   │                             # ParameterView, BriefSelection, BriefComposer, PrintBrief, Badges, CopyButton
│   └── app/
│       ├── page.tsx              # plan: India → Bhopal map + dated plan for today
│       ├── ranking/page.tsx      # full filterable ranking table
│       ├── ghats/[siteId]/page.tsx
│       ├── brief/page.tsx
│       ├── methodology/page.tsx
│       ├── api/brief/route.ts    # POST only; optional AI; always returns a usable brief
│       └── reports/[year]/route.ts  # allow-listed PDF streaming
├── tests/                        # vitest (node + one jsdom file)
└── docs/
```

Deviations from the master prompt's target tree: the organiser folder is nested under `source-data/organiser-track-2/` (as cloned) instead of flattened; `coverage.json` is not generated (coverage is computed in TypeScript so filters can recompute it); PDFs are served from `source-data` through a route instead of being duplicated under `public/`; a map was added on the team's request using OSM/Natural Earth data saved under `source-data/geo/` (no hand-typed coordinates); `@react-three/drei` is not used.

## Data pipeline

1. `scripts/verify_pdf_pages.py` (dev-only, run once; needs `pypdf`) extracts the text of each cited page and checks the printed parameter line → `source-data/derived/pdf_line_verification.json` (tied to the primary CSV hash).
2. `npm run data:build` → `scripts/build_dataset.py`: validates headers/widths/encoding, classifies every row (numeric / BDL / ND / not sampled / unparsed), builds stable IDs `bhp-L{line}-{sha8}`, checks the sample subset and statewide caveats, parses criteria, records hashes and absent windows, writes JSON + `docs/DATA_AUDIT.md`. Deterministic except `generatedAt`.
3. At runtime `src/lib/data.ts` enriches rows with Class B screening status from `StandardsEngine`. Python never computes pass/fail; `tests/ingestion.test.ts` checks the TS engine against the Python cross-check counts.

## Request flow

- Pages are React Server Components. Filters come from the URL (`?year=&festival=&phase=&parameter=`), are parsed strictly (invalid → visible error + full scope), and rankings are recomputed on each request (7 sites, 1,524 rows — trivial cost).
- Client components: filters, brief selection tray, evidence table, charts (Recharts), brief composer, planning console.
- Plan map: `GhatMapScene` (R3F, `next/dynamic`, `ssr: false`) renders one scene in kilometres around Bhopal — an extruded India slab, OSM lake shapes with a small water shader, and ghat columns — using a logarithmic depth buffer so the camera can fly from ~4,600 km to ~40 km without re-loading layers. A custom rig interpolates distance geometrically during the fly-in, then hands over to three's `MapControls`. Labels are DOM elements projected each frame with simple de-overlap (no extra React roots). Radix Tabs/ScrollArea for the panel, Framer Motion for panel/intro transitions. No WebGL → 2D SVG map with the same projection. Reduced motion → no pulses/water animation.

## AI provider interface

```ts
interface BriefNarrativeProvider {
  id: "none" | "anthropic" | "cerebras" | "openai_compatible";
  configured: boolean;
  generate(facts: GroundedBriefFacts, signal: AbortSignal): Promise<{ json: unknown; model: string }>;
}
```

- Chosen only from server env (`providerFromEnv`). No browser-supplied URLs or keys; `openai_compatible` requires an `https://` base URL.
- Anthropic: `POST https://api.anthropic.com/v1/messages` (`x-api-key`, `anthropic-version: 2023-06-01`). Cerebras: `POST https://api.cerebras.ai/v1/chat/completions` (Bearer, `response_format: json_object`), endpoint confirmed from Cerebras API docs on 11 Oct 2026. Model ID always from `AI_MODEL`.
- `composeNarrative`: one attempt, `AI_TIMEOUT_MS` (default 12 s) abort, 64 KB response cap, `validateGeneratedBrief`, else template. `/api/brief` adds a body-size cap, zod request schema, and a per-instance throttle (8/min/IP).
- Model output is rendered as React text (no `dangerouslySetInnerHTML`, no markdown).

## Offline behaviour

After `npm install`, everything works offline with `AI_PROVIDER=none`: fonts are bundled via `@fontsource`, data is committed JSON, PDFs are served locally. Only the "MPPCB original" links and optional AI need the network.
