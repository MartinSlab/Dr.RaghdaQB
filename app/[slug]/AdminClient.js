'use client';
import { useEffect, useState } from 'react';

const L = 'ABCDEFGH';

export default function AdminClient() {
  const [pw, setPw] = useState('');
  const [authed, setAuthed] = useState(false);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('upload');

  async function api(path, opts = {}, password = pw) {
    const r = await fetch(path, { ...opts, headers: { ...(opts.headers || {}), 'x-admin-password': password } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`);
    return d;
  }

  async function login(password = pw) {
    setErr('');
    try {
      await api('/api/admin/results', {}, password);
      sessionStorage.setItem('adm', password);
      setPw(password);
      setAuthed(true);
    } catch (e) {
      setErr(e.message);
    }
  }
  useEffect(() => {
    const saved = sessionStorage.getItem('adm');
    if (saved) login(saved);
    // eslint-disable-next-line
  }, []);

  if (!authed) {
    return (
      <>
        <div className="band"><div className="wrap bandin"><h1>Teacher login</h1></div></div>
        <div className="wrap pull">
        <div className="card">
          <label>Password</label>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && login()} />
          {err && <div className="err">{err}</div>}
          <div style={{ marginTop: 14 }}><button onClick={() => login()}>Log in</button></div>
        </div>
        </div>
      </>
    );
  }

  return (
    <>
    <div className="band"><div className="wrap wide bandin row between">
      <h1>Teacher dashboard</h1>
      <button className="ghost small" onClick={() => { sessionStorage.removeItem('adm'); setAuthed(false); setPw(''); }}>Log out</button>
    </div></div>
    <div className="wrap wide pull">
      <div className="tabs">
        {[['upload', '📄 Upload question bank'], ['banks', '📚 Question banks'], ['results', '📊 Student scores'], ['settings', '⚙️ Settings']].map(([k, t]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{t}</button>
        ))}
      </div>
      {tab === 'upload' && <Upload api={api} onSaved={() => setTab('banks')} />}
      {tab === 'banks' && <Banks api={api} />}
      {tab === 'results' && <Results api={api} />}
      {tab === 'settings' && <Settings api={api} />}
    </div>
    </>
  );
}

/* ------------------------------ UPLOAD ------------------------------ */
function Upload({ api, onSaved }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [progress, setProgress] = useState(null); // {done,total}
  const [questions, setQuestions] = useState(null);
  const [err, setErr] = useState('');
  const [warn, setWarn] = useState('');
  const [saving, setSaving] = useState(false);

  async function process() {
    setErr(''); setWarn(''); setQuestions(null);
    if (!file) return setErr('Choose a .docx file first');
    try {
      setProgress({ done: 0, total: 1, label: 'Reading file…' });
      const fd = new FormData();
      fd.append('file', file);
      const { chunks, images = {} } = await api('/api/admin/parse', { method: 'POST', body: fd });
      const all = [];
      let failed = 0, lastErr = '';
      for (let i = 0; i < chunks.length; i++) {
        const chunkImages = (chunks[i].imageIds || []).map((id) => ({ id, src: images[id] })).filter((x) => x.src);
        setProgress({ done: i, total: chunks.length, label: `AI is reading & solving part ${i + 1} of ${chunks.length}…` });
        let ok = false;
        for (let attempt = 0; attempt < 2 && !ok; attempt++) {
          try {
            const d = await api('/api/admin/solve', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ text: chunks[i].text, images: chunkImages }),
            });
            all.push(...(d.questions || []));
            ok = true;
          } catch (e) {
            lastErr = e.message;
            if (attempt === 1) failed++;
          }
        }
      }
      setProgress(null);
      // remove repeated questions
      const seen = new Set();
      const unique = [];
      for (const q of all) {
        const k = (q.text + '|' + q.options.join('|') + '|' + (q.image || '').slice(-60)).toLowerCase().replace(/\s+/g, ' ');
        if (seen.has(k)) continue;
        seen.add(k);
        unique.push(q);
      }
      const dups = all.length - unique.length;
      if (!unique.length) return setErr(lastErr || 'No multiple-choice questions were found in this file.');
      const msgs = [];
      if (dups) msgs.push(`${dups} repeated question(s) were removed.`);
      if (failed) msgs.push(`${failed} part(s) of the file failed (${lastErr}). Upload again to retry.`);
      setWarn(msgs.join(' '));
      if (!name) setName(file.name.replace(/\.docx$/i, ''));
      setQuestions(unique);
    } catch (e) {
      setProgress(null);
      setErr(e.message);
    }
  }

  function attachImage(i, f) {
    if (!f) return;
    if (f.size > 900_000) return setErr('Picture is too large (max 900 KB).');
    const r = new FileReader();
    r.onload = () => upd(i, { image: r.result, note: '' });
    r.readAsDataURL(f);
  }
  const upd = (i, patch) => setQuestions((qs) => qs.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const updOpt = (i, j, v) => setQuestions((qs) => qs.map((q, k) => (k === i ? { ...q, options: q.options.map((o, m) => (m === j ? v : o)) } : q)));

  async function save() {
    setErr('');
    if (!name.trim()) return setErr('Give this bank a name');
    setSaving(true);
    try {
      await api('/api/admin/banks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, questions }),
      });
      setQuestions(null); setFile(null); setName('');
      onSaved();
    } catch (e) { setErr(e.message); }
    setSaving(false);
  }

  const needCheck = questions ? questions.filter((q) => q.source === 'unknown').length : 0;

  return (
    <div>
      <div className="card">
        <h2>Upload a Word file (.docx)</h2>
        <p className="sub">The AI finds the multiple-choice questions (including ones whose options are pictures), keeps each picture with its question, and solves them when the file has no answers. Written questions (terms, calculations, short answers) are converted to multiple choice with 3 wrong choices. Review everything before publishing.</p>
        <input type="file" accept=".docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <div style={{ marginTop: 12 }}>
          <button onClick={process} disabled={!!progress}>Process file</button>
        </div>
        {progress && (
          <div style={{ marginTop: 14 }}>
            <div className="sub">{progress.label}</div>
            <div className="bar"><div style={{ width: `${Math.max(5, (progress.done / progress.total) * 100)}%` }} /></div>
          </div>
        )}
        {err && <div className="err">{err}</div>}
        {warn && <div className="err">{warn}</div>}
      </div>

      {questions && (
        <div className="card">
          <h2>Review {questions.length} questions</h2>
          <p className="sub">
            <span className="badge file">from file</span> answer taken from the document · <span className="badge ai">AI solved</span> answer worked out by the AI — please double-check these.
            {needCheck > 0 && <> <span className="badge unknown">check</span> {needCheck} question(s) need your attention.</>}
          </p>
          <label>Bank name (shown to students)</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chapter 3 – Kinematics" dir="auto" />
          <div style={{ marginTop: 16 }}>
            {questions.map((q, i) => (
              <div className="qedit" key={i}>
                <div className="row between">
                  <strong>Q{i + 1} {q.converted && <span className="badge file" style={{ background: '#fff3d6', color: '#8a5a00' }}>from written</span>} <span className={'badge ' + q.source}>{q.source === 'file' ? 'from file' : q.source === 'ai' ? 'AI solved' : 'check'}</span></strong>
                  <button className="danger small" onClick={() => setQuestions((qs) => qs.filter((_, k) => k !== i))}>Delete</button>
                </div>
                <textarea value={q.text} onChange={(e) => upd(i, { text: e.target.value })} dir="auto" />
                {q.note && <div className="err">{q.note}</div>}
                {q.image && <img src={q.image} alt="Question visual" style={{ maxWidth: '100%', borderRadius: 12, margin: '12px 0', display: 'block', background: '#fff' }} />}
                <div className="row" style={{ margin: '6px 0' }}>
                  <label className="small ghost" style={{ display: 'inline-block', margin: 0, padding: '6px 12px', border: '2px solid var(--line)', borderRadius: 10, cursor: 'pointer' }}>
                    {q.image ? 'Replace picture' : 'Attach picture'}
                    <input type="file" accept="image/*" hidden onChange={(e) => attachImage(i, e.target.files?.[0])} />
                  </label>
                  {q.image && <button className="ghost small" onClick={() => upd(i, { image: '' })}>Remove picture</button>}
                </div>
                {Array.isArray(q.options) && q.options.length > 0 ? (
                  q.options.map((o, j) => (
                    <div className="optrow" key={j}>
                      <input type="radio" name={'c' + i} checked={q.answer === j} onChange={() => upd(i, { answer: j, source: q.source === 'unknown' ? 'ai' : q.source })} title="Mark as correct" />
                      <span className="letter">{L[j]}</span>
                      <input type="text" value={o} onChange={(e) => updOpt(i, j, e.target.value)} dir="auto" />
                    </div>
                  ))
                ) : (
                  <div>
                    <label>Correct answer</label>
                    <textarea value={String(q.answer ?? '')} onChange={(e) => upd(i, { answer: e.target.value })} dir="auto" style={{ minHeight: 44 }} />
                  </div>
                )}
                <label>Explanation</label>
                <textarea value={q.explanation} onChange={(e) => upd(i, { explanation: e.target.value })} dir="auto" style={{ minHeight: 44 }} />
              </div>
            ))}
          </div>
          {err && <div className="err">{err}</div>}
          <button onClick={save} disabled={saving || !questions.length}>{saving ? 'Saving…' : `Publish ${questions.length} questions`}</button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ BANKS ------------------------------ */
function Banks({ api }) {
  const [banks, setBanks] = useState(null);
  const load = () => fetch('/api/banks', { cache: 'no-store' }).then((r) => r.json()).then((d) => setBanks(d.banks));
  useEffect(() => { load(); }, []);
  async function del(b) {
    if (!window.confirm(`Delete "${b.name}"? Students' past scores are kept.`)) return;
    await api('/api/admin/banks?id=' + b.id, { method: 'DELETE' });
    load();
  }
  return (
    <div className="card">
      <h2>Question banks</h2>
      {!banks ? <p className="sub">Loading…</p> : banks.length === 0 ? <p className="sub">Nothing uploaded yet.</p> : (
        <table>
          <thead><tr><th>Name</th><th>Questions</th><th>Uploaded</th><th></th></tr></thead>
          <tbody>
            {banks.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td><td>{b.count}</td><td>{new Date(b.createdAt).toLocaleDateString()}</td>
                <td><button className="danger small" onClick={() => del(b)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ------------------------------ RESULTS ------------------------------ */
function Results({ api }) {
  const [rows, setRows] = useState(null);
  const [fq, setFq] = useState('');
  const [fc, setFc] = useState('');
  const [fn, setFn] = useState('');
  const load = () => api('/api/admin/results').then((d) => setRows(d.results));
  useEffect(() => { load(); }, []);

  if (!rows) return <div className="card"><p className="sub">Loading…</p></div>;
  const quizzes = [...new Set(rows.map((r) => r.quizName))];
  const classes = [...new Set(rows.map((r) => r.className))].sort();
  const shown = rows.filter((r) => (!fq || r.quizName === fq) && (!fc || r.className === fc) && (!fn || r.name.toLowerCase().includes(fn.toLowerCase())));
  const avg = shown.length ? Math.round(shown.reduce((s, r) => s + (r.total ? (r.score / r.total) * 100 : 0), 0) / shown.length) : 0;

  async function del(r) {
    if (!window.confirm(`Delete ${r.name}'s result?`)) return;
    await api('/api/admin/results?id=' + r.id, { method: 'DELETE' });
    load();
  }
  function exportCsv() {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [['Date', 'Name', 'Class', 'Quiz', 'Score', 'Total', 'Percent'].map(esc).join(',')];
    shown.forEach((r) => lines.push([new Date(r.date).toLocaleString(), r.name, r.className, r.quizName, r.score, r.total, r.total ? Math.round((r.score / r.total) * 100) + '%' : ''].map(esc).join(',')));
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'scores.csv';
    a.click();
  }

  return (
    <div className="card">
      <div className="row between"><h2>Student scores</h2><button className="ghost small" onClick={exportCsv} disabled={!shown.length}>⬇ Export CSV (Excel)</button></div>
      <div className="row" style={{ marginBottom: 12 }}>
        <select className="grow" value={fq} onChange={(e) => setFq(e.target.value)}><option value="">All quizzes</option>{quizzes.map((q) => <option key={q}>{q}</option>)}</select>
        <select className="grow" value={fc} onChange={(e) => setFc(e.target.value)}><option value="">All classes</option>{classes.map((c) => <option key={c}>{c}</option>)}</select>
        <input className="grow" type="text" placeholder="Search name…" value={fn} onChange={(e) => setFn(e.target.value)} />
      </div>
      <p className="sub">{shown.length} attempt(s) · average {avg}%</p>
      <div className="scroll">
        <table>
          <thead><tr><th>Date</th><th>Name</th><th>Class</th><th>Quiz</th><th>Score</th><th>%</th><th></th></tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.date).toLocaleString()}</td><td>{r.name}</td><td>{r.className}</td><td>{r.quizName}</td>
                <td><strong>{r.score}/{r.total}</strong></td><td>{r.total ? Math.round((r.score / r.total) * 100) : 0}%</td>
                <td><button className="danger small" onClick={() => del(r)}>✕</button></td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={7} className="sub">No results yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------ SETTINGS ------------------------------ */
function Settings({ api }) {
  const [s, setS] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => { api('/api/admin/settings').then(setS); }, []);
  if (!s) return <div className="card"><p className="sub">Loading…</p></div>;
  async function save() {
    const d = await api('/api/admin/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(s) });
    setS(d); setMsg('Saved ✓'); setTimeout(() => setMsg(''), 2000);
  }
  return (
    <div className="card">
      <h2>Settings</h2>
      <label>Default timer (minutes) — students can change it. 0 means no timer</label>
      <input type="number" min="0" value={s.timerMinutes} onChange={(e) => setS({ ...s, timerMinutes: e.target.value })} />
      <label>Default number of questions for “All topics mixed” — students can change it</label>
      <input type="number" min="0" value={s.allBanksCount} onChange={(e) => setS({ ...s, allBanksCount: e.target.value })} />
      {msg && <div className="msg">{msg}</div>}
      <div style={{ marginTop: 14 }}><button onClick={save}>Save settings</button></div>
    </div>
  );
}
