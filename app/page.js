'use client';
import { useEffect, useRef, useState } from 'react';

const L = 'ABCDEFGH';

export default function Home() {
  const [stage, setStage] = useState('home'); // home | quiz | result
  const [banks, setBanks] = useState([]);
  const [settings, setSettings] = useState({ timerMinutes: 0, allBanksCount: 20 });
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', className: '', bankId: '', count: '', timer: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const [quiz, setQuiz] = useState(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(null);
  const [result, setResult] = useState(null);

  // ----- number of questions and timer: the student chooses both -----
  const selBank = banks.find((b) => b.id === form.bankId);
  const total = form.bankId === 'all' ? banks.reduce((n, b) => n + (b.count || 0), 0) : selBank?.count || 0;
  const defaultCount = form.bankId === 'all' && settings.allBanksCount > 0 ? Math.min(settings.allBanksCount, total) : total;
  const countOptions = [...new Set([5, 10, 15, 20, 25, 30, 40, 50, 75, 100].filter((n) => n < total).concat([total, defaultCount].filter((n) => n > 0)))].sort((a, b) => a - b);
  const effCount = countOptions.map(String).includes(form.count) ? form.count : String(defaultCount);
  const defaultTimer = Number(settings.timerMinutes) || 0;
  const timerOptions = [...new Set([0, 5, 10, 15, 20, 30, 45, 60, 90, defaultTimer])].sort((a, b) => a - b);
  const effTimer = timerOptions.map(String).includes(form.timer) ? form.timer : String(defaultTimer);

  useEffect(() => {
    fetch('/api/banks')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setBanks(d.banks || []);
        setSettings(d.settings || settings);
        setForm((f) => ({ ...f, bankId: d.banks?.length ? d.banks[0].id : '' }));
      })
      .catch((e) => setErr(e.message || 'Could not load quizzes'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line
  }, []);

  async function start() {
    setErr('');
    if (!form.name.trim() || !form.className.trim()) return setErr('Please enter your name and class');
    setBusy(true);
    try {
      const r = await fetch('/api/quiz/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, count: effCount, timerMinutes: effTimer }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setQuiz(d);
      setAnswers(new Array(d.questions.length).fill(null));
      setIdx(0);
      setTimeLeft(d.timerMinutes > 0 ? d.timerMinutes * 60 : null);
      setStage('quiz');
    } catch (e) {
      setErr(e.message || 'Something went wrong');
    }
    setBusy(false);
  }

  async function submit(auto = false) {
    if (busy || !quiz) return;
    const unanswered = answers.filter((a) => a === null).length;
    if (!auto && unanswered > 0 && !window.confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`)) return;
    setBusy(true);
    try {
      const r = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId: quiz.sessionId, answers }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setResult(d);
      setStage('result');
    } catch (e) {
      setErr(e.message || 'Could not submit');
    }
    setBusy(false);
  }
  const submitRef = useRef(submit);
  submitRef.current = submit;

  // countdown
  useEffect(() => {
    if (stage !== 'quiz' || timeLeft === null) return;
    const t = setInterval(() => {
      setTimeLeft((s) => {
        if (s <= 1) {
          clearInterval(t);
          submitRef.current(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [stage, quiz]);

  function pick(i) {
    setAnswers((a) => a.map((v, k) => (k === idx ? i : v)));
  }
  function updateFreeText(value) {
    setAnswers((a) => a.map((v, k) => (k === idx ? value : v)));
  }
  function restart() {
    setStage('home');
    setQuiz(null);
    setResult(null);
    setErr('');
  }
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ---------- HOME ----------
  if (stage === 'home') {
    return (
      <>
        <header className="hero">
          <svg className="atom" viewBox="0 0 200 200" aria-hidden="true">
            <defs>
              <radialGradient id="nuc"><stop offset="0" stopColor="#fff" /><stop offset=".45" stopColor="#ffd45a" /><stop offset="1" stopColor="#ff8a00" /></radialGradient>
            </defs>
            <g className="spin">
              {[0, 60, 120].map((r) => (
                <g key={r} transform={`rotate(${r} 100 100)`}>
                  <ellipse className="orbit" cx="100" cy="100" rx="92" ry="32" />
                  <circle className={r === 0 ? 'e' : r === 60 ? 'e e2' : 'e e3'} r="5.5">
                    <animateMotion dur={`${3 + r / 30}s`} repeatCount="indefinite" path="M 8 100 a 92 32 0 1 0 184 0 a 92 32 0 1 0 -184 0" />
                  </circle>
                </g>
              ))}
            </g>
            <circle className="nucleus" cx="100" cy="100" r="13" />
          </svg>
          <h1>Physics Quiz</h1>
          <p>Pick a topic and answer at your own pace. You'll see every correct answer at the end.</p>
          <svg className="arc" viewBox="0 0 400 130" aria-hidden="true">
            <path className="path" d="M12 118 Q 200 -70 388 118" />
            <line className="ground" x1="0" y1="122" x2="400" y2="122" />
            <circle className="ball" r="9">
              <animateMotion dur="2.2s" begin="0.3s" repeatCount="1" fill="freeze" calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines="0.4 0 0.6 1" path="M12 112 Q 200 -76 388 112" />
            </circle>
          </svg>
        </header>
        <div className="wrap pull">
        <div className="card">
          <label>Full name</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} dir="auto" />
          <label>Class</label>
          <input type="text" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} placeholder="e.g. 3B" dir="auto" />
          <label>Quiz</label>
          {loading ? (
            <p className="sub">Loading…</p>
          ) : banks.length === 0 ? (
            <p className="sub">No quizzes available yet.</p>
          ) : (
            <select value={form.bankId} onChange={(e) => setForm({ ...form, bankId: e.target.value })}>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.count} questions)</option>
              ))}
              {banks.length > 1 && (
                <option value="all">
                  🎲 All topics mixed (random questions)
                </option>
              )}
            </select>
          )}
          {total > 0 && (
            <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
              <div className="grow">
                <label>Number of questions</label>
                <select value={effCount} onChange={(e) => setForm({ ...form, count: e.target.value })}>
                  {countOptions.map((n) => (
                    <option key={n} value={n}>{n === total ? `All ${n} questions` : `${n} questions`}</option>
                  ))}
                </select>
              </div>
              <div className="grow">
                <label>Timer</label>
                <select value={effTimer} onChange={(e) => setForm({ ...form, timer: e.target.value })}>
                  {timerOptions.map((m) => (
                    <option key={m} value={m}>{m === 0 ? 'No timer' : `${m} minutes`}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {err && <div className="err">{err}</div>}
          <div style={{ marginTop: 16 }}>
            <button onClick={start} disabled={busy || !banks.length}>{busy ? 'Starting…' : 'Start quiz'}</button>
          </div>
        </div>
        </div>
      </>
    );
  }

  // ---------- QUIZ ----------
  if (stage === 'quiz' && quiz) {
    const q = quiz.questions[idx];
    const done = answers.filter((a) => a !== null).length;
    const questionType = q?.type || (Array.isArray(q?.options) && q.options.length > 0 ? 'mcq' : 'short_answer');
    const hasOptions = Array.isArray(q?.options) && q.options.length > 0;
    const currentAnswer = answers[idx];

    return (
      <>
        <div className="band"><div className="wrap bandin">
        <div className="row between">
          <strong className="qname">{quiz.quizName}</strong>
          {timeLeft !== null && <span className={'timer' + (timeLeft < 60 ? ' low' : '')}>⏱ {fmt(timeLeft)}</span>}
        </div>
        <div className="bar"><div style={{ width: `${(done / quiz.questions.length) * 100}%` }} /></div>
        <div className="sub light">Question {idx + 1} of {quiz.questions.length} — {done} answered</div>
        </div></div>
        <div className="wrap pull">
        <div className="card" key={idx}>
          <div className="qtext" dir="auto">{q.text}</div>
          {q.image && <img src={q.image} alt="Question visual" style={{ maxWidth: '100%', borderRadius: 12, margin: '12px 0', display: 'block' }} />}
          {hasOptions && (questionType === 'mcq' || questionType === 'true_false') ? (
            q.options.map((o, i) => (
              <button key={i} className={'opt' + (answers[idx] === i ? ' sel' : '')} onClick={() => pick(i)} dir="auto">
                <span className="letter">{L[i]}</span><span>{o}</span>
              </button>
            ))
          ) : (
            <textarea
              value={typeof currentAnswer === 'string' || typeof currentAnswer === 'number' ? String(currentAnswer) : ''}
              onChange={(e) => updateFreeText(e.target.value)}
              placeholder={questionType === 'numeric' ? 'Type the numeric answer' : 'Type your answer'}
              style={{ width: '100%', minHeight: 110, marginTop: 10 }}
              dir="auto"
            />
          )}
          {err && <div className="err">{err}</div>}
          <div className="row between" style={{ marginTop: 14 }}>
            <button className="ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Back</button>
            {idx < quiz.questions.length - 1 ? (
              <button onClick={() => setIdx(idx + 1)}>Next →</button>
            ) : (
              <button onClick={() => submit(false)} disabled={busy}>{busy ? 'Submitting…' : 'Submit quiz'}</button>
            )}
          </div>
        </div>
        <div className="row dots">
          {quiz.questions.map((_, i) => (
            <button key={i} className={'small ' + (i === idx ? '' : answers[i] !== null ? 'done' : 'ghost')} onClick={() => setIdx(i)}>{i + 1}</button>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <button className="ghost" onClick={() => submit(false)} disabled={busy}>Finish now</button>
        </div>
        </div>
      </>
    );
  }

  // ---------- RESULT ----------
  if (stage === 'result' && result) {
    const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
    return (
      <>
        <div className="band resultband">
          <div className="light">{form.name} · {form.className}</div>
          {pct >= 80 && (
            <div className="confetti" aria-hidden="true">
              {Array.from({ length: 30 }, (_, i) => (
                <i key={i} style={{ '--x': `${(i * 37) % 100}%`, '--d': `${(i % 10) * 0.18}s`, '--s': `${((i % 7) - 3) * 22}px`, '--c': ['#ffc22e', '#22d3ee', '#8b5cf6', '#f472b6', '#34e08a'][i % 5] }} />
              ))}
            </div>
          )}
          <div className="ring" style={{ '--pct': pct }}>
            <div className="score">{result.score}/{result.total}</div>
          </div>
          <p className="verdict">{pct >= 80 ? 'Excellent work.' : pct >= 50 ? 'Solid. Check what you missed below.' : 'Read the explanations below and try again.'}</p>
          <div style={{ marginTop: 18 }}><button onClick={restart}>Take another quiz</button></div>
        </div>
        <div className="wrap pull">
        <h2 style={{ color: '#fff' }}>Review your answers</h2>
        {result.review.map((r, n) => (
          <div className="card rev" key={n}>
            <div className="qtext" dir="auto">{n + 1}. {r.text}</div>
            {r.image && <img src={r.image} alt="Question visual" style={{ maxWidth: '100%', borderRadius: 12, margin: '12px 0', display: 'block' }} />}
            {Array.isArray(r.options) && r.options.length > 0 ? (
              r.options.map((o, i) => (
                <div key={i} className={'opt ' + (i === r.correct ? 'ok' : i === r.chosen ? 'bad' : '')} dir="auto">
                  <span className="letter">{L[i]}</span>
                  <span>{o}{i === r.correct ? '  ✓' : i === r.chosen ? '  ✗ (your answer)' : ''}</span>
                </div>
              ))
            ) : (
              <div className="sub" dir="auto">Your answer: {r.chosen === null || r.chosen === undefined ? 'Not answered' : String(r.chosen)}</div>
            )}
            {r.chosen === null && <div className="sub">Not answered</div>}
            {r.explanation && <div className="expl" dir="auto">💡 {r.explanation}</div>}
          </div>
        ))}
        </div>
      </>
    );
  }
  return null;
}
