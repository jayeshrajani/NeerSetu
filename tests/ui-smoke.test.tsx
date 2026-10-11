// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BriefComposer } from "@/components/BriefComposer";
import { buildBriefFacts } from "@/lib/brief-facts";
import { renderBrief } from "@/lib/brief-templates";
import { DEFAULT_FILTERS } from "@/lib/filters";

afterEach(cleanup);

const facts = (() => {
  const r = buildBriefFacts(["bairagarh-sant-hirdaram-kund"], DEFAULT_FILTERS);
  if (!r.ok) throw new Error(r.error);
  return r.facts;
})();

function setup(aiAvailable = false) {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  const print = vi.fn();
  window.print = print;
  render(
    <BriefComposer siteIds={["bairagarh-sant-hirdaram-kund"]} filters={DEFAULT_FILTERS} templateEn={renderBrief(facts, "en")} templateHi={renderBrief(facts, "hi")} aiAvailable={aiAvailable} />,
  );
  return { writeText, print };
}

describe("U05 — brief copy / print / review controls (jsdom)", () => {
  it("renders both languages immediately with the template badge and no AI button when unconfigured", () => {
    setup(false);
    expect(screen.getByText("Evidence-based template")).toBeTruthy();
    expect(screen.getByText(/GhatWatch officer brief/)).toBeTruthy();
    expect(screen.getByText(/GhatWatch अधिकारी संक्षेप/)).toBeTruthy();
    expect(screen.queryByText(/Refine wording with AI/)).toBeNull();
  });

  it("Copy English / Hindi / Both copy the right text; review checkbox starts unchecked", async () => {
    const { writeText, print } = setup(false);
    const box = screen.getByRole("checkbox") as HTMLInputElement;
    expect(box.checked).toBe(false);
    await act(async () => fireEvent.click(screen.getByText("Copy English")));
    expect(writeText.mock.calls[0]![0]).toMatch(/^GhatWatch officer brief/);
    expect(writeText.mock.calls[0]![0]).toContain("Reviewed by officer: [ ]");
    await act(async () => fireEvent.click(screen.getByText("Copy Hindi")));
    expect(writeText.mock.calls[1]![0]).toMatch(/अधिकारी द्वारा समीक्षा: \[ \]/);
    fireEvent.click(box);
    await act(async () => fireEvent.click(screen.getByText("Copy both")));
    const both = writeText.mock.calls[2]![0] as string;
    expect(both).toContain("Reviewed by officer: [x]");
    expect(both).toContain("अधिकारी द्वारा समीक्षा: [x]");
    fireEvent.click(screen.getByText("Print / Save PDF"));
    expect(print).toHaveBeenCalledOnce();
  });

  it("AI refine failure keeps the template and shows a fallback notice", async () => {
    setup(true);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    await act(async () => fireEvent.click(screen.getByText("Refine wording with AI")));
    expect(screen.getByText(/AI wording is unavailable/)).toBeTruthy();
    expect(screen.getByText("Evidence-based template")).toBeTruthy();
    fetchSpy.mockRestore();
  });
});
