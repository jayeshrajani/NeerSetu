"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the textarea fallback
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

export function CopyButton({ text, label, className = "" }: { text: string; label: string; className?: string }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyText(text);
        setState(ok ? "ok" : "fail");
        setTimeout(() => setState("idle"), 2200);
      }}
      className={`inline-flex items-center gap-1.5 rounded-md border keyline px-2.5 py-1.5 text-xs text-fog-300 transition hover:border-tide-400/40 hover:text-tide-200 ${className}`}
    >
      {state === "ok" ? <Check className="size-3.5 text-tide-300" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      <span aria-live="polite">{state === "ok" ? "Copied" : state === "fail" ? "Copy failed — select text manually" : label}</span>
    </button>
  );
}
