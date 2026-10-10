import { getMongoDb } from '../../../lib/db';
export const dynamic = 'force-dynamic';

// Open /api/health in the browser to check the database connection.
export async function GET() {
  try {
    const db = await getMongoDb();
    await db.command({ ping: 1 });
    return Response.json({ ok: true, database: 'connected' });
  } catch (e) {
    const msg = String(e?.message || e).replace(/mongodb(\+srv)?:\/\/[^\s"']+/g, 'mongodb://…');
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
