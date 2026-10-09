import { redis } from '../../../../lib/db';
import { isAdmin, unauthorized } from '../../../../lib/auth';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!isAdmin(req)) return unauthorized();
  const { name, questions } = await req.json();
  if (!name?.trim() || !Array.isArray(questions) || !questions.length) {
    return Response.json({ error: 'Name and at least one question are required' }, { status: 400 });
  }
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const clean = questions.map((q) => ({
    text: String(q.text),
    options: q.options.map(String),
    answer: q.answer,
    explanation: String(q.explanation || ''),
  }));
  await redis.set('bank:' + id, clean);
  await redis.hset('banks', {
    [id]: { id, name: name.trim(), count: clean.length, createdAt: Date.now() },
  });
  return Response.json({ id });
}

export async function DELETE(req) {
  if (!isAdmin(req)) return unauthorized();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
  await redis.hdel('banks', id);
  await redis.del('bank:' + id);
  return Response.json({ ok: true });
}
