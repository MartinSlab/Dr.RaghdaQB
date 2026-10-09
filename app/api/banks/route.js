import { redis, getSettings } from '../../../lib/db';
export const dynamic = 'force-dynamic';

export async function GET() {
  const banks = (await redis.hgetall('banks')) || {};
  const list = Object.values(banks).sort((a, b) => a.createdAt - b.createdAt);
  const s = await getSettings();
  return Response.json({
    banks: list,
    settings: { timerMinutes: s.timerMinutes, allBanksCount: s.allBanksCount },
  });
}
