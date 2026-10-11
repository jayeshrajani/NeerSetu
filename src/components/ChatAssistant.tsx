"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp, ArrowUpRight, BookOpen, Check, Copy, MessageCircle, Minus, RotateCcw, Sparkles, Square, Waves, X } from "lucide-react";
import { chatAnswerSchema, conversationText, PAST_READINGS_QUESTION, type ChatAnswer, type ChatBlock, type ChatRequest, type ChatResponse, type ChatSource } from "@/lib/chat";

type Message = { id: string; role: "user"; text: string } | { id: string; role: "assistant"; mode: ChatResponse["mode"]; answer: ChatAnswer; sources: ChatSource[] };
const suggestions = [
  PAST_READINGS_QUESTION,
  "Visarjan ke baad phool aur plastic kaise alag collect karein?",
  "If foam appears near a drain, what should I record and report?",
];

function SourceLinks({ block, sources }: { block: ChatBlock; sources: ChatSource[] }) {
  const used = sources.filter((source) => [...block.evidenceIds, ...block.guideIds].includes(source.id));
  if (!used.length) return null;
  return (
    <details className="chat-sources">
      <summary><BookOpen size={12} aria-hidden />{used.some((source) => source.kind === "observation") ? "Evidence & guidance" : "Planning guidance"}</summary>
      <div className="chat-source-list">
        {used.map((source) => (
          <div key={source.id}>
            <a href={source.href} target="_blank" rel="noopener noreferrer">{source.label}<ArrowUpRight size={12} aria-hidden /></a>
            <p>{source.detail}</p>
            {source.csvHref && <a href={source.csvHref} target="_blank" rel="noopener noreferrer">CSV source, line {source.csvLine}<ArrowUpRight size={12} aria-hidden /></a>}
          </div>
        ))}
      </div>
    </details>
  );
}

export function ChatAssistant() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<ChatRequest | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const latestReplyRef = useRef<HTMLElement>(null);
  const lastScrolledMessageRef = useRef<string | null>(null);
  const scrollPositionRef = useRef(0);
  const followLatestRef = useRef(true);
  const controllerRef = useRef<AbortController | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus({ preventScroll: true });
  }, [open]);

  useLayoutEffect(() => {
    const log = logRef.current;
    if (!open || !log) return;
    const latest = messages.at(-1);
    if (!latest) {
      log.scrollTop = 0;
      followLatestRef.current = true;
    } else if (latest.id === lastScrolledMessageRef.current || !followLatestRef.current && latest.role === "assistant") {
      log.scrollTop = scrollPositionRef.current;
    } else if (latest.role === "user") {
      followLatestRef.current = true;
      log.scrollTop = log.scrollHeight;
    } else if (latestReplyRef.current) {
      const padding = Number.parseFloat(getComputedStyle(log).paddingTop) || 0;
      log.scrollTop += latestReplyRef.current.getBoundingClientRect().top - log.getBoundingClientRect().top - padding;
    }
    lastScrolledMessageRef.current = latest?.id ?? null;
    scrollPositionRef.current = log.scrollTop;
  }, [messages, open]);

  useEffect(() => () => {
    controllerRef.current?.abort();
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
  }, []);

  function close() {
    setOpen(false);
    launcherRef.current?.focus();
  }

  async function ask(request: ChatRequest) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setPendingRequest(request);
    setBusy(true);
    setError(null);
    const timer = setTimeout(() => controller.abort(), 65_000);
    try {
      const response = await fetch("/api/chat", { method: "POST", signal: controller.signal, headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      const body = await response.json() as ChatResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || "The reply could not be loaded. Please retry.");
      const answer = chatAnswerSchema.parse(body.answer);
      if (!Array.isArray(body.sources)) throw new Error("The reply could not be loaded. Please retry.");
      if (controllerRef.current !== controller) return;
      setMessages((previous) => [...previous, { id: crypto.randomUUID(), role: "assistant", mode: body.mode, answer, sources: body.sources }]);
      setPendingRequest(null);
    } catch (failure) {
      if (controllerRef.current !== controller) return;
      setError(controller.signal.aborted ? "Reply stopped. You can retry your question." : failure instanceof Error ? failure.message : "Connection lost. Please retry.");
    } finally {
      clearTimeout(timer);
      if (controllerRef.current === controller) {
        setBusy(false);
        controllerRef.current = null;
        inputRef.current?.focus({ preventScroll: true });
      }
    }
  }

  function send(text = input) {
    const question = text.trim();
    if (!question || question.length > 2000 || busy) return;
    const next: Message[] = [...messages, { id: crypto.randomUUID(), role: "user", text: question }];
    setMessages(next);
    setInput("");
    const history: ChatRequest["messages"] = next.slice(-15).map((message) => ({ role: message.role, content: message.role === "user" ? message.text : conversationText(message.answer).slice(0, 4000) }));
    while (new TextEncoder().encode(JSON.stringify({ messages: history })).byteLength > 28_000) history.shift();
    const siteId = pathname.startsWith("/ghats/") ? pathname.split("/")[2] : undefined;
    void ask({ messages: history, ...(siteId ? { siteId } : {}) });
  }

  function reset() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setPendingRequest(null);
    setMessages([]);
    setInput("");
    setError(null);
    setBusy(false);
    inputRef.current?.focus();
  }

  async function copy(message: Extract<Message, { role: "assistant" }>) {
    try {
      await navigator.clipboard.writeText(conversationText(message.answer));
      setCopied(message.id);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Copy is unavailable in this browser.");
    }
  }

  return (
    <div data-noprint className="neer-chat">
      {open && (
        <section role="dialog" aria-label="NeerSetu Assistant" aria-modal="false" className="chat-panel" onKeyDown={(event) => { if (event.key === "Escape") close(); }}>
          <header className="chat-header">
            <div className="chat-mark"><Waves size={23} aria-hidden /></div>
            <div className="chat-heading"><h2>NeerSetu</h2><span>Assistant</span></div>
            <button type="button" className="chat-icon" onClick={reset} title="New conversation" aria-label="New conversation"><RotateCcw size={16} /></button>
            <button type="button" className="chat-icon" onClick={close} title="Minimize chat" aria-label="Minimize chat"><Minus size={18} /></button>
          </header>

          <div ref={logRef} className="chat-log" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions" onScroll={(event) => {
            const log = event.currentTarget;
            scrollPositionRef.current = log.scrollTop;
            followLatestRef.current = log.scrollHeight - log.clientHeight - log.scrollTop <= 48;
          }}>
            {!messages.length && (
              <div className="chat-welcome">
                <Sparkles size={25} className="chat-welcome-icon" aria-hidden />
                <h3>What needs attention?</h3>
                <p>Namaste. What is happening at your ghat?</p>
                <div className="chat-suggestions">
                  {suggestions.map((question) => <button key={question} type="button" onClick={() => send(question)}>{question}<ArrowUpRight size={15} aria-hidden /></button>)}
                </div>
              </div>
            )}
            {messages.map((message, index) => message.role === "user" ? (
              <div className="chat-user" key={message.id}><span className="sr-only">You: </span>{message.text}</div>
            ) : (
              <article ref={index === messages.length - 1 ? latestReplyRef : undefined} className="chat-reply" key={message.id} lang={message.answer.language === "en" ? "en" : "hi-Latn"}>
                <div className="chat-reply-byline"><Waves size={14} aria-hidden /><span>NeerSetu</span>{message.mode === "evidence" && <span className="text-fog-300">Source answer</span>}<button className="chat-icon" type="button" title="Copy reply" aria-label="Copy reply" onClick={() => void copy(message)}>{copied === message.id ? <Check size={14} /> : <Copy size={14} />}</button></div>
                {message.answer.answer.map((block, index) => <div key={index} className="chat-block"><p>{block.text}</p><SourceLinks block={block} sources={message.sources} /></div>)}
                <div className="chat-next"><h4>{message.answer.language === "en" ? "What to do next" : "Ab kya karein"}</h4><ol>{message.answer.nextSteps.map((block, index) => <li key={index}><p>{block.text}</p><SourceLinks block={block} sources={message.sources} /></li>)}</ol></div>
                {message.answer.followUp && <p className="chat-followup">{message.answer.followUp}</p>}
              </article>
            ))}
            {busy && <div className="chat-thinking" role="status"><span /><span /><span /><p>Looking into your question...</p></div>}
            {error && <div className="chat-error" role="alert"><p>{error}</p>{pendingRequest && <button type="button" onClick={() => void ask(pendingRequest)} disabled={busy}><RotateCcw size={13} aria-hidden />Retry</button>}<button type="button" className="chat-icon" onClick={() => setError(null)} aria-label="Dismiss error" title="Dismiss error"><X size={14} /></button></div>}
          </div>

          <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); send(); }}>
            <label className="sr-only" htmlFor="neer-chat-question">Your question</label>
            <textarea id="neer-chat-question" ref={inputRef} value={input} onChange={(event) => setInput(event.target.value)} rows={2} maxLength={2000} placeholder="Ask NeerSetu..." onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); }
            }} />
            {busy ? <button className="chat-send" type="button" onClick={() => controllerRef.current?.abort()} title="Stop reply" aria-label="Stop reply"><Square size={16} /></button> : <button className="chat-send" type="submit" disabled={!input.trim()} title="Send question" aria-label="Send question"><ArrowUp size={20} /></button>}
            <p className="chat-note">{input.length > 1800 ? `${input.length}/2000` : "Historical evidence. Current conditions need checking."}</p>
          </form>
        </section>
      )}
      <button ref={launcherRef} type="button" className={`chat-launcher ${open ? "is-open" : ""}`} onClick={() => open ? close() : setOpen(true)} aria-label={open ? "Close NeerSetu chat" : "Open NeerSetu chat"} aria-expanded={open} aria-haspopup="dialog" title={open ? "Close chat" : "Ask NeerSetu"}>
        {open ? <X size={24} aria-hidden /> : <MessageCircle size={25} aria-hidden />}
        {!open && <span className="chat-launcher-label">Ask NeerSetu</span>}
      </button>
    </div>
  );
}