# Test report

Run on 11 Oct 2026 (macOS, Node 26.8.1, npm 11.19.0, Python 3.9.6) in the working tree. Only results actually executed are marked PASS.

## Commands

| Command | Result |
|---|---|
| `npm run data:build` (build_dataset.py + build_geo.py) | PASS — 1,524 rows, 0 anomalies, 0 hard errors; geo.json written |
| `npm test` (Vitest) | PASS — 10 files, 58 tests |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` (Next 16.4) | PASS |
| Re-run `data:build`, compare outputs | PASS — observations/sites/standards byte-identical; manifest differs only in `generatedAt` |
| Secret scan (`grep` for key patterns, `.next/static` for key names, `git check-ignore .env`) | PASS — none found; `.env`/`.env.local` ignored |
| `npm install` from scratch | NOT RUN on a clean clone. Local installs needed retries through the corporate npm mirror (`ECONNRESET`), not a project issue |

## Acceptance matrix

| ID | Status | Evidence |
|---|---|---|
| D01–D10 | PASS | `tests/ingestion.test.ts`, `tests/missingness.test.ts` |
| S01–S06 | PASS | `tests/standards.test.ts` (boundaries 4.9/5, 3/3.1, 6.49/6.5/8.5/8.51, BDL/ND, no-limit params, coliform) |
| S07–S11 | PASS | `tests/scoring.test.ts`, `tests/missingness.test.ts` |
| S12 | PASS | `tests/filters.test.ts` |
| T01–T05, T08 | PASS | `tests/provenance.test.ts` |
| T06 (gaps never joined) | PASS (manual) | Charts use one series per festival-year with `connectNulls={false}`; checked on Bairagarh detail screenshot |
| T07 (no causal/safety claims) | PASS | `tests/brief.test.ts`; AI output filter in `tests/ai-fallback.test.ts` |
| U01 Plan / ranking render | PASS (manual + HTTP) | `/`, `/?view=map`, `/ranking`, all 7 `/ghats/*` return 200; headless Chrome screenshots at 1440px |
| U02 Filters + reset + invalid | PASS | `tests/filters.test.ts`; `/?year=2031` shows the error alert |
| U03 Ghat detail | PASS (HTTP + screenshot) | 7/7 return 200 |
| U04 Bilingual brief | PASS | `tests/brief.test.ts` |
| U05 Copy / print / review box | PASS (jsdom) | `tests/ui-smoke.test.tsx`; the real print dialog was not opened (headless) |
| U06 Responsive 1440/1024/375 | PASS (overflow check) | `scrollWidth == innerWidth` on plan, detail, ranking, methodology, brief. Keyboard navigation was not systematically audited |
| U07 No-key / invalid key / timeout | PASS | `tests/ai-fallback.test.ts` (network mocked) |
| U08 Fake IDs / invented numbers rejected | PASS | `tests/ai-fallback.test.ts` |
| U09 404 / invalid input | PASS | `/ghats/nope` 404; `/reports/1999` 404; malformed `POST /api/brief` 400 |
| U10 No credentials in client | PASS | secret scan above |
| U11 Clean install/build | PARTIAL | build/test/lint/typecheck pass locally; clean-clone install NOT RUN |
| U12 README | PASS | 4 run steps, track, user, limitations, sources, team placeholders |
| Plan: today / calendar / dated steps | PASS | `tests/outlook.test.ts` (IST date, `?asOf` validation, stage changes, step status by date, Durga-only ranking) |
| Map anchors sourced, not invented | PASS | `tests/outlook.test.ts` checks every anchor's OSM id exists in the saved `source-data/geo/` responses |
| Live AI provider | NOT RUN | No keys available |
| 3D fly-in India → Bhopal | PASS (manual) | Headless Chrome (SwiftShader) screenshots before, during and after the flight |
