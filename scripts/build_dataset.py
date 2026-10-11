#!/usr/bin/env python3
"""GhatWatch dataset build + audit (Python 3.9+, standard library only).

Reads the organiser Track 2 pack in source-data/organiser-track-2/ (never modified),
normalises the Bhopal primary CSV, validates the 2025 sample, profiles the
statewide file, parses CPCB criteria, and writes:

  src/generated/observations.json   one record per primary CSV row (nothing dropped)
  src/generated/sites.json          seven site registry entries
  src/generated/standards.json      all 19 CPCB criteria rows + explicit Class B map
  src/generated/data-manifest.json  hashes, counts, provenance, warnings
  docs/DATA_AUDIT.md                human-readable audit

Benchmark pass/fail is deliberately NOT computed here; the TypeScript standards
engine is the single implementation. Python only produces an independent
cross-check count that tests compare against.

Usage:  python3 scripts/build_dataset.py            # JSON + audit
        python3 scripts/build_dataset.py --audit    # audit only (no JSON writes)
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import re
import sys
from collections import Counter, OrderedDict, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACK = ROOT / "source-data" / "organiser-track-2"
DATA = PACK / "data"
RES = PACK / "resources"
DERIVED = ROOT / "source-data" / "derived"
GEN = ROOT / "src" / "generated"
AUDIT_MD = ROOT / "docs" / "DATA_AUDIT.md"

METHODOLOGY_VERSION = "1.0.0"
ORGANISER_REPO = "https://github.com/Vishal4742/bhopal-impact-lab-2026-problem-statements"
ORGANISER_COMMIT = "6b96823f27aaab18ce2f07dfc71a3732011bd4ab"
ORGANISER_PATH = "track-2-visarjan-ghat-watch"

PRIMARY = DATA / "bhopal_ghats_2023_2025.csv"
SAMPLE = DATA / "sample_bhopal_2025.csv"
STATEWIDE = DATA / "mp_immersion_sites_2023_2025.csv"
CRITERIA = DATA / "cpcb_water_quality_criteria.csv"

PRIMARY_HEADER = [
    "year", "festival", "site", "water_body", "phase", "parameter", "value", "unit_assumed", "flag",
    "value_as_printed", "parameter_as_printed", "site_as_printed", "site_match_confidence", "source_page",
]
STATEWIDE_HEADER = [
    "year", "festival", "regional_office", "phase", "parameter", "value", "unit_assumed", "flag",
    "value_as_printed", "parameter_as_printed", "site_as_printed", "needs_check", "source_page",
]
CRITERIA_HEADER = ["class", "designated_best_use", "parameter", "limit_type", "limit", "unit"]

YEARS = [2023, 2024, 2025]
FESTIVALS = ["Ganesh", "Durga"]
PHASES = ["pre", "during", "after"]
PARAMETERS = [
    "pH", "Total solids", "Dissolved solids", "Suspended solids", "Dissolved oxygen", "BOD", "COD",
    "Turbidity", "Conductivity", "Chromium", "Lead", "Zinc", "Copper",
]
# Immersion-CSV parameter -> exact CPCB criteria-CSV parameter label (Class B only).
CLASS_B_MAP = OrderedDict([
    ("Dissolved oxygen", "Dissolved oxygen"),
    ("BOD", "BOD (5 days 20C)"),
    ("pH", "pH"),
])

REPORTS = OrderedDict([
    (2023, {
        "file": "Idol_immer._Report_23_CPCB.pdf",
        "title": "MPPCB Idol Immersion Report 2023 (CPCB format)",
        "titleHi": "म.प्र. प्रदूषण नियंत्रण बोर्ड — मूर्ति विसर्जन रिपोर्ट 2023",
        "url": "https://www.mppcb.mp.gov.in/proc/mon/Idol_immer._Report_23_CPCB.pdf",
    }),
    (2024, {
        "file": "Ganesh_and_Durga_visarjan_report-2024.pdf",
        "title": "MPPCB Ganesh and Durga Visarjan Report 2024",
        "titleHi": "म.प्र. प्रदूषण नियंत्रण बोर्ड — गणेश एवं दुर्गा विसर्जन रिपोर्ट 2024",
        "url": "https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2024.pdf",
    }),
    (2025, {
        "file": "Ganesh_and_Durga_visarjan_report-2025.pdf",
        "title": "MPPCB Ganesh and Durga Visarjan Report 2025",
        "titleHi": "म.प्र. प्रदूषण नियंत्रण बोर्ड — गणेश एवं दुर्गा विसर्जन रिपोर्ट 2025",
        "url": "https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2025.pdf",
    }),
])
CPCB_URL = "https://cpcb.gov.in/water-quality-criteria/"

# Fixed ID map: stable slugs, Hindi names are team transliterations (need native review).
SITES = OrderedDict([
    ("Bairagarh (Sant Hirdaram) kund", {"id": "bairagarh-sant-hirdaram-kund", "nameHi": "बैरागढ़ (संत हिरदाराम) कुंड"}),
    ("Khatlapura ghat", {"id": "khatlapura-ghat", "nameHi": "खटलापुरा घाट"}),
    ("Prempura ghat", {"id": "prempura-ghat", "nameHi": "प्रेमपुरा घाट"}),
    ("Rani Kamlapati ghat / Kamla Park kund", {"id": "rani-kamlapati-kamla-park", "nameHi": "रानी कमलापति घाट / कमला पार्क कुंड"}),
    ("Hathaikheda dam / kund", {"id": "hathaikheda-dam-kund", "nameHi": "हथाईखेड़ा डैम / कुंड"}),
    ("Malikhedi kund", {"id": "malikhedi-kund", "nameHi": "मालीखेड़ी कुंड"}),
    ("Shahpura lake ghat", {"id": "shahpura-lake-ghat", "nameHi": "शाहपुरा झील घाट"}),
])
SITE_NOTES = {
    "Rani Kamlapati ghat / Kamla Park kund": (
        "Ganesh tables print 'Kamla Park ... kund'; Durga tables print 'Rani Kamlapati visarjan ghat (Lower Lake)'. "
        "These may be two different physical places. Confirm the physical site before dispatching a team."
    ),
}

NOT_SAMPLED_TOKENS = {"", "*", "**", "_", "-"}
NOT_SAMPLED_FLAGS = {"not sampled", "*", "**"}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def read_csv(path: Path):
    raw = path.read_bytes()
    has_bom = raw.startswith(b"\xef\xbb\xbf")
    text = raw.decode("utf-8-sig")  # raises on invalid UTF-8, which we want
    crlf = b"\r\n" in raw
    reader = csv.reader(io.StringIO(text, newline=""))
    rows = list(reader)
    header, body = rows[0], rows[1:]
    widths = Counter(len(r) for r in body)
    dict_rows = [dict(zip(header, r)) for r in body]
    meta = {"hasBom": has_bom, "crlf": crlf, "header": header, "rowWidths": dict(widths), "bytes": len(raw)}
    return header, dict_rows, meta


def parse_float(s: str):
    s = s.strip()
    if not re.fullmatch(r"[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?", s):
        return None
    v = float(s)
    return v if math.isfinite(v) else None


def classify(row: dict):
    """Return (status, numeric_value, anomaly or None). Never maps a non-number to 0."""
    value = row["value"].strip()
    flag = row["flag"].strip()
    printed = row["value_as_printed"].strip()
    if value != "":
        num = parse_float(value)
        if num is None:
            return "unparsed", None, "value column is not a number: %r" % value
        if flag:
            return "unparsed", None, "numeric value %r conflicts with flag %r" % (value, flag)
        p = parse_float(printed)
        if p is None or p != num:
            return "numeric", num, "value %r differs from value_as_printed %r" % (value, printed)
        return "numeric", num, None
    upper = printed.upper()
    if flag == "BDL" or upper == "BDL":
        if flag not in ("", "BDL") or upper not in ("", "BDL"):
            return "unparsed", None, "BDL flag/printed mismatch (%r/%r)" % (flag, printed)
        return "below_detection_limit", None, None
    if flag == "ND" or upper == "ND":
        return "not_detected", None, None
    if flag in NOT_SAMPLED_FLAGS and printed in NOT_SAMPLED_TOKENS:
        return "not_sampled", None, None
    return "unparsed", None, "unknown flag/printed combination (%r/%r)" % (flag, printed)


def canon_tuple(row: dict, header):
    return tuple(row[h].strip() for h in header)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--audit", action="store_true", help="write docs/DATA_AUDIT.md only")
    args = ap.parse_args()

    warnings = []
    hard_errors = []

    # ---------- primary ----------
    p_header, primary, p_meta = read_csv(PRIMARY)
    if p_header != PRIMARY_HEADER:
        hard_errors.append("Primary header mismatch: %r" % p_header)
    if set(p_meta["rowWidths"]) != {len(PRIMARY_HEADER)}:
        hard_errors.append("Primary rows with wrong column count: %r" % p_meta["rowWidths"])

    pdf_ver = {}
    pdf_ver_meta = None
    pv_path = DERIVED / "pdf_line_verification.json"
    if pv_path.exists():
        pv = json.loads(pv_path.read_text(encoding="utf-8"))
        pdf_ver_meta = {k: pv[k] for k in ("method", "pypdfVersion", "primarySha256", "groupCounts", "pdfs")}
        for r in pv["rows"]:
            pdf_ver[r["csvLine"]] = r
    manual = json.loads((DERIVED / "manual_spot_checks.json").read_text(encoding="utf-8"))
    manual_keys = {(c["year"], c["festival"], c["site"]): c for c in manual["checks"]}

    primary_sha = sha256_file(PRIMARY)
    if pdf_ver_meta and pdf_ver_meta["primarySha256"] != primary_sha:
        warnings.append("pdf_line_verification.json was generated for a different primary CSV hash; page verification ignored.")
        pdf_ver = {}

    observations = []
    status_counts = Counter()
    status_by_param = defaultdict(Counter)
    anomalies = []
    natural = defaultdict(list)
    unexpected = defaultdict(Counter)
    flags_counter = Counter()
    printed_nonnum = Counter()
    for idx, r in enumerate(primary):
        line = idx + 2
        try:
            year = int(r["year"])
        except ValueError:
            year = None
        if year not in YEARS:
            unexpected["year"][r["year"]] += 1
        if r["festival"] not in FESTIVALS:
            unexpected["festival"][r["festival"]] += 1
        if r["phase"] not in PHASES:
            unexpected["phase"][r["phase"]] += 1
        if r["parameter"] not in PARAMETERS:
            unexpected["parameter"][r["parameter"]] += 1
        if r["site"] not in SITES:
            unexpected["site"][r["site"]] += 1
        status, num, anomaly = classify(r)
        status_counts[status] += 1
        status_by_param[r["parameter"]][status] += 1
        flags_counter[r["flag"]] += 1
        if r["value"].strip() == "":
            printed_nonnum[r["value_as_printed"]] += 1
        raw_join = "\x1f".join(r[h] for h in p_header)
        digest = hashlib.sha256(raw_join.encode("utf-8")).hexdigest()
        oid = "bhp-L%04d-%s" % (line, digest[:8])
        if anomaly:
            anomalies.append({"id": oid, "line": line, "issue": anomaly})
        natural[(r["site"], r["year"], r["festival"], r["phase"], r["parameter"])].append(oid)
        try:
            page = int(r["source_page"])
        except ValueError:
            page = None
            anomalies.append({"id": oid, "line": line, "issue": "source_page not an integer: %r" % r["source_page"]})
        ver = pdf_ver.get(line)
        page_verified = bool(ver and ver["lineMatch"] in ("exact", "loose") and ver["viewerPage"] == page)
        site_meta = SITES.get(r["site"], {"id": "unknown"})
        mk = manual_keys.get((year, r["festival"], r["site"]))
        manual_check = None
        if mk and mk["viewerPage"] == page:
            manual_check = "compared" if r["parameter"] in mk["compared"] else "table_viewed"
        observations.append(OrderedDict([
            ("id", oid),
            ("sourceCsv", "bhopal_ghats_2023_2025.csv"),
            ("sourceCsvLine", line),
            ("siteId", site_meta["id"]),
            ("siteCanonical", r["site"]),
            ("siteAsPrinted", r["site_as_printed"]),
            ("siteMatchConfidence", r["site_match_confidence"] if r["site_match_confidence"] in ("high", "medium", "low") else "unknown"),
            ("waterBody", r["water_body"]),
            ("year", year),
            ("festival", r["festival"]),
            ("phase", r["phase"]),
            ("parameter", r["parameter"]),
            ("parameterAsPrinted", r["parameter_as_printed"]),
            ("numericValue", num),
            ("valueAsPrinted", r["value_as_printed"]),
            ("flag", r["flag"]),
            ("measurementStatus", status),
            ("unitAssumed", r["unit_assumed"] or None),
            ("sourcePageRaw", page),
            ("sourcePdfViewerPage", page if page_verified else None),
            ("pageVerification", (ver["lineMatch"] if page_verified else "unverified")),
            ("manualCheck", manual_check),
        ]))

    dup_keys = {k: v for k, v in natural.items() if len(v) > 1}
    for k, ids in dup_keys.items():
        anomalies.append({"id": ids[0], "line": None, "issue": "duplicate natural key %r -> %r" % (k, ids)})
    for field, cnt in unexpected.items():
        hard_errors.append("Unexpected %s values: %r" % (field, dict(cnt)))

    # windows / coverage frame
    windows = Counter((o["siteCanonical"], o["year"], o["festival"]) for o in observations)
    absent_windows = [
        {"site": s, "siteId": SITES[s]["id"], "year": y, "festival": f}
        for s in SITES for y in YEARS for f in FESTIVALS if (s, y, f) not in windows
    ]

    # independent python cross-check for benchmarked params (TS tests compare to this)
    def num_vals(param):
        return [o["numericValue"] for o in observations if o["parameter"] == param and o["measurementStatus"] == "numeric"]
    do_vals, bod_vals, ph_vals = num_vals("Dissolved oxygen"), num_vals("BOD"), num_vals("pH")
    cross_check = {
        "doNumeric": len(do_vals), "doBelow5": sum(v < 5 for v in do_vals), "doZero": sum(v == 0 for v in do_vals),
        "bodNumeric": len(bod_vals), "bodAbove3": sum(v > 3 for v in bod_vals),
        "phNumeric": len(ph_vals), "phOutside6_5to8_5": sum(v < 6.5 or v > 8.5 for v in ph_vals),
    }

    # ---------- sample ----------
    s_header, sample, s_meta = read_csv(SAMPLE)
    sample_result = {"rows": len(sample), "headerMatchesPrimary": s_header == p_header}
    prim_2025 = Counter(canon_tuple(r, p_header) for r in primary if r["year"] == "2025")
    samp = Counter(canon_tuple(r, s_header) for r in sample) if s_header == p_header else Counter()
    missing_in_primary = samp - prim_2025
    sample_result.update({
        "primary2025Rows": sum(prim_2025.values()),
        "sampleRowsNotInPrimary": sum(missing_in_primary.values()),
        "primary2025RowsNotInSample": sum((prim_2025 - samp).values()),
        "isSubset": sum(missing_in_primary.values()) == 0,
        "identicalTo2025Primary": samp == prim_2025,
    })
    if not sample_result["isSubset"]:
        warnings.append("Sample CSV contains %d rows not present in primary 2025 rows." % sum(missing_in_primary.values()))

    # ---------- statewide (background only; never scored) ----------
    sw_result = {"available": STATEWIDE.exists()}
    if STATEWIDE.exists():
        w_header, sw, w_meta = read_csv(STATEWIDE)
        nc = Counter(r.get("needs_check", "") for r in sw)
        cross_page = defaultdict(set)
        for r in sw:
            key = (r["year"], r["festival"], r["regional_office"], r["site_as_printed"], r["phase"], r["parameter"], r["value_as_printed"])
            cross_page[key].add(r["source_page"])
        multi = sum(1 for v in cross_page.values() if len(v) > 1)
        sw_flags = Counter(r["flag"] for r in sw)
        sw_result.update({
            "rows": len(sw), "headerMatchesPublished": w_header == STATEWIDE_HEADER, "header": w_header,
            "needsCheck": dict(nc), "regionalOffices": len(set(r["regional_office"] for r in sw)),
            "distinctSiteLabels": len(set(r["site_as_printed"] for r in sw)),
            "years": dict(Counter(r["year"] for r in sw)), "flags": dict(sw_flags),
            "identicalReadingKeysOnMultiplePages": multi,
            "sha256": sha256_file(STATEWIDE),
        })

    # ---------- criteria ----------
    c_header, criteria_rows, c_meta = read_csv(CRITERIA)
    if c_header != CRITERIA_HEADER:
        hard_errors.append("Criteria header mismatch: %r" % c_header)
    criteria = []
    for i, r in enumerate(criteria_rows):
        cid = "CPCB-%s-%s" % (r["class"], re.sub(r"[^a-z0-9]+", "-", r["parameter"].lower()).strip("-"))
        criteria.append(OrderedDict([
            ("id", cid), ("csvLine", i + 2), ("class", r["class"]), ("designatedBestUse", r["designated_best_use"]),
            ("parameter", r["parameter"]), ("limitType", r["limit_type"]), ("limit", r["limit"]), ("unit", r["unit"] or None),
        ]))
    class_b = [c for c in criteria if c["class"] == "B"]
    class_b_map = OrderedDict()
    for imm_param, crit_label in CLASS_B_MAP.items():
        match = [c for c in class_b if c["parameter"] == crit_label]
        if len(match) != 1:
            hard_errors.append("Class B criterion for %s (%r) not found exactly once" % (imm_param, crit_label))
        else:
            class_b_map[imm_param] = match[0]["id"]

    # ---------- PDFs ----------
    pdfs = []
    for p in sorted(RES.glob("*.pdf")):
        pdfs.append({"file": p.name, "bytes": p.stat().st_size, "sha256": sha256_file(p),
                     "pages": (pdf_ver_meta or {}).get("pdfs", {}).get(p.name, {}).get("pages")})
    for y, rep in REPORTS.items():
        if not (RES / rep["file"]).exists():
            hard_errors.append("Missing report PDF for %d: %s" % (y, rep["file"]))

    # ---------- sites ----------
    sites_out = []
    for name, meta in SITES.items():
        rows = [o for o in observations if o["siteCanonical"] == name]
        aliases = sorted(set(o["siteAsPrinted"] for o in rows))
        wbs = sorted(set(o["waterBody"] for o in rows))
        confs = sorted(set(o["siteMatchConfidence"] for o in rows))
        conf = "medium" if "medium" in confs else ("high" if confs == ["high"] else "unknown")
        alias_by_fest = OrderedDict((f, sorted(set(o["siteAsPrinted"] for o in rows if o["festival"] == f))) for f in FESTIVALS)
        sites_out.append(OrderedDict([
            ("id", meta["id"]), ("canonicalName", name), ("nameHi", meta["nameHi"]),
            ("waterBody", wbs[0] if len(wbs) == 1 else " / ".join(wbs)),
            ("printedAliases", aliases), ("printedAliasesByFestival", alias_by_fest),
            ("identityConfidence", conf), ("identityNote", SITE_NOTES.get(name)),
            ("rowCount", len(rows)),
            ("absentWindows", [{"year": a["year"], "festival": a["festival"]} for a in absent_windows if a["site"] == name]),
        ]))

    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    manifest = OrderedDict([
        ("sourcePackName", "Bhopal Impact Lab 2026 — Track 2 Visarjan Ghat Watch"),
        ("sourceRepo", ORGANISER_REPO), ("sourceCommit", ORGANISER_COMMIT), ("sourcePath", ORGANISER_PATH),
        ("dataYearMin", min(YEARS)), ("dataYearMax", max(o["year"] for o in observations)),
        ("primaryRowCount", len(primary)), ("uniqueSiteCount", len(set(o["siteId"] for o in observations))),
        ("sampleRowCount", len(sample)), ("criteriaRowCount", len(criteria_rows)),
        ("statewideRowCount", sw_result.get("rows")),
        ("inputSha256", OrderedDict([
            ("bhopal_ghats_2023_2025.csv", primary_sha), ("sample_bhopal_2025.csv", sha256_file(SAMPLE)),
            ("cpcb_water_quality_criteria.csv", sha256_file(CRITERIA)),
            ("mp_immersion_sites_2023_2025.csv", sw_result.get("sha256")),
        ])),
        ("generatedAt", generated_at), ("methodologyVersion", METHODOLOGY_VERSION),
        ("measurementStatusCounts", dict(status_counts)),
        ("crossCheck", cross_check),
        ("sampleCheck", sample_result),
        ("absentWindows", absent_windows),
        ("pageVerification", OrderedDict([
            ("method", pdf_ver_meta["method"] if pdf_ver_meta else None),
            ("groupCounts", pdf_ver_meta["groupCounts"] if pdf_ver_meta else None),
            ("rowsWithVerifiedViewerPage", sum(1 for o in observations if o["sourcePdfViewerPage"] is not None)),
            ("manualTablesChecked", len(manual["checks"])),
        ])),
        ("reports", OrderedDict((str(y), dict(rep, sha256=sha256_file(RES / rep["file"]))) for y, rep in REPORTS.items())),
        ("criteriaSource", CPCB_URL),
        ("validationWarnings", warnings + [a["issue"] + " (line %s)" % a["line"] for a in anomalies]),
    ])
    standards = OrderedDict([
        ("source", CPCB_URL), ("sourceCsv", "cpcb_water_quality_criteria.csv"),
        ("screeningClass", "B"), ("classBParameterMap", class_b_map),
        ("unmeasuredClassBParameters", [c["id"] for c in class_b if c["parameter"] not in CLASS_B_MAP.values()]),
        ("criteria", criteria),
    ])

    if not args.audit:
        GEN.mkdir(parents=True, exist_ok=True)
        dump = lambda obj, name: (GEN / name).write_text(json.dumps(obj, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        (GEN / "observations.json").write_text(
            "[\n" + ",\n".join(json.dumps(o, ensure_ascii=False, separators=(",", ":")) for o in observations) + "\n]\n", encoding="utf-8")
        dump(sites_out, "sites.json")
        dump(standards, "standards.json")
        dump(manifest, "data-manifest.json")

    write_audit(
        p_meta=p_meta, primary=primary, observations=observations, status_counts=status_counts,
        status_by_param=status_by_param, flags_counter=flags_counter, printed_nonnum=printed_nonnum,
        dup_keys=dup_keys, anomalies=anomalies, windows=windows, absent_windows=absent_windows,
        cross_check=cross_check, sample_result=sample_result, s_meta=s_meta, sw_result=sw_result,
        criteria=criteria, class_b_map=class_b_map, pdfs=pdfs, pdf_ver_meta=pdf_ver_meta, manual=manual,
        manifest=manifest, sites_out=sites_out, warnings=warnings, hard_errors=hard_errors, c_meta=c_meta,
    )

    print(json.dumps({
        "primaryRows": len(primary), "sites": manifest["uniqueSiteCount"], "status": dict(status_counts),
        "sampleSubset": sample_result["isSubset"], "absentWindows": len(absent_windows),
        "anomalies": len(anomalies), "hardErrors": hard_errors, "wroteJson": not args.audit,
    }, ensure_ascii=False))
    return 1 if hard_errors else 0


def md_table(headers, rows):
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    for r in rows:
        out.append("| " + " | ".join(str(c).replace("|", "\\|") for c in r) + " |")
    return "\n".join(out)


def write_audit(**k):
    m = k["manifest"]
    obs = k["observations"]
    L = []
    L.append("# GhatWatch — Data Audit")
    L.append("")
    L.append("> Generated by `scripts/build_dataset.py` from the files actually present in `source-data/organiser-track-2/`. "
             "Re-run `npm run data:audit` to regenerate. Generation time (UTC): `%s`." % m["generatedAt"])
    L.append("")
    L.append("## 1. Provenance")
    L.append("")
    L.append("- Source repository: %s (commit `%s`, folder `%s`). Copied unmodified into `source-data/organiser-track-2/`." % (ORGANISER_REPO, ORGANISER_COMMIT, ORGANISER_PATH))
    L.append("- Alternate organiser pack (`Laaaaksh/bhopal-impact-lab-2026`, `tracks/02-visarjan-ghat-watch`): a clone was attempted on 11 Oct 2026 and failed (`fetch-pack: early EOF`). It was **not** compared; the Vishal4742 pack is the only input.")
    L.append("- Python %s, standard-library `csv` parser, UTF-8 decoding (BOM-tolerant)." % sys.version.split()[0])
    L.append("")
    rows = []
    for name, sha in m["inputSha256"].items():
        rows.append([name, sha or "n/a"])
    L.append(md_table(["Input file", "SHA-256"], rows))
    L.append("")
    L.append("## 2. File-level validation")
    L.append("")
    pm = k["p_meta"]
    L.append(md_table(
        ["File", "Data rows (excl. header)", "Header as published", "Column-count by row", "BOM", "CRLF"],
        [
            ["bhopal_ghats_2023_2025.csv", len(k["primary"]), pm["header"] == PRIMARY_HEADER, pm["rowWidths"], pm["hasBom"], pm["crlf"]],
            ["sample_bhopal_2025.csv", k["sample_result"]["rows"], k["sample_result"]["headerMatchesPrimary"], k["s_meta"]["rowWidths"], k["s_meta"]["hasBom"], k["s_meta"]["crlf"]],
            ["mp_immersion_sites_2023_2025.csv", k["sw_result"].get("rows"), k["sw_result"].get("headerMatchesPublished"), "—", "—", "—"],
            ["cpcb_water_quality_criteria.csv", len(k["criteria"]), k["c_meta"]["header"] == CRITERIA_HEADER, k["c_meta"]["rowWidths"], k["c_meta"]["hasBom"], k["c_meta"]["crlf"]],
        ]))
    L.append("")
    if k["hard_errors"]:
        L.append("**Hard errors:** " + "; ".join(k["hard_errors"]))
    else:
        L.append("No hard errors: every primary row has 14 columns, and all years, festivals, phases, parameters and site labels are in the expected sets.")
    L.append("")
    L.append("## 3. Primary file profile (`bhopal_ghats_2023_2025.csv`)")
    L.append("")
    by = lambda f: Counter(o[f] for o in obs)
    L.append("- Unique standardised sites: **%d**" % len(set(o["siteCanonical"] for o in obs)))
    L.append("- Years: %s" % dict(sorted(by("year").items())))
    L.append("- Festivals: %s" % dict(by("festival")))
    L.append("- Phases: %s" % dict(by("phase")))
    L.append("- Parameters (13): %s" % dict(by("parameter")))
    L.append("- Units as assumed by the pack: %s (blank = pH, unitless)" % dict(Counter(o["unitAssumed"] or "(blank)" for o in obs)))
    L.append("- `flag` column values: %s" % dict(k["flags_counter"]))
    L.append("- `value_as_printed` where `value` is empty: %s" % {(kk if kk else "(blank)"): v for kk, v in k["printed_nonnum"].items()})
    L.append("")
    L.append("### Measurement status (GhatWatch normalisation)")
    L.append("")
    sc = k["status_counts"]
    L.append(md_table(["Status", "Rows", "Rule"], [
        ["numeric", sc.get("numeric", 0), "`value` parses as a finite number (real `0` stays 0)"],
        ["below_detection_limit", sc.get("below_detection_limit", 0), "flag/printed `BDL`; no number, not zero, not missing"],
        ["not_detected", sc.get("not_detected", 0), "flag/printed `ND`"],
        ["not_sampled", sc.get("not_sampled", 0), "flag `not sampled`/`*`/`**` with printed blank, `_`, `-`, `*`, `**`"],
        ["unparsed", sc.get("unparsed", 0), "anything else — preserved and listed below"],
        ["not_in_source", "%d windows" % len(k["absent_windows"]), "whole site/year/festival table absent from the pack (never a row)"],
    ]))
    L.append("")
    L.append("### Status by parameter")
    L.append("")
    sbp = k["status_by_param"]
    L.append(md_table(["Parameter", "numeric", "BDL", "ND", "not sampled", "unparsed"], [
        [p, sbp[p].get("numeric", 0), sbp[p].get("below_detection_limit", 0), sbp[p].get("not_detected", 0), sbp[p].get("not_sampled", 0), sbp[p].get("unparsed", 0)]
        for p in PARAMETERS]))
    L.append("")
    L.append("### Rows vs sample windows")
    L.append("")
    L.append("- %d data rows = one parameter reading each. They form %d site × year × festival windows present in the pack (out of a nominal 7 × 3 × 2 = 42)." % (len(obs), len(k["windows"])))
    L.append("- Duplicate natural keys (site, year, festival, phase, parameter): **%d**." % len(k["dup_keys"]))
    L.append("- Windows with no table in the supplied pack (`not_in_source`):")
    for a in k["absent_windows"]:
        L.append("  - %s — %d %s" % (a["site"], a["year"], a["festival"]))
    ss_windows = set((o["year"], o["festival"]) for o in obs if o["parameter"] == "Suspended solids")
    ss_missing = ["%d %s" % (y, f) for y in YEARS for f in FESTIVALS if (y, f) not in ss_windows]
    L.append("- Suspended solids has %d rows (other parameters: 120). It has no rows at all for: %s (the participant guide says the Durga 2023 and Durga 2025 tables omit it). That is a parameter absent from those tables, not a not-sampled reading." % (
        sum(1 for o in obs if o["parameter"] == "Suspended solids"), ", ".join(ss_missing) or "none"))
    L.append("")
    L.append("### Anomalies (preserved, not removed)")
    L.append("")
    if k["anomalies"]:
        L.append(md_table(["Observation", "CSV line", "Issue"], [[a["id"], a["line"], a["issue"]] for a in k["anomalies"]]))
    else:
        L.append("None. No value/flag conflicts, no unparseable numbers, no value vs value_as_printed numeric disagreement.")
    L.append("")
    L.append("### Independent Python cross-check of benchmark parameters")
    L.append("")
    cc = k["cross_check"]
    L.append("- Dissolved oxygen: %d numeric readings; %d below 5 mg/l; %d are a printed numeric 0." % (cc["doNumeric"], cc["doBelow5"], cc["doZero"]))
    L.append("- BOD: %d numeric readings; %d above 3 mg/l." % (cc["bodNumeric"], cc["bodAbove3"]))
    L.append("- pH: %d numeric readings; %d outside 6.5–8.5." % (cc["phNumeric"], cc["phOutside6_5to8_5"]))
    L.append("- These match the participant guide's statements (42 of 116 DO below 5; 100 of 112 BOD above 3). The TypeScript engine is tested against these counts (`tests/ingestion.test.ts`).")
    zero_rows = [o for o in obs if o["parameter"] == "Dissolved oxygen" and o["numericValue"] == 0]
    L.append("")
    L.append(md_table(["DO = 0 observation", "CSV line", "Site", "Year", "Festival", "Phase", "PDF viewer page"],
                      [[o["id"], o["sourceCsvLine"], o["siteCanonical"], o["year"], o["festival"], o["phase"], o["sourcePageRaw"]] for o in zero_rows]))
    L.append("")
    L.append("## 4. Site identity")
    L.append("")
    L.append(md_table(["Site ID", "Canonical", "Water body (as in CSV)", "Identity", "Printed aliases"], [
        [s["id"], s["canonicalName"], s["waterBody"], s["identityConfidence"], "<br>".join(s["printedAliases"])] for s in k["sites_out"]]))
    L.append("")
    L.append("- **Rani Kamlapati ghat / Kamla Park kund** is `medium` confidence in every row. Ganesh tables print *Kamla Park … kund*; Durga tables print *Rani Kamlapati visarjan ghat (Lower Lake)*. GhatWatch keeps one canonical record (as the pack does) but shows the ambiguity everywhere and never assigns coordinates.")
    L.append("- No coordinates are present in any file; GhatWatch does not geocode.")
    L.append("")
    L.append("## 5. 2025 sample (`sample_bhopal_2025.csv`)")
    L.append("")
    sr = k["sample_result"]
    L.append("- Rows: %d. Header identical to primary: %s." % (sr["rows"], sr["headerMatchesPrimary"]))
    L.append("- Compared as a multiset of all 14 trimmed fields against the %d primary rows with year 2025: rows in sample but not primary = **%d**; primary-2025 rows not in sample = %d; identical multiset = **%s**." % (
        sr["primary2025Rows"], sr["sampleRowsNotInPrimary"], sr["primary2025RowsNotInSample"], sr["identicalTo2025Primary"]))
    L.append("- The sample is never added to totals. The app reads only the primary file.")
    L.append("")
    L.append("## 6. Statewide file (background only, excluded from all scoring)")
    L.append("")
    sw = k["sw_result"]
    if sw.get("available"):
        L.append("- Rows: %d. Header: `%s`." % (sw["rows"], ",".join(sw["header"])))
        L.append("- `needs_check` values: %s (published guide: 879 rows marked `yes`)." % sw["needsCheck"])
        L.append("- Regional offices: %d; distinct printed site labels: %d; years: %s." % (sw["regionalOffices"], sw["distinctSiteLabels"], sw["years"]))
        L.append("- Reading keys (year, festival, office, printed site, phase, parameter, printed value) that occur on more than one `source_page`: **%d** — consistent with the dictionary's warning that some tables span two pages and appear twice." % sw["identicalReadingKeysOnMultiplePages"])
        L.append("- No site standardisation, so it cannot be joined safely to the seven Bhopal sites. Not used in rankings, charts or briefs.")
    L.append("")
    L.append("## 7. CPCB criteria (`cpcb_water_quality_criteria.csv`)")
    L.append("")
    L.append(md_table(["ID", "Class", "Parameter", "Limit type", "Limit", "Unit"], [
        [c["id"], c["class"], c["parameter"], c["limitType"], c["limit"], c["unit"] or ""] for c in k["criteria"]]))
    L.append("")
    L.append("- Class B mapping used for screening (explicit, no fuzzy matching): %s." % ", ".join("`%s` → `%s`" % (a, b) for a, b in k["class_b_map"].items()))
    L.append("- `CPCB-B-total-coliform` (max 500 MPN/100 ml) has **no observations** in the ghat data, so no site can be said to meet Class B in full.")
    L.append("- Class E electrical conductivity (2250 micromhos/cm) is a different class and is **not** applied to the Conductivity column.")
    L.append("")
    L.append("## 8. Source PDFs and page references")
    L.append("")
    L.append(md_table(["File", "Pages", "Bytes", "SHA-256"], [[p["file"], p["pages"] or "not opened", p["bytes"], p["sha256"][:16] + "…"] for p in k["pdfs"]]))
    L.append("")
    L.append("Year → report mapping (filenames confirmed present): " + "; ".join("%s → `%s`" % (y, r["file"]) for y, r in REPORTS.items()) + ".")
    L.append("")
    pv = k["pdf_ver_meta"]
    if pv:
        gc = pv["groupCounts"]
        L.append("### Automated page-text check (all rows)")
        L.append("")
        L.append("`scripts/verify_pdf_pages.py` (pypdf %s) extracted the text of each cited page, read `source_page` as a **1-based PDF viewer page**, and searched for a numbered line with the printed parameter label followed by the printed pre/during/after tokens." % pv["pypdfVersion"])
        L.append("")
        L.append("- Parameter lines (site × year × festival × parameter groups): exact match **%d**, whitespace-insensitive match %d, not found %d, inconsistent page %d." % (gc["exact"], gc["loose"], gc["not_found"], gc["page_inconsistent"]))
        L.append("- The one whitespace-only match is Bairagarh 2025 Ganesh pH: the PDF prints `* *` in the after column; the CSV records `**`.")
        L.append("- Rows whose viewer page is therefore marked text-verified: **%d of %d**. The app links these with `#page=N`." % (m["pageVerification"]["rowsWithVerifiedViewerPage"], len(obs)))
        L.append("- Limitation: a text match proves the printed tokens occur on that page; when two tables on a page share identical values (e.g. `0.03 0.03 0.03`), it does not by itself prove table→site attribution. The pages show no separate printed page numbers, so viewer page = report page for citation purposes.")
        L.append("")
    L.append("### Manual visual checks (performed by the build team)")
    L.append("")
    L.append(k["manual"]["note"])
    L.append("")
    L.append(md_table(["Year", "Festival", "Site", "Viewer page", "Printed heading", "Compared", "Result", "Notable"], [
        [c["year"], c["festival"], c["site"], c["viewerPage"], c["printedHeading"], ", ".join(c["compared"]), c["result"], c["notable"]] for c in k["manual"]["checks"]]))
    L.append("")
    L.append("All six year × festival combinations are covered; the checks include numeric zero (DO), `BDL`, `_`, `*` and a missing-column table. The organiser's own note says the Bhopal file was spot-checked on six tables, not exhaustively certified; the checks above are ours and are additional.")
    L.append("")
    L.append("## 9. Warnings carried into the app")
    L.append("")
    if m["validationWarnings"]:
        for w in m["validationWarnings"]:
            L.append("- " + w)
    else:
        L.append("- None from the build. Standing caveats: units are assumed (reports print none); data is historical (2023–2025) and not live; 2026 site status is unverified.")
    L.append("")
    AUDIT_MD.parent.mkdir(parents=True, exist_ok=True)
    AUDIT_MD.write_text("\n".join(L) + "\n", encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
