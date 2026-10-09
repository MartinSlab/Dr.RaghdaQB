import { randomUUID } from 'crypto';
import { redis } from '../../../../lib/db';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { sessionId, answers } = await req.json();
  const s = await redis.get('session:' + sessionId);
  if (!s) {
    return Response.json({ error: 'Session expired or already submitted' }, { status: 404 });
  }
  await redis.del('session:' + sessionId);

  const cache = {};
  let score = 0;
  const review = [];
  for (let n = 0; n < s.refs.length; n++) {
    const [b, i] = s.refs[n];
    if (!cache[b]) cache[b] = (await redis.get('bank:' + b)) || [];
    const q = cache[b][i];
    if (!q) continue;
    const chosen = Number.isInteger(answers?.[n]) ? answers[n] : null;
    if (chosen === q.answer) score++;
    review.push({
      text: q.text,
      options: q.options,
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
