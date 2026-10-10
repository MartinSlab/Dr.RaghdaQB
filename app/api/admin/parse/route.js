import { safe } from '../../../../lib/api';
import { isAdmin, unauthorized } from '../../../../lib/auth';
import { parseDocx } from '../../../../lib/docx';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

async function POST_impl(req) {
  if (!isAdmin(req)) return unauthorized();
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return Response.json({ error: 'No file uploaded' }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith('.docx')) {
    return Response.json({ error: 'Please upload a .docx file (Word 2007 or newer)' }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const { chunks, images, imageCount } = await parseDocx(buffer);
  if (!chunks.length) return Response.json({ error: 'The file looks empty' }, { status: 400 });
  return Response.json({ chunks, images, imageCount });
}

export const POST = safe(POST_impl);
