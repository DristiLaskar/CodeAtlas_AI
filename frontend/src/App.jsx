import { useState, useEffect } from 'react';
import { ChevronRight, RefreshCw, Trash2, Box } from 'lucide-react';

const ArrowRight = ChevronRight;
const Loader2 = RefreshCw;
const ChevronDown = p => <ChevronRight {...p} className={`${p.className || ''} rotate-90`} />;
const Plus = () => <span className="text-base leading-none">+</span>;
import Chat from './components/ChatInterface.jsx';

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export default function App() {
  const [repos, setRepos] = useState([]);
  const [repo, setRepo] = useState(null);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  const loadRepos = async () => {
    try {
      const r = await fetch(`${API}/repos`);
      if (r.ok) setRepos(((await r.json()).repos || []).map(x => (typeof x === 'string' ? x : x.name)));
    } catch (e) { console.error(e); }
  };
  useEffect(() => { loadRepos(); }, []);

  const index = async (url, token) => {
    setBusy(true); setStatus(null);
    try {
      const r = await fetch(`${API}/index`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_url: url, github_token: token || undefined }),
      });
      const d = await r.json();
      if (r.ok) { await loadRepos(); setRepo(d.repo); setBusy(false); return true; }
      setStatus(d.detail || 'Indexing failed');
    } catch (e) { setStatus(e.message); }
    setBusy(false); return false;
  };

  const remove = async name => {
    try { await fetch(`${API}/repos/${name}`, { method: 'DELETE' }); } catch (e) { console.error(e); }
    if (repo === name) setRepo(null);
    loadRepos();
  };

  return (
    <div className="h-full flex flex-col">
      <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-[var(--line)] backdrop-blur relative z-20">
        <button onClick={() => setRepo(null)} className="flex items-center gap-2.5">
          <span className="w-5 h-5 rounded-md bg-[var(--acc)] block" />
          <span className="mono text-sm font-medium tracking-tight">codeAtlas</span>
        </button>

        {repo && (
          <div className="relative">
            <button onClick={() => setMenu(!menu)} className="btn">
              <Box size={14} className="text-[var(--acc)]" /> {repo}
              <ChevronDown size={14} className="text-[var(--mute)]" />
            </button>
            {menu && (
              <>
                <div className="fixed inset-0" onClick={() => setMenu(false)} />
                <div className="panel absolute right-0 mt-2 w-64 p-1.5 shadow-2xl fade">
                  {repos.map(r => (
                    <div key={r} className="group flex items-center rounded-lg hover:bg-[#1a1a1d]">
                      <button onClick={() => { setRepo(r); setMenu(false); }}
                        className={`flex-1 text-left px-3 py-2 text-sm truncate ${r === repo ? 'text-[var(--acc)]' : ''}`}>{r}</button>
                      <button onClick={() => remove(r)} className="p-2 text-[var(--mute)] hover:text-red-400 opacity-0 group-hover:opacity-100">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => { setRepo(null); setMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--mute)] hover:text-white border-t border-[var(--line)] mt-1">
                    <Plus size={14} /> Index new repo
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 min-h-0">
        {repo ? <Chat key={repo} repo={repo} /> :
          <Home repos={repos} onOpen={setRepo} onDelete={remove} onIndex={index} busy={busy} status={status} />}
      </main>
    </div>
  );
}

function Home({ repos, onOpen, onDelete, onIndex, busy, status }) {
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [showTok, setShowTok] = useState(false);

  const submit = async e => {
    e.preventDefault();
    if (url.trim() && (await onIndex(url.trim(), token.trim()))) setUrl('');
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-5 pt-[12vh] pb-16 fade">
        <div className="inline-flex items-center gap-2 mono text-[11px] text-[var(--mute)] border border-[var(--line)] rounded-full px-3 py-1 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--acc)]" /> 100% local · runs on Ollama
        </div>
        <h1 className="text-5xl font-semibold tracking-tight leading-[1.05]">
          Ask your codebase<br /><span className="text-[var(--acc)]">anything.</span>
        </h1>
        <p className="text-[var(--mute)] mt-4 text-base max-w-md">
          Paste a GitHub repo. Get answers with exact file and line citations — nothing leaves your machine.
        </p>

        <form onSubmit={submit} className="mt-9">
          <div className="panel flex items-center p-1.5 focus-within:border-[var(--acc)] transition">
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://github.com/owner/repo"
              className="flex-1 bg-transparent outline-none px-4 py-3 text-sm mono placeholder:text-[#55555c]" />
            <button disabled={busy || !url.trim()} className="btn btn-acc !py-2.5">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <>Index <ArrowRight size={15} /></>}
            </button>
          </div>
          <button type="button" onClick={() => setShowTok(!showTok)} className="mt-3 text-xs text-[var(--mute)] hover:text-white">
            {showTok ? '− Hide' : '+ Private repo?'} access token
          </button>
          {showTok && (
            <input value={token} onChange={e => setToken(e.target.value)} type="password" placeholder="GitHub token (optional)"
              className="panel w-full mt-2 bg-transparent outline-none px-4 py-3 text-sm mono" />
          )}
        </form>

        {busy && <p className="mt-4 text-sm text-[var(--mute)]">Indexing… on a CPU this can take a few minutes.</p>}
        {status && <p className="mt-4 text-sm text-red-400 panel px-4 py-3 !border-red-500/30">{status}</p>}

        {repos.length > 0 && (
          <div className="mt-14">
            <div className="mono text-[11px] uppercase tracking-widest text-[var(--mute)] mb-3">Indexed repositories</div>
            <div className="panel divide-y divide-[var(--line)] overflow-hidden">
              {repos.map(r => (
                <div key={r} className="group flex items-center hover:bg-[#17171a] transition">
                  <button onClick={() => onOpen(r)} className="flex-1 flex items-center gap-3 px-4 py-3.5 text-left">
                    <Box size={15} className="text-[var(--acc)]" />
                    <span className="text-sm">{r}</span>
                    <ArrowRight size={14} className="ml-auto text-[var(--mute)] group-hover:text-[var(--acc)] group-hover:translate-x-0.5 transition" />
                  </button>
                  <button onClick={() => onDelete(r)} className="px-4 text-[var(--mute)] hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}