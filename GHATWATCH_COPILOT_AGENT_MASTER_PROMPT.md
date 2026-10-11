# GHATWATCH — GitHub Copilot Agent Master Implementation Prompt

**Status:** Approved implementation brief. Execute in GitHub Copilot **Agent** mode inside the team's actual working repository.

**Approved decisions:** Track 2 (`Visarjan Ghat Watch`) · focused MVP · AI-provider-agnostic · premium officer dashboard.

**Reference sources:**
- Organiser repository: https://github.com/Vishal4742/bhopal-impact-lab-2026-problem-statements
- Alternate organiser-linked data pack (check availability; do not assume same commit): https://github.com/Laaaaksh/bhopal-impact-lab-2026 (`tracks/02-visarjan-ghat-watch`)
- Track 2 participant guide: https://github.com/Vishal4742/bhopal-impact-lab-2026-problem-statements/blob/main/track-2-visarjan-ghat-watch/PROBLEM-STATEMENT.md
- Data dictionary: https://github.com/Vishal4742/bhopal-impact-lab-2026-problem-statements/blob/main/track-2-visarjan-ghat-watch/data/DATA_DICTIONARY.md
- Existing product proposal (if copied into workspace): `docs/PLATFORM_BLUEPRINT.md`

> **Important:** This is an executable work order, not a brainstorming exercise. First inspect files, then implement, test, fix, document, and prepare a deliverable. The organiser's source files override any example or proposal below. Do **not** fabricate audit results, deployment URLs, numerical rankings, source pages, model availability, or passing tests.

---

## 0. Your role, mission, and non-negotiables

You are the senior full-stack developer, data QA engineer, accessibility-minded product designer, and release engineer for **GhatWatch**. Work autonomously within the checked-out repository, use terminal and editing tools, and ship a functioning, comprehensible, polished MVP. Do not stop after producing a plan or empty scaffolding.

**Primary user:** A Bhopal Municipal Corporation (BMC) officer planning pre-Durga-visarjan water testing, inspection and cleanup. **One workflow:** locate historically concerning or insufficiently sampled ghats → inspect evidence and uncertainty → compile a bilingual officer action brief. **One outcome:** an evidence-backed, shareable prioritisation decision.

**Real context:** Source monitoring is historical (2023–2025). The organising event is 11 October 2026 and the guide identifies 20 October 2026 as Durga visarjan. Data is **not live**, does **not certify water safety**, does **not establish a causal effect from idol immersion**, and does **not determine legal site eligibility in 2026**. Do not label any historical site "safe", "currently polluted", "approved", "open", or "banned" based solely on these measurements. Keep any reported NGT restrictions separate from verified site-specific operational status.

**MUST preserve throughout:**
1. Government-source evidence and reproducible rules precede LLM prose.
2. Every displayed reading/ranking reason/briefing claim is linked to a locally identifiable evidence row and MPPCB report/page if available.
3. Numeric zero is different from missing; `BDL` and `ND` are censored/nondetected, not zero and not normal missing.
4. CPCB **Class B** is an explicitly chosen *screening comparison*, **not** an official class designation for these ghats or proof of full compliance.
5. Units in the extracted immersion reports are **assumed**, not printed; disclose that.
6. Absence of measurements is an *evidence gap*, never evidence of a satisfactory result.
7. Keep historical concern, sampling priority, evidence completeness, and current operational status separate.
8. AI credentials are optional; the complete decision workflow must work with no API key and with an AI outage.
9. No login to/scraping of/live API integration with government systems. Use the supplied public data pack and public static source documents only.
10. No personal data, fake demos, placeholder controls that do nothing, fabricated map coordinates, or hidden hardcoded "winning" rankings.
11. Do not overwrite or delete organiser data/source PDFs. Avoid pushing secrets; never commit `.env.local`.
12. The event requires new submitted code written after 10:15 AM IST on 11 October 2026. Reuse libraries/frameworks, but do not backdate or misrepresent code provenance.

**Optimisation order:** scientific honesty → working end-to-end officer flow → judge-visible source traceability → premium usability → provider integrations → optional extras.

---

## 1. Mandatory repository reconnaissance — do this before coding

Start by stating your brief execution plan in the Agent conversation, then **use tools to inspect the actual workspace**. Do not assume the current repo is an empty Next.js app, the organiser's source pack, or the target submission repository. Decide which it is.

### 1.1 Identify and preserve repository state

Use equivalents of:

```bash
pwd
ls -la
find . -maxdepth 3 -type f | sort | head -200
git status --short
git remote -v
find . -name 'package.json' -o -name 'pyproject.toml' -o -name 'requirements.txt' -o -name 'PROBLEM-STATEMENT.md' -o -name 'DATA_DICTIONARY.md'
```

Inspect all existing entrypoints, package scripts, tech choices, TypeScript config, styling, assets and code before replacing anything. Preserve other people's work and avoid destructive operations. If an app already exists, integrate rather than recreate it. Do not initialize Git or change remote configuration without reason. If workspace has unrelated uncommitted changes, preserve them. Read `GHATWATCH_PLATFORM_BLUEPRINT.md` / `docs/PLATFORM_BLUEPRINT.md` when present.

### 1.2 Locate and read EVERY relevant Track 2 source file

Search for both possible source-pack layouts:

- `track-2-visarjan-ghat-watch/{PROBLEM-STATEMENT.md,data/,resources/}`
- `tracks/02-visarjan-ghat-watch/{...}`

Mandatory inspection inventory:

| Source | Expected according to published guide | Exact audit required |
|---|---:|---|
| `PROBLEM-STATEMENT.md` | Participant guide | Read completely, including judging, source/implementation rules, submission |
| `data/DATA_DICTIONARY.md` | Dictionary | Read completely, including caveats, site identity, code semantics |
| `data/bhopal_ghats_2023_2025.csv` | 1,524 data rows | Parse **all** rows and all columns |
| `data/sample_bhopal_2025.csv` | 453 data rows | Verify subset of primary; DO NOT concatenate |
| `data/mp_immersion_sites_2023_2025.csv` | 21,600 data rows | Inspect headers, counts, QA caveats; background only |
| `data/cpcb_water_quality_criteria.csv` | 19 records | Parse `class, designated_best_use, parameter, limit_type, limit, unit` |
| `resources/` | 6 source PDFs | Inventory exact filenames, report years and page counts; manually verify selected numeric examples and PDF page indexing |
| Organiser root `README.md` | Event instructions | Read for code start time, 17:00 IST deadline and public submission |

The published immersion CSV schema is:

```csv
year,festival,site,water_body,phase,parameter,value,unit_assumed,flag,value_as_printed,parameter_as_printed,site_as_printed,site_match_confidence,source_page
```

The statewide CSV includes other fields such as `regional_office` and `needs_check`. Never assume the statewide schema is identical.

**If the data pack is not present:** obtain it from the public organiser GitHub repository via `git clone`/download only if permitted by the available environment and your project setup. Do not silently substitute fake rows; preserve source provenance. If network access is unavailable, report the precise missing paths and continue with any locally available verifiable code, but do not claim a completed data-backed MVP.

### 1.3 Perform and save a real data audit

Generate `docs/DATA_AUDIT.md` **from actual processing**, with at least:

- Exact SHA-256 hash and provenance/URL or repo commit for each processed CSV.
- Raw data row count (excluding header) and column/header validation, file encoding, CSV quoting/empty field handling.
- Unique sites (expect seven), years, festivals, phases and parameters, with observed counts and missing-value breakdown.
- Numeric vs `BDL` vs `ND` vs explicit not-sampled vs absent-in-source vs malformed/unparsed counts. Keep separate categories.
- Distinguish data *rows* from unique sample windows. Count duplicate natural keys (`site/year/festival/phase/parameter`) and conflicting values; do not silently remove.
- Verify sample records are present in the primary file (compare canonicalized fields/multiset, not merely filenames). Report any discrepancy; never add sample rows to totals.
- Verify Class B criteria from **actual criteria CSV** using `limit_type` (`min`, `max`, `range`) and `limit` (e.g. `6.5-8.5`), not invented thresholds.
- Audit unexpected range/year/parameter/site/phase values. Keep unparsed rows traceable in QA output.
- Document source PDF-to-year mapping, PDF page-number interpretation (one-based printed page versus PDF viewer page), and spot checks.
- State that the organiser Bhopal extraction was previously spot-checked rather than exhaustively certified. Report the checks **you personally performed**, with exact checked evidence IDs, report filenames and page labels.
- Record source-data coverage vs information truly missing from source: e.g. no 2025 Durga table reported for **Bairagarh** and **Malikhedi**; do not invent table rows.
- Confirm medium-confidence identity for **Rani Kamlapati ghat / Kamla Park kund** and keep that alias ambiguity visible.
- Review `needs_check` and possible repeated cross-page rows in the statewide dataset; exclude statewide records from MVP scoring.

Use standard CSV parsers with robust Unicode handling. An audit that only repeats organiser README numbers does **not** satisfy this phase.

### 1.4 Representative source PDF spot checks

Use local public PDFs when available. Prefer inspecting/selecting pages (e.g. text extraction plus rendered page spot check), not blind OCR. Check **at least six distinct numeric observations spanning 2023, 2024, 2025 and both festivals**, and at least one missing / `BDL` notation. Include the Bairagarh 2025 Ganesh DO=0, BOD=8 examples *only after verifying that exact row and source page*. If `source_page` refers to PDF viewer numbering and embedded report numbering differs, document both and ensure generated links are honest. Do not mark unverified rows as "PDF validated."

**Gate A1:** A useful, factual `docs/DATA_AUDIT.md` exists, actual ingested counts are known, and any unresolved anomalies are recorded rather than buried. Then proceed to implementation without waiting for approval.

---

## 2. Approved product scope and deliberate exclusions

### Required MVP features

**A. Officer dashboard (`/`):** Elegant, responsive, immediately useful prioritisation of the seven historical ghats, reproducible ranking explanations, independent sampling-priority signal, evidence/coverage indicator, date/"not live" context, filters by year/festival/phase and appropriate parameter exploration, fast links to details, and CTA to create a brief.

**B. Ghat evidence detail (`/ghats/[siteId]` or equivalent accessible panel):** Canonical site name, original printed names, water body, identity caveats, year/festival/phase records, CPCB comparisons, DO/BOD/pH trends with explicit gaps, a readable evidence table for all 13 parameters, and exact report/page source references.

**C. Bilingual officer action brief (`/brief` or modal + print layout):** Brief for selected site(s) containing historical findings, evidence IDs/report pages, uncertainties, verification actions and human-review marker. Render **English and Hindi**; allow copy and print/save-as-PDF locally with no model key. AI can refine language, but deterministic content is authoritative.

**D. Methodology (`/methodology`):** CPCB Class B rationale, full actual applicable benchmark entries, screening vs certification disclaimer, traceable score formula and denominator choices, unknown-value handling, assumed units, source documents, site-name caveats, model limitations, reproducible data provenance.

**E. Documented QA + submission artifacts:** Audit, concise README and <=5 setup steps, `.env.example`, `LICENSE`, working tests, design/product documentation, demo script, no secrets.

### Strictly not required in MVP

NO user accounts, admin dashboard, geocoding, public map with invented pins, vector DB/RAG, autonomous web research, live sensors, forecasting, water-safety certifications, remediation-optimization algorithms, broad statewide scorecards, full Hindi localisation of every button, database/ORM or citizen-facing portal. Do not spend the build window on these unless core requirements and tests are complete. An AI Q&A chatbot is **not** mandatory; the AI-facing feature is the brief composer.

---

## 3. Technology and deployment contract

Preferred low-ops stack unless an existing usable project dictates otherwise:

- **Next.js App Router, React, TypeScript** with strict TS mode.
- **Tailwind CSS**, lightweight accessible primitives (shadcn/ui/Radix if already compatible), **Lucide** icons and **Recharts** for line/bar charts.
- **Python 3 standard library** (or existing reproducible Python environment) for one-time CSV validation/normalisation/precomputation; no Python server in production. Do not introduce pandas just to parse ~1,500 rows unless already present.
- **Committed generated JSON** under `src/generated/` or equivalent, so Vercel/static deployment does not need Python in the deployment environment.
- **Server-side Next.js route handler** only for optional AI narrative generation; keep model keys server-side.
- **Vitest** (or a test runner already installed) for deterministic engine/contract tests; smoke-test the application where tooling allows.
- Must boot without network/API key after NPM dependencies are installed and data has been compiled. Public PDF external links may require connectivity; display reference metadata even if links fail.

**Build scripts**, appropriately adapted to existing package manager:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "data:build": "python3 scripts/build_dataset.py",
    "data:audit": "python3 scripts/build_dataset.py --audit"
  }
}
```

These are target script behaviors, not instructions to overwrite a valid existing `package.json`. Ensure scripts execute in the chosen working-directory layout. A clean project should run with `npm install`, `npm run data:build`, `npm test`, `npm run dev` (four setup steps); AI is optional.

Do not rely on Google Fonts fetching at build time, unreliably available CDNs, or unavailable model APIs for the essential experience. Use a deliberate font stack supporting Devanagari, print CSS, accessible focus indicators and functional native clipboard/print fallbacks.

---

## 4. Target repository structure (adapt, don't destructively force)

If building a standalone submission repository with data available, target:

```text
ghatwatch/
├── .github/
│   └── copilot-instructions.md
├── .gitignore
├── .env.example
├── LICENSE
├── README.md
├── package.json
├── package-lock.json                  # or chosen package-manager lockfile
├── tsconfig.json
├── next.config.ts
├── scripts/
│   └── build_dataset.py             # real audit + normalized artifacts, zero fake data
├── source-data/
│   ├── bhopal_ghats_2023_2025.csv
│   ├── sample_bhopal_2025.csv
│   ├── mp_immersion_sites_2023_2025.csv   # optional to copy; not used by MVP
│   ├── cpcb_water_quality_criteria.csv
│   └── DATA_DICTIONARY.md
├── public/
│   └── ...                          # only assets actually used
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # officer dashboard
│   │   ├── globals.css
│   │   ├── ghats/[siteId]/page.tsx  # evidence detail
│   │   ├── brief/page.tsx           # optional if not using a dialog
│   │   ├── methodology/page.tsx
│   │   └── api/brief/route.ts      # AI provider optional; server only
│   ├── components/
│   │   ├── AppShell.tsx
│   │   ├── DataFreshnessBanner.tsx
│   │   ├── GhatPriorityTable.tsx
│   │   ├── FiltersBar.tsx
│   │   ├── GhatEvidencePanel.tsx
│   │   ├── BenchmarkBadge.tsx
│   │   ├── PhaseTrendChart.tsx
│   │   ├── EvidenceCitation.tsx
│   │   ├── CoverageIndicator.tsx
│   │   ├── BriefComposer.tsx
│   │   └── PrintBrief.tsx
│   ├── generated/
│   │   ├── observations.json
│   │   ├── sites.json
│   │   ├── standards.json
│   │   └── data-manifest.json
│   ├── lib/
│   │   ├── data.ts
│   │   ├── standards.ts
│   │   ├── scoring.ts
│   │   ├── coverage.ts
│   │   ├── provenance.ts
│   │   ├── filters.ts
│   │   ├── brief-facts.ts
│   │   ├── brief-templates.ts
│   │   ├── brief-validation.ts
│   │   └── ai/
│   │       ├── provider.ts
│   │       ├── none.ts
│   │       ├── anthropic.ts
│   │       └── openai-compatible.ts # Cerebras usable by configuration
│   └── types/
│       └── ghatwatch.ts
├── tests/
│   ├── ingestion.test.ts
│   ├── standards.test.ts
│   ├── missingness.test.ts
│   ├── scoring.test.ts
│   ├── filters.test.ts
│   ├── provenance.test.ts
│   ├── brief.test.ts
│   ├── ai-fallback.test.ts
│   └── ui-smoke.test.tsx           # if test environment supports it
└── docs/
    ├── PLATFORM_BLUEPRINT.md
    ├── DATA_AUDIT.md
    ├── METHODOLOGY.md
    ├── ARCHITECTURE.md
    ├── TEST_REPORT.md
    ├── DEMO_SCRIPT.md
    └── SUBMISSION_CHECKLIST.md
```

If this workspace **is** the organiser's data repo, create the app in a clearly named `ghatwatch/` or `app/` subdirectory and read source files in place; do not restructure Track 1 or remove original evidence. If this workspace **is** the team's already-started app repo, preserve its structure and integrate. Document actual deviations from the target tree in `docs/ARCHITECTURE.md`. Create only files that serve actual working functionality, not decorative empty stubs.

---

## 5. Strict data contracts and provenance

### 5.1 TypeScript data model

Implement equivalent validated types (adjust names if existing contracts already exist):

```ts
type Festival = 'Ganesh' | 'Durga';
type Phase = 'pre' | 'during' | 'after';
type MeasurementStatus =
  | 'numeric'
  | 'below_detection_limit'
  | 'not_detected'
  | 'not_sampled'
  | 'not_in_source'
  | 'unparsed';
type BenchmarkStatus =
  | 'within_screening_benchmark'
  | 'outside_screening_benchmark'
  | 'indeterminate'
  | 'no_class_b_benchmark';

type Observation = {
  id: string;                   // stable, deterministic and unique
  sourceCsv: string;
  sourceCsvLine: number;        // 1-based file line, header = 1
  siteId: string;
  siteCanonical: string;
  siteAsPrinted: string;
  siteMatchConfidence: 'high' | 'medium' | 'low' | 'unknown';
  waterBody: string;
  year: number;
  festival: Festival;
  phase: Phase;
  parameter: string;
  parameterAsPrinted: string;
  numericValue: number | null;
  valueAsPrinted: string;       // exact text including '0', 'BDL', '*'
  measurementStatus: MeasurementStatus;
  unitAssumed: string | null;
  unitsAreInferred: true;
  sourcePdfFilename: string;
  sourceReportUrl: string;
  sourcePageRaw: number | null;
  sourcePdfViewerPage: number | null; // only set when verified
  benchmarkId: string | null;
  benchmarkStatus: BenchmarkStatus;
};

type SiteSummary = {
  id: string;
  canonicalName: string;
  waterBody: string;
  printedAliases: string[];
  identityConfidence: 'high' | 'medium' | 'low' | 'unknown';
  operationalStatus2026: 'unverified';
  historicalConcern: 'elevated' | 'moderate' | 'lower_observed' | 'insufficient_evidence';
  concernIndex: number | null;      // optional non-official score
  evidenceCompleteness: number | null; // definition must be exposed
  samplingPriority: 'urgent_retest' | 'priority_retest' | 'routine_verify' | 'identity_review';
  topReasons: { label: string; observationIds: string[]; why: string }[];
};
```

**Source aliases**: do not collapse `Rani Kamlapati ghat / Kamla Park kund` to one confirmed geographic point. Keep raw names searchable and explain the ambiguity in overview/detail/brief. Key sites by stable slugs computed from canonical name plus a documented fixed ID map if needed; do not infer location from coordinates.

**Observation IDs**: generated from canonical source dataset ID + source row index and/or SHA-256 of original row plus a collision counter. Two rows with same site/year/festival/phase/parameter **must not silently replace one another**.

### 5.2 Normalisation rules

- Parse real `0`, `0.0`, `0.00` as numeric **zero**.
- Parse an empty numeric `value` using `flag` and `value_as_printed`; do not use `Number('')` or `parseFloat('BDL')` with fallback to `0`.
- `BDL`: `numericValue=null`, status `below_detection_limit`, do not infer detection limit or pass/fail.
- `ND`: `numericValue=null`, status `not_detected`, same no-quantification rule.
- `not sampled`, `*`, `**`, `_`, `-`, blank with missing value: status `not_sampled` when an explicit source row exists.
- If an entire site/festival/year/phase record does not exist in the pack, model that as `not_in_source` for coverage view rather than inventing an Observation and implying it was sampled.
- Unknown flags or numeric corruption: `unparsed`, preserve raw fields, surface QA warnings.
- Preserve every source row. Never impute missing measurements for charting or scoring.
- For rows where numeric value and censorship flag conflict, log anomaly; do not silently choose the more convenient interpretation.
- Respect locale-safe numeric parsing and Unicode (`µS/cm`, Hindi script, accented symbols).

### 5.3 Source document identity and page references

Map 2023→`Idol_immer._Report_23_CPCB.pdf`, 2024→`Ganesh_and_Durga_visarjan_report-2024.pdf`, 2025→`Ganesh_and_Durga_visarjan_report-2025.pdf` **after confirming bundled filenames**. Source URLs from official guide:

```text
2023: https://www.mppcb.mp.gov.in/proc/mon/Idol_immer._Report_23_CPCB.pdf
2024: https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2024.pdf
2025: https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2025.pdf
CPCB: https://cpcb.gov.in/water-quality-criteria/
```

The supplied `source_page` is a source metadata field, not inherently a verified PDF viewer anchor. Verify its semantics on sample pages before constructing `#page=N`; when uncertain, show **"source metadata page N (not independently verified)"** with the report URL, instead of a bogus deep link. Link to a local bundled public PDF when practical; otherwise use original public URL. A blocked URL does not remove the citation text from the app.

### 5.4 Derived-data manifest

Generate machine-readable `data-manifest.json` containing `sourcePackName`, `dataYearMin`, `dataYearMax`, `primaryRowCount`, `uniqueSiteCount`, `sampleRowCount`, `criteriaRowCount`, input SHA-256 digests, `generatedAt`, `methodologyVersion`, `validationWarnings`, and provenance source links. Display the actual 2023–2025 date range and data-last-year in the header. Build step must be deterministic for fixed inputs except documented generation timestamp.

**Gate A2:** Re-running ingestion produces equivalent normalized facts and score results; no fake records; all data issues visible in QA reports.

---

## 6. Standards engine — exact official-file mapping

The supplied CPCB criteria CSV uses:

```csv
class,designated_best_use,parameter,limit_type,limit,unit
B,Outdoor bathing (organised),Total coliform,max,500,MPN/100 ml
B,Outdoor bathing (organised),pH,range,6.5-8.5,
B,Outdoor bathing (organised),Dissolved oxygen,min,5,mg/l
B,Outdoor bathing (organised),BOD (5 days 20C),max,3,mg/l
```

Implement `parseCriteriaCsv()` + parameter-mapping tests. The BOD label in criteria includes test conditions and must map explicitly to the immersion column `BOD`. Do not loose-match an arbitrary parameter. Use class **B** only as a *stated comparative benchmark*:

| Parameter | Parsed rule | Inclusive screening result |
|---|---|---|
| Dissolved oxygen | `min 5 mg/l` | `<5` outside, `>=5` within |
| BOD (5 days 20C) | `max 3 mg/l` | `>3` outside, `<=3` within |
| pH | `range 6.5-8.5` | outside if `<6.5` or `>8.5` |
| Total coliform | `max 500 MPN/100 ml` | Part of Class B but **not measured in supplied ghat CSV** |
| COD, solids, turbidity, conductivity, Cr/Pb/Zn/Cu | None for Class B in supplied table | `no_class_b_benchmark`; show numeric contextual reading only |

The criteria CSV has classes A–E, but do not mistakenly use Class E electrical conductivity limit as Class B. Do not say "legal violation" or "compliant water" from the three available fields. The UI label should be **"Class B screening comparison"**, not "Water is safe". Expose actual criteria source, units, comparison operator, and the fact that total coliform is unavailable.

Boundary cases must be unit-tested, including `DO 0` numeric, `DO 4.9/5`, `BOD 3/3.1`, `pH 6.49/6.5/8.5/8.51`, `BDL`, `ND`, and missing.

---

## 7. Explainable analysis: deterministic concern, coverage and action priority

The numbers below form a **proposed reproducible heuristic**. Implement and disclose them, unless actual data QA reveals a technical problem. These weights are **not** CPCB/MPPCB official risk weights. Do not use AI to override the rules.

### 7.1 Per-observation screening and bounded severity

For numeric values only:

```text
DO severity  = clamp((5 - DO) / 5, 0, 1)
BOD severity = clamp((BOD - 3) / 3, 0, 1)
pH severity  = clamp(max(6.5 - pH, pH - 8.5, 0) / 2, 0, 1)
```

These are merely normalized magnitudes of comparison outside the chosen Class B benchmark; do not interpret as probabilities, toxicity levels or clinical risk.

Use `clamp(x,0,1) = min(max(x,0),1)`. Every severity value carries the observation ID and active criterion ID. All missing, `BDL`, `ND`, unparsed, and non-Class-B parameters contribute **no numeric severity**, not zero severity.

### 7.2 Window-based aggregation that does not reward data gaps

- Define `window = (siteId, year, festival)`, with up to three phases and the three benchmarked parameters. Do **not** combine 2023 Ganesh with 2023 Durga as if sampled the same day.
- For each window with comparable numeric records, compute its `meanSeverity` over numeric DO/BOD/pH values, `exceedanceFraction = count(outside) / count(numeric comparable)`, and `hasExceedance` Boolean. Preserve denominator and source IDs.
- Average **window-level** metrics rather than raw all-row metrics to avoid years with more rows automatically dominating.
- Suggested recency weights: `2023:1`, `2024:1.25`, `2025:1.5`; fixed across both festivals. Yearly recency is a product heuristic, not an official policy.
- Aggregate site `meanSeverityWeighted` and `exceedanceFractionWeighted` as weighted averages over **valid sampled windows only**. For recurrence, use `number of valid windows with >=1 exceedance / number of valid windows`. Do not divide by unsampled windows, and disclose the number of valid windows.
- For sites with at least **three numeric benchmark-comparable observations over at least two parameter types**, compute:

```text
concernIndex = 100 * (
  0.45 * meanSeverityWeighted +
  0.35 * exceedanceFractionWeighted +
  0.20 * recurrenceFraction
)
```

- Sites below this evidence minimum have `concernIndex=null` and `historicalConcern='insufficient_evidence'`, **but** still show any critical actual reading and can be assigned high *sampling priority*.
- Define display buckets as a documented UX choice only: `>=50 elevated`, `>=20 and <50 moderate`, `<20 lower_observed`, and null insufficient evidence. Labels must include **historical**, e.g. "Elevated historical concern". Never label the `<20` bucket "safe".
- Rank computed sites by descending index, then by evidence-backed observation count, then stable canonical-name tie-break. Show sites without comparable numeric evidence as "insufficient evidence", not at the bottom with a synthetic zero score. If the data has strange distributions, report and justify any adjusted thresholds in `docs/METHODOLOGY.md` and update tests.
- When filters apply, recompute from matching original facts and show denominator counts and scope description. When only `COD`/metals are selected as a *view* filter, don't misrepresent them as Class B scoring factors; keep score scope explicitly `DO/BOD/pH` or switch to unscored observation exploration. Never silently change ranking logic with a cosmetic parameter filter.

### 7.3 Independent coverage metric

Explicitly define coverage, with honest denominators:

1. `recordedBenchmarkedSlots`: rows that actually exist in the source for DO/BOD/pH (including not sampled/BDL/ND).
2. `numericComparableSlots`: those existing rows with numeric comparable values.
3. `censoredSlots`: BDL/ND source rows without numbers.
4. `explicitNotSampledSlots`: source rows marked missing.
5. `sourceAbsentWindows`: missing `(site, year, festival)` windows relative to the **nominal 3 years × 2 festivals reference frame**, clearly labelled "no table in supplied pack", not "failed sampling".
6. `phaseCoverage`: observed phase presence by site/festival/year, showing `pre`, `during`, `after` **and** gaps.

Display two transparent quantities instead of one misleading confidence percentage: `(numeric comparable)/(recorded benchmark slots)` and `(source festival-year windows available)/(6 nominal windows)` (or similar, with precise definitions). Explicitly warn that nominal windows are an analytical frame, not an official sampling mandate. Identity confidence is a **separate** label. Do not claim a quantitative probability of data accuracy.

### 7.4 Separate sampling priority

Implement a deterministic **sampling/verification priority** that can flag serious historical findings *despite* missing observations. Suggested ordered rule set:

1. `identity_review` if site identity confidence is medium/low and operational actions require exact location; annotate "confirm physical site before dispatch"; do **not** suppress historical evidence.
2. `urgent_retest` if a verified numeric DO == 0 or another clearly defined severe screening result (e.g. DO <=2.5 mg/l or BOD >=9 mg/l) appears in available historical data; label these cutoffs **heuristic triggers**, not official remediation thresholds. Also consider datedness prominently.
3. `priority_retest` if Class B screened exceedances exist **or** if latest-year site/festival evidence is notably absent / only during-immersion readings are present.
4. `routine_verify` otherwise; **still not an approval/safety determination**.

Identity review can coexist as a separate flag with other urgency to avoid a lower urgent priority simply because the site name is ambiguous. Prefer structuring `samplingPriority` + `needsIdentityVerification: boolean` rather than letting one enum mask the other. No automatic dispatch, aeration action, closure, or financial expenditure.

### 7.5 Explain every order and action

Generate each `topReasons[]` from facts only, with labels such as `DO below Class B screening level`, `BOD above screening level`, `repeated finding across 3 observed windows`, `missing 2025 Durga table`, `pre/post measurements not sampled`, or `location name ambiguous`. Clicking a reason opens the exact contributing source records and their dates/pages. If a reason only describes absent windows, link to a documented **source-coverage assertion** instead of inventing an observation ID.

**Gate B:** Re-ranking by years/festivals is deterministic, no missing value makes a site look safer, and every actual measurement-based reason has a credible source reference.

---

## 8. Premium visual experience: concrete implementation spec

**Visual direction:** Modern civic intelligence console, calm and authoritative, not generic government portal, not neon AI demo. Polished typography, elegant whitespace, thin keylines, precise data labels, restrained water-blue/teal accent, slate/ink foregrounds, warm/neutral surfaces, high-contrast warning/error colors only for meaningful states. Use consistent spacing, subtle hover states, thoughtfully sized charts, sticky primary navigation when helpful, comfortable desktop density, responsive small-screen cards, accessible focus rings.

**Avoid:** Random gradients, massive hero marketing, decorative animations, fake stock photos, status-only red/green without labels, "AI-generated risk percent", 3D map, emoji-heavy UI, crowded charts, empty generic template, illegible Hindi, JavaScript-only navigation without links.

### 8.1 App shell

- Brand: `GhatWatch` with compact subheading "Bhopal immersion water-quality intelligence".
- Prominent data status: **Historical monitoring, 2023–2025 · not live**.
- Context: "Planning support for Durga visarjan, 20 Oct 2026" derived from organiser guide and clearly labelled as event context, not necessarily current date in future deployments.
- Top/right actions: `Methodology`, `Build Officer Brief`, optionally source-dataset information.
- No login, user profile, fictional notification numbers, or fake live sync status.

### 8.2 Dashboard (`/`)

- KPI strip: `7 historical sites`, `1,524 source rows` (computed manifest), `2023–2025`, and factual data-coverage note. Do not call source rows "tests" if each row is one parameter reading.
- Main hero content is ranked priority table/cards, not decorative charts.
- Filters: year (All/2023/2024/2025), festival (All/Ganesh/Durga), phase (All/Pre/During/After), optional quick parameter view. Correct URL query state preferred for shareability.
- Each rank item: rank if score exists, site name + water body, historical-concern category, top 1–3 evidence-derived reasons, **numeric comparator sample count**, missing/identity qualifier, independent sampling action priority, detail affordance, select-for-brief.
- Show both "Historical concern" and "Sampling/verification priority" as separately headed concepts; don't conflate them.
- Honest labels `not assessed for current suitability` and `current authorisation unverified` in context.
- Functional sorting/filtering/selection; filter state should not invent facts or silently modify evidence.
- Empty filter state explains why results are missing and offers a working reset.

### 8.3 Detail view (`/ghats/[siteId]`)

- Full canonical and original printed site labels; water body; match confidence; 2026 operational status `unverified`.
- A concise, source-derived analytical synopsis with one-click expandable reasoning and selected time-window scope.
- Charts for DO/BOD/pH, with **actual** three phases `pre/during/after`, grouped by year and festival, and explicit null gaps. No joining discontinuous points over unsampled stages; charts should have separate series or scoped selectors to prevent 2023 after from being visually adjacent to 2024 pre as if continuous dates.
- Benchmark guide lines and units with **"assumed"** tooltip.
- Evidence table with sortable/filterable year, festival, phase, parameter and status, accessible on mobile; display raw/printed values, numeric values where present, screening benchmark status or not-applicable, report PDF + page, and audit notation.
- A citation drawer/expansion: CSV row number, printed source site, parameter and value, report title, `source_page`, verified viewer-page status, criterion row, and copyable human-readable citation.
- Contextual indicators (metals, COD etc.) remain visible with "No Class B limit in supplied criteria" rather than red/green pass-fail badges.
- Helpful *not measured* and *no source table* empty states; never 0-filled plots.

### 8.4 Brief composer (`/brief` or integrated panel)

- Select 1–3 ghats (at least one; validate limit), and optionally choose a year/festival context.
- Deterministic **English and Hindi** drafts first, including:
  1. Purpose / selected sites and source coverage years.
  2. **Observed historical evidence** with only actual cited values and year/festival/phase.
  3. **What remains unknown:** absent phases, BDL/ND, units inferred, ambiguous name, not-current water status, missing coliform, unverified 2026 authorisation when relevant.
  4. **Proposed actions for officer/technical review:** targeted current sampling, site-identity confirmation, inspection, collection of outstanding report tables, referral to appropriate technical team.
  5. **Sources:** report year/title/PDF-page references and screening criteria reference.
- Concise: aim for ~150–250 words per language maximum, or an equivalent legible one-page combined printout. Don't remove essential uncertainty to hit arbitrary length exactly.
- Provide `Copy English`, `Copy Hindi`, `Copy Both`, `Print / Save PDF` with real event handlers and visible feedback. Print layout hides app chrome and preserves Hindi glyphs, source references and measurement units.
- Editable draft field is optional but useful; preserve cited facts, and label human modifications clearly if editing is offered.
- Include a **"Reviewed by officer"** unchecked checkbox; do not auto-check or claim governmental approval.
- Ensure the deterministic draft appears immediately with no AI key; AI enhancement button only if configured, and a retry/fallback message if not.
- No guarantee of legal/government approval; suggestions are for technical and administrative consideration.

### 8.5 Methodology page

Readable sections: data inventory & source links, "why Class B", exact criteria, scoring with actual weights/thresholds, interpretation of scores, missing/censored handling, nominal-window coverage, source-page verification level, source-name ambiguity, lack of total coliform, year limitations, prohibited inferences, operational site-status caveat, how generated briefs are checked, and "not a current live water report".

### 8.6 Responsive / accessibility details

Target 1440px desktop, 1024px tablet, and ~375px mobile; no horizontal document overflow. Chart tooltips are keyboard-accessible or values visible in the table. Form controls have labels, focus order makes sense, warning semantics conveyed with text/icons not color alone, table headers exist, and copy/print buttons work. Support `prefers-reduced-motion`. Do not cause hydration mismatches from client-only browser data.

**Gate C:** A person unfamiliar with the dataset can find a concerning historical reading, see its source, and create a bilingual briefing without instruction.

---

## 9. Optional AI: provider agnostic, fully guarded, resilient

### 9.1 Configuration

Support these explicit env keys (names can be adapted if project already has conventions, but document actual behavior):

```dotenv
AI_PROVIDER=none
AI_MODEL=
AI_TIMEOUT_MS=12000
ANTHROPIC_API_KEY=
CEREBRAS_API_KEY=
OPENAI_COMPATIBLE_BASE_URL=
OPENAI_COMPATIBLE_API_KEY=
```

`AI_PROVIDER` options: `none`, `anthropic`, `cerebras` or `openai_compatible`. Use server-only keys and SDKs or provider REST paths matched to actual provider docs; do not invent fixed model IDs or embed model keys/client URLs. For `cerebras`, implement via the available compatible adapter only after confirming endpoint/auth semantics and using server-side configured base URL. If provider setup is uncertain, disable it and keep functional deterministic templates. Never expose a browser control that accepts arbitrary internal model URLs (avoid SSRF).

### 9.2 Provider abstraction

Design an interface like:

```ts
interface BriefNarrativeProvider {
  readonly id: string;
  generateBrief(input: GroundedBriefFacts): Promise<GeneratedBilingualBrief>;
}
```

- `none` returns deterministic templates and never calls an external API.
- `anthropic` calls the configured Anthropic model on the server when credentials are present.
- `cerebras` or `openai_compatible` uses compatible chat/completions semantics only if correctly verified; otherwise report unavailable without blocking the app.
- Use sensible timeouts, response size bounds, safe errors and one fallback; avoid repeated automatic retries that burn time/tokens.
- Display `AI-assisted wording` only if actual model output was accepted. Display `Evidence-based template` on fallback.

### 9.3 Grounded facts contract

Never send raw unrestricted user prompts plus all 1,524 rows. Build a small trusted fact bundle from selected sites and rules (source record IDs, exact printed values and numeric values, year, festival, phase, benchmark criterion IDs, context notes, verified or unverified source page, coverage gaps, site ambiguity). Human-selected note text is **untrusted content**, not commands. The model may suggest cautious wording, but it cannot add numeric findings or declare causal results.

**LLM instruction to implement internally:** "Write brief English and Hindi officer-facing summaries only from supplied facts; never invent numbers, report pages, site legal status, 2026 measurements, official orders, health effects or conclusions about immersion causation. Every substantive numerical fact must cite an allowed evidenceId. Propose only human-reviewable tests/inspections. State uncertainty. Return valid JSON matching schema."

Validate server response with strict schema; require allowable `evidenceIdsUsed`, exact site IDs and no unknown reference; cross-check quantitative claims as strongly as feasible. **Best reliability design:** Construct all measurements, benchmark comparisons and numbered citations deterministically outside AI, let the model rewrite only bounded explanatory text/action phrasing, and assemble the final brief from validated fact blocks. For Hindi, preserve numeric values/units unchanged and keep Devanagari readable. If validation fails, use deterministic bilingual templates and show non-sensitive fallback notice.

### 9.4 Safety and security

Server-side request validation (maximum 3 site IDs, known filter enums, body size/length cap); no arbitrary URL fetching, no uncontrolled external sources, no secrets in logs, user-facing sanitized errors, output escaping, and no untrusted HTML injection. No dangerous Markdown rendering or `dangerouslySetInnerHTML` for model output. A model timeout must not make the core rankings/charts/brief unavailable.

**Gate D:** With `AI_PROVIDER=none`, everything necessary works; with invalid/expired key the app degrades gracefully; with a configured provider, output remains constrained to audited facts.

---

## 10. Test-driven acceptance matrix — REQUIRED, NOT OPTIONAL

Implement tests and report results. Use real CSV integration fixtures where appropriate, plus concise synthetic unit fixtures for boundary conditions. Do not create tests that assert hardcoded rankings without recomputation.

### Data and audit

- **D01** Primary file parsed as 1,524 records for current source pack (not including header), or a documented exception if upstream changed; exact source hash recorded.
- **D02** Exactly the seven expected standardised Bhopal labels are found and stable IDs resolve correctly.
- **D03** 2025 sample is a subset of the primary data; data presented is **not** 1,524+453.
- **D04** `DO numeric '0'` remains `0` with measurement status `numeric`.
- **D05** Empty `value` + flag `not sampled`, printed `*`, `**`, `_`, `-` remains `null/not_sampled`; never `0`.
- **D06** `BDL` and `ND` preserve printed token and distinct statuses; not counted as numeric violations or numeric passes.
- **D07** Missing an entire 2025 Durga site table is shown as `not_in_source`, not a fabricated numeric zero or sample.
- **D08** Anomalous duplicate/conflicting natural keys or unknown flags are reported rather than silently removed.
- **D09** The 879 `needs_check` statewide rows (published count) and statewide duplicate caveat are documented if the file is available; statewide is not in primary rankings.
- **D10** All thirteen parameter names and original aliases/printed fields survive normalization.

### Standards and scoring

- **S01** Class B is parsed from supplied criteria CSV; correct mapping to BOD criterion `BOD (5 days 20C)`.
- **S02** `DO=4.9` outside, `DO=5` within, `DO=0` outside.
- **S03** `BOD=3` within, `BOD=3.1` outside.
- **S04** `pH=6.49/8.51` outside, `6.5/8.5` within.
- **S05** COD, solids, turbidity, conductivity and four metals return `no_class_b_benchmark` rather than pass/fail.
- **S06** Total coliform criterion is shown but no coliform observations are falsely created; no overall Class B certification.
- **S07** Same normalized rows under reordered input produce the same site score/order/reasons (except source-row IDs if intentionally row-index based; rank must be stable).
- **S08** Inserting a missing row does not numerically reduce historical severity or fabricate a pass; it may affect documented completeness.
- **S09** A site with insufficient numeric comparisons gets null/"insufficient evidence", never zero/green "safe".
- **S10** Ranking ties resolve deterministically; denominators and year weights are disclosed.
- **S11** Sampling priority and historical concern are independent; ambiguity flags can coexist with urgent retesting.
- **S12** Filter changes use only matching facts and refresh both displayed scope and computed values/reason IDs; no hidden stale ranking.

### Traceability and honest interpretation

- **T01** Every numeric badge, chart point, site reason and brief numeric claim can be resolved to evidence row IDs and original CSV line.
- **T02** Every measurement has report URL/filename/year and `source_page` metadata, or an explicit missing/uncertain notation.
- **T03** Source-page links do not claim validation if page offset wasn't checked; backup report citation available when linking fails.
- **T04** Rani Kamlapati / Kamla Park identity is visibly medium confidence and not assigned a precise invented pin.
- **T05** 2026 operational status remains `unverified` without an independently verified official status source.
- **T06** Missing pre/during/after points display as gaps; never connect/relabel absent measurements as observed values.
- **T07** No UI/brief statement claims immersion *caused* a measurement or predicts present-day water quality from historic readings.
- **T08** Units are clearly marked inferred/assumed; data source years and date limitations visible.

### UX/AI/operations

- **U01** `/` renders seven sites with usable navigation and no fake cards; rankings are genuinely data-backed.
- **U02** Year/festival/phase filters and reset work, update query state/results, and produce a meaningful empty state.
- **U03** Opening each site produces relevant detail view, chart, evidence list, sources and limitations.
- **U04** Brief creation for 1–3 selected sites generates actual **English and Hindi** output with evidence/caveats.
- **U05** Copy buttons copy correct language(s); Print/Save PDF opens a print-ready layout (not an inactive control).
- **U06** At 1440px/1024px/375px the core screens are usable; no significant overflow; keyboard navigation works.
- **U07** `AI_PROVIDER=none` and no API key still produce a fully functional brief; invalid key/timeout falls back.
- **U08** Provider output referencing fake site/evidence IDs is rejected; deterministic fact blocks remain authoritative.
- **U09** Unknown site slug, invalid filters and malformed brief request return accessible safe error/404 states.
- **U10** No credentials in client bundle, committed files, console output or screenshots.
- **U11** Clean `npm install`, `npm run data:build`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` pass or documented known environment limitation with exact failure logs.
- **U12** README gives app run instructions in **five or fewer steps**, license, team/member placeholders, Track 2, intended officer, exact source links, working/unsupported features, and any extra public sources.

For each criterion, record `PASS`, `FAIL`, or `NOT RUN` with command/output/evidence in `docs/TEST_REPORT.md`. Never call a test "PASS" if you didn't execute it. Fix failures rather than quietly deleting the tests.

---

## 11. Execution order, dependency gates, and checkpoint discipline

Work independently, in the following order. Keep changes scoped and frequently run typechecks/tests; don't produce a grand design document while core behavior remains unimplemented.

| Sprint | What to build | Exit condition |
|---|---|---|
| **0. Recon** | Repo/source audit; choose exact working directory; protect existing files | Inventory and realistic plan; no destructive writes |
| **1. ETL** | Parse/QA source CSVs, standards, stable IDs, provenance manifest | Actual normalized JSON, `DATA_AUDIT.md`, data assertions |
| **2. Rules** | CPCB evaluator, evidence coverage, reproducible ranking, independent sampling priority, fixtures | Standard/missing/ranking tests pass; reasons cite evidence |
| **3. UI** | Premium dashboard + filters + evidence detail + responsive charts + methodology | Officer can navigate history and source readings |
| **4. Brief** | Deterministic EN/HI composer, copy/print, human-review marker | Full offline-ready end-to-end flow |
| **5. AI adapter** | Provider abstraction + optional server route + strict validation/fallback | No-key/invalid-key tests pass; key not in browser |
| **6. Verify** | Build, lint, types, tests, local smoke, cross-check PDFs, correct data/UX bugs | Honest `TEST_REPORT.md`, broken interactions fixed |
| **7. Ship** | README, MIT license, `.env.example`, demo, checklist, source credits | Public-ready artifact; no secrets; exact instructions |

**Time pressure / priority:** If remaining event time is short, cut optional AI Q&A, map and decorative refinements first; retain cited numeric comparisons, missing-data semantics, site details, deterministic bilingual brief, README and passing build. Event guide identifies a **17:00 IST, 11 Oct 2026** public-repo submission cutoff. Do not promise a later delivery; do the work possible now and report what is actually finished.

At each gate in your Agent status messages, give a compact fact-based update: files changed, test status, remaining blockers. Do not stop for confirmation unless blocked by access to the *mandatory input data*. If blocked, still complete useful independent components and clearly mark not verified.

---

## 12. Documentation, open-source handoff, and submission requirements

### 12.1 `README.md` must include

1. `GhatWatch` name, **Track 2: Visarjan Ghat Watch**, event/date, the one officer user, and one-sentence value proposition.
2. Team name and member roles (use conspicuous `[TEAM NAME]`, `[MEMBER NAME]` placeholders if unknown; **never invent real names**).
3. Screenshot(s) **only if actually captured**, or a simple accurate product diagram. Avoid image placeholders that appear broken.
4. Working features and detailed limitations, including historical-only data, not a live meter, assumed units, Class B only as a reference, unavailable coliform, site ambiguity, authorisation unknown, non-causality.
5. **Run in <=5 steps** including commands; optional AI configuration shown separately and never required for initial startup.
6. High-level architecture and explainable scoring link to `docs/METHODOLOGY.md`.
7. Exact supplied source file names, organiser repo URL, report/criteria links; extra public data URLs if actually used.
8. Tests/run script, `LICENSE`, `.env.example`, how to generate the officer brief and demo video link only if real.

### 12.2 Other actual files

- `docs/PLATFORM_BLUEPRINT.md`: copy the provided proposal into repo if supplied; update its status to "implemented plan" only for built features and annotate deviations.
- `docs/DATA_AUDIT.md`: **real** counts/hashes, anomalies, source spot checks and their verification level.
- `docs/METHODOLOGY.md`: exact formulas, parameter mapping, cutoffs, coverage definitions, scope/filter semantics, statistical caveats and examples computed from data.
- `docs/ARCHITECTURE.md`: current file tree, data build pipeline, provider interface and offline/AI behavior.
- `docs/TEST_REPORT.md`: test commands and PASS/FAIL/NOT RUN matrix, actual limitations.
- `docs/DEMO_SCRIPT.md`: reliable <=120-second walkthrough: start → ranking → actual evidence → missingness → bilingual brief → copy/print → limitations.
- `docs/SUBMISSION_CHECKLIST.md`: public GitHub URL **blank unless known**, team info, tested start/build, secret scan, licensing, data-credit confirmation, optional <=2-min video link and status.
- `LICENSE`: MIT unless team/organiser indicates otherwise.
- `.gitignore`: ignores `.env`, `.env.local`, `.next/`, `node_modules/`, build caches, test output and temporary private files.
- `.env.example`: key names/default `AI_PROVIDER=none`, **no tokens**.
- `.github/copilot-instructions.md`: compact durable repository rules pointing to methodology, source files, test scripts and safety requirements.

### 12.3 Secrets and integrity checks

Before completion, run equivalent checks:

```bash
git status --short
npm run data:build
npm test
npm run typecheck
npm run lint
npm run build
# inspect tracked/untracked files and search for API keys/private tokens before push
```

Do not use destructive cleanup or overwrite teammates' work. Avoid committing generated `node_modules`, giant nonessential duplicated PDFs, personal data or model outputs with credentials. Verify that `.env.example` contains only placeholders, and that optional requests stay on the server. A reviewer should reproduce the app without requiring any AI account.

### 12.4 Actual hackathon deliverable checklist

- Public GitHub repository by **17:00 IST, Sunday 11 October 2026**, according to the organiser guide.
- Submission form URL from organiser repository: https://docs.google.com/forms/d/e/1FAIpQLSfKNgfbYvYMI6xHgS0ir4kBhZWspGp37hIzbt9PhB-ZfK70vQ/viewform
- Optional, strongly recommended **screen recording <=2 min**, ideally showing exact measured values and Hindi/English brief.
- Jury evaluates: day-one impact **double weighted**, product, idea, demo clarity. Track 2 checks specifically traceable source/criteria evidence, missing-data honesty and readable bilingual brief.
- **Do not claim** you submitted a form, published a repo, recorded a video or deployed the app unless you actually completed that action or the user confirms it.

---

## 13. Demo-critical verified examples and caveats to test

Use the real data, not hardcoded marketing fixtures. Examples verified in the public sample CSV (still spot-check their original MPPCB PDF pages locally):

- **Bairagarh (Sant Hirdaram) kund**, `2025 / Ganesh / during / Dissolved oxygen`: numeric **0 mg/l**, sample row source page **28**. This is an actual numeric zero, not blank.
- Same location/window, `BOD`: **8 mg/l**, source page **28**. Before and after corresponding DO/BOD records are `not sampled` in the public 2025 sample; display as gaps, not a before/after trend.
- **Khatlapura ghat**, `2025 / Ganesh`: DO pre **7.3**, during **6.0**, after **6.5** mg/l; BOD pre **4.4**, during **5.4**, after **5.2** mg/l, source page **28**. Note BOD was already above 3 before immersion, so never imply immersion alone caused the condition.
- **Rani Kamlapati ghat / Kamla Park kund** is an ambiguous standardized identity; do not use a verified map pin for it.
- Bairagarh and Malikhedi lack 2025 Durga tables in the supplied guide; not the same as measured safe water.

Every final app value, explanatory statement and brief must be computed from rows in the actual workspace. If the local data differs from examples, local source data wins; update docs and avoid repeating stale examples.

---

## 14. Final report you must give me after implementation

After editing/testing, respond concisely with **actual** rather than aspirational statements:

1. **Implementation summary:** Which pages, datasets, analysis rules, bilingual briefing and AI providers really work.
2. **Files changed:** Key modules and documentation created; location of app when repo has source-pack nesting.
3. **Data audit:** Actual counts, mismatches and source-page spot checks with paths to reports.
4. **Test results:** Exact commands run and PASS/FAIL/NOT RUN counts; any known failure and its consequence.
5. **How to run:** Clean checkout commands in <=5 steps, optional AI setup.
6. **Constraints:** Missing official operational status, incomplete Class B measurements, source-data caveats and what remains out of scope.
7. **Submission state:** GitHub URL/deployed URL/video only if real. Otherwise give the precise steps humans still need to complete.
8. **Demo path:** Suggest the strongest reproducible 2-minute officer workflow using verified actual rows.

### Definition of DONE

Do **not** declare success unless all of the following are true:

- Real 2023–2025 data drives all seven site entries and summaries.
- Primary/sample/statewide roles are correct; missing/BDL/ND/zero are differentiated.
- Class B screening comparisons for DO/BOD/pH use the source criteria CSV and are boundary-tested.
- Historical concern, sampling priority, coverage and 2026 legal status are visibly separate.
- Ranking reasons and plotted/readout numbers carry row IDs and report/page provenance.
- User can meaningfully filter, inspect source evidence and generate/copy/print a bilingual officer brief.
- AI absent/failed still yields a usable and accurate briefing.
- Premium responsive design is readable, keyboard-accessible and avoids fake interactivity.
- Methodology/data audit/test report openly state limitations and what was actually checked.
- README, license, environment template, and secret scan are ready for public handoff.
- The app builds and its key tests pass, or failures are explicitly documented and not concealed.

**Begin now: inventory the workspace, read the real guide/dictionary and ALL primary CSV rows, write the audit, and then implement the system phase by phase. No placeholders masquerading as completed features.**
