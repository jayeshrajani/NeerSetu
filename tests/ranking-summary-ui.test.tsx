// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RankingSummary } from "@/components/RankingSummary";
import { DEFAULT_FILTERS } from "@/lib/filters";

const fallback = {
  purposeEn: "Past tests guide review. Current water quality is unknown.",
  purposeHi: "पुराने परीक्षणों की जांच करें। अभी की जल गुणवत्ता अज्ञात है।",
  actionsEn: ["Take fresh samples."],
  actionsHi: ["पानी के नए नमूने लें।"],
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Ranking summary language and request states", () => {
  it("shows the source summary immediately and switches language", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<RankingSummary siteIds={["offline"]} filters={DEFAULT_FILTERS} fallback={fallback} aiAvailable={false} />);
    expect(screen.getByText(fallback.purposeEn)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "हिन्दी" }));
    expect(screen.getByText(fallback.purposeHi)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requests summary wording once and replaces the fallback", async () => {
    const summary = { ...fallback, purposeEn: "Review the leading ghats and take fresh samples." };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ mode: "ai", summary })));
    await act(async () => { render(<RankingSummary siteIds={["success"]} filters={DEFAULT_FILTERS} fallback={fallback} aiAvailable />); });
    expect(screen.getByText(summary.purposeEn)).toBeTruthy();
    expect(screen.getByText(/AI wording/)).toBeTruthy();
    expect(JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string).presentation).toBe("summary");
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("keeps readable source wording when the request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    await act(async () => { render(<RankingSummary siteIds={["failure"]} filters={DEFAULT_FILTERS} fallback={fallback} aiAvailable />); });
    expect(screen.getByText(fallback.purposeEn)).toBeTruthy();
    expect(screen.getByText(/AI unavailable/)).toBeTruthy();
  });
});