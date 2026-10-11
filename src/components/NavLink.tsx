"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 transition ${active ? "text-fog-100 underline decoration-marigold-400 decoration-2 underline-offset-[18px]" : "text-fog-500 hover:text-fog-100"}`}
    >
      {children}
    </Link>
  );
}
