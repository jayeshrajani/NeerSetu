import type { RenderedBrief } from "@/lib/brief-templates";

export function BriefDoc({ brief, reviewed }: { brief: RenderedBrief; reviewed: boolean }) {
  const hi = brief.lang === "hi";
  return (
    <article lang={brief.lang} className={`print-avoid ${hi ? "font-hindi" : ""}`}>
      <h2 className="font-display text-xl font-semibold leading-snug text-fog-100">{brief.title}</h2>
      <p className="mt-1 text-xs text-warn-300">{brief.meta}</p>
      {brief.sections.map((s) => (
        <section key={s.id} className="mt-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-tide-300">{s.heading}</h3>
          <ul className={`mt-1.5 grid gap-1 text-[13.5px] leading-relaxed text-fog-300 ${s.id === "sources" ? "text-xs text-fog-500" : ""}`}>
            {s.items.map((it, i) =>
              it.heading ? (
                <li key={i} className={`font-semibold text-fog-100 ${i > 0 ? "mt-2" : ""}`}>
                  {it.text}
                </li>
              ) : (
                <li key={i} className={s.id === "sources" ? "" : "relative pl-4 before:absolute before:left-0 before:top-[0.6em] before:size-1.5 before:rounded-full before:bg-tide-400/60"}>
                  {it.text}
                  {it.refs.length > 0 && <sup className="num ml-0.5 text-tide-300">[{it.refs.join(", ")}]</sup>}
                </li>
              ),
            )}
          </ul>
        </section>
      ))}
      <p className="mt-4 border-t keyline pt-2 text-xs text-fog-300">{reviewed ? brief.reviewLine.replace("[ ]", "[x]") : brief.reviewLine}</p>
    </article>
  );
}
