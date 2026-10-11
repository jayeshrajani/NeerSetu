import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { campaignFor, resolveToday } from "@/lib/calendar";
import { buildOutlook } from "@/lib/outlook";
import { getObservation, observations, sites } from "@/lib/data";
import { geo } from "@/lib/geo";

describe("Today-aware plan", () => {
  it("resolves today in IST and validates ?asOf", () => {
    expect(resolveToday(undefined, new Date("2026-10-10T20:00:00Z")).today).toBe("2026-10-11");
    expect(resolveToday("2026-10-15")).toMatchObject({ today: "2026-10-15", overridden: true });
    expect(resolveToday("2026-02-31").error).toBeDefined();
    expect(resolveToday("<script>").overridden).toBe(false);
  });

  it("campaign stages around Durga visarjan 20 Oct 2026", () => {
    expect(campaignFor("2026-10-11")).toMatchObject({ daysToVisarjan: 9, stage: "preparation", afterDate: "2026-10-27" });
    expect(campaignFor("2026-10-15").stage).toBe("pre_window");
    expect(campaignFor("2026-10-20").stage).toBe("visarjan_day");
    expect(campaignFor("2026-10-24").stage).toBe("post_window");
    expect(campaignFor("2026-10-28")).toMatchObject({ stage: "none", festival: null });
  });

  it("ranks on the upcoming festival's history only and cites real rows", () => {
    const o = buildOutlook("2026-10-11");
    expect(o.festival).toBe("Durga");
    for (const s of o.sites) {
      for (const w of s.summary.windows) expect(w.festival).toBe("Durga");
      for (const f of s.findings) for (const id of f.ids) expect(getObservation(id)?.festival).toBe("Durga");
    }
    const durgaDo = observations.filter((x) => x.festival === "Durga" && x.parameter === "Dissolved oxygen" && x.measurementStatus === "numeric");
    expect(o.headline[0]!.text).toContain(`of ${durgaDo.length} Durga DO readings`);
    const bai = o.sites.find((s) => s.summary.id === "bairagarh-sant-hirdaram-kund")!;
    expect(bai.windows.find((w) => w.year === 2025)).toMatchObject({ present: false });
  });

  it("highest-risk ghats: all assumed in use, severe Durga history, comparative reasons cite Durga rows", () => {
    const o = buildOutlook("2026-10-11");
    expect(o.steps.some((s) => s.key === "confirm")).toBe(false);
    expect(o.risks.map((r) => r.siteId)).toEqual(["bairagarh-sant-hirdaram-kund", "shahpura-lake-ghat", "rani-kamlapati-kamla-park"]);
    for (const r of [...o.risks, ...(o.watch ? [o.watch] : [])])
      for (const f of r.reasons) for (const id of f.ids) expect(getObservation(id)?.festival).toBe("Durga");
    const text = (id: string) => o.risks.find((r) => r.siteId === id)!.reasons.map((f) => f.text).join(" ");
    expect(text("bairagarh-sant-hirdaram-kund")).toMatch(/only ghat to reach zero/);
    expect(text("shahpura-lake-ghat")).toMatch(/Highest BOD of all seven ghats.*11\.6/);
    expect(text("rani-kamlapati-kamla-park")).toMatch(/stayed below 5 mg\/l in every phase sampled \(2\.5, 2\.4, 2\.6/);
    expect(o.watch?.siteId).toBe("malikhedi-kund");
  });

  it("dated steps change status with the date", () => {
    const before = buildOutlook("2026-10-11");
    expect(before.steps.find((s) => s.key === "pre")).toMatchObject({ status: "now", to: "2026-10-19" });
    expect(before.steps.find((s) => s.key === "after")).toMatchObject({ status: "upcoming", from: "2026-10-27" });
    expect(before.steps.find((s) => s.key === "request")!.siteIds.sort()).toEqual(["bairagarh-sant-hirdaram-kund", "malikhedi-kund"]);
    const after = buildOutlook("2026-10-22");
    expect(after.steps.find((s) => s.key === "pre")!.status).toBe("past");
    expect(after.steps.find((s) => s.key === "after")!.status).toBe("upcoming");
    expect(buildOutlook("2026-11-15").steps).toHaveLength(0);
  });
});

describe("Map anchors are sourced, never invented", () => {
  const src = ["osm_site_anchors.json", "osm_waterbodies_overpass.json"].map((f) => readFileSync(join(process.cwd(), "source-data", "geo", f), "utf-8")).join("\n");
  it("every site has an anchor tied to an OSM id present in the saved source files", () => {
    expect(geo.sites.map((s) => s.siteId).sort()).toEqual(sites.map((s) => s.id).sort());
    for (const s of geo.sites)
      for (const a of s.anchors) {
        const [type, id] = a.osm.split("/");
        expect(src).toMatch(new RegExp(`"type":\\s*"${type}",\\s*"id":\\s*${id}\\b`));
        expect(["osm_named_feature", "locality", "water_body", "name_match_only"]).toContain(a.basis);
      }
  });
  it("the ambiguous site keeps two candidate places", () => {
    expect(geo.sites.find((s) => s.siteId === "rani-kamlapati-kamla-park")!.anchors).toHaveLength(2);
  });
});
