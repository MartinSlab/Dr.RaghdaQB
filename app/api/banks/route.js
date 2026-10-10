import { safe } from '../../../lib/api';
import { redis, getSettings } from '../../../lib/db';
export const dynamic = 'force-dynamic';

async function GET_impl() {
  const banks = (await redis.hgetall('banks')) || {};
  const list = Object.values(banks).sort((a, b) => a.createdAt - b.createdAt);
  const s = await getSettings();
  return Response.json({
    banks: list,
    settings: { timerMinutes: s.timerMinutes, allBanksCount: s.allBanksCount },
  });
}

export const GET = safe(GET_impl);
