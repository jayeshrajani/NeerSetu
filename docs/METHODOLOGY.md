# GhatWatch — Methodology (v1.0.0)

GhatWatch is a **historical screening and prioritisation aid** for a BMC officer planning pre-Durga-visarjan water testing. It is not a live water monitor, not a safety certificate, not a legal compliance finding, not a 2026 site-authorisation status, and not evidence that idol immersion caused any reading. The same content, with numbers computed live from the bundled data, is at `/methodology` in the app.

Code: `src/lib/standards.ts` (comparisons), `src/lib/scoring.ts` (`SCORING` constants, index, priority, reasons), `src/lib/coverage.ts`, `src/lib/filters.ts`. Change this document and `tests/` together with any constant.

## 1. Inputs

| File | Rows | Role |
|---|---:|---|
| `bhopal_ghats_2023_2025.csv` | 1,524 | Only input to rankings, charts and briefs |
| `sample_bhopal_2025.csv` | 453 | Verified identical to primary 2025 rows; never added |
| `mp_immersion_sites_2023_2025.csv` | 21,600 | Profiled in the audit; excluded from everything else |
| `cpcb_water_quality_criteria.csv` | 19 | Parsed; Class B rows used for screening |

See `docs/DATA_AUDIT.md` for hashes, counts and verification.

## 2. Screening comparison: CPCB Class B

Class B (*outdoor bathing, organised*) is chosen as a **comparison** because people enter the water at ghats. It is not an official designation for these ghats. Explicit mapping, no fuzzy matching:

| Immersion parameter | Criterion ID | Rule (inclusive) |
|---|---|---|
| Dissolved oxygen | `CPCB-B-dissolved-oxygen` | min 5 mg/l → `<5` outside, `5` within |
| BOD | `CPCB-B-bod-5-days-20c` (`BOD (5 days 20C)`) | max 3 mg/l → `3` within, `3.1` outside |
| pH | `CPCB-B-ph` | range 6.5–8.5 → `6.49`/`8.51` outside |

- `CPCB-B-total-coliform` (max 500 MPN/100 ml) is **not measured** in the ghat data → no site can be called Class B compliant.
- COD, total/dissolved/suspended solids, turbidity, conductivity, chromium, lead, zinc, copper: `no_class_b_benchmark`; shown as contextual readings only. The Class E conductivity limit is not applied.
- Units are **assumed** by the data pack (the reports print none).

## 3. Measurement status

| Source | Status | Score effect |
|---|---|---|
| number (incl. printed `0`) | `numeric` | compared |
| `BDL` | `below_detection_limit` | none (no detection limit published) |
| `ND` | `not_detected` | none |
| blank, `_`, `-`, `*`, `**` | `not_sampled` | none; counted as a gap |
| whole site/year/festival table absent | `not_in_source` (coverage only, no row invented) | none; reason + priority |
| anything else | `unparsed` (none found) | none; listed in audit |

Nothing that is not a number contributes a severity of zero.

## 4. Historical concern index (non-official heuristic)

Per numeric reading (bounded magnitude outside the screening level — not a probability, toxicity or health risk):

```
DO severity  = clamp((5 − DO) / 5, 0, 1)
BOD severity = clamp((BOD − 3) / 3, 0, 1)
pH severity  = clamp(max(6.5 − pH, pH − 8.5, 0) / 2, 0, 1)
```

Readings are grouped into **windows** = site × year × festival (Ganesh and Durga never merged). Per window: `meanSeverity`, `exceedanceFraction = outside / numeric`, `hasExceedance`. Recency weights 2023 = 1, 2024 = 1.25, 2025 = 1.5 (product choice, not policy).

```
concernIndex = 100 × ( 0.45 × Σw·meanSeverity / Σw
                     + 0.35 × Σw·exceedanceFraction / Σw
                     + 0.20 × windowsWithExceedance / sampledWindows )
```

- Only windows with ≥1 numeric DO/BOD/pH reading are in any denominator.
- A site is scored only with **≥3 numeric readings across ≥2 of the three parameters** in scope; otherwise `insufficient_evidence`, unranked, listed after ranked sites.
- Bands (UX): ≥50 elevated, ≥20 moderate, <20 lower observed (never "safe").
- Ranking: index desc → numeric reading count desc → canonical name.
- Filters (year / festival / phase) recompute everything from matching rows. The parameter view never changes the score.

### Computed result (all years, both festivals, all phases)

| Rank | Site | Index | Band | Numeric DO/BOD/pH | Windows with exceedance | Lowest DO | Highest BOD |
|---:|---|---:|---|---:|---|---:|---:|
| 1 | Bairagarh (Sant Hirdaram) kund | 63.3 | elevated | 39 | 5/5 | 0 | 14 |
| 2 | Malikhedi kund | 56.3 | elevated | 39 | 5/5 | 0.6 | 16.8 |
| 3 | Shahpura lake ghat | 49.9 | moderate | 54 | 6/6 | 2.5 | 11.6 |
| 4 | Rani Kamlapati ghat / Kamla Park kund | 49.8 | moderate | 54 | 6/6 | 2.4 | 9.2 |
| 5 | Khatlapura ghat | 46.9 | moderate | 53 | 6/6 | 4 | 11.2 |
| 6 | Hathaikheda dam / kund | 45.0 | moderate | 54 | 6/6 | 5.1 | 22 |
| 7 | Prempura ghat | 30.7 | moderate | 50 | 5/6 | 3.9 | 6.8 |

Generated from `rankSites()` on the current dataset; `tests/scoring.test.ts` recomputes the formula independently. Distribution note: BOD exceeds 3 mg/l in 100 of 112 numeric readings, so every site's fraction-outside component is high; DO severity and recurrence separate them. No site falls below 20, so no "lower observed" band appears in the full scope. Thresholds were kept as specified.

## 5. Evidence coverage (separate from concern)

- **Numeric DO/BOD/pH** = numeric readings ÷ DO/BOD/pH rows that exist (incl. not sampled, BDL).
- **Festival tables** = windows present ÷ nominal windows in scope (3 years × 2 festivals = 6 for the full range). The nominal frame is an analytical reference, not an official sampling mandate.
- **Phase grid**: each pre / during / after slot is full, partial, not sampled, or no table.
- Identity confidence is a separate label.

## 6. Sampling / verification priority (separate from concern)

1. **Urgent re-test** — any numeric DO ≤ 2.5 mg/l (incl. 0) or BOD ≥ 9 mg/l in scope (heuristic triggers).
2. **Priority re-test** — any screening exceedance; or the latest year in scope has a missing festival table, only during-immersion readings, or no numeric reading.
3. **Routine verification** — otherwise (still not a safety or approval determination).

`needsIdentityVerification` is a separate boolean (medium/low identity) that coexists with any priority. Nothing is dispatched automatically.

With the current data 6 of 7 sites trigger urgent re-test across 2023–2025 (Prempura: priority re-test). This reflects how many severe historical readings exist; filter by year to see recency.

## 7. Reasons

Every reason is generated from facts: DO = 0, DO ≤ 2.5, BOD ≥ 9, DO below 5, BOD above 3, pH outside, recurrence, not-sampled slots — each lists contributing observation IDs. "No table in the reports" reasons cite a **source-coverage assertion** (no rows for site/year/festival in the CSV) instead of an invented ID. The identity reason cites the site note.

## 8. Source pages

`source_page` is the 1-based PDF viewer page (confirmed by text extraction; the reports print no separate page numbers). Rows whose printed parameter line was found on that page get a `#page=N` link to the bundled PDF; all 1,524 rows passed. Otherwise the UI would say "source metadata page N (not independently verified)".

## 9. Briefs

Facts (values, comparisons, citations) are assembled deterministically (`src/lib/brief-facts.ts`, `brief-templates.ts`). An optional AI provider may only rewrite the purpose sentence and action wording; `src/lib/brief-validation.ts` rejects unknown evidence/site IDs, numbers not in the facts, markup, and safety/causal/legal/health terms. Any failure falls back to the template. Hindi text is a team translation and needs native-speaker review.

## 10. Prohibited inferences

No current water quality, no 2026 authorisation status, no causation from immersion, no health effects, no Class B compliance, no geolocation.
