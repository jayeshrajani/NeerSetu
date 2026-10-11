# Submission checklist

Deadline: **5:00 PM IST, Sunday 11 October 2026** · Form: https://docs.google.com/forms/d/e/1FAIpQLSfKNgfbYvYMI6xHgS0ir4kBhZWspGp37hIzbt9PhB-ZfK70vQ/viewform

| Item | Status |
|---|---|
| Public GitHub repo URL | `________________` (not yet created/pushed) |
| Team name and members in README | ☐ fill `[TEAM NAME]` / `[MEMBER NAME]` placeholders |
| Track and user in README | ☑ Track 2, BMC officer |
| Run in ≤5 steps | ☑ 4 steps in README (tested locally: `npm install`, `npm test`, `npm run build && npm start`) |
| What works / doesn't | ☑ README sections |
| Extra data sources listed | ☑ none added; organiser sources linked |
| LICENSE | ☑ MIT |
| `.env.example`, no secrets | ☑ placeholders only; `.env*` ignored — re-run the secret scan below before pushing |
| Tests / build pass | ☑ see `docs/TEST_REPORT.md` |
| Data credit | ☑ organiser pack + MPPCB + CPCB in README |
| Hindi reviewed by a native speaker | ☐ |
| AI keys verified (optional) | ☐ not tested — set `AI_PROVIDER`, `AI_MODEL`, key in `.env.local` and try "Refine wording with AI" |
| ≤2 min screen recording (optional) | ☐ follow `docs/DEMO_SCRIPT.md`; link: `________` |
| Form submitted | ☐ |

## Before pushing

```bash
git status --short                       # .env / .env.local must NOT appear
git grep -nE "sk-[A-Za-z0-9]{10,}|csk-[A-Za-z0-9]{10,}|api[_-]?key\s*[:=]\s*['\"][^'\"]{8,}" || echo "no secrets found"
npm test && npm run typecheck && npm run lint && npm run build
```

The source PDFs (~29 MB) are committed so citations and page checks are reproducible. Remove `GHATWATCH_COPILOT_AGENT_MASTER_PROMPT.md` / `GHATWATCH_PLATFORM_BLUEPRINT.md` from the root only if the team prefers (a copy of the blueprint is in `docs/`).
