#!/usr/bin/env python3
"""Check every primary-CSV parameter line against the text of its cited PDF page.

Requires `pypdf` (dev-only; not needed to run the app). Writes
source-data/derived/pdf_line_verification.json, which build_dataset.py consumes.

Method: for each (year, festival, site, parameter) group, the printed values
for pre/during/after are joined into one expected line, e.g. "D.Oxygen 7.3 6 6.5".
The cited page (1-based PDF viewer page) is text-extracted and searched for a
numbered line with that parameter label and those tokens. A match proves the
values occur on that page; it does not by itself prove which table (site) they
belong to, so we additionally record whether a distinctive site keyword occurs
on the same page.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
import sys
from collections import OrderedDict
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover
    sys.exit("pypdf is required: python3 -m pip install pypdf")

ROOT = Path(__file__).resolve().parent.parent
PACK = ROOT / "source-data" / "organiser-track-2"
PRIMARY = PACK / "data" / "bhopal_ghats_2023_2025.csv"
OUT = ROOT / "source-data" / "derived" / "pdf_line_verification.json"

REPORTS = {
    "2023": "Idol_immer._Report_23_CPCB.pdf",
    "2024": "Ganesh_and_Durga_visarjan_report-2024.pdf",
    "2025": "Ganesh_and_Durga_visarjan_report-2025.pdf",
}
PHASES = ["pre", "during", "after"]
SITE_KEYWORDS = {
    "Bairagarh (Sant Hirdaram) kund": "hirdaram",
    "Khatlapura ghat": "khatlapura",
    "Prempura ghat": "prempura",
    "Rani Kamlapati ghat / Kamla Park kund": "kamlapati",
    "Hathaikheda dam / kund": "hathaikheda",
    "Malikhedi kund": "maalikhedi",
    "Shahpura lake ghat": "shahpura",
}


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().lower()


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    with PRIMARY.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    groups: "OrderedDict[tuple, dict]" = OrderedDict()
    for line_no, r in enumerate(rows, start=2):
        key = (r["year"], r["festival"], r["site"], r["parameter"])
        g = groups.setdefault(key, {"pages": set(), "printed": {}, "label": r["parameter_as_printed"], "lines": {}})
        g["pages"].add(r["source_page"])
        g["printed"][r["phase"]] = r["value_as_printed"].strip()
        g["lines"][r["phase"]] = line_no

    page_text: dict = {}
    pdf_meta = {}
    for year, fn in REPORTS.items():
        path = PACK / "resources" / fn
        reader = PdfReader(str(path))
        pdf_meta[fn] = {"pages": len(reader.pages), "sha256": sha256(path)}
        for i, page in enumerate(reader.pages, start=1):
            page_text[(year, i)] = page.extract_text() or ""

    results = []
    counts = {"exact": 0, "loose": 0, "not_found": 0, "page_inconsistent": 0}
    for (year, festival, site, parameter), g in groups.items():
        if len(g["pages"]) != 1:
            status = "page_inconsistent"
            page = None
        else:
            page = int(next(iter(g["pages"])))
            text = page_text.get((year, page), "")
            tokens = [g["printed"].get(p, "") for p in PHASES]
            tokens = [t for t in tokens if t != ""]
            label = re.escape(g["label"].lower())
            candidates = []
            for ln in text.splitlines():
                m = re.match(rf"^\s*\d+\s+{label}\s+(.*)$", norm(ln))
                if m:
                    candidates.append(m.group(1))
            exp = " ".join(tokens).lower()
            if exp in (c.strip() for c in candidates):
                status = "exact"
            elif exp.replace(" ", "") in (c.replace(" ", "") for c in candidates):
                status = "loose"
            else:
                status = "not_found"
        counts[status] += 1
        site_kw = SITE_KEYWORDS[site]
        site_on_page = page is not None and site_kw in norm(page_text.get((year, page), ""))
        for phase, line_no in g["lines"].items():
            results.append({
                "csvLine": line_no,
                "year": int(year),
                "festival": festival,
                "site": site,
                "parameter": parameter,
                "phase": phase,
                "viewerPage": page,
                "lineMatch": status,
                "siteKeywordOnPage": site_on_page,
            })

    results.sort(key=lambda x: x["csvLine"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    out = {
        "method": "pypdf text extraction; cited source_page read as 1-based PDF viewer page; parameter line matched by printed tokens",
        "pypdfVersion": __import__("pypdf").__version__,
        "primarySha256": sha256(PRIMARY),
        "pdfs": pdf_meta,
        "groupCounts": counts,
        "rows": results,
    }
    OUT.write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"groups": counts, "rows": len(results), "out": str(OUT.relative_to(ROOT))}))


if __name__ == "__main__":
    main()
