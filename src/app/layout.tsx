import type { Metadata, Viewport } from "next";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-sans-devanagari/400.css";
import "@fontsource/ibm-plex-sans-devanagari/600.css";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: { default: "NeerSetu", template: "%s · NeerSetu" },
  description:
    "Evidence-backed pre-visarjan prioritisation of seven Bhopal ghats from MPPCB 2023–2025 monitoring, with CPCB Class B screening, source-page traceability and a bilingual officer brief.",
};

export const viewport: Viewport = { themeColor: "#0b0c0d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
