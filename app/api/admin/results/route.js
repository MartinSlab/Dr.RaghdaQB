import { redis } from '../../../../lib/db';
import { isAdmin, unauthorized } from '../../../../lib/auth';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!isAdmin(req)) return unauthorized();
  const all = (await redis.hgetall('results')) || {};
  const results = Object.values(all).sort((a, b) => b.date - a.date);
  return Response.json({ results });
}

export async function DELETE(req) {
  if (!isAdmin(req)) return unauthorized();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
  await redis.hdel('results', id);
  return Response.json({ ok: true });
}
