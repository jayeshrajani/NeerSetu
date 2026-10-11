"use client";

import Link from "next/link";
import { createContext, useContext, useMemo, useState } from "react";
import { ArrowRight, Check, Plus, X } from "lucide-react";

const MAX = 3;

interface Ctx {
  selected: string[];
  toggle: (id: string) => void;
  clear: () => void;
  limitHit: boolean;
}
const SelectionCtx = createContext<Ctx | null>(null);

export function BriefSelectionProvider({ children, names, scopeQuery }: { children: React.ReactNode; names: Record<string, string>; scopeQuery: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [limitHit, setLimitHit] = useState(false);
  const value = useMemo<Ctx>(
    () => ({
      selected,
      limitHit,
      toggle: (id) =>
        setSelected((s) => {
          if (s.includes(id)) {
            setLimitHit(false);
            return s.filter((x) => x !== id);
          }
          if (s.length >= MAX) {
            setLimitHit(true);
            return s;
          }
          return [...s, id];
        }),
      clear: () => {
        setSelected([]);
        setLimitHit(false);
      },
    }),
    [selected, limitHit],
  );
  const q = new URLSearchParams(scopeQuery.replace(/^\?/, ""));
  q.set("sites", selected.join(","));
  return (
    <SelectionCtx.Provider value={value}>
      {children}
      <div
        data-noprint
        className={`fixed inset-x-0 bottom-4 z-30 mx-auto w-[min(680px,calc(100%-2rem))] transition-all duration-300 ${selected.length ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"}`}
        aria-hidden={!selected.length}
      >
        <div className="glass flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
          <span className="text-xs text-fog-500">For brief ({selected.length}/{MAX}):</span>
          <div className="flex flex-1 flex-wrap gap-1.5">
            {selected.map((id) => (
              <button key={id} type="button" onClick={() => value.toggle(id)} className="inline-flex items-center gap-1 rounded-md border border-tide-400/30 bg-tide-400/10 px-2 py-1 text-xs text-tide-200">
                {names[id]} <X className="size-3" aria-label="remove" />
              </button>
            ))}
          </div>
          {limitHit && <span className="text-xs text-warn-300" role="status">Maximum {MAX} ghats per brief.</span>}
          <Link
            href={`/brief?${q.toString()}`}
            tabIndex={selected.length ? 0 : -1}
            className="inline-flex items-center gap-1.5 rounded-lg bg-tide-400 px-3 py-2 text-sm font-medium text-ink-950 hover:bg-tide-300"
          >
            Build brief <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </SelectionCtx.Provider>
  );
}

export function SelectToggle({ id, name }: { id: string; name: string }) {
  const ctx = useContext(SelectionCtx);
  if (!ctx) return null;
  const on = ctx.selected.includes(id);
  return (
    <button
      type="button"
      onClick={() => ctx.toggle(id)}
      aria-pressed={on}
      aria-label={`${on ? "Remove" : "Add"} ${name} ${on ? "from" : "to"} brief`}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition ${on ? "border-tide-400/60 bg-tide-400/15 text-tide-200" : "keyline text-fog-300 hover:border-tide-400/40 hover:text-tide-200"}`}
    >
      {on ? <Check className="size-3.5" aria-hidden /> : <Plus className="size-3.5" aria-hidden />}
      {on ? "In brief" : "Brief"}
    </button>
  );
}
