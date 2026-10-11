// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChatAssistant } from "@/components/ChatAssistant";
import { PAST_READINGS_QUESTION } from "@/lib/chat";

vi.mock("next/navigation", () => ({ usePathname: () => "/ghats/khatlapura-ghat" }));
const cleanupQuestion = "Visarjan ke baad phool aur plastic kaise alag collect karein?";
const incidentQuestion = "If foam appears near a drain, what should I record and report?";
const reply = { mode: "ai", answer: { language: "hinglish", answer: [{ text: "Plastic aur phool alag collect karein.", evidenceIds: [], guideIds: ["cleanup"] }], nextSteps: [{ text: "Municipal crew se pickup arrange karein.", evidenceIds: [], guideIds: ["cleanup"] }], followUp: "Floating waste bhi hai?" }, sources: [{ id: "cleanup", kind: "guidance", href: "/methodology#chat-cleanup", label: "Cleanup", detail: "General guidance" }] };
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const open = () => { render(<ChatAssistant />); fireEvent.click(screen.getByRole("button", { name: "Open NeerSetu chat" })); };

describe("Floating NeerSetu chat", () => {
  it("labels the reliable first starter response as a source answer", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ...reply, mode: "evidence" })));
    open();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: PAST_READINGS_QUESTION })); });
    expect(screen.getByText("Source answer")).toBeTruthy();
  });

  it("opens with input focus and minimizes without losing the conversation", () => {
    open();
    expect(screen.queryByRole("button", { name: "Which ghat should we check first?" })).toBeNull();
    expect(screen.getByRole("button", { name: "Which past readings at Khatlapura need a fresh check?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: cleanupQuestion })).toBeTruthy();
    expect(screen.getByRole("button", { name: incidentQuestion })).toBeTruthy();
    for (const question of ["How do we remove floating waste?", "Ghat ki safai kaise karein?", "What can we do about low oxygen?"]) {
      expect(screen.queryByRole("button", { name: question })).toBeNull();
    }
    const input = screen.getByRole("textbox", { name: "Your question" });
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "Keep this draft" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open NeerSetu chat" }));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Keep this draft");
  });

  it("sends a question with site context and displays Hinglish actions and citations", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(reply)));
    open();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: cleanupQuestion })); });
    expect(screen.getByText("Plastic aur phool alag collect karein.")).toBeTruthy();
    expect(screen.getByText("Ab kya karein")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Cleanup" })[0]?.getAttribute("href")).toBe("/methodology#chat-cleanup");
    expect(JSON.parse(spy.mock.calls[0]![1]!.body as string).siteId).toBe("khatlapura-ghat");
    expect(JSON.parse(spy.mock.calls[0]![1]!.body as string).messages[0].content).toBe(cleanupQuestion);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Aur floating waste?" } });
    await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
    const second = JSON.parse(spy.mock.calls[1]![1]!.body as string);
    expect(second.messages.map((message: { role: string }) => message.role)).toEqual(["user", "assistant", "user"]);
    expect(second.messages[1].content).toContain("Plastic aur phool");
  });

  it("keeps a failed question and retries without duplicate user messages", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ error: "AI unavailable" }), { status: 502 })).mockResolvedValueOnce(new Response(JSON.stringify(reply)));
    open();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: incidentQuestion })); });
    expect(screen.getByRole("alert").textContent).toContain("AI unavailable");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Retry" })); });
    expect(screen.getAllByText(incidentQuestion)).toHaveLength(1);
    expect(screen.getByText("Plastic aur phool alag collect karein.")).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("does not send blank questions or Shift+Enter and clears history on reset", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(reply)));
    open();
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(spy).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Question" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter", shiftKey: true });
    expect(spy).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send question" })); });
    fireEvent.click(screen.getByRole("button", { name: "New conversation" }));
    expect(screen.queryByText("Question")).toBeNull();
    expect(screen.getByText("What needs attention?")).toBeTruthy();
  });

  it("aligns a long new reply at its beginning, not the bottom", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(reply)));
    open();
    const log = screen.getByRole("log");
    Object.defineProperties(log, { scrollHeight: { configurable: true, value: 1800 }, clientHeight: { configurable: true, value: 300 } });
    log.style.paddingTop = "20px";
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const top = this.classList.contains("chat-reply") ? 720 - log.scrollTop : 100;
      return { top } as DOMRect;
    });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: cleanupQuestion })); });
    expect(log.scrollTop).toBe(600);
    expect(log.scrollTop).not.toBe(log.scrollHeight);
  });

  it("preserves older-message reading position when a pending reply arrives and when reopened", async () => {
    let resolveResponse!: (response: Response) => void;
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise<Response>((resolve) => { resolveResponse = resolve; }));
    open();
    const log = screen.getByRole("log");
    Object.defineProperties(log, { scrollHeight: { configurable: true, value: 1800 }, clientHeight: { configurable: true, value: 300 } });
    fireEvent.click(screen.getByRole("button", { name: cleanupQuestion }));
    log.scrollTop = 120;
    fireEvent.scroll(log);
    await act(async () => { resolveResponse(new Response(JSON.stringify(reply))); });
    expect(log.scrollTop).toBe(120);
    fireEvent.click(screen.getByRole("button", { name: "Minimize chat" }));
    fireEvent.click(screen.getByRole("button", { name: "Open NeerSetu chat" }));
    expect(screen.getByRole("log").scrollTop).toBe(120);
  });

  it("does not move the conversation when an error arrives or is dismissed", async () => {
    let resolveResponse!: (response: Response) => void;
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise<Response>((resolve) => { resolveResponse = resolve; }));
    open();
    const log = screen.getByRole("log");
    Object.defineProperties(log, { scrollHeight: { configurable: true, value: 1800 }, clientHeight: { configurable: true, value: 300 } });
    fireEvent.click(screen.getByRole("button", { name: cleanupQuestion }));
    log.scrollTop = 200;
    fireEvent.scroll(log);
    await act(async () => { resolveResponse(new Response(JSON.stringify({ error: "AI unavailable" }), { status: 502 })); });
    expect(log.scrollTop).toBe(200);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss error" }));
    expect(log.scrollTop).toBe(200);
  });
});