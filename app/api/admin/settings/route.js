import { redis, getSettings } from '../../../../lib/db';
import { isAdmin, unauthorized } from '../../../../lib/auth';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  if (!isAdmin(req)) return unauthorized();
  return Response.json(await getSettings());
}

export async function POST(req) {
  if (!isAdmin(req)) return unauthorized();
  const b = await req.json();
  const settings = {
    timerMinutes: Math.max(0, Math.min(600, parseInt(b.timerMinutes) || 0)),
    allBanksCount: Math.max(0, Math.min(500, parseInt(b.allBanksCount) || 0)),
  };
  await redis.set('settings', settings);
  return Response.json(settings);
}
