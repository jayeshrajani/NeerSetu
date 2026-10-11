# GhatWatch — repository rules for Copilot

- Product: Track 2 "Visarjan Ghat Watch". One user (BMC officer), one workflow (rank → inspect evidence → bilingual brief).
- Source of truth: `source-data/organiser-track-2/` (organiser pack, never edit). Build normalised JSON with `npm run data:build` (Python 3 stdlib only) → `src/generated/`.
- Methodology: `docs/METHODOLOGY.md` and `/methodology`. Scoring constants live in `src/lib/scoring.ts` (`SCORING`); change docs + tests together.
- Honesty rules (tests enforce these):
  - numeric `0` stays 0; blank/`_`/`*`/`**` = not sampled; `BDL`/`ND` = censored. None of these become 0 or "clean".
  - CPCB Class B is a screening comparison for DO/BOD/pH only. Coliform is unmeasured. No "safe", "compliant", "approved", "caused by immersion", health claims.
  - Historical concern, sampling priority, coverage and 2026 status (`unverified`) stay separate.
  - Every number shown links to an observation ID → CSV line → report PDF page. Only text-verified pages get `#page=N`.
  - Rani Kamlapati / Kamla Park identity is medium confidence. Map markers come only from OSM features saved in `source-data/geo/` (`npm run data:build` runs `scripts/build_geo.py`); every marker states its basis. Never add hand-typed coordinates.
  - The home plan uses today's IST date and `src/lib/calendar.ts`; only add festival dates with a citable source.
- AI is optional (`AI_PROVIDER=none` default). Keys are server-only; the model may only rewrite purpose/action wording; output is validated in `src/lib/brief-validation.ts`.
- Checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. Never commit `.env*` files.
