import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: __dirname },
  // The report route streams the organiser PDFs from source-data at runtime.
  outputFileTracingIncludes: {
    "/reports/[year]": ["./source-data/organiser-track-2/resources/*visarjan_report*.pdf", "./source-data/organiser-track-2/resources/Idol_immer._Report_23_CPCB.pdf"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
