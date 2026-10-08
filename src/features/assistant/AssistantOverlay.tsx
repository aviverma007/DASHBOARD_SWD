import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Mic, MicOff, X } from "lucide-react";
import MorphOrb, { type MorphOrbHandle, type MorphPhase } from "../../components/ui/ai-thinking-orb-and-input";
import { VoicePoweredOrb } from "../../components/ui/voice-powered-orb";
import { useAuthStore } from "../../store/authStore";
import { ask } from "./engine";
import { EXAMPLES } from "./domains/meta";
import type { Answer, Block, Section } from "./types";

/* ───────────── speech recognition (Chrome / Edge, needs HTTPS or localhost) ───────────── */
interface SRResult { isFinal: boolean; 0: { transcript: string } }
interface SRInstance {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<SRResult> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type SRCtor = new () => SRInstance;
const getSR = (): SRCtor | null => {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/* ───────────── block renderers ───────────── */
const NUMLIKE = /^[-+▲▼₹]?\s*[\d.,]+|%$|\bCr$|\bL$/;

function BlockView({ b }: { b: Block }) {
  if (b.t === "text") return <p className="sa-text">{b.text}</p>;
  if (b.t === "kv") {
    return (
      <dl className="sa-kv">
        {b.rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
      </dl>
    );
  }
  if (b.t === "bars") {
    const max = Math.max(...b.rows.map(r => r.value), 1);
    return (
      <div className="sa-bars">
        {b.title && <div className="sa-cap">{b.title}</div>}
        {b.rows.map(r => (
          <div key={r.label} className="sa-bar">
            <span className="sa-bar-l" title={r.label}>{r.label}</span>
            <span className="sa-bar-t"><i style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} /></span>
            <span className="sa-bar-v">{r.text}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="sa-tablewrap">
      <table className="sa-table">
        <thead><tr>{b.head.map((h, i) => <th key={i} className={i === 0 ? "" : "r"}>{h}</th>)}</tr></thead>
        <tbody>
          {b.rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className={j > 0 && NUMLIKE.test(c) ? "r" : ""}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
      {b.note && <div className="sa-note">{b.note}</div>}
    </div>
  );
}

function SectionView({ s, onOpen }: { s: Section; onOpen: (p: string) => void }) {
  return (
    <section className="sa-section">
      <div className="sa-sec-title">{s.title}</div>
      <p className="sa-headline">{s.headline}</p>
      {s.blocks.map((b, i) => <BlockView key={i} b={b} />)}
      <div className="sa-foot">
        {s.asOn && <span>Data as on {s.asOn}</span>}
        {s.open && <button type="button" onClick={() => onOpen(s.open!.path)}>{s.open.label} <ArrowUpRight size={13} /></button>}
      </div>
    </section>
  );
}

/* ───────────── overlay ───────────── */
export default function AssistantOverlay({ onClose }: { onClose: () => void }) {
  const access = useAuthStore(s => s.access);
  const navigate = useNavigate();
  const orb = useRef<MorphOrbHandle>(null);
  const [phase, setPhase] = useState<MorphPhase>("idle");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState("");
  const rec = useRef<SRInstance | null>(null);
  const finalText = useRef("");

  const SR = typeof window !== "undefined" ? getSR() : null;
  const secure = typeof window !== "undefined" && window.isSecureContext;
  const voiceOk = !!SR && secure;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && phase === "idle" && !listening) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, listening, onClose]);
  useEffect(() => () => { try { rec.current?.abort(); } catch { /* ignore */ } }, []);

  const onSubmit = useCallback(async (text: string) => {
    setAnswer(null);
    const a = await ask(text, access);
    setAnswer(a);
    return a.headline;
  }, [access]);

  const go = (path: string) => { onClose(); navigate(path); };

  const stopVoice = useCallback(() => { try { rec.current?.stop(); } catch { /* ignore */ } }, []);
  const startVoice = useCallback(() => {
    if (!SR || !secure) return;
    setVoiceMsg("");
    finalText.current = "";
    const r = new SR();
    r.lang = "en-IN"; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    r.onresult = e => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      finalText.current = txt.trim();
      orb.current?.setText(finalText.current);
    };
    r.onerror = e => {
      setVoiceMsg(e.error === "not-allowed" ? "Microphone permission was blocked — allow it in the browser's site settings." : e.error === "no-speech" ? "I didn't hear anything — try again." : `Voice input stopped (${e.error}).`);
    };
    r.onend = () => {
      setListening(false);
      const t = finalText.current;
      if (t) orb.current?.ask(t);
    };
    rec.current = r;
    try { r.start(); setListening(true); } catch { setListening(false); }
  }, [SR, secure]);

  const mic = (
    <button type="button" className="mo-mic" data-on={listening ? "" : undefined} disabled={!voiceOk}
      onClick={() => (listening ? stopVoice() : startVoice())}
      aria-label={listening ? "Stop listening" : "Ask by voice"}
      title={voiceOk ? (listening ? "Tap to stop" : "Ask by voice") : !secure ? "Voice input needs HTTPS (or localhost)" : "Voice input isn't supported in this browser"}>
      {listening ? <MicOff /> : <Mic />}
    </button>
  );

  const showWelcome = phase === "idle" && !listening;
  const showDetail = phase === "answered" && !!answer;

  return (
    <div className="sa-overlay" role="dialog" aria-modal="true" aria-label="SmartDB Assistant">
      <div className="sa-top">
        <div className="sa-brand"><span className="sa-spark" />SmartDB Assistant</div>
        <button type="button" className="sa-close" onClick={onClose} aria-label="Close assistant"><X size={20} /></button>
      </div>

      <MorphOrb ref={orb} onSubmit={onSubmit} onPhase={setPhase} minThinkMs={2300} micSlot={mic}
        placeholder="Ask about sales, inventory, budgets, PR to PO…" />

      {showWelcome && (
        <div className="sa-welcome">
          <h2>What would you like to know?</h2>
          <p>Ask in plain words — I read the same data as the tabs. Mention a project and a period if you want.</p>
          <div className="sa-chips">
            {EXAMPLES.map(([area, q]) => (
              <button key={q} type="button" onClick={() => orb.current?.ask(q)}><b>{area}</b>{q}</button>
            ))}
          </div>
          {!voiceOk && <p className="sa-hint">{!secure ? "Voice input is off: browsers only allow the microphone on HTTPS pages or localhost." : "Voice input works in Chrome or Edge."}</p>}
          {voiceMsg && <p className="sa-hint warn">{voiceMsg}</p>}
        </div>
      )}

      {listening && (
        <div className="sa-listen">
          <div className="sa-voice"><VoicePoweredOrb enableVoiceControl hue={150} className="rounded-full overflow-hidden" /></div>
          <p>Listening… speak your question</p>
          <span>Tap the red mic to stop</span>
        </div>
      )}

      {showDetail && answer && (
        <div className="sa-panel">
          {answer.followUps.length > 0 && (
            <div className="sa-follow">
              <span>Ask next</span>
              {answer.followUps.map(f => <button key={f} type="button" onClick={() => orb.current?.ask(f)}>{f}</button>)}
            </div>
          )}
          {answer.notes.map(n => <p key={n} className="sa-warn">{n}</p>)}
          {answer.sections.map((s, i) => <SectionView key={i} s={s} onOpen={go} />)}
        </div>
      )}
    </div>
  );
}
