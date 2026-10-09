import mammoth from 'mammoth';
import { isAdmin, unauthorized } from '../../../../lib/auth';
import { splitDocument } from '../../../../lib/chunk';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req) {
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
  const { value } = await mammoth.extractRawText({ buffer });
  if (!value.trim()) return Response.json({ error: 'The file looks empty' }, { status: 400 });
  const chunks = splitDocument(value);
  return Response.json({ chunks, chars: value.length });
}
