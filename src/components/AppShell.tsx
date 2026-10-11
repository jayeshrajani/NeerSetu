import Link from "next/link";
import { manifest } from "@/lib/data";
import { NavLink } from "@/components/NavLink";
import { ChatAssistant } from "@/components/ChatAssistant";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-fog-100 focus:px-3 focus:py-2 focus:text-ink-950">
        Skip to content
      </a>
      <header data-noprint className="sticky top-0 z-40 h-[52px] border-b keyline bg-ink-950">
        <div className="mx-auto flex h-full max-w-[1600px] items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="flex items-baseline gap-2" aria-label="NeerSetu home">
            <span className="text-[15px] font-semibold tracking-tight">NeerSetu</span>
            <span className="hidden text-xs text-fog-500 md:inline">/ Bhopal visarjan water records</span>
          </Link>
          <span className="eyebrow hidden lg:inline">
            MPPCB {manifest.dataYearMin}–{manifest.dataYearMax} · historical, not live
          </span>
          <nav aria-label="Primary" className="ml-auto flex items-center gap-0.5 text-[13px]">
            <NavLink href="/">Plan</NavLink>
            <NavLink href="/ranking">Ranking</NavLink>
            <NavLink href="/methodology">Method</NavLink>
            <NavLink href="/brief">Brief</NavLink>
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer data-noprint className="border-t keyline">
        <div className="mx-auto flex max-w-[1600px] flex-wrap gap-x-6 gap-y-1 px-4 py-4 text-[11px] text-fog-500 sm:px-6">
          <span>Planning aid only — not a live monitor, safety certificate, 2026 site authorisation, or proof that immersion caused any reading.</span>
          <span>
            Data: MPPCB reports via the{" "}
            <a className="underline hover:text-fog-100" href={`${manifest.sourceRepo}/tree/${manifest.sourceCommit}/${manifest.sourcePath}`}>
              organiser pack
            </a>{" "}
            · criteria:{" "}
            <a className="underline hover:text-fog-100" href={manifest.criteriaSource}>
              CPCB
            </a>{" "}
            · map: © OpenStreetMap contributors, Natural Earth
          </span>
          <span className="num ml-auto">methodology v{manifest.methodologyVersion} · MIT</span>
        </div>
      </footer>
      <ChatAssistant />
    </div>
  );
}
