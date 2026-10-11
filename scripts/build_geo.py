#!/usr/bin/env python3
"""Build src/generated/geo.json for the map (Python 3.9+, standard library only).

Inputs (all committed under source-data/geo/):
  ne_10m_india_pov.geojson        Natural Earth, India point-of-view boundary (public domain)
  osm_waterbodies_overpass.json   OSM lake polygons via Overpass `out geom` (ODbL)
  osm_site_anchors.json           OSM named features / localities used as anchors (ODbL)
  site_locations.json             hand-written mapping: ghat -> anchor + basis (no invented coordinates)
"""
from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GEO = ROOT / "source-data" / "geo"
OUT = ROOT / "src" / "generated" / "geo.json"


def perp(p, a, b):
    (x, y), (x1, y1), (x2, y2) = p, a, b
    dx, dy = x2 - x1, y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(x - x1, y - y1)
    t = max(0.0, min(1.0, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)))
    return math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))


def simplify(pts, tol):
    if len(pts) < 4:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        best, idx = 0.0, -1
        for k in range(i + 1, j):
            d = perp(pts[k], pts[i], pts[j])
            if d > best:
                best, idx = d, k
        if best > tol and idx > 0:
            keep[idx] = True
            stack += [(i, idx), (idx, j)]
    return [p for p, k in zip(pts, keep) if k]


def ring_area(r):
    return 0.5 * sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1))


def inside(pt, ring):
    x, y = pt
    c = False
    for i in range(len(ring) - 1):
        (x1, y1), (x2, y2) = ring[i], ring[i + 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def visual_center(outer, holes):
    """Interior point farthest from any edge (grid search) — avoids bbox centres that fall on land."""
    xs = [p[0] for p in outer]
    ys = [p[1] for p in outer]
    best, bp = -1.0, None
    n = 60
    for i in range(1, n):
        for j in range(1, n):
            p = (min(xs) + (max(xs) - min(xs)) * i / n, min(ys) + (max(ys) - min(ys)) * j / n)
            if not inside(p, outer) or any(inside(p, h) for h in holes):
                continue
            d = min(perp(p, outer[k], outer[k + 1]) for k in range(len(outer) - 1))
            if d > best:
                best, bp = d, p
    return bp


def stitch(ways):
    """Join member ways (lists of [lon,lat]) into closed rings."""
    ways = [w[:] for w in ways if len(w) > 1]
    rings = []
    while ways:
        ring = ways.pop(0)
        changed = True
        while ring[0] != ring[-1] and changed:
            changed = False
            for i, w in enumerate(ways):
                if w[0] == ring[-1]:
                    ring += w[1:]
                elif w[-1] == ring[-1]:
                    ring += w[::-1][1:]
                elif w[-1] == ring[0]:
                    ring = w[:-1] + ring
                elif w[0] == ring[0]:
                    ring = w[::-1][:-1] + ring
                else:
                    continue
                ways.pop(i)
                changed = True
                break
        if ring[0] == ring[-1] and len(ring) >= 4:
            rings.append(ring)
    return rings


def r5(p):
    return [round(p[0], 5), round(p[1], 5)]


def main() -> None:
    cfg = json.loads((GEO / "site_locations.json").read_text(encoding="utf-8"))

    # India outline
    ind = json.loads((GEO / "ne_10m_india_pov.geojson").read_text(encoding="utf-8"))["features"][0]["geometry"]
    polys = ind["coordinates"] if ind["type"] == "MultiPolygon" else [ind["coordinates"]]
    india = []
    for poly in polys:
        outer = [tuple(p) for p in poly[0]]
        if abs(ring_area(outer)) < 0.02:  # drop specks (< ~250 km²)
            continue
        s = simplify(outer, 0.04)
        if len(s) >= 4:
            india.append([r5(p) for p in s])
    india.sort(key=lambda r: -abs(ring_area(r)))

    # Lakes
    raw = json.loads((GEO / "osm_waterbodies_overpass.json").read_text(encoding="utf-8"))
    by_osm = {}
    for e in raw["elements"]:
        key = f"{e['type']}/{e['id']}"
        if e["type"] == "way":
            outers = [[[g["lon"], g["lat"]] for g in e["geometry"]]]
            inners = []
        else:
            outers = stitch([[[g["lon"], g["lat"]] for g in m.get("geometry", [])] for m in e["members"] if m["type"] == "way" and m.get("role") == "outer"])
            inners = stitch([[[g["lon"], g["lat"]] for g in m.get("geometry", [])] for m in e["members"] if m["type"] == "way" and m.get("role") == "inner"])
        by_osm[key] = (outers, inners)

    lakes = []
    lake_center = {}
    for wb in cfg["waterBodies"]:
        outers, inners = by_osm[wb["osm"]]
        outers = sorted(outers, key=lambda r: -abs(ring_area(r)))
        main_outer = [tuple(p) for p in outers[0]]
        holes = [[tuple(p) for p in h] for h in inners if inside(tuple(h[0]), main_outer)]
        c = visual_center(main_outer, holes)
        lake_center[wb["id"]] = c
        lakes.append({
            "id": wb["id"], "name": wb["name"], "nameHi": wb["nameHi"], "osm": wb["osm"],
            "outer": [[r5(p) for p in simplify([tuple(q) for q in o], 0.00012)] for o in outers],
            "holes": [[r5(p) for p in simplify(h, 0.00012)] for h in holes if abs(ring_area(h)) > 2e-7],
            "center": r5(c),
        })

    anchors_raw = {f"{e['type']}/{e['id']}": e for e in json.loads((GEO / "osm_site_anchors.json").read_text(encoding="utf-8"))["elements"]}
    wb_osm_to_id = {wb["osm"]: wb["id"] for wb in cfg["waterBodies"]}
    sites = []
    for s in cfg["sites"]:
        out = []
        for a in s["anchors"]:
            if a["basis"] == "water_body":
                lon, lat = lake_center[wb_osm_to_id[a["osm"]]]
            else:
                e = anchors_raw[a["osm"]]
                lon, lat = e["lon"], e["lat"]
            out.append({**a, "lon": round(lon, 5), "lat": round(lat, 5)})
        sites.append({"siteId": s["siteId"], "anchors": out})

    lons = [p[0] for l in lakes for o in l["outer"] for p in o] + [a["lon"] for s in sites for a in s["anchors"]]
    lats = [p[1] for l in lakes for o in l["outer"] for p in o] + [a["lat"] for s in sites for a in s["anchors"]]
    result = {
        "attribution": {
            "india": "Boundary: Natural Earth (public domain), India point-of-view edition ne_10m_admin_0_countries_ind. Simplified for display; not an authoritative boundary.",
            "osm": "Lakes and anchors © OpenStreetMap contributors, ODbL. Queried via Overpass API on 11 Oct 2026.",
        },
        "precision": cfg["precision"],
        "india": india,
        "bhopal": {"lon": anchors_raw["node/245712627"]["lon"], "lat": anchors_raw["node/245712627"]["lat"], "osm": "node/245712627", "note": "OSM city label point only, not a data location."},
        "bhopalBounds": [round(min(lons), 4), round(min(lats), 4), round(max(lons), 4), round(max(lats), 4)],
        "lakes": lakes,
        "sites": sites,
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"indiaRings": len(india), "indiaPoints": sum(len(r) for r in india), "lakes": [(l["id"], sum(len(o) for o in l["outer"]), len(l["holes"])) for l in lakes], "bytes": OUT.stat().st_size}))


if __name__ == "__main__":
    main()
