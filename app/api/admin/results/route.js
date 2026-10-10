import { safe } from '../../../../lib/api';
import { redis } from '../../../../lib/db';
import { isAdmin, unauthorized } from '../../../../lib/auth';
export const dynamic = 'force-dynamic';

async function GET_impl(req) {
  if (!isAdmin(req)) return unauthorized();
  const all = (await redis.hgetall('results')) || {};
  const results = Object.values(all).sort((a, b) => b.date - a.date);
  return Response.json({ results });
}

async function DELETE_impl(req) {
  if (!isAdmin(req)) return unauthorized();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });
  await redis.hdel('results', id);
  return Response.json({ ok: true });
}

export const GET = safe(GET_impl);
export const DELETE = safe(DELETE_impl);
