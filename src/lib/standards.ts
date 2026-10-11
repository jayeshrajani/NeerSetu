import type { BenchmarkStatus, Criterion, MeasurementStatus, ParsedRule, StandardsFile } from "@/types/ghatwatch";

/** Minimal RFC-4180 CSV reader (quotes, embedded commas, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

const CRITERIA_HEADER = ["class", "designated_best_use", "parameter", "limit_type", "limit", "unit"];

export function criterionId(cls: string, parameter: string): string {
  return `CPCB-${cls}-${parameter.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export function parseCriteriaCsv(text: string): Criterion[] {
  const [header, ...body] = parseCsv(text);
  if (!header || header.join(",") !== CRITERIA_HEADER.join(",")) {
    throw new Error(`Unexpected criteria header: ${header?.join(",")}`);
  }
  return body.map((r, i) => {
    const [cls = "", use = "", parameter = "", limitType = "", limit = "", unit = ""] = r;
    if (limitType !== "min" && limitType !== "max" && limitType !== "range") {
      throw new Error(`Unknown limit_type '${limitType}' on criteria line ${i + 2}`);
    }
    return {
      id: criterionId(cls, parameter),
      csvLine: i + 2,
      class: cls,
      designatedBestUse: use,
      parameter,
      limitType,
      limit,
      unit: unit || null,
    };
  });
}

export function parseRule(c: Criterion): ParsedRule {
  const num = (s: string) => {
    const v = Number(s.trim());
    if (s.trim() === "" || !Number.isFinite(v)) throw new Error(`Bad limit '${s}' in ${c.id}`);
    return v;
  };
  if (c.limitType === "range") {
    const m = c.limit.match(/^\s*([0-9.]+)\s*-\s*([0-9.]+)\s*$/);
    if (!m || !m[1] || !m[2]) throw new Error(`Bad range '${c.limit}' in ${c.id}`);
    return { criterionId: c.id, parameter: c.parameter, limitType: "range", min: num(m[1]), max: num(m[2]), unit: c.unit };
  }
  const v = num(c.limit);
  return {
    criterionId: c.id,
    parameter: c.parameter,
    limitType: c.limitType,
    min: c.limitType === "min" ? v : null,
    max: c.limitType === "max" ? v : null,
    unit: c.unit,
  };
}

/** Inclusive comparison: a value exactly at the limit is within. */
export function isOutside(rule: ParsedRule, value: number): boolean {
  if (rule.min !== null && value < rule.min) return true;
  if (rule.max !== null && value > rule.max) return true;
  return false;
}

export class StandardsEngine {
  readonly rules: Map<string, ParsedRule>;
  readonly criteria: Criterion[];
  readonly classBMap: Record<string, string>;

  constructor(file: Pick<StandardsFile, "criteria" | "classBParameterMap">) {
    this.criteria = file.criteria;
    this.classBMap = file.classBParameterMap;
    this.rules = new Map();
    for (const [immersionParam, cid] of Object.entries(file.classBParameterMap)) {
      const c = file.criteria.find((x) => x.id === cid);
      if (!c || c.class !== "B") throw new Error(`Class B criterion ${cid} for ${immersionParam} missing`);
      this.rules.set(immersionParam, parseRule(c));
    }
  }

  /** Rule for an immersion-CSV parameter name, exact match only. */
  ruleFor(parameter: string): ParsedRule | null {
    return this.rules.get(parameter) ?? null;
  }

  evaluate(parameter: string, status: MeasurementStatus, value: number | null): BenchmarkStatus {
    const rule = this.ruleFor(parameter);
    if (!rule) return "no_class_b_benchmark";
    if (status !== "numeric" || value === null || !Number.isFinite(value)) return "indeterminate";
    return isOutside(rule, value) ? "outside_screening_benchmark" : "within_screening_benchmark";
  }

  /** Bounded 0..1 magnitude outside the screening limit. Not a probability or toxicity. */
  severity(parameter: string, value: number): number {
    const rule = this.ruleFor(parameter);
    if (!rule) throw new Error(`No Class B rule for ${parameter}`);
    const clamp = (x: number) => Math.min(Math.max(x, 0), 1);
    if (rule.limitType === "min" && rule.min !== null) return clamp((rule.min - value) / rule.min);
    if (rule.limitType === "max" && rule.max !== null) return clamp((value - rule.max) / rule.max);
    if (rule.min !== null && rule.max !== null) return clamp(Math.max(rule.min - value, value - rule.max, 0) / 2);
    return 0;
  }

  describe(parameter: string): string | null {
    const r = this.ruleFor(parameter);
    if (!r) return null;
    const u = r.unit ? ` ${r.unit}` : "";
    if (r.limitType === "min") return `≥ ${r.min}${u}`;
    if (r.limitType === "max") return `≤ ${r.max}${u}`;
    return `${r.min}–${r.max}${u}`;
  }
}

export const BENCHMARK_PARAMETERS = ["Dissolved oxygen", "BOD", "pH"] as const;
