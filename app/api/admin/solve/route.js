import { safe } from '../../../../lib/api';
import { isAdmin, unauthorized } from '../../../../lib/auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const TEXT_MODEL = () => process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
// Used only to "look at" pictures (graphs, circuits, figures). Change in .env if Groq renames it.
const VISION_MODEL = () => process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';

const SYSTEM = `You are an expert physics teacher preparing a multiple-choice (MCQ) quiz from text extracted from a Word exam sheet. EVERY question in the exam must end up as an MCQ: real MCQs are copied, written questions are converted.

HOW THE TEXT LOOKS
- Blocks are separated by lines of "-----". Usually one block = one question, but a question can be split over several consecutive blocks (stem, figure, a lone "x"): join them. A line "[SECTION: ...]" tells you which part of the exam you are in.
- "[[IMG:n]]" marks where picture number n sits. A line "(picture description: ...)" follows it when the picture could be inspected.
- Options appear as "a) ...", "(b) ...", "C) ...". Letters are not always lower-case.
- "__text__" means the words were underlined in Word.
- Word can jumble text (a fraction written as a numerator row and a denominator row, a stem split over lines). Reconstruct the intended question.
- Ignore noise: Arabic exam-source tags, row numbers. Keep dotted blanks as "……".

KIND 1 - EXISTING MCQ (a stem with 2-6 options, or options shown inside a picture)
- Copy the stem and options. Ignore any "__" marks here.
- If the text gives the answer ("Answer: b" or the ANSWER KEY section) use it (answerSource "file"). Otherwise SOLVE it (answerSource "solved").
- Output: "kind":"mcq", "options":[...] WITHOUT letter labels, "answer": 0-based index.
- If the options exist only inside a picture use ["Choice (a)","Choice (b)","Choice (c)","Choice (d)"] using the labels printed in the picture.

KIND 2 - WRITTEN QUESTION (no options) -> CONVERT TO MCQ
Solve it correctly, then write exactly 3 wrong choices:
- "Write the scientific term / name the quantity" (a definition): stem "Which scientific term is described by: <definition>?" Correct = the term. Wrong choices = 3 genuinely related terms from the same topic that a student could confuse with it.
- Calculation ("Calculate / Determine / Find"): stem = the original question with all given data. Correct = your computed value with unit and sensible rounding. Wrong choices = the results of typical mistakes (forgetting a unit conversion cm→m, using diameter as radius, forgetting the number of turns or a factor such as 2π or 2, wrong power of ten, swapping a ratio), written in the same format and units as the correct value. They must all differ from the correct value.
- "Mention / state / explain / what is the shape of…": stem = the question. Correct = a short precise answer. Wrong choices = plausible but wrong statements of similar length.
- "Correct the underlined…": stem = 'In the statement "<statement>", the underlined words "<underlined words>" are wrong. What is the correct replacement?' Correct = the right words. Wrong choices = plausible wrong replacements.
- A question about a figure uses the picture description. If you cannot inspect the figure, do NOT guess: set "needsFigure": true and still write the stem.
- Output: "kind":"converted", "correct": string, "distractors": [3 strings]. Do NOT output options/answer for these.
- Do not put the correct answer inside the question text.

SKIP only titles, instructions (for example "Choose", "Answer the following question"), and fragments that contain no question. If the same question appears twice, output it once. Keep original order, wording and language. Write formulas in plain Unicode (v², x₀, √, ×, Δ, μ₀, π). No LaTeX.

SOLVING: think step by step before answering: write the law, substitute the numbers (use the constants given in the question), compute, compare with every option. Unit conversions and powers of ten are the usual traps. If no option matches your result choose the nearest and set confidence "low".

OUTPUT: return ONLY valid JSON, no markdown:
{"questions":[
 {
  "kind": "mcq" | "converted",
  "question": string,          // stem only, without options and without [[IMG]] markers
  "options": [string,...],     // kind mcq only
  "answer": number|null,       // kind mcq only
  "correct": string,           // kind converted only
  "distractors": [string,string,string], // kind converted only
  "answerSource": "file"|"solved",
  "confidence": "high"|"low",
  "image": number|null,        // n of the [[IMG:n]] belonging to THIS question, else null
  "needsFigure": boolean,
  "explanation": string        // 1-3 short sentences: law/formula and the key step or result
 }
]}`;

const DESCRIBE = `You are helping a physics teacher. For each numbered image, write a precise description so that someone who cannot see it can answer a multiple-choice question about it.
- Graphs: axis labels, the shape of each curve/line (straight through origin, decreasing, hyperbola, parabola…), and which panel label (a)(b)(c)(d) or curve number shows which shape; relative slopes if several lines.
- Circuits / magnetic-field / wire / coil diagrams: components, labelled values, current and field directions (clockwise, into/out of page, up/down), what each labelled option (A)-(D) shows (e.g. core material and current value).
- Copy any printed text and numbers exactly. Do NOT solve the question.
Return ONLY JSON: {"<image number>": "<description>", ...}`;

function parseJson(raw) {
  const t = String(raw || '').replace(/```json|```/gi, '').trim();
  const s = t.search(/[\[{]/);
  const e = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (s === -1 || e === -1) throw new Error('AI returned an unexpected format');
  return JSON.parse(t.slice(s, e + 1));
}

async function groq(body) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY is not set on the server');
  let lastError = 'AI request failed';
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status === 503) {
      const wait = Math.min(Number(res.headers.get('retry-after')) * 1000 || 8000, 12000);
      lastError = 'Groq rate limit reached';
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      lastError = data?.error?.message || lastError;
      if (res.status >= 500) { await new Promise((r) => setTimeout(r, 1500)); continue; }
      throw new Error(lastError);
    }
    return data?.choices?.[0]?.message?.content || '';
  }
  throw new Error(lastError);
}

async function describeImages(images) {
  try {
    const content = [{ type: 'text', text: DESCRIBE }];
    for (const im of images) {
      content.push({ type: 'text', text: `Image ${im.id}:` });
      content.push({ type: 'image_url', image_url: { url: im.src } });
    }
    const raw = await groq({ model: VISION_MODEL(), temperature: 0, max_tokens: 1500, messages: [{ role: 'user', content }] });
    const obj = parseJson(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {}; // questions that need the picture will be flagged for the teacher
  }
}

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clean(list, images) {
  const out = [];
  for (const o of list) {
    if (!o || typeof o.question !== 'string') continue;
    const text = o.question.replace(/\[\[[^\]]*\]\]/g, '').replace(/__/g, '').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) continue;
    const img = images.find((im) => String(im.id) === String(o.image));
    const notes = [];
    let options, answer, valid;
    const converted = o.kind === 'converted' || (!Array.isArray(o.options) && o.correct);

    if (converted) {
      const correct = String(o.correct ?? '').trim();
      const seen = new Set([correct.toLowerCase()]);
      const wrong = (Array.isArray(o.distractors) ? o.distractors : [])
        .map((x) => String(x).trim())
        .filter((x) => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()));
      if (!correct || wrong.length < 2) continue;
      options = shuffled([correct, ...wrong.slice(0, 3)]);
      answer = options.indexOf(correct);
      valid = true;
      if (wrong.length < 3) notes.push('Only ' + (wrong.length + 1) + ' choices could be written for this question.');
    } else {
      options = (Array.isArray(o.options) ? o.options : [])
        .map((x) => String(x).replace(/^\s*\(?[A-Ha-h]\s*[\.\)]\s+/, '').trim())
        .filter(Boolean);
      if (options.length < 2) continue;
      answer = Number.isInteger(o.answer) ? o.answer : null;
      valid = answer !== null && answer >= 0 && answer < options.length;
    }

    if (o.needsFigure && !img) notes.push('This question uses a figure that could not be imported. Attach the picture, then check the answer.');
    else if (o.needsFigure) notes.push('The AI could not read this picture. Check the answer yourself.');
    else if (o.confidence === 'low') notes.push('The AI is not sure about this answer. Check it.');
    else if (!valid) notes.push('No answer was chosen. Pick the correct option.');

    const unsure = !valid || o.needsFigure || o.confidence === 'low';
    out.push({
      text,
      type: 'mcq',
      options,
      answer: valid ? answer : 0,
      explanation: String(o.explanation || '').trim(),
      source: unsure ? 'unknown' : o.answerSource === 'file' ? 'file' : 'ai',
      image: img ? img.src : '',
      converted: !!converted,
      note: notes.join(' '),
    });
  }
  return out;
}

async function POST_impl(req) {
  if (!isAdmin(req)) return unauthorized();
  const { text, images } = await req.json();
  if (!text) return Response.json({ error: 'No text' }, { status: 400 });
  const imgs = Array.isArray(images) ? images.filter((i) => i && i.src) : [];

  try {
    let body = text;
    if (imgs.length) {
      const desc = await describeImages(imgs);
      body = text.replace(/\[\[IMG:(\d+)\]\]/g, (m, n) => (desc[n] ? `${m}\n(picture description: ${desc[n]})` : m));
    }
    const model = TEXT_MODEL();
    const raw = await groq({
      model,
      temperature: 0,
      max_completion_tokens: 12000,
      ...(model.includes('gpt-oss') ? { reasoning_effort: 'medium' } : {}),
      messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: body }],
    });
    let parsed = parseJson(raw);
    if (!Array.isArray(parsed)) parsed = parsed.questions || [];
    return Response.json({ questions: clean(parsed, imgs) });
  } catch (e) {
    return Response.json({ error: e.message || 'AI request failed' }, { status: 502 });
  }
}

export const POST = safe(POST_impl);
