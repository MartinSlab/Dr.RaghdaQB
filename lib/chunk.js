// Splits the document text into chunks at question boundaries, so each AI call is short.
// If an answer key sits at the end of the document, it is attached to every chunk.
const TARGET = 2600;

function normalizeTableText(raw) {
  return raw
    .replace(/\r/g, '')
    .replace(/\t+/g, '\n')
    .replace(/([A-Da-d][\)\.])\s*(?=[A-Da-d][\)\.])/g, '$1\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitByParagraphs(text, maxLen = 2200) {
  const parts = text.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  const out = [];
  let cur = '';

  for (const p of parts) {
    const next = cur ? `${cur}\n\n${p}` : p;
    if (next.length <= maxLen) {
      cur = next;
      continue;
    }
    if (cur) out.push(cur);
    cur = p.length <= maxLen ? p : p.slice(0, maxLen);
  }
  if (cur) out.push(cur);
  return out;
}

export function splitDocument(raw) {
  const text = normalizeTableText(raw);
  let body = text;
  let key = '';

  const re = /^[ \t]*(answer\s*key|answers?|model\s*answers?|solutions?|الإجابات|الاجابات|الإجابات النموذجية|مفتاح الإجابة|مفتاح الاجابة)[ \t]*[:：]?[ \t]*$/gim;
  let m, last = null;
  while ((m = re.exec(text))) last = m;
  if (last && last.index > text.length * 0.5 && text.length - last.index <= 12000) {
    body = text.slice(0, last.index).trim();
    key = text.slice(last.index).trim();
  }

  const qStart = /^\s*(?:Q(?:uestion)?\.?\s*)?[\d٠-٩]+\s*[\.\)\-:]\s*\S|^\s*(?:[A-Da-d]\s*[\)\.]\s*\S|\([A-Da-d]\)\s*\S)|^\s*(?:Choose|No\.|Question|Answer)\s*$/i;
  const chunks = [];
  let cur = [];
  let len = 0;
  for (const line of body.split('\n')) {
    if (len > TARGET && qStart.test(line)) {
      chunks.push(cur.join('\n'));
      cur = [];
      len = 0;
    }
    cur.push(line);
    len += line.length + 1;
  }
  if (cur.length) chunks.push(cur.join('\n'));

  const final = [];
  for (const c of chunks.length ? chunks : splitByParagraphs(body, 2200)) {
    if (c.length <= 9000) { final.push(c); continue; }
    let rest = c;
    while (rest.length > 0) {
      let cut = Math.min(3500, rest.length);
      if (cut < rest.length) {
        const nl = rest.lastIndexOf('\n', cut);
        if (nl > 1000) cut = nl;
      }
      final.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
  }

  return final
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => (key ? `${c}\n\n[ANSWER KEY FROM THE END OF THE DOCUMENT]\n${key}` : c));
}
