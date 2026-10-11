import geoJson from "@/generated/geo.json";

export type Basis = "osm_named_feature" | "locality" | "water_body" | "name_match_only";

export interface GeoAnchor {
  basis: Basis;
  osm: string;
  label: string;
  waterBody: string | null;
  lon: number;
  lat: number;
}

export interface GeoData {
  attribution: { india: string; osm: string };
  precision: Record<Basis, string>;
  india: [number, number][][];
  bhopal: { lon: number; lat: number; osm: string; note: string };
  bhopalBounds: [number, number, number, number];
  lakes: { id: string; name: string; nameHi: string; osm: string; outer: [number, number][][]; holes: [number, number][][]; center: [number, number] }[];
  sites: { siteId: string; anchors: GeoAnchor[] }[];
}

export const geo = geoJson as unknown as GeoData;

const LAT0 = geo.bhopal.lat;
const LON0 = geo.bhopal.lon;
const KX = 111.32 * Math.cos((LAT0 * Math.PI) / 180);
const KZ = 110.57;

/** Local equirectangular projection in km around Bhopal: x = east, z = south. Fine for display, not for survey. */
export function project(lon: number, lat: number): [number, number] {
  return [(lon - LON0) * KX, -(lat - LAT0) * KZ];
}

export const BASIS_LABEL: Record<Basis, string> = {
  osm_named_feature: "OSM feature with the ghat's name",
  locality: "Locality named on the report",
  water_body: "Lake only — ghat point unknown",
  name_match_only: "Name match only — weak",
};
