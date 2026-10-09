import { randomUUID } from 'crypto';
import { redis, getSettings, shuffle } from '../../../../lib/db';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const { name, className, bankId } = await req.json();
  if (!name?.trim() || !className?.trim()) {
    return Response.json({ error: 'Name and class are required' }, { status: 400 });
  }
  const settings = await getSettings();
  const banks = (await redis.hgetall('banks')) || {};
  const isAll = bankId === 'all';
  if (!isAll && !banks[bankId]) {
    return Response.json({ error: 'Quiz not found' }, { status: 404 });
  }

  const ids = isAll ? Object.keys(banks) : [bankId];
  let pool = [];
  for (const id of ids) {
    const qs = (await redis.get('bank:' + id)) || [];
    qs.forEach((q, i) => pool.push({ b: id, i, q }));
  }
  if (!pool.length) return Response.json({ error: 'No questions available' }, { status: 404 });

  pool = shuffle(pool);
  if (isAll && settings.allBanksCount > 0) pool = pool.slice(0, settings.allBanksCount);

  const sessionId = randomUUID();
  const quizName = isAll ? 'All topics' : banks[bankId].name;
  await redis.set(
    'session:' + sessionId,
    {
      name: name.trim().slice(0, 80),
      className: className.trim().slice(0, 40),
      bankId,
      quizName,
      refs: pool.map((p) => [p.b, p.i]),
    },
    { ex: 60 * 60 * 6 }
  );

  return Response.json({
    sessionId,
    quizName,
    timerMinutes: settings.timerMinutes,
    // answers are NOT sent to the browser
    questions: pool.map((p) => ({ text: p.q.text, options: p.q.options })),
  });
}
