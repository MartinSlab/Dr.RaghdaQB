import { safe } from '../../../../lib/api';
import { randomUUID } from 'crypto';
import { redis } from '../../../../lib/db';
export const dynamic = 'force-dynamic';

async function POST_impl(req) {
  const { sessionId, answers } = await req.json();
  const s = await redis.get('session:' + sessionId);
  if (!s) {
    return Response.json({ error: 'Session expired or already submitted' }, { status: 404 });
  }
  await redis.del('session:' + sessionId);

  function normalize(v) {
    if (v === null || v === undefined) return '';
    return String(v).trim().toLowerCase();
  }

  function isCorrect(q, chosen) {
    if (q.answer === null || q.answer === undefined) return false;
    if (Array.isArray(q.options) && q.options.length > 0) {
      if (typeof q.answer === 'number' && Number.isInteger(chosen)) return chosen === q.answer;
      if (typeof q.answer === 'string') return normalize(chosen) === normalize(q.answer);
      return normalize(chosen) === normalize(q.answer);
    }
    if (typeof q.answer === 'number' && Number.isFinite(Number(chosen))) {
      return Number(chosen) === Number(q.answer);
    }
    return normalize(chosen) === normalize(q.answer);
  }

  const cache = {};
  let score = 0;
  const review = [];
  for (let n = 0; n < s.refs.length; n++) {
    const [b, i] = s.refs[n];
    if (!cache[b]) cache[b] = (await redis.get('bank:' + b)) || [];
    const q = cache[b][i];
    if (!q) continue;
    const chosen = answers?.[n] ?? null;
    if (isCorrect(q, chosen)) score++;
    review.push({
      text: q.text,
      type: q.type || (Array.isArray(q.options) && q.options.length > 0 ? 'mcq' : 'short_answer'),
      image: q.image || '',
      options: Array.isArray(q.options) ? q.options : [],
      correct: q.answer,
      chosen,
      explanation: q.explanation || '',
    });
  }

  const result = {
    id: randomUUID(),
    name: s.name,
    className: s.className,
    quizName: s.quizName,
    bankId: s.bankId,
    score,
    total: review.length,
    date: Date.now(),
  };
  await redis.hset('results', { [result.id]: result });

  return Response.json({ score, total: review.length, review });
}

export const POST = safe(POST_impl);
