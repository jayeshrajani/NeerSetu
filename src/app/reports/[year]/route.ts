import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { manifest } from "@/lib/data";

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(manifest.reports).map((year) => ({ year }));
}

/** Serves only the three allow-listed MPPCB report PDFs bundled from the organiser pack. */
export async function GET(_req: Request, { params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  const report = Object.prototype.hasOwnProperty.call(manifest.reports, year) ? manifest.reports[year] : undefined;
  if (!report) return new Response("Report not found", { status: 404 });
  try {
    const buf = await readFile(join(process.cwd(), "source-data", "organiser-track-2", "resources", report.file));
    return new Response(new Uint8Array(buf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${report.file}"`,
        "cache-control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new Response(`Bundled copy unavailable. Original: ${report.url}`, { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
}
