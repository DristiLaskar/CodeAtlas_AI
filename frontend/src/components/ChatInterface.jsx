import { useState, useEffect, useRef } from 'react';
import { Send as ArrowUp, RefreshCw, Sparkles as Zap, FileText } from 'lucide-react';
import { renderMarkdown } from '../utils/markdown.js';

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
const SUGGEST = [
  'Explain the overall architecture of this repo',
  'What is the main entry point and startup flow?',
  'List the key modules and what each one does',
  'Which design patterns are used here?',
];

// One shared request per repo — stops React StrictMode from firing the (slow) summary twice
const pending = {};
const getSummary = (repo, force) => {
  if (force || !pending[repo]) {
    pending[repo] = fetch(`${API}/repos/${repo}/summary${force ? '?refresh=true' : ''}`)
      .then(r => (r.ok ? r.json() : null)).catch(() => null)
      .then(d => { if (!d) delete pending[repo]; return d; });
  }
  return pending[repo];
};

export default function Chat({ repo }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [agent, setAgent] = useState(false);
  const [status, setStatus] = useState('');
  const [sum, setSum] = useState(null);
  const [sumLoading, setSumLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const end = useRef(null);
  const ta = useRef(null);

  const loadSummary = async (force = false) => {
    setSumLoading(true); setSum(null);
    setSum(await getSummary(repo, force));
    setSumLoading(false);
  };
  useEffect(() => { loadSummary(); }, [repo]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  const send = async text => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    const history = msgs.slice(-6).map(({ role, content }) => ({ role, content }));
    setInput(''); setBusy(true);
    if (ta.current) ta.current.style.height = 'auto';
    setMsgs(p => [...p, { role: 'user', content: q }, { role: 'assistant', content: '', sources: [] }]);

    // Immutable update of the last message (this is what fixes the doubled words)
    const patch = fn => setMsgs(p => p.map((m, i) => (i === p.length - 1 ? fn(m) : m)));
    const headers = { 'Content-Type': 'application/json' };
    const body = JSON.stringify({ repo_name: repo, question: q, k: 6, chat_history: history });

    try {
      if (agent) {
        setStatus('Agent is exploring the code…');
        const r = await fetch(`${API}/query`, { method: 'POST', headers, body });
        const d = await r.json();
        patch(m => ({ ...m, content: r.ok ? d.answer : `Error: ${d.detail || 'query failed'}`, sources: d.sources || [] }));
      } else {
        const r = await fetch(`${API}/query/stream`, { method: 'POST', headers, body });
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          patch(m => ({ ...m, content: `Error: ${e.detail || 'stream failed'}` }));
        } else {
          const rd = r.body.getReader();
          const dec = new TextDecoder();
          let buf = '';
          for (;;) {
            const { value, done } = await rd.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() || '';
            for (const l of lines) {
              const s = l.trim();
              if (!s.startsWith('data: ')) continue;
              try {
                const d = JSON.parse(s.slice(6));
                if (d.type === 'token') patch(m => ({ ...m, content: m.content + d.content }));
                else if (d.type === 'sources') patch(m => ({ ...m, sources: d.sources || [] }));
                else if (d.type === 'error') patch(m => ({ ...m, content: `Error: ${d.content}` }));
              } catch { /* ignore partial line */ }
            }
          }
        }
      }
    } catch (e) {
      patch(m => ({ ...m, content: `Request failed: ${e.message}` }));
    }
    setStatus(''); setBusy(false);
  };

  const meta = sum?.metadata || {};

  return (
    <div className="h-full relative">
      <div className="h-full overflow-y-auto">
        <div className="max-w-3xl mx-auto px-5 pt-10 pb-44">

          {msgs.length === 0 && (
            <div className="fade">
              <div className="mono text-[11px] uppercase tracking-widest text-[var(--mute)]">Repository</div>
              <h2 className="text-4xl font-semibold tracking-tight mt-1">{repo}</h2>

              <div className="panel mt-6 p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="mono text-[11px] uppercase tracking-widest text-[var(--acc)]">Overview</span>
                  <button onClick={() => loadSummary(true)} title="Regenerate" className="text-[var(--mute)] hover:text-white">
                    <RefreshCw size={14} className={sumLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
                {sumLoading ? (
                  <div className="space-y-2.5">
                    <div className="skel h-3.5 w-full" /><div className="skel h-3.5 w-11/12" /><div className="skel h-3.5 w-3/4" />
                    <p className="text-xs text-[var(--mute)] pt-2">Profiling the repo — only slow the first time, then it's cached.</p>
                  </div>
                ) : sum ? (
                  <>
                    <div className={`md ${open ? '' : 'collapsed'}`} dangerouslySetInnerHTML={{ __html: renderMarkdown(sum.summary) }} />
                    <button onClick={() => setOpen(!open)} className="text-xs text-[var(--acc)] mt-2">{open ? 'Show less' : 'Read more'}</button>
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[var(--line)] mono text-xs text-[var(--mute)]">
                      <span>{meta.total_chunks || 0} chunks</span><span>·</span>
                      <span>{meta.files_sampled || 0} files profiled</span>
                      {meta.languages?.length > 0 && <><span>·</span><span>{meta.languages.join(', ')}</span></>}
                    </div>
                  </>
                ) : <p className="text-sm text-[var(--mute)]">No overview available — you can still ask questions below.</p>}
              </div>

              <div className="flex flex-wrap gap-2 mt-6">
                {SUGGEST.map(s => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}
              </div>
            </div>
          )}

          {msgs.map((m, i) => {
            const last = i === msgs.length - 1;
            return m.role === 'user' ? (
              <div key={i} className="flex justify-end mb-8 fade">
                <div className="bg-[#1b1b1f] border border-[var(--line)] rounded-2xl rounded-br-md px-4 py-2.5 max-w-[85%] text-[15px]">{m.content}</div>
              </div>
            ) : (
              <div key={i} className="mb-10 fade">
                <div className="mono text-[11px] uppercase tracking-widest text-[var(--mute)] mb-2 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--acc)]" /> codeAtlas
                </div>
                {m.content ? <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                  : busy && last && (
                    <div className="flex items-center gap-3 text-sm text-[var(--mute)]">
                      <span className="flex gap-1"><i className="dot" /><i className="dot" /><i className="dot" /></span>
                      {status || 'Searching the code…'}
                    </div>
                  )}
                {m.sources?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {[...new Set(m.sources)].map(s => (
                      <span key={s} className="mono text-[11px] text-[var(--mute)] border border-[var(--line)] rounded-md px-2 py-1 flex items-center gap-1.5">
                        <FileText size={10} /> {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={end} />
        </div>
      </div>

      {/* Composer */}
      <div className="absolute bottom-0 inset-x-0 pt-10 pb-5 px-5 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent pointer-events-none">
        <div className="max-w-3xl mx-auto panel p-2.5 pointer-events-auto shadow-2xl focus-within:border-[#3a3a40] transition">
          <textarea ref={ta} rows={1} value={input} placeholder={`Ask about ${repo}…`}
            onChange={e => setInput(e.target.value)}
            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'; }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="w-full bg-transparent outline-none resize-none px-2.5 py-2 text-[15px] placeholder:text-[#55555c]" />
          <div className="flex items-center justify-between mt-1">
            <button onClick={() => setAgent(!agent)} title="Slower, but can open and read files itself"
              className={`chip !py-1 ${agent ? '!border-[var(--acc)] !text-[var(--acc)]' : ''}`}>
              <Zap size={12} /> Agent mode {agent ? 'on' : 'off'}
            </button>
            <button onClick={() => send()} disabled={busy || !input.trim()} className="btn btn-acc !p-2 !rounded-lg">
              <ArrowUp size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}