import { isAdmin, unauthorized } from '../../../../lib/auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM = `You are an expert physics teacher. You receive raw text extracted from a Word file containing multiple-choice questions (MCQs), possibly with an answer key.

Return ONLY a JSON array (no markdown, no commentary). Each item:
{
  "question": string,            // the full question text, keep original wording and language
  "options": [string, ...],      // option texts WITHOUT the letter/number labels (A, B, a), 1) ...)
  "answer": number,              // 0-based index of the correct option
  "answerSource": "file" | "solved",  // "file" if the answer came from an answer key / marking in the text, otherwise "solved"
  "explanation": string          // 1-3 short sentences: key formula/reasoning
}

Rules:
- If the text gives the answer (inline like "Answer: B", a marked/bold/starred option, or in the ANSWER KEY section), use it and set answerSource "file".
- Otherwise solve the problem carefully (units, vectors, significant relationships, conversions) and set answerSource "solved".
- Write formulas in plain text/Unicode (v², x₀, √, ×, Δ, θ, π, m/s²). Do not use LaTeX.
- Skip anything that is not a complete MCQ (headings, instructions, cut-off questions at the very start or end).
- Never invent questions. Keep the original order.`;

function clean(arr) {
  const out = [];
  for (const o of arr) {
    if (!o || typeof o.question !== 'string' || !Array.isArray(o.options) || o.options.length < 2) continue;
    const options = o.options.map((x) => String(x).replace(/^\s*\(?[A-Ha-h]\s*[\.\)]\s+/, '').trim());
    let answer = Number.isInteger(o.answer) ? o.answer : -1;
    let source = o.answerSource === 'file' ? 'file' : 'ai';
    if (answer < 0 || answer >= options.length) {
      answer = 0;
      source = 'unknown';
    }
    out.push({
      text: o.question.trim(),
      options,
      answer,
      explanation: String(o.explanation || '').trim(),
      source,
    });
  }
  return out;
}

export async function POST(req) {
  if (!isAdmin(req)) return unauthorized();
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not set on the server' }, { status: 500 });
  }
  const { text } = await req.json();
  if (!text) return Response.json({ error: 'No text' }, { status: 400 });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: 'user', content: text }],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return Response.json({ error: data?.error?.message || 'AI request failed' }, { status: 502 });
  }
  const raw = (data.content || []).map((c) => c.text || '').join('');
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1) {
    return Response.json({ error: 'AI returned an unexpected format' }, { status: 502 });
  }
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return Response.json({ questions: clean(parsed) });
  } catch {
    return Response.json({ error: 'Could not read the AI response' }, { status: 502 });
  }
}
