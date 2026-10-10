// Reads a .docx the way a teacher reads it: keeps questions whole, keeps each picture
// next to the question it belongs to, fixes fractions / superscripts / Arabic tags.
import mammoth from 'mammoth';

const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻', '–': '⁻', '+': '⁺', '(': '⁽', ')': '⁾', n: 'ⁿ' };
const SUB = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '-': '₋', '+': '₊' };
const MAX_IMG_BYTES = 1_000_000;
const TARGET_CHARS = 1800;
const MAX_QUESTION_BLOCKS = 6;
const MAX_IMAGES_PER_CHUNK = 4;

const decode = (s) =>
  s.replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

function mapChars(str, table, fallbackPrefix) {
  const out = [...str].map((c) => table[c]);
  return out.every(Boolean) ? out.join('') : `${fallbackPrefix}(${str})`;
}

// "1 1 1 4 / a) b) c) d) / 4 2 1 1"  ->  "a) 1/4   b) 1/2   c) 1/1   d) 4/1"
function fixStackedFractions(text) {
  return text.replace(
    /^([^\n\t]+(?:\t[^\n\t]+){1,5})[ \t]*\n((?:\(?[A-Fa-f]\)[ \t]*){2,6})\n([^\n\t]+(?:\t[^\n\t]+){1,5})[ \t]*$/gm,
    (all, top, labels, bottom) => {
      const t = top.split('\t').map((x) => x.trim());
      const b = bottom.split('\t').map((x) => x.trim());
      const l = labels.trim().split(/\s+/);
      if (t.length !== b.length || t.length !== l.length) return all;
      return l.map((lab, i) => `${lab} ${t[i]}/${b[i]}`).join('\t');
    }
  );
}

function cleanText(text) {
  let t = text.normalize('NFKC'); // turns 𝒕𝒉𝒆 𝒅𝒆𝒏𝒔𝒊𝒕𝒚 into "the density"
  t = t.replace(/\r/g, '').replace(/[ \u00a0]+\n/g, '\n');
  t = fixStackedFractions(t);
  // exam-source tags written in Arabic, e.g. (تجريبى), "دور ثاني 2023"
  t = t.replace(/\(?\s*تجريب[يى]\s*\)?/g, '');
  t = t
    .split('\n')
    .filter((line) => !(line.trim().length <= 30 && /^[\u0600-\u06FF\s\d]+$/.test(line.trim()) && /(\d{4}|تجريب|دور)/.test(line)))
    .join('\n');
  // options sitting on one line: put each "a) …" on its own line (tabs / wide gaps only)
  t = t.replace(/(?:\t| {2,})+(?=\(?[A-Da-d]\s*[\)\.]\s*\S)/g, '\n');
  t = t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

// __x__ marks underlined words. If most of a block is underlined it is just a title: drop the marks.
function unmarkHeadingUnderline(t) {
  t = t.replace(/__(\s*)__/g, '$1');
  const under = [...t.matchAll(/__([\s\S]*?)__/g)].reduce((n, m) => n + m[1].length, 0);
  return under > 0 && under >= t.replace(/__/g, '').length * 0.7 ? t.replace(/__/g, '') : t;
}

const HEADER_CELL = /^(no\.?|question|answer|م|السؤال|الاجابة|الإجابة)$/i;
const NUMBER_CELL = /^\d{1,3}(\s+\d{1,3})*$/;

function htmlToBlocks(html) {
  let h = html
    .replace(/<sup>([\s\S]*?)<\/sup>/g, (_, s) => mapChars(decode(s.replace(/<[^>]+>/g, '')).trim(), SUP, '^'))
    .replace(/<u>([\s\S]*?)<\/u>/g, (_, s) => `__${decode(s.replace(/<[^>]+>/g, ''))}__`)
    .replace(/<sub>([\s\S]*?)<\/sub>/g, (_, s) => mapChars(decode(s.replace(/<[^>]+>/g, '')).trim(), SUB, '_'))
    .replace(/<img[^>]*src="IMG(\d+|X)[^"]*"[^>]*>/g, (_, n) => (n === 'X' ? ' [[FIGURE NOT IMPORTED]] ' : ` [[IMG:${n}]] `))
    .replace(/<br\s*\/?>/g, '\n');

  const blocks = [];
  const tableRe = /<table[\s\S]*?<\/table>/g;
  let last = 0;
  const flushOutside = (chunk) => {
    chunk
      .replace(/<\/(p|h\d|li)>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .split('\n')
      .map((l) => decode(l).trim())
      .filter(Boolean)
      .forEach((l) => blocks.push({ text: l, top: true }));
  };
  for (const m of h.matchAll(tableRe)) {
    flushOutside(h.slice(last, m.index));
    for (const row of m[0].match(/<tr[\s\S]*?<\/tr>/g) || []) {
      const cells = (row.match(/<t[dh][\s\S]*?<\/t[dh]>/g) || [])
        .map((c) => decode(c.replace(/<\/p>/g, '\n').replace(/<[^>]+>/g, '')).split('\n').map((x) => x.trim()).filter(Boolean).join('\n'))
        .filter((c) => c && !NUMBER_CELL.test(c.replace(/\n/g, ' ')));
      if (!cells.length || cells.every((c) => HEADER_CELL.test(c.trim()))) continue;
      blocks.push({ text: cells.join('\n'), top: false });
    }
    last = m.index + m[0].length;
  }
  flushOutside(h.slice(last));
  return blocks
    .map((b) => ({ ...b, text: unmarkHeadingUnderline(cleanText(b.text)) }))
    .filter((b) => b.text && !/^[\s.\-–_…]+$/.test(b.text));
}

const KEY_RE = /^(answer\s*key|answers?|model\s*answers?|solutions?|الإجابات|الاجابات|الإجابات النموذجية|مفتاح الإجابة|مفتاح الاجابة)\s*[:：]?$/i;

export async function parseDocx(buffer) {
  const images = {};
  let n = 0;
  const { value: html } = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: ['u => u'],
      convertImage: mammoth.images.imgElement(async (img) => {
        const id = ++n;
        if (!/^image\/(png|jpe?g|gif|webp|bmp)$/i.test(img.contentType)) return { src: 'IMGX' };
        const b64 = await img.read('base64');
        if (b64.length * 0.75 > MAX_IMG_BYTES) return { src: 'IMGX' };
        images[id] = `data:${img.contentType};base64,${b64}`;
        return { src: `IMG${id}` };
      }),
    }
  );

  let blocks = htmlToBlocks(html);

  // glue picture-only blocks onto the question above them
  const glued = [];
  for (const b of blocks) {
    if (/^(\[\[(IMG:\d+|FIGURE NOT IMPORTED)\]\]\s*)+$/.test(b.text) && glued.length) glued[glued.length - 1].text += '\n' + b.text;
    else glued.push({ ...b });
  }
  blocks = glued;

  // an answer key at the end of the document is attached to every chunk
  let key = '';
  const ki = blocks.findIndex((b, i) => b.top && KEY_RE.test(b.text) && i > blocks.length * 0.5);
  if (ki !== -1) {
    key = blocks.slice(ki).map((b) => b.text).join('\n').slice(0, 10000);
    blocks = blocks.slice(0, ki);
  }

  const chunks = [];
  let cur = [], flags = [], len = 0, imgs = [], section = '';
  let startSection = '';
  const push = () => {
    if (!cur.length) return;
    let text = (startSection ? `[SECTION: ${startSection}]\n\n` : '') + cur.join('\n-----\n');
    if (key) text += `\n\n[ANSWER KEY FROM THE END OF THE DOCUMENT]\n${key}`;
    chunks.push({ text, imageIds: [...new Set(imgs)] });
    cur = []; flags = []; len = 0; imgs = []; startSection = section;
  };
  for (const b of blocks) {
    if (b.top && b.text.length <= 80 && !/[\[\]]/.test(b.text)) section = b.text.replace(/^[.\s]+/, '');
    const ids = [...b.text.matchAll(/\[\[IMG:(\d+)\]\]/g)].map((m) => m[1]);
    if (cur.length && (len + b.text.length > TARGET_CHARS || cur.filter((_, k) => !flags[k]).length >= MAX_QUESTION_BLOCKS || new Set([...imgs, ...ids]).size > MAX_IMAGES_PER_CHUNK)) push();
    if (!cur.length) startSection = section;
    cur.push(b.text);
    flags.push(b.top);
    len += b.text.length + 7;
    imgs.push(...ids);
  }
  push();
  return { chunks, images, imageCount: Object.keys(images).length };
}
