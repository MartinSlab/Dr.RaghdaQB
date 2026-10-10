import { safe } from '../../../../lib/api';
import { randomUUID } from 'crypto';
import { redis, getSettings, shuffle } from '../../../../lib/db';
export const dynamic = 'force-dynamic';

async function POST_impl(req) {
  const { name, className, bankId, count, timerMinutes } = await req.json();
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
  // the student chooses how many questions; without a choice fall back to the teacher's default
  const wanted = parseInt(count, 10);
  if (wanted > 0) pool = pool.slice(0, wanted);
  else if (isAll && settings.allBanksCount > 0) pool = pool.slice(0, settings.allBanksCount);
  const chosenTimer = Number(timerMinutes);
  const timer = timerMinutes === undefined || timerMinutes === '' || !Number.isFinite(chosenTimer)
    ? settings.timerMinutes
    : Math.max(0, Math.min(300, Math.floor(chosenTimer)));

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
    timerMinutes: timer,
    // answers are NOT sent to the browser
    questions: pool.map((p) => ({
      text: p.q.text,
      type: p.q.type || (Array.isArray(p.q.options) && p.q.options.length > 0 ? 'mcq' : 'short_answer'),
      image: p.q.image || '',
      options: Array.isArray(p.q.options) ? p.q.options : [],
    })),
  });
}

export const POST = safe(POST_impl);
